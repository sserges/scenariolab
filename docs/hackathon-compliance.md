# Hackathon Compliance Tracker

## Status legend

- **Project requirement:** supplied directly for ScenarioLab; not presented as an official hackathon rule.
- **Unverified:** believed or supplied to apply, but must be confirmed against an official 2026 hackathon source.
- **Confirmed:** verified against an official source with a link and access date.

## Official references

Inspected October 29, 2026:

- [Build Your First AI App overview and submission requirements](https://build-your-first-ai-app.devpost.com/)
- [Build Your First AI App official rules](https://build-your-first-ai-app.devpost.com/rules)

The event requirements below are confirmed from those pages. A published event rule does not by itself confirm that a particular participant meets the rule or has completed registration.

## Working requirements

| Item | Current status | Evidence / action needed |
| --- | --- | --- |
| Event name: “Build Your First AI App 2026” | Confirmed | Official Devpost overview, accessed Oct 29, 2026 |
| Student eligibility applies | Confirmed | Rules require eligible students; the overview also lists “Students only” |
| Personal participant eligibility | Unverified | Confirm student status plus applicable age, geography, and Devpost platform requirements |
| Completed Devpost registration | Unverified | Participant must confirm they joined the event with the intended Devpost account |
| Official submission deadline: Nov 27, 2026 at 5:00 PM EST | Confirmed | Deadline displayed on the official overview and rules pages |
| Internal submission target: Nov 25, 2026 | Project requirement | Team planning target; no external confirmation needed |
| Working prototype | Confirmed | Required deliverable: functional application, prototype, or demonstrable proof of concept |
| AI implementation explanation | Confirmed | Must identify the model, API, library, or tool and explain its contribution |
| Accessible source code | Confirmed | Must provide a GitHub repository or another accessible source-code link, where applicable |
| README | Confirmed | Must explain setup, features, technologies, and how to try the project |
| Demo | Confirmed | A short demonstration video or screenshots must show the main features |
| Participant contributions | Confirmed | Must describe what was built, what was learned, and any AI-assisted development tools used |
| AI coding assistants permitted with disclosure | Confirmed | Rules permit them with credit, tool disclosure, and identification of the participant's own contribution |
| Team-size limits | Unverified | Rules permit teams subject to configured team requirements; confirm the configured limit |
| Build-period / pre-existing-code restrictions | Unverified | Confirm what may predate the event and what must be created during it |
| Repository visibility and licensing | Unverified | Source must be accessible; confirm whether public visibility and a specific license are required |
| AI/content/data policy | Unverified | Confirm rules for generated content, third-party documents, URLs, privacy, and attribution |
| Judging criteria | Confirmed | Creativity 25%, implementation 30%, usefulness 25%, presentation/documentation 20% |
| Demo availability details | Unverified | Confirm video duration, screenshot limits, credentials, uptime window, and no-login expectations |

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

- Personal eligibility, completed Devpost registration, and team roster confirmation
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

1. Use the official 2026 Devpost overview and rules linked above.
2. Record the access date for any new or changed requirement.
3. Quote or accurately summarize the relevant requirement without relying on prior-year rules.
4. Replace `Unverified` with `Confirmed` only when the source directly supports the claim.
5. Add an owner and due date for any unresolved requirement that could block submission.
6. Recheck the deadline, deliverables, and portal at the November 25 internal submission gate.

## Open compliance questions

1. Does the intended participant personally meet the student, age, geographic, and platform eligibility requirements?
2. Has the intended participant completed Devpost registration and joined the hackathon?
3. What team-size limit is configured for the event?
4. What video duration, screenshot count, file sizes, and submission-field limits apply?
5. Must ScenarioLab be deployed publicly, and must judges be able to access it without credentials?
6. Are prompt-to-scenario and document/URL ingestion permitted with third-party material?
7. Are there build-period restrictions on pre-existing templates or libraries beyond disclosed attribution?
