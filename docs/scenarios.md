# Predefined Scenarios

All three official scenarios are validated `ScenarioDefinition` data in `backend/src/scenariolab_api/scenarios/` and run on the same generic engine (`engine/core.py`). The engine has no scenario-specific branches. Each turn uses the fixed phase order: action effects, recurring rules, one seeded event, then outcome evaluation. Effects that would leave a metric's declared bounds make that decision unavailable, or make that event ineligible. They are never clamped.

| Scenario | ID / version | Turns | Metrics | Decisions | Events | AI features |
| --- | --- | --- | --- | --- | --- | --- |
| Startup Survival | `startup-survival` 1.0.0 | 12 months | 7 | 3 | 3 | Scenario Director, live briefings (both off by default) |
| Cybersecurity Crisis | `cybersecurity-crisis` 1.0.0 | 12 rounds | 6 | 7 | 12 | None: Classic only, authored briefings |
| Space Colony | `space-colony` 1.0.0 | 12 cycles | 8 | 7 | 11 | None: Classic only, authored briefings |

AI scope is declared in the catalog (`ScenarioCatalogEntry.ai_features`), not inferred from scenario IDs. The briefing route uses a provider only for entries that opt into `live-briefings`. Every other scenario receives the deterministic authored fallback, even when `SCENARIOLAB_AI_ENABLED=true`. Director proposals stay pinned to the Startup Survival profile and return HTTP 409 `unsupported_director_scenario` for other scenarios.

## Cybersecurity Crisis

The player leads an incident-response team for 12 decision rounds.

**Core dynamic: escalation versus containment.** A recurring rule adds the current **Attacker Momentum** to **Threat Level** after every decision. Isolation lowers momentum but takes services offline. Threat hunts lower Threat Level directly but pause services for forensics. When momentum is low but footholds remain (Threat Level ≥ 25), the attacker can pivot back (*Attacker Pivots to New Access*). Durable containment therefore needs both levers. **Response Resources** (responder hours) never refill on their own. Resting the team gives the attacker room to advance, and external responders cost stakeholder trust.

| Metric | Start | Notes |
| --- | --- | --- |
| System Integrity | 72/100 | Loss at ≤ 20 |
| Threat Level | 30/100 | Rises by momentum each round; loss at ≥ 90 |
| Attacker Momentum | 4 /round | 0–10 |
| Operational Continuity | 90% | Loss at ≤ 25% |
| Stakeholder Trust | 70/100 | Loss at ≤ 15 |
| Response Resources | 140 hrs | Finite pool |

**Decisions:** Isolate Affected Systems, Patch and Harden Systems, Launch Threat Hunt, Brief Stakeholders Transparently, Restore Services and Rotate Staff, Engage External Responders, and Fail Over to Backup Site. Fail Over is situational: it appears only once continuity is 60% or lower.

**Events:** Targeted Phishing Campaign, Compromised Employee Credentials, Suspicious Lateral Movement, Ransomware Detonation, Third-Party Supplier Breach, Critical Vulnerability Disclosed, Attacker Pivots to New Access, Customer Data Exposure, Customer-Facing Service Disruption, Industry Threat Intelligence Shared (unlocked by transparent briefings), Attacker Infrastructure Taken Down, and Recovery Milestone Reached.

**Victory: Crisis Contained.** After round 12, Threat Level must be ≤ 45, System Integrity ≥ 45, continuity ≥ 50%, and trust ≥ 35. **Failures:** Network Takeover, Critical Infrastructure Compromised, Operations Collapse, Stakeholder Confidence Lost, and Crisis Unresolved (the turn-limit fallback).

## Space Colony

The player commands a 50-astronaut Mars colony for 12 mission cycles.

**Core dynamic: stocks and flows.** Oxygen, Food, and Energy are reserves measured in days of supply. Three recurring rules add each reserve's own **Balance** every cycle. A reserve that would go negative is exhausted at zero, the shortfall is recorded, and the run is lost. Infrastructure decisions improve future balances at an immediate cost: Overhaul Oxygen Generators, Expand Hydroponics Bay (plants also add oxygen), Deploy Additional Solar Arrays, and Run Habitat Maintenance. Emergency Rationing banks reserves now at a heavy morale cost. A Survey Expedition (at most two) can unlock a later Subsurface Ice Discovery.

| Metric | Start | Notes |
| --- | --- | --- |
| Oxygen Reserve / Balance | 30 days / −2 per cycle | Loss when exhausted |
| Food Stores / Balance | 36 days / −3 per cycle | Loss when exhausted |
| Energy Reserve / Balance | 34 days / −2 per cycle | Loss when exhausted |
| Crew Morale | 72/100 | Loss at ≤ 15 |
| Colony Integrity | 80/100 | Loss at ≤ 20 |

**Events:** Oxygen Scrubber Malfunction, Hydroponic Crop Blight, Solar Storm, Power Distribution Failure, Micrometeoroid Habitat Breach, Crew Conflict, Medical Emergency, Regional Dust Storm, Subsurface Ice Discovery, Resupply Lander Arrives, and Record Harvest.

**Victory: Colony Sustained.** After cycle 12, every reserve must be ≥ 10 days, Crew Morale ≥ 35, and Colony Integrity ≥ 40. **Failures:** Life Support Failure, Food Supplies Exhausted, Total Power Loss, Habitat Collapse, Crew Breakdown, and Colony Unsustainable (the turn-limit fallback).

## Balance evidence

These figures were measured with the real engine during Brick 9C tuning. The heuristic players evaluated each decision against alternative seeds' event draws, so they had no foresight of the actual roll.

| Check | Cybersecurity Crisis | Space Colony |
| --- | --- | --- |
| Balanced heuristic, 40 seeds | 40/40 wins | 40/40 wins |
| Other heuristic emphases | Containment-first and trust-first 40/40; continuity-first 27/40 | Infrastructure-first, stockpile-first, and crew-first 40/40 each |
| Uniformly random decisions | about 3% wins | about 10% wins |
| Random runs without an available decision | 0 of 5,000 | 0 of 5,000 |

Repeatedly preferring any single decision does not reliably win either scenario. Pytest keeps a smaller version of the dead-end, bounds, and outcome-diversity sweep (300 seeds per scenario), along with exact seed-42 golden runs.
