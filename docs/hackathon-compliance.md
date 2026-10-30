# Hackathon Compliance Tracker

## Status legend

- **Project requirement:** supplied directly for ScenarioLab; not presented as an official hackathon rule.
- **Unverified:** believed or supplied to apply, but must be confirmed against an official 2026 hackathon source.
- **Confirmed:** verified against an official source with a link and access date.

No hackathon rule is currently marked confirmed because no official rules, submission page, or eligibility document has been inspected during Brick 1.

## Working requirements

| Item | Current status | Evidence / action needed |
| --- | --- | --- |
| Event name: “Build Your First AI App 2026” | Unverified | Confirm the official event name and organizer |
| Official submission deadline: Nov 27, 2026 at 3:00 PM Mountain Time | Unverified | Confirm date, year, time zone, daylight/standard-time wording, and submission portal behavior |
| Internal submission target: Nov 25, 2026 | Project requirement | Team planning target; no external confirmation needed |
| ScenarioLab must be an AI-powered app | Project requirement; official relevance unverified | Map product AI features to official judging/eligibility language |
| Required deliverables | Unverified | Check whether source code, deployed URL, video, slides, screenshots, write-up, or model disclosure are required |
| Team eligibility and team-size limits | Unverified | Confirm participant, age, geography, affiliation, and team-size rules |
| Build-period / pre-existing-code restrictions | Unverified | Confirm what may predate the event and what must be created during it |
| Required or prohibited technologies | Unverified | Confirm sponsor APIs, model requirements, open-source restrictions, and hosting constraints |
| Repository visibility and licensing | Unverified | Confirm whether the repo must be public and whether a license is required |
| AI/content/data policy | Unverified | Confirm rules for generated content, third-party documents, URLs, privacy, and attribution |
| Judging criteria and category | Unverified | Record criteria, weighting, prize category, and tie-break rules |
| Demo availability requirements | Unverified | Confirm whether judges require credentials, uptime window, or a no-login path |

## ScenarioLab compliance posture

The project is designed to make responsible AI behavior demonstrable:

- Python, not an LLM, calculates authoritative numeric outcomes.
- AI-generated events and definitions are treated as candidate data and validated before use.
- AI-generated code is never executed.
- An allowlisted effect and predicate language prevents arbitrary execution.
- Engine outcome records ground generated explanations.
- Seeded fallback events preserve the full gameplay loop when the AI API fails.
- A provider adapter permits configuration without coupling the engine to a vendor.
- Imported documents and URLs will be treated as untrusted data with provenance, size limits, and prompt-injection defenses.
- The MVP can be demonstrated deterministically using a fake provider and fallback path.

These are product design choices, not claims that a particular hackathon rule requires them.

## Evidence to collect during development

- Official rules and submission URLs, captured with access dates
- Eligibility and team roster confirmation
- Required account, API, or sponsor-technology evidence
- Architecture diagram and explanation of the deterministic/AI boundary
- Automated test results for validation, determinism, and fallback behavior
- Dependency and license inventory
- Data-source provenance and permissions for any imported demo content
- Deployed demo URL and judge-friendly access instructions, if required
- Short demo video and backup recording, if required
- Screenshots showing the 12-turn loop, charts, history, fallback, and ending report
- Submission confirmation and immutable references to the submitted version

## Confirmation procedure

Before implementation choices are justified as “hackathon compliant”:

1. Locate the organizer's official 2026 rules and submission page.
2. Record each source URL and the date accessed.
3. Quote or accurately summarize the relevant requirement without relying on prior-year rules.
4. Replace `Unverified` with `Confirmed` only when the source directly supports the claim.
5. Add an owner and due date for any unresolved requirement that could block submission.
6. Recheck the deadline and portal at the November 25 internal submission gate.

## Open compliance questions

1. What is the official rules URL and submission portal?
2. Is 3:00 PM “Mountain” specified as MST, MDT, or a named local time zone? On November 27, Denver observes standard time, but the official wording controls.
3. Which artifacts and maximum video length/file sizes are required?
4. Must ScenarioLab be deployed publicly, and must judges be able to access it without credentials?
5. Are there required AI providers, sponsor tools, or disclosure statements?
6. Are prompt-to-scenario and document/URL ingestion permitted with third-party material?
7. Are there restrictions on pre-existing templates, libraries, or AI-assisted development?
8. What judging category and criteria best fit ScenarioLab?
