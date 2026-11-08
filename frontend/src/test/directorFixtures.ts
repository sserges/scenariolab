import type {
  DirectorChoice,
  DirectorReplayHistory,
  DirectorReplayResponse,
  DirectorProposalResponse,
  DirectorTurnRecord,
  DirectorTurnResponse,
  GameState,
  MetricChange,
  SignedDirectorProposal,
} from "../lib/api";
import {
  gameStartFixture,
  gameTurnFixture,
} from "./scenarioFixtures";

const digest = "a".repeat(64);
const signature = {
  algorithm: "HMAC-SHA256" as const,
  key_id: "director-test",
  value: "A".repeat(43),
};

export const directorChoicesFixture: DirectorChoice[] = [
  {
    choice_id: "director-choice-demand-test-1",
    title: "Fund a demand test",
    description: "Spend carefully to learn which customers will stay.",
    effects: [{ metric_id: "cash", operator: "subtract", value: 250_000 }],
  },
  {
    choice_id: "director-choice-overhead-2",
    title: "Reduce overhead now",
    description: "Simplify operations and protect the runway.",
    effects: [{ metric_id: "monthly-expenses", operator: "subtract", value: 500_000 }],
  },
  {
    choice_id: "director-choice-retain-team-3",
    title: "Protect the core team",
    description: "Invest in retention and preserve team confidence.",
    effects: [{ metric_id: "team-morale", operator: "add", value: 3 }],
  },
];

export function signedProposalFor(state: GameState, turn = state.current_turn): SignedDirectorProposal {
  const previousDecision = state.decision_history.at(-1);
  return {
    payload: {
      record_format_version: 1,
      context_version: "1",
      profile_id: "startup-survival-director",
      profile_version: "1.0.0",
      scenario_id: "startup-survival",
      scenario_version: "1.0.0",
      seed: 42,
      turn,
      previous_state_digest: digest,
      previous_history_digest: digest,
      context_digest: digest,
      context_snapshot: {
        context_version: "1",
        scenario_id: "startup-survival",
        scenario_version: "1.0.0",
        profile_id: "startup-survival-director",
        profile_version: "1.0.0",
        seed: 42,
        turn,
        metric_values: { ...state.metric_values },
        recent_action_ids: previousDecision === undefined ? [] : [previousDecision.action_id],
        recent_event_ids: previousDecision?.event_id === null || previousDecision?.event_id === undefined ? [] : [previousDecision.event_id],
        recent_beats: [],
        recent_headline_digests: [],
      },
      source: "fallback",
      situation: {
        situation_id: `director-situation-${turn}`,
        beat_id: "supplier",
        headline: `Supplier terms need a decision ${turn}`,
        description: "A supplier has offered revised terms. Choose how the company should respond.",
      },
      choices: directorChoicesFixture,
    },
    signature,
  };
}

export function proposalResponseFor(state: GameState): DirectorProposalResponse {
  const proposal = signedProposalFor(state);
  return {
    scenario_id: "startup-survival",
    scenario_version: "1.0.0",
    seed: 42,
    state,
    proposal,
    previews: proposal.payload.choices.map((choice, index) => ({
      choice_id: choice.choice_id,
      metric_changes: previewChanges(state, index),
      projected_status: "active",
      outcome_reason: "turn-completed",
      scripted_event_id: index === 0 ? "competitor-price-cut" : null,
      scripted_event_title: index === 0 ? "Competitor Price Cut" : null,
    })),
  };
}

export function turnResponseFor(
  proposal: SignedDirectorProposal,
  choiceId = proposal.payload.choices[0]!.choice_id,
): DirectorTurnResponse {
  const baseResult = gameTurnFixture.turn_result;
  const choice = proposal.payload.choices.find((item) => item.choice_id === choiceId);
  if (choice === undefined) throw new Error("Director choice fixture is missing");
  const state: GameState = {
    ...gameTurnFixture.state,
    decision_history: gameTurnFixture.state.decision_history.map((record) => ({
      ...record,
      action_id: choice.choice_id,
      action_title: choice.title,
    })),
  };
  const result = {
    ...baseResult,
    new_state: state,
    selected_action: {
      action_id: choice.choice_id,
      title: choice.title,
      description: choice.description,
    },
  };
  const record: DirectorTurnRecord = {
    proposal,
    selected_choice_id: choiceId,
    receipt: {
      payload: {
        record_format_version: 1,
        profile_id: proposal.payload.profile_id,
        profile_version: proposal.payload.profile_version,
        scenario_id: proposal.payload.scenario_id,
        scenario_version: proposal.payload.scenario_version,
        seed: proposal.payload.seed,
        turn: proposal.payload.turn,
        previous_state_digest: digest,
        previous_history_digest: digest,
        proposal_digest: digest,
        selected_choice_id: choiceId,
        resulting_state_digest: digest,
        result_digest: digest,
      },
      signature,
    },
  };
  return {
    scenario_id: "startup-survival",
    scenario_version: "1.0.0",
    seed: 42,
    state,
    turn_result: result,
    turn_record: record,
  };
}

export function directorHistoryFixture(
  records: DirectorTurnRecord[] = [],
): DirectorReplayHistory {
  return {
    format_version: 2,
    mode: "director",
    scenario_id: "startup-survival",
    scenario_version: "1.0.0",
    seed: 42,
    profile_id: "startup-survival-director",
    profile_version: "1.0.0",
    turn_records: records,
  };
}

export function directorReplayResponseFor(
  history: DirectorReplayHistory,
  state: GameState,
  latestRecord: DirectorTurnRecord | null,
  latestResult: DirectorTurnResponse["turn_result"] | null,
): DirectorReplayResponse {
  return {
    scenario_id: history.scenario_id,
    scenario_version: history.scenario_version,
    seed: history.seed,
    state,
    latest_turn_record: latestRecord,
    latest_turn_result: latestResult,
  };
}

function previewChanges(state: GameState, index: number): MetricChange[] {
  if (index === 0) {
    return [{ metric_id: "cash", previous_value: state.metric_values.cash ?? 0, new_value: (state.metric_values.cash ?? 0) - 250_000, delta: -250_000, exhausted: false, attempted_value: null }];
  }
  if (index === 1) {
    return [{ metric_id: "monthly-expenses", previous_value: state.metric_values["monthly-expenses"] ?? 0, new_value: (state.metric_values["monthly-expenses"] ?? 0) - 500_000, delta: -500_000, exhausted: false, attempted_value: null }];
  }
  return [{ metric_id: "team-morale", previous_value: state.metric_values["team-morale"] ?? 0, new_value: (state.metric_values["team-morale"] ?? 0) + 3, delta: 3, exhausted: false, attempted_value: null }];
}

export const directorInitialProposalFixture = proposalResponseFor(gameStartFixture.state);
