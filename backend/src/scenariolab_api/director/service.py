from __future__ import annotations

import re
from hashlib import sha256

from pydantic import ValidationError
from scenariolab_api.config import Settings
from scenariolab_api.director.canonical import digest
from scenariolab_api.director.diagnostics import (
    DirectorDiagnosticCode,
    record_director_diagnostic,
    schema_diagnostic_code,
)
from scenariolab_api.director.fallback import ordered_fallback_candidates
from scenariolab_api.director.generation import DirectorGenerationService, create_director_generation_service
from scenariolab_api.director.models import (
    DirectorChoice,
    DirectorChoiceCandidate,
    DirectorChoicePreview,
    DirectorContextSnapshot,
    DirectorEffect,
    DirectorGeneratedProposal,
    DirectorGenerationContext,
    DirectorPromptDecision,
    DirectorPromptEvent,
    DirectorPromptMetric,
    DirectorPromptObjective,
    DirectorProposalPayload,
    DirectorProposalRequest,
    DirectorProposalResponse,
    DirectorReceiptPayload,
    DirectorReplayHistory,
    DirectorReplayRequest,
    DirectorReplayResponse,
    DirectorSituation,
    DirectorTurnRecord,
    DirectorTurnRequest,
    DirectorTurnResponse,
    SignedDirectorProposal,
    SignedDirectorReceipt,
)
from scenariolab_api.director.profile import STARTUP_SURVIVAL_DIRECTOR_PROFILE
from scenariolab_api.director.security import (
    DirectorSigner,
    InvalidSignature,
    SigningUnavailable,
)
from scenariolab_api.domain.enums import GameStatus, MetricKind, MetricUnit
from scenariolab_api.domain.models import ActionEffect, GameState, ScenarioAction, ScenarioDefinition
from scenariolab_api.engine import EngineError, TurnResult, initialize_game, resolve_transient_action
from scenariolab_api.scenarios.startup_survival import STARTUP_SURVIVAL


class DirectorFailure(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        diagnostic_code: DirectorDiagnosticCode | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.diagnostic_code = diagnostic_code


class DirectorService:
    """Validated live Director proposal with deterministic authored fallback."""

    def __init__(
        self,
        settings: Settings,
        generation: DirectorGenerationService | None = None,
    ) -> None:
        self._settings = settings
        self._profile = STARTUP_SURVIVAL_DIRECTOR_PROFILE
        self._generation = generation or create_director_generation_service(settings)

    def replay(self, history: DirectorReplayHistory) -> tuple[GameState, TurnResult | None]:
        self._require_enabled()
        signer = self._signer()
        definition = self._definition(history)
        state = initialize_game(definition, history.seed)
        previous_result: TurnResult | None = None
        prefix: tuple[DirectorTurnRecord, ...] = ()

        if len(history.turn_records) > definition.turn.max_turns:
            raise DirectorFailure(422, "invalid_director_history", "Director history exceeds the scenario turn limit.")

        for index, record in enumerate(history.turn_records, start=1):
            if state.status in {GameStatus.WON, GameStatus.LOST}:
                raise DirectorFailure(422, "invalid_director_history", "Director history contains decisions after a terminal turn.")
            self._verify_proposal(record.proposal, history, state, prefix, signer)
            self._validate_proposal_and_preview(definition, state, record.proposal.payload)
            choice = self._find_choice(record.proposal.payload.choices, record.selected_choice_id)
            proposal_digest = signer.proposal_digest(record.proposal.payload)
            try:
                previous_result = self._resolve_choice(
                    definition,
                    state,
                    choice,
                    proposal_digest=proposal_digest,
                )
            except EngineError as error:
                raise DirectorFailure(422, "invalid_director_history", f"Director history is invalid at turn {index}.") from error

            self._verify_receipt(
                record.receipt,
                proposal=record.proposal,
                selected_choice_id=record.selected_choice_id,
                history=history,
                state=state,
                previous_records=prefix,
                result=previous_result,
                signer=signer,
            )
            state = previous_result.new_state
            prefix = (*prefix, record)

        return state, previous_result

    def propose(
        self,
        request: DirectorProposalRequest,
        *,
        caller_key: str = "unknown",
    ) -> DirectorProposalResponse:
        state, _ = self.replay(request)
        if state.status in {GameStatus.WON, GameStatus.LOST}:
            raise DirectorFailure(409, "game_already_complete", "A terminal game cannot receive another Director proposal.")
        signer = self._signer()
        context = self._context(state, request.turn_records)
        context_digest = signer.context_digest(context)
        previous_state_digest = signer.state_digest(state)
        previous_history_digest = self._history_digest(request, request.turn_records)
        definition = self._definition(request)

        if (
            self._settings.director_live_generation_enabled
            and self._settings.ai_enabled
        ):
            generation_context = self._generation_context(definition, state, context)
            candidate = self._generation.get_cached(generation_context)
            if candidate is None:
                candidate = self._generation.generate_once(
                    generation_context,
                    caller_key=caller_key,
                )
            if candidate is not None:
                try:
                    live_payload = self._build_live_payload(
                        history=request,
                        candidate=candidate,
                        context=context,
                        context_digest=context_digest,
                        previous_state_digest=previous_state_digest,
                        previous_history_digest=previous_history_digest,
                    )
                    live_previews = self._validate_proposal_and_preview(
                        definition,
                        state,
                        live_payload,
                    )
                except DirectorFailure as error:
                    # Invalid provider content is rejected as one proposal; no effect is edited.
                    record_director_diagnostic(
                        error.diagnostic_code or DirectorDiagnosticCode.SEMANTIC_VALIDATION_FAILURE
                    )
                except ValidationError as error:
                    record_director_diagnostic(schema_diagnostic_code(error))
                else:
                    self._generation.cache_validated(generation_context, candidate)
                    return self._signed_response(
                        definition,
                        request,
                        state,
                        live_payload,
                        live_previews,
                        signer,
                    )

        last_failure: DirectorFailure | None = None
        for situation, candidates in ordered_fallback_candidates(context):
            payload = self._build_payload(
                history=request,
                situation=situation,
                candidates=candidates,
                context=context,
                context_digest=context_digest,
                previous_state_digest=previous_state_digest,
                previous_history_digest=previous_history_digest,
            )
            try:
                previews = self._validate_proposal_and_preview(definition, state, payload)
            except DirectorFailure as error:
                last_failure = error
                continue
            return self._signed_response(
                definition,
                request,
                state,
                payload,
                previews,
                signer,
            )
        if last_failure is not None:
            raise DirectorFailure(409, "no_valid_fallback", "No authored fallback proposal is valid for the current state.") from last_failure
        raise DirectorFailure(409, "no_valid_fallback", "No authored fallback proposal is available for the current state.")

    def take_turn(self, request: DirectorTurnRequest) -> DirectorTurnResponse:
        state, _ = self.replay(request)
        if state.status in {GameStatus.WON, GameStatus.LOST}:
            raise DirectorFailure(409, "game_already_complete", "A terminal game cannot accept another Director choice.")
        signer = self._signer()
        self._verify_proposal(request.proposal, request, state, request.turn_records, signer)
        definition = self._definition(request)
        self._validate_proposal_and_preview(definition, state, request.proposal.payload)
        selected_choice = self._find_choice(request.proposal.payload.choices, request.selected_choice_id)
        proposal_digest = signer.proposal_digest(request.proposal.payload)
        try:
            result = self._resolve_choice(
                definition,
                state,
                selected_choice,
                proposal_digest=proposal_digest,
            )
        except EngineError as error:
            raise DirectorFailure(422, "invalid_director_choice", "The selected Director choice cannot be resolved.") from error

        receipt_payload = DirectorReceiptPayload(
            profile_id=self._profile.profile_id,
            profile_version=self._profile.version,
            scenario_id=definition.scenario_id,
            scenario_version=definition.version,
            seed=request.seed,
            turn=state.current_turn,
            previous_state_digest=signer.state_digest(state),
            previous_history_digest=self._history_digest(request, request.turn_records),
            proposal_digest=proposal_digest,
            selected_choice_id=request.selected_choice_id,
            resulting_state_digest=signer.state_digest(result.new_state),
            result_digest=signer.result_digest(result),
        )
        receipt_signature = signer.sign(
            receipt_payload,
            domain="director-receipt",
            key_id=request.proposal.signature.key_id,
        )
        receipt = SignedDirectorReceipt(payload=receipt_payload, signature=receipt_signature)
        try:
            turn_record = DirectorTurnRecord(
                proposal=request.proposal,
                selected_choice_id=request.selected_choice_id,
                receipt=receipt,
            )
            # Enforce the complete v2 transcript limit before returning a record
            # that a browser could not later submit for authoritative replay.
            DirectorReplayHistory(
                format_version=request.format_version,
                mode=request.mode,
                scenario_id=request.scenario_id,
                scenario_version=request.scenario_version,
                seed=request.seed,
                profile_id=request.profile_id,
                profile_version=request.profile_version,
                turn_records=(*request.turn_records, turn_record),
            )
        except ValidationError as error:
            raise DirectorFailure(413, "director_history_too_large", "Director turn record exceeds the replay size limit.") from error
        return DirectorTurnResponse(
            scenario_id=definition.scenario_id,
            scenario_version=definition.version,
            seed=request.seed,
            state=result.new_state,
            turn_result=result,
            turn_record=turn_record,
        )

    def replay_response(self, history: DirectorReplayRequest) -> DirectorReplayResponse:
        state, latest_result = self.replay(history)
        pending_previews = ()
        if history.pending_proposal is not None:
            if state.status in {GameStatus.WON, GameStatus.LOST}:
                raise DirectorFailure(409, "stale_pending_proposal", "A terminal game cannot restore a pending proposal.")
            signer = self._signer()
            self._verify_proposal(
                history.pending_proposal,
                history,
                state,
                history.turn_records,
                signer,
            )
            pending_previews = self._validate_proposal_and_preview(
                self._definition(history),
                state,
                history.pending_proposal.payload,
            )
        return DirectorReplayResponse(
            scenario_id=history.scenario_id,
            scenario_version=history.scenario_version,
            seed=history.seed,
            state=state,
            latest_turn_record=history.turn_records[-1] if history.turn_records else None,
            latest_turn_result=latest_result,
            pending_proposal=history.pending_proposal,
            pending_previews=pending_previews,
        )

    def _require_enabled(self) -> None:
        if not self._settings.director_enabled:
            raise DirectorFailure(503, "director_disabled", "Director mode is disabled by backend configuration.")

    def _signer(self) -> DirectorSigner:
        self._require_enabled()
        try:
            return DirectorSigner.from_settings(self._settings)
        except SigningUnavailable as error:
            raise DirectorFailure(503, "director_signing_unavailable", "Director signing is not configured.") from error

    def _definition(self, run: DirectorReplayHistory) -> ScenarioDefinition:
        if run.scenario_id != self._profile.scenario_id or run.scenario_version != self._profile.scenario_version:
            raise DirectorFailure(409, "unsupported_director_scenario", "The Director profile does not support this scenario version.")
        if run.profile_id != self._profile.profile_id or run.profile_version != self._profile.version:
            raise DirectorFailure(409, "unsupported_director_profile", "The Director profile version is not supported.")
        definition = STARTUP_SURVIVAL
        definition_metric_ids = {metric.metric_id for metric in definition.metrics}
        profile_metric_ids = {rule.metric_id for rule in self._profile.metrics}
        if definition_metric_ids != profile_metric_ids:
            raise DirectorFailure(500, "director_profile_mismatch", "Director profile metric allowlist does not match the pinned scenario.")
        metrics = {metric.metric_id: metric for metric in definition.metrics}
        if any(
            metrics[metric_id].kind is not MetricKind.MONEY
            or metrics[metric_id].unit is not MetricUnit.CENTS
            for metric_id in ("cash", "monthly-revenue", "monthly-expenses")
        ):
            raise DirectorFailure(500, "director_profile_mismatch", "Director financial policy requires integer cents.")
        return definition

    def _context(
        self,
        state: GameState,
        records: tuple[DirectorTurnRecord, ...],
    ) -> DirectorContextSnapshot:
        headlines = tuple(
            _headline_digest(record.proposal.payload.situation.headline)
            for record in records
        )
        return DirectorContextSnapshot(
            context_version="1",
            scenario_id=state.scenario_id,
            scenario_version=state.scenario_version,
            profile_id=self._profile.profile_id,
            profile_version=self._profile.version,
            seed=state.seed.seed,
            turn=state.current_turn,
            metric_values=dict(state.metric_values),
            recent_action_ids=tuple(record.action_id for record in state.decision_history[-3:]),
            recent_event_ids=tuple(
                record.event_id
                for record in state.decision_history[-3:]
                if record.event_id is not None
            ),
            recent_beats=tuple(
                record.proposal.payload.situation.beat_id
                for record in records[-3:]
            ),
            recent_headline_digests=headlines,
        )

    def _generation_context(
        self,
        definition: ScenarioDefinition,
        state: GameState,
        context: DirectorContextSnapshot,
    ) -> DirectorGenerationContext:
        event_by_id = {event.event_id: event for event in definition.events}
        recent_decisions = tuple(
            DirectorPromptDecision(
                turn=decision.turn,
                action_title=decision.action_title,
                resulting_status=decision.resulting_status,
                outcome_reason=decision.outcome_reason,
                event_title=(
                    event_by_id[decision.event_id].title
                    if decision.event_id in event_by_id
                    else None
                ),
                changed_metrics=tuple(
                    change.metric_id
                    for change in decision.metric_changes
                    if change.delta != 0
                ),
            )
            for decision in state.decision_history[-3:]
        )
        turn_events = tuple(
            DirectorPromptEvent(
                event_id=event.event_id,
                title=event.title,
                description=event.description[:240],
            )
            for event in definition.events
            if event.trigger.earliest_turn <= state.current_turn + 2
            and (
                event.trigger.latest_turn is None
                or event.trigger.latest_turn >= state.current_turn
            )
        )
        objectives = tuple(
            DirectorPromptObjective(
                condition_id=condition.condition_id,
                title=condition.title,
                description=condition.description[:240],
            )
            for condition in (*definition.win_conditions, *definition.loss_conditions)
        )
        return DirectorGenerationContext(
            scenario_id=definition.scenario_id,
            scenario_version=definition.version,
            scenario_title=definition.title,
            scenario_objective=definition.metadata.objective[:240],
            turn=state.current_turn,
            remaining_turns=max(0, state.max_turns - state.current_turn + 1),
            metrics=tuple(
                DirectorPromptMetric(
                    metric_id=metric.metric_id,
                    title=metric.title,
                    unit=metric.unit.value,
                    value=state.metric_values[metric.metric_id],
                    min_value=metric.min_value,
                    max_value=metric.max_value,
                )
                for metric in definition.metrics
            ),
            recent_decisions=recent_decisions,
            recent_director_families=context.recent_beats,
            recent_headline_digests=context.recent_headline_digests,
            relevant_curated_events=turn_events,
            objectives=objectives,
            policy=self._profile,
        )

    def _build_live_payload(
        self,
        *,
        history: DirectorReplayHistory,
        candidate: DirectorGeneratedProposal,
        context: DirectorContextSnapshot,
        context_digest: str,
        previous_state_digest: str,
        previous_history_digest: str,
    ) -> DirectorProposalPayload:
        situation_digest = digest(
            {"context_digest": context_digest, "candidate": candidate.model_dump(mode="json")},
            domain="director-live-situation",
        )
        situation = DirectorSituation(
            situation_id=f"director-live-{situation_digest[:24]}",
            beat_id=candidate.situation.beat_id,
            headline=candidate.situation.headline,
            description=candidate.situation.description,
        )
        if situation.beat_id in context.recent_beats[-3:]:
            raise DirectorFailure(
                422,
                "repeated_director_situation",
                "Generated situation repeats a recent family.",
                diagnostic_code=DirectorDiagnosticCode.SEMANTIC_VALIDATION_FAILURE,
            )
        headline_digest = _headline_digest(situation.headline)
        if headline_digest in context.recent_headline_digests:
            raise DirectorFailure(
                422,
                "repeated_director_situation",
                "Generated situation repeats a recent headline.",
                diagnostic_code=DirectorDiagnosticCode.SEMANTIC_VALIDATION_FAILURE,
            )
        narrative_texts = [situation.headline, situation.description]
        narrative_texts.extend(
            text
            for choice in candidate.choices
            for text in (choice.title, choice.description)
        )
        if any(re.search(r"\d", text) for text in narrative_texts):
            raise DirectorFailure(
                422,
                "invalid_director_proposal",
                "Generated narrative contains unsupported numeric claims.",
                diagnostic_code=DirectorDiagnosticCode.SEMANTIC_VALIDATION_FAILURE,
            )
        return self._build_payload(
            history=history,
            situation=situation,
            candidates=candidate.choices,
            context=context,
            context_digest=context_digest,
            previous_state_digest=previous_state_digest,
            previous_history_digest=previous_history_digest,
            source="live",
        )

    def _signed_response(
        self,
        definition: ScenarioDefinition,
        request: DirectorReplayHistory,
        state: GameState,
        payload: DirectorProposalPayload,
        previews: tuple[DirectorChoicePreview, ...],
        signer: DirectorSigner,
    ) -> DirectorProposalResponse:
        signature = signer.sign(payload, domain="director-proposal")
        return DirectorProposalResponse(
            scenario_id=definition.scenario_id,
            scenario_version=definition.version,
            seed=request.seed,
            state=state,
            proposal=SignedDirectorProposal(payload=payload, signature=signature),
            previews=previews,
        )
    def _history_digest(
        self,
        history: DirectorReplayHistory,
        records: tuple[DirectorTurnRecord, ...],
    ) -> str:
        identity = {
            "format_version": history.format_version,
            "mode": history.mode,
            "scenario_id": history.scenario_id,
            "scenario_version": history.scenario_version,
            "seed": history.seed,
            "profile_id": history.profile_id,
            "profile_version": history.profile_version,
            "turn_records": [record.model_dump(mode="json") for record in records],
        }
        return DirectorSigner.history_digest(identity)

    def _build_payload(
        self,
        *,
        history: DirectorReplayHistory,
        situation: DirectorSituation,
        candidates: tuple[DirectorChoiceCandidate, ...],
        context: DirectorContextSnapshot,
        context_digest: str,
        previous_state_digest: str,
        previous_history_digest: str,
        source: str = "fallback",
    ) -> DirectorProposalPayload:
        candidate_body = {
            "situation": situation.model_dump(mode="json"),
            "choices": [choice.model_dump(mode="json") for choice in candidates],
            "context_digest": context_digest,
        }
        candidate_digest = digest(candidate_body, domain="director-candidate")
        choices = tuple(
            DirectorChoice(
                choice_id=(
                    "director-choice-"
                    + sha256(
                        f"scenariolab/director-choice/v1\0{candidate_digest}\0{index}".encode("utf-8")
                    ).hexdigest()[:20]
                    + f"-{index + 1}"
                ),
                title=choice.title,
                description=choice.description,
                effects=choice.effects,
            )
            for index, choice in enumerate(candidates)
        )
        return DirectorProposalPayload(
            profile_id=self._profile.profile_id,
            profile_version=self._profile.version,
            context_version="1",
            scenario_id=history.scenario_id,
            scenario_version=history.scenario_version,
            seed=history.seed,
            turn=context.turn,
            previous_state_digest=previous_state_digest,
            previous_history_digest=previous_history_digest,
            context_digest=context_digest,
            context_snapshot=context,
            source=source,
            situation=situation,
            choices=choices,
        )

    def _verify_proposal(
        self,
        envelope: SignedDirectorProposal,
        history: DirectorReplayHistory,
        state: GameState,
        previous_records: tuple[DirectorTurnRecord, ...],
        signer: DirectorSigner,
    ) -> None:
        try:
            signer.verify(envelope.payload, envelope.signature, domain="director-proposal")
        except InvalidSignature as error:
            raise DirectorFailure(422, "invalid_director_signature", "Director proposal signature is invalid.") from error
        payload = envelope.payload
        expected_context = self._context(state, previous_records)
        expected_bindings = (
            payload.profile_id == self._profile.profile_id,
            payload.profile_version == self._profile.version,
            payload.scenario_id == history.scenario_id,
            payload.scenario_version == history.scenario_version,
            payload.seed == history.seed,
            payload.turn == state.current_turn == len(previous_records) + 1,
            payload.previous_state_digest == signer.state_digest(state),
            payload.previous_history_digest == self._history_digest(history, previous_records),
            payload.context_snapshot == expected_context,
            payload.context_digest == signer.context_digest(expected_context),
            payload.source in {"live", "fallback"},
        )
        if not all(expected_bindings):
            raise DirectorFailure(409, "stale_director_proposal", "Director proposal does not match the current game state and history.")

    def _validate_proposal_and_preview(
        self,
        definition: ScenarioDefinition,
        state: GameState,
        proposal: DirectorProposalPayload,
    ) -> tuple[DirectorChoicePreview, ...]:
        profile = self._profile
        if not profile.minimum_choices <= len(proposal.choices) <= profile.maximum_choices:
            raise DirectorFailure(
                422,
                "invalid_director_proposal",
                "Director proposal has an invalid number of choices.",
                diagnostic_code=DirectorDiagnosticCode.STRUCTURED_SCHEMA_FAILURE,
            )
        metric_rules = {rule.metric_id: rule for rule in profile.metrics}
        definition_metrics = {metric.metric_id: metric for metric in definition.metrics}
        if set(metric_rules) - set(definition_metrics):
            raise DirectorFailure(500, "director_profile_mismatch", "Director profile references an undeclared scenario metric.")

        fingerprints: set[tuple[tuple[str, str, int], ...]] = set()
        previews: list[DirectorChoicePreview] = []
        for choice in proposal.choices:
            if not 1 <= len(choice.effects) <= profile.maximum_effects_per_choice:
                raise DirectorFailure(
                    422,
                    "invalid_director_proposal",
                    "A Director choice has an invalid effect count.",
                    diagnostic_code=DirectorDiagnosticCode.EFFECT_LIMIT_VIOLATION,
                )
            if len(choice.effects) > profile.maximum_effects_per_turn:
                raise DirectorFailure(
                    422,
                    "invalid_director_proposal",
                    "A Director choice exceeds the per-turn effect limit.",
                    diagnostic_code=DirectorDiagnosticCode.EFFECT_LIMIT_VIOLATION,
                )
            fingerprint = tuple(
                sorted((effect.metric_id, effect.operator, effect.value) for effect in choice.effects)
            )
            if fingerprint in fingerprints:
                raise DirectorFailure(
                    422,
                    "invalid_director_proposal",
                    "Director choices must have distinct effects.",
                    diagnostic_code=DirectorDiagnosticCode.SEMANTIC_VALIDATION_FAILURE,
                )
            fingerprints.add(fingerprint)

            per_metric_totals: dict[str, int] = {}
            total_cash_debit = 0
            for effect in choice.effects:
                rule = metric_rules.get(effect.metric_id)
                if rule is None or effect.metric_id not in definition_metrics:
                    raise DirectorFailure(
                        422,
                        "invalid_director_effect",
                        "Director effect references an unsupported metric.",
                        diagnostic_code=DirectorDiagnosticCode.UNKNOWN_METRIC,
                    )
                if effect.operator not in rule.operators:
                    raise DirectorFailure(
                        422,
                        "invalid_director_effect",
                        "Director effect uses an unsupported operator for its metric.",
                        diagnostic_code=DirectorDiagnosticCode.UNKNOWN_OPERATOR,
                    )
                if effect.value > rule.max_effect_value:
                    raise DirectorFailure(
                        422,
                        "invalid_director_effect",
                        "Director effect exceeds its per-effect limit.",
                        diagnostic_code=DirectorDiagnosticCode.EFFECT_LIMIT_VIOLATION,
                    )
                per_metric_totals[effect.metric_id] = per_metric_totals.get(effect.metric_id, 0) + effect.value
                metric = definition_metrics[effect.metric_id]
                if (
                    effect.operator == "subtract"
                    and metric.kind in {MetricKind.MONEY, MetricKind.RESOURCE}
                    and effect.value > state.metric_values[effect.metric_id]
                ):
                    raise DirectorFailure(
                        422,
                        "director_unaffordable_choice",
                        "Director choice spends or removes more than the current resource allows.",
                        diagnostic_code=DirectorDiagnosticCode.UNAFFORDABLE_CHOICE,
                    )
                if effect.metric_id == "cash" and effect.operator == "subtract":
                    total_cash_debit += effect.value
            if any(
                total > metric_rules[metric_id].max_turn_total
                for metric_id, total in per_metric_totals.items()
            ):
                raise DirectorFailure(
                    422,
                    "invalid_director_effect",
                    "Director effects exceed a per-turn metric limit.",
                    diagnostic_code=DirectorDiagnosticCode.EFFECT_LIMIT_VIOLATION,
                )
            if total_cash_debit > profile.maximum_cash_debit_per_turn:
                raise DirectorFailure(
                    422,
                    "invalid_director_effect",
                    "Director choice exceeds the cash debit limit.",
                    diagnostic_code=DirectorDiagnosticCode.EFFECT_LIMIT_VIOLATION,
                )

            action = self._as_action(choice, definition)
            try:
                result = resolve_transient_action(
                    definition,
                    state,
                    action,
                    provenance_digest=DirectorSigner.proposal_digest(proposal),
                )
            except EngineError as error:
                raise DirectorFailure(
                    422,
                    "invalid_director_effect",
                    "Director choice cannot complete a valid full turn.",
                    diagnostic_code=DirectorDiagnosticCode.SEMANTIC_VALIDATION_FAILURE,
                ) from error
            previews.append(
                DirectorChoicePreview(
                    choice_id=choice.choice_id,
                    metric_changes=result.metric_changes,
                    projected_status=result.resulting_status,
                    outcome_reason=result.outcome_reason,
                    scripted_event_id=(
                        result.triggered_event.event_id if result.triggered_event else None
                    ),
                    scripted_event_title=(
                        result.triggered_event.title if result.triggered_event else None
                    ),
                )
            )
        return tuple(previews)

    def _as_action(
        self,
        choice: DirectorChoice,
        definition: ScenarioDefinition,
    ) -> ScenarioAction:
        metrics = {metric.metric_id: metric for metric in definition.metrics}
        effects = tuple(
            ActionEffect(
                metric_id=effect.metric_id,
                operator=effect.operator,
                value=effect.value,
                description=f"{effect.operator.title()} {metrics[effect.metric_id].title} by {effect.value}.",
            )
            for effect in choice.effects
        )
        return ScenarioAction(
            action_id=choice.choice_id,
            title=choice.title,
            description=choice.description,
            preconditions=(),
            effects=effects,
        )

    def _resolve_choice(
        self,
        definition: ScenarioDefinition,
        state: GameState,
        choice: DirectorChoice,
        *,
        proposal_digest: str,
    ) -> TurnResult:
        return resolve_transient_action(
            definition,
            state,
            self._as_action(choice, definition),
            provenance_digest=proposal_digest,
        )

    def _verify_receipt(
        self,
        receipt: SignedDirectorReceipt,
        *,
        proposal: SignedDirectorProposal,
        selected_choice_id: str,
        history: DirectorReplayHistory,
        state: GameState,
        previous_records: tuple[DirectorTurnRecord, ...],
        result: TurnResult,
        signer: DirectorSigner,
    ) -> None:
        try:
            signer.verify(receipt.payload, receipt.signature, domain="director-receipt")
        except InvalidSignature as error:
            raise DirectorFailure(422, "invalid_director_signature", "Director receipt signature is invalid.") from error
        receipt_payload = receipt.payload
        proposal_digest = signer.proposal_digest(proposal.payload)
        expected = (
            receipt_payload.profile_id == self._profile.profile_id,
            receipt_payload.profile_version == self._profile.version,
            receipt_payload.scenario_id == history.scenario_id,
            receipt_payload.scenario_version == history.scenario_version,
            receipt_payload.seed == history.seed,
            receipt_payload.turn == state.current_turn,
            receipt_payload.previous_state_digest == signer.state_digest(state),
            receipt_payload.previous_history_digest == self._history_digest(history, previous_records),
            receipt_payload.proposal_digest == proposal_digest,
            receipt_payload.selected_choice_id == selected_choice_id,
            receipt_payload.resulting_state_digest == signer.state_digest(result.new_state),
            receipt_payload.result_digest == signer.result_digest(result),
            receipt.signature.key_id == proposal.signature.key_id,
        )
        if not all(expected):
            raise DirectorFailure(422, "invalid_director_receipt", "Director receipt does not match the resolved turn.")

    @staticmethod
    def _find_choice(choices: tuple[DirectorChoice, ...], choice_id: str) -> DirectorChoice:
        choice = next((candidate for candidate in choices if candidate.choice_id == choice_id), None)
        if choice is None:
            raise DirectorFailure(422, "invalid_director_choice", "Selected choice is not in the signed proposal.")
        return choice


def _headline_digest(value: str) -> str:
    normalized = " ".join(value.casefold().split())
    return sha256(normalized.encode("utf-8")).hexdigest()
