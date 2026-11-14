// Generated from real backend responses (seed 42) for Brick 9C UI tests.
// Regenerate rather than hand-edit when the scenario definitions change.
import type {
  AIBriefingResponse,
  GameStartResponse,
  GameTurnResponse,
  ScenarioCatalogEntry,
  ScenarioDefinition,
} from "../lib/api";

export const cyberDefinitionFixture: ScenarioDefinition = ({
  "scenario_id": "cybersecurity-crisis",
  "schema_version": "1.0",
  "version": "1.0.0",
  "title": "Cybersecurity Crisis",
  "description": "Lead a fictional organization's incident-response team through twelve rounds of an escalating security crisis while keeping operations running.",
  "category": "cybersecurity",
  "metadata": {
    "objective": "Contain the attack within 12 decision rounds while preserving system integrity, operational continuity, and stakeholder trust.",
    "author": "ScenarioLab",
    "content_locale": "en-US",
    "source": "predefined",
    "tags": [
      "cybersecurity",
      "incident-response",
      "strategy"
    ],
    "disclaimer": "This fictional simulation uses illustrative values. It is not a security assessment, incident-response plan, or professional advice.",
    "source_references": []
  },
  "initial_state": {
    "system-integrity": 72,
    "threat-level": 30,
    "attacker-momentum": 4,
    "operational-continuity": 90,
    "stakeholder-trust": 70,
    "response-resources": 140
  },
  "metrics": [
    {
      "metric_id": "system-integrity",
      "title": "System Integrity",
      "description": "How much of the environment remains trustworthy and uncompromised.",
      "kind": "score",
      "unit": "points",
      "format": {
        "style": "score",
        "decimals": 0,
        "currency_code": null,
        "suffix": "/100"
      },
      "initial_value": 72,
      "min_value": 0,
      "max_value": 100,
      "capacity": null,
      "critical_threshold": 20,
      "favorable_direction": "higher"
    },
    {
      "metric_id": "threat-level",
      "title": "Threat Level",
      "description": "Attacker foothold and potential impact. Rises each round by Attacker Momentum.",
      "kind": "score",
      "unit": "points",
      "format": {
        "style": "score",
        "decimals": 0,
        "currency_code": null,
        "suffix": "/100"
      },
      "initial_value": 30,
      "min_value": 0,
      "max_value": 100,
      "capacity": null,
      "critical_threshold": 90,
      "favorable_direction": "lower"
    },
    {
      "metric_id": "attacker-momentum",
      "title": "Attacker Momentum",
      "description": "Threat Level added at the end of every round until containment slows the attacker.",
      "kind": "count",
      "unit": "points",
      "format": {
        "style": "number",
        "decimals": 0,
        "currency_code": null,
        "suffix": " /round"
      },
      "initial_value": 4,
      "min_value": 0,
      "max_value": 10,
      "capacity": null,
      "critical_threshold": 8,
      "favorable_direction": "lower"
    },
    {
      "metric_id": "operational-continuity",
      "title": "Operational Continuity",
      "description": "Share of critical business services still operating normally.",
      "kind": "percentage",
      "unit": "percent",
      "format": {
        "style": "percentage",
        "decimals": 0,
        "currency_code": null,
        "suffix": null
      },
      "initial_value": 90,
      "min_value": 0,
      "max_value": 100,
      "capacity": null,
      "critical_threshold": 25,
      "favorable_direction": "higher"
    },
    {
      "metric_id": "stakeholder-trust",
      "title": "Stakeholder Trust",
      "description": "Confidence of leadership, customers, regulators, and partners in the response.",
      "kind": "score",
      "unit": "points",
      "format": {
        "style": "score",
        "decimals": 0,
        "currency_code": null,
        "suffix": "/100"
      },
      "initial_value": 70,
      "min_value": 0,
      "max_value": 100,
      "capacity": null,
      "critical_threshold": 15,
      "favorable_direction": "higher"
    },
    {
      "metric_id": "response-resources",
      "title": "Response Resources",
      "description": "Responder hours, tooling, and support available to commit. Does not refill on its own.",
      "kind": "resource",
      "unit": "hours",
      "format": {
        "style": "number",
        "decimals": 0,
        "currency_code": null,
        "suffix": " hrs"
      },
      "initial_value": 140,
      "min_value": 0,
      "max_value": 999,
      "capacity": null,
      "critical_threshold": 20,
      "favorable_direction": "higher"
    }
  ],
  "turn": {
    "duration": 1,
    "unit": "round",
    "max_turns": 12
  },
  "actions": [
    {
      "action_id": "isolate-affected-systems",
      "title": "Isolate Affected Systems",
      "description": "Segment compromised hosts and cut attacker pathways. Slows the attack sharply but takes services offline.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "subtract",
          "value": 20,
          "destination_metric_id": null,
          "description": "Commit 20 responder hours to containment."
        },
        {
          "metric_id": "attacker-momentum",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Reduce Attacker Momentum by 3."
        },
        {
          "metric_id": "operational-continuity",
          "operator": "subtract",
          "value": 10,
          "destination_metric_id": null,
          "description": "Take isolated services offline (-10%)."
        },
        {
          "metric_id": "system-integrity",
          "operator": "add",
          "value": 3,
          "destination_metric_id": null,
          "description": "Stop further spread inside isolated segments."
        }
      ]
    },
    {
      "action_id": "patch-and-harden",
      "title": "Patch and Harden Systems",
      "description": "Roll out emergency patches, rotate credentials, and enforce multi-factor authentication across the estate.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "subtract",
          "value": 25,
          "destination_metric_id": null,
          "description": "Commit 25 responder hours to remediation."
        },
        {
          "metric_id": "system-integrity",
          "operator": "add",
          "value": 10,
          "destination_metric_id": null,
          "description": "Restore 10 points of System Integrity."
        },
        {
          "metric_id": "attacker-momentum",
          "operator": "subtract",
          "value": 1,
          "destination_metric_id": null,
          "description": "Close known entry points (-1 momentum)."
        },
        {
          "metric_id": "operational-continuity",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Brief maintenance windows (-3%)."
        }
      ]
    },
    {
      "action_id": "launch-threat-hunt",
      "title": "Launch Threat Hunt",
      "description": "Proactively search for persistence and evict the attacker from footholds it already holds. Forensics briefly pause services.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "subtract",
          "value": 30,
          "destination_metric_id": null,
          "description": "Commit 30 responder hours to hunting."
        },
        {
          "metric_id": "threat-level",
          "operator": "subtract",
          "value": 12,
          "destination_metric_id": null,
          "description": "Evict known footholds (-12 Threat Level)."
        },
        {
          "metric_id": "operational-continuity",
          "operator": "subtract",
          "value": 4,
          "destination_metric_id": null,
          "description": "Forensic imaging pauses some services (-4%)."
        }
      ]
    },
    {
      "action_id": "brief-stakeholders",
      "title": "Brief Stakeholders Transparently",
      "description": "Give leadership, customers, and regulators a candid status update and a clear remediation plan.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "subtract",
          "value": 10,
          "destination_metric_id": null,
          "description": "Commit 10 hours to communications."
        },
        {
          "metric_id": "stakeholder-trust",
          "operator": "add",
          "value": 8,
          "destination_metric_id": null,
          "description": "Improve Stakeholder Trust by 8."
        },
        {
          "metric_id": "operational-continuity",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Divert leadership attention (-2%)."
        }
      ]
    },
    {
      "action_id": "restore-services",
      "title": "Restore Services and Rotate Staff",
      "description": "Bring business systems back online and rest the response team. Recovers capacity, but the attacker keeps operating.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "operational-continuity",
          "operator": "add",
          "value": 8,
          "destination_metric_id": null,
          "description": "Restore services (+8%)."
        },
        {
          "metric_id": "response-resources",
          "operator": "add",
          "value": 20,
          "destination_metric_id": null,
          "description": "Recover 20 responder hours through rest."
        },
        {
          "metric_id": "attacker-momentum",
          "operator": "add",
          "value": 2,
          "destination_metric_id": null,
          "description": "Reduced vigilance lets the attacker advance (+2)."
        }
      ]
    },
    {
      "action_id": "engage-external-responders",
      "title": "Engage External Responders",
      "description": "Call in an outside incident-response firm. Adds substantial capacity, but signals that the crisis is serious.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "add",
          "value": 45,
          "destination_metric_id": null,
          "description": "Add 45 hours of external responder capacity."
        },
        {
          "metric_id": "stakeholder-trust",
          "operator": "subtract",
          "value": 7,
          "destination_metric_id": null,
          "description": "Stakeholders read the escalation as a warning (-7)."
        }
      ]
    },
    {
      "action_id": "activate-backup-site",
      "title": "Fail Over to Backup Site",
      "description": "Shift critical operations to clean disaster-recovery infrastructure. Only possible once continuity has dropped to 60% or lower.",
      "preconditions": [
        {
          "reference": "metric",
          "operator": "lte",
          "value": 60,
          "metric_id": "operational-continuity",
          "action_id": null
        }
      ],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "subtract",
          "value": 35,
          "destination_metric_id": null,
          "description": "Commit 35 hours to the failover."
        },
        {
          "metric_id": "operational-continuity",
          "operator": "add",
          "value": 22,
          "destination_metric_id": null,
          "description": "Restore critical operations (+22%)."
        },
        {
          "metric_id": "system-integrity",
          "operator": "add",
          "value": 4,
          "destination_metric_id": null,
          "description": "Run on known-clean systems (+4)."
        }
      ]
    }
  ],
  "recurring_rules": [
    {
      "rule_id": "attacker-escalation",
      "target_metric_id": "threat-level",
      "terms": [
        {
          "metric_id": "attacker-momentum",
          "operator": "add"
        }
      ],
      "underflow_behavior": "reject",
      "description": "After the chosen response, Threat Level rises by the current Attacker Momentum before any event is processed."
    }
  ],
  "events": [
    {
      "event_id": "phishing-campaign",
      "title": "Targeted Phishing Campaign",
      "description": "Convincing emails impersonating the finance team reach hundreds of employees, and several click the link.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "turn",
            "operator": "gte",
            "value": 1,
            "metric_id": null,
            "action_id": null
          }
        ],
        "earliest_turn": 1,
        "latest_turn": 3
      },
      "effects": [
        {
          "metric_id": "attacker-momentum",
          "operator": "add",
          "value": 2,
          "destination_metric_id": null,
          "description": "New access paths add 2 Attacker Momentum."
        },
        {
          "metric_id": "system-integrity",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Infected endpoints reduce integrity by 3."
        }
      ],
      "weight": 3,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "credential-compromise",
      "title": "Compromised Employee Credentials",
      "description": "An administrator's stolen credentials are used to sign in from an unfamiliar location.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "gte",
            "value": 3,
            "metric_id": "attacker-momentum",
            "action_id": null
          }
        ],
        "earliest_turn": 2,
        "latest_turn": 7
      },
      "effects": [
        {
          "metric_id": "system-integrity",
          "operator": "subtract",
          "value": 6,
          "destination_metric_id": null,
          "description": "Privileged misuse reduces integrity by 6."
        },
        {
          "metric_id": "threat-level",
          "operator": "add",
          "value": 5,
          "destination_metric_id": null,
          "description": "Privileged access raises Threat Level by 5."
        }
      ],
      "weight": 2,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "lateral-movement",
      "title": "Suspicious Lateral Movement",
      "description": "Network monitoring flags unusual traffic between internal servers that should never talk to each other.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "gte",
            "value": 40,
            "metric_id": "threat-level",
            "action_id": null
          }
        ],
        "earliest_turn": 2,
        "latest_turn": 9
      },
      "effects": [
        {
          "metric_id": "attacker-momentum",
          "operator": "add",
          "value": 2,
          "destination_metric_id": null,
          "description": "Spreading access adds 2 Attacker Momentum."
        },
        {
          "metric_id": "threat-level",
          "operator": "add",
          "value": 3,
          "destination_metric_id": null,
          "description": "Wider reach raises Threat Level by 3."
        }
      ],
      "weight": 2,
      "max_occurrences": 2,
      "fallback_eligible": true
    },
    {
      "event_id": "ransomware-detonation",
      "title": "Ransomware Detonation",
      "description": "File servers begin encrypting and a ransom note appears on shared drives across the organization.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "gte",
            "value": 55,
            "metric_id": "threat-level",
            "action_id": null
          }
        ],
        "earliest_turn": 4,
        "latest_turn": 11
      },
      "effects": [
        {
          "metric_id": "operational-continuity",
          "operator": "subtract",
          "value": 18,
          "destination_metric_id": null,
          "description": "Encrypted systems cut continuity by 18%."
        },
        {
          "metric_id": "system-integrity",
          "operator": "subtract",
          "value": 10,
          "destination_metric_id": null,
          "description": "Encrypted data reduces integrity by 10."
        },
        {
          "metric_id": "stakeholder-trust",
          "operator": "subtract",
          "value": 6,
          "destination_metric_id": null,
          "description": "Visible disruption reduces trust by 6."
        }
      ],
      "weight": 4,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "supplier-compromise",
      "title": "Third-Party Supplier Breach",
      "description": "A managed-service supplier discloses that its remote-access tooling was breached, including its connection to your network.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "turn",
            "operator": "gte",
            "value": 3,
            "metric_id": null,
            "action_id": null
          }
        ],
        "earliest_turn": 3,
        "latest_turn": 9
      },
      "effects": [
        {
          "metric_id": "attacker-momentum",
          "operator": "add",
          "value": 1,
          "destination_metric_id": null,
          "description": "A new trusted pathway adds 1 Attacker Momentum."
        },
        {
          "metric_id": "stakeholder-trust",
          "operator": "subtract",
          "value": 4,
          "destination_metric_id": null,
          "description": "Partners question supply-chain controls (-4)."
        }
      ],
      "weight": 1,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "critical-vulnerability",
      "title": "Critical Vulnerability Disclosed",
      "description": "A widely used gateway product receives an emergency advisory for an actively exploited flaw.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "lt",
            "value": 80,
            "metric_id": "system-integrity",
            "action_id": null
          }
        ],
        "earliest_turn": 5,
        "latest_turn": 11
      },
      "effects": [
        {
          "metric_id": "threat-level",
          "operator": "add",
          "value": 6,
          "destination_metric_id": null,
          "description": "Exposed gateways raise Threat Level by 6."
        },
        {
          "metric_id": "attacker-momentum",
          "operator": "add",
          "value": 1,
          "destination_metric_id": null,
          "description": "Easy exploitation adds 1 Attacker Momentum."
        }
      ],
      "weight": 2,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "data-exposure",
      "title": "Customer Data Exposure",
      "description": "Samples of internal customer records appear on a leak site, and journalists begin asking questions.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "lte",
            "value": 55,
            "metric_id": "system-integrity",
            "action_id": null
          }
        ],
        "earliest_turn": 5,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "stakeholder-trust",
          "operator": "subtract",
          "value": 12,
          "destination_metric_id": null,
          "description": "Public exposure reduces trust by 12."
        },
        {
          "metric_id": "threat-level",
          "operator": "add",
          "value": 4,
          "destination_metric_id": null,
          "description": "Exfiltration confirms deep access (+4 Threat Level)."
        }
      ],
      "weight": 3,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "service-disruption",
      "title": "Customer-Facing Service Disruption",
      "description": "The customer portal fails under degraded infrastructure, and support queues overflow.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "lte",
            "value": 65,
            "metric_id": "operational-continuity",
            "action_id": null
          }
        ],
        "earliest_turn": 3,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "operational-continuity",
          "operator": "subtract",
          "value": 7,
          "destination_metric_id": null,
          "description": "Additional outages cut continuity by 7%."
        },
        {
          "metric_id": "stakeholder-trust",
          "operator": "subtract",
          "value": 4,
          "destination_metric_id": null,
          "description": "Customers notice the outage (-4 trust)."
        }
      ],
      "weight": 2,
      "max_occurrences": 2,
      "fallback_eligible": true
    },
    {
      "event_id": "threat-intel-shared",
      "title": "Industry Threat Intelligence Shared",
      "description": "Your transparency earns goodwill. A sector partner shares the attacker's infrastructure and tooling indicators.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "action-count",
            "operator": "gte",
            "value": 1,
            "metric_id": null,
            "action_id": "brief-stakeholders"
          },
          {
            "reference": "metric",
            "operator": "gte",
            "value": 70,
            "metric_id": "stakeholder-trust",
            "action_id": null
          }
        ],
        "earliest_turn": 3,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "attacker-momentum",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Known indicators reduce Attacker Momentum by 2."
        },
        {
          "metric_id": "threat-level",
          "operator": "subtract",
          "value": 5,
          "destination_metric_id": null,
          "description": "Blocked infrastructure lowers Threat Level by 5."
        }
      ],
      "weight": 3,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "attacker-pivot",
      "title": "Attacker Pivots to New Access",
      "description": "Blocked on one path, the attacker falls back on footholds that were never evicted and resumes operations.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "lte",
            "value": 2,
            "metric_id": "attacker-momentum",
            "action_id": null
          },
          {
            "reference": "metric",
            "operator": "gte",
            "value": 25,
            "metric_id": "threat-level",
            "action_id": null
          }
        ],
        "earliest_turn": 3,
        "latest_turn": 11
      },
      "effects": [
        {
          "metric_id": "attacker-momentum",
          "operator": "add",
          "value": 3,
          "destination_metric_id": null,
          "description": "Remaining footholds restore 3 Attacker Momentum."
        }
      ],
      "weight": 3,
      "max_occurrences": 2,
      "fallback_eligible": true
    },
    {
      "event_id": "attacker-infrastructure-down",
      "title": "Attacker Infrastructure Taken Down",
      "description": "With the attacker starved of access, law enforcement and hosting providers dismantle its command servers.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "lte",
            "value": 1,
            "metric_id": "attacker-momentum",
            "action_id": null
          },
          {
            "reference": "metric",
            "operator": "lte",
            "value": 30,
            "metric_id": "threat-level",
            "action_id": null
          }
        ],
        "earliest_turn": 6,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "threat-level",
          "operator": "subtract",
          "value": 8,
          "destination_metric_id": null,
          "description": "Lost command servers lower Threat Level by 8."
        },
        {
          "metric_id": "stakeholder-trust",
          "operator": "add",
          "value": 4,
          "destination_metric_id": null,
          "description": "Visible progress improves trust by 4."
        }
      ],
      "weight": 3,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "recovery-milestone",
      "title": "Recovery Milestone Reached",
      "description": "Core systems pass verification, and leadership confirms that normal operations are resuming.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "gte",
            "value": 70,
            "metric_id": "system-integrity",
            "action_id": null
          },
          {
            "reference": "metric",
            "operator": "gte",
            "value": 65,
            "metric_id": "operational-continuity",
            "action_id": null
          }
        ],
        "earliest_turn": 7,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "stakeholder-trust",
          "operator": "add",
          "value": 6,
          "destination_metric_id": null,
          "description": "Confirmed recovery improves trust by 6."
        },
        {
          "metric_id": "operational-continuity",
          "operator": "add",
          "value": 4,
          "destination_metric_id": null,
          "description": "Verified systems return to service (+4%)."
        }
      ],
      "weight": 2,
      "max_occurrences": 1,
      "fallback_eligible": true
    }
  ],
  "win_conditions": [
    {
      "condition_id": "crisis-contained",
      "title": "Crisis Contained",
      "description": "After round twelve, the attacker is contained and the organization is still operating with stakeholder confidence intact.",
      "logic": "all",
      "conditions": [
        {
          "reference": "turn",
          "operator": "gte",
          "value": 12,
          "metric_id": null,
          "action_id": null
        },
        {
          "reference": "metric",
          "operator": "lte",
          "value": 45,
          "metric_id": "threat-level",
          "action_id": null
        },
        {
          "reference": "metric",
          "operator": "gte",
          "value": 45,
          "metric_id": "system-integrity",
          "action_id": null
        },
        {
          "reference": "metric",
          "operator": "gte",
          "value": 50,
          "metric_id": "operational-continuity",
          "action_id": null
        },
        {
          "reference": "metric",
          "operator": "gte",
          "value": 35,
          "metric_id": "stakeholder-trust",
          "action_id": null
        }
      ],
      "priority": 50
    }
  ],
  "loss_conditions": [
    {
      "condition_id": "network-takeover",
      "title": "Network Takeover",
      "description": "The attacker gains control of the environment when Threat Level reaches 90.",
      "logic": "all",
      "conditions": [
        {
          "reference": "metric",
          "operator": "gte",
          "value": 90,
          "metric_id": "threat-level",
          "action_id": null
        }
      ],
      "priority": 100
    },
    {
      "condition_id": "critical-infrastructure-compromised",
      "title": "Critical Infrastructure Compromised",
      "description": "The response fails when System Integrity falls to 20 or below.",
      "logic": "all",
      "conditions": [
        {
          "reference": "metric",
          "operator": "lte",
          "value": 20,
          "metric_id": "system-integrity",
          "action_id": null
        }
      ],
      "priority": 95
    },
    {
      "condition_id": "operations-collapse",
      "title": "Operations Collapse",
      "description": "The organization cannot function when Operational Continuity falls to 25% or below.",
      "logic": "all",
      "conditions": [
        {
          "reference": "metric",
          "operator": "lte",
          "value": 25,
          "metric_id": "operational-continuity",
          "action_id": null
        }
      ],
      "priority": 90
    },
    {
      "condition_id": "stakeholder-confidence-lost",
      "title": "Stakeholder Confidence Lost",
      "description": "Leadership replaces the response team when Stakeholder Trust falls to 15 or below.",
      "logic": "all",
      "conditions": [
        {
          "reference": "metric",
          "operator": "lte",
          "value": 15,
          "metric_id": "stakeholder-trust",
          "action_id": null
        }
      ],
      "priority": 80
    },
    {
      "condition_id": "crisis-unresolved",
      "title": "Crisis Unresolved",
      "description": "After round twelve, the run ends unsuccessfully if the attacker is not contained or the organization is too damaged to recover.",
      "logic": "all",
      "conditions": [
        {
          "reference": "turn",
          "operator": "gte",
          "value": 12,
          "metric_id": null,
          "action_id": null
        }
      ],
      "priority": 0
    }
  ],
  "calculation": {
    "numeric_mode": "strict-integer-v1",
    "money_mode": "integer-cents",
    "bound_violation": "reject",
    "unsupported_operator": "reject",
    "missing_reference": "reject",
    "effect_order": [
      "action-effects",
      "recurring-rules",
      "event-effects",
      "outcome-evaluation"
    ],
    "random_stream_version": "scenario-seed-v1"
  },
  "fallback": {
    "event_ids": [
      "phishing-campaign",
      "credential-compromise",
      "lateral-movement",
      "ransomware-detonation",
      "supplier-compromise",
      "critical-vulnerability",
      "attacker-pivot",
      "data-exposure",
      "service-disruption",
      "threat-intel-shared",
      "attacker-infrastructure-down",
      "recovery-milestone"
    ],
    "no_event_allowed": true
  }
}) as unknown as never;

export const cyberStartFixture: GameStartResponse = ({
  "scenario_id": "cybersecurity-crisis",
  "scenario_version": "1.0.0",
  "seed": 42,
  "state": {
    "scenario_id": "cybersecurity-crisis",
    "scenario_version": "1.0.0",
    "current_turn": 1,
    "max_turns": 12,
    "metric_values": {
      "system-integrity": 72,
      "threat-level": 30,
      "attacker-momentum": 4,
      "operational-continuity": 90,
      "stakeholder-trust": 70,
      "response-resources": 140
    },
    "status": "not-started",
    "decision_history": [],
    "seed": {
      "seed": 42,
      "stream_version": "scenario-seed-v1"
    }
  },
  "available_actions": [
    {
      "action_id": "isolate-affected-systems",
      "title": "Isolate Affected Systems",
      "description": "Segment compromised hosts and cut attacker pathways. Slows the attack sharply but takes services offline.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "subtract",
          "value": 20,
          "destination_metric_id": null,
          "description": "Commit 20 responder hours to containment."
        },
        {
          "metric_id": "attacker-momentum",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Reduce Attacker Momentum by 3."
        },
        {
          "metric_id": "operational-continuity",
          "operator": "subtract",
          "value": 10,
          "destination_metric_id": null,
          "description": "Take isolated services offline (-10%)."
        },
        {
          "metric_id": "system-integrity",
          "operator": "add",
          "value": 3,
          "destination_metric_id": null,
          "description": "Stop further spread inside isolated segments."
        }
      ]
    },
    {
      "action_id": "patch-and-harden",
      "title": "Patch and Harden Systems",
      "description": "Roll out emergency patches, rotate credentials, and enforce multi-factor authentication across the estate.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "subtract",
          "value": 25,
          "destination_metric_id": null,
          "description": "Commit 25 responder hours to remediation."
        },
        {
          "metric_id": "system-integrity",
          "operator": "add",
          "value": 10,
          "destination_metric_id": null,
          "description": "Restore 10 points of System Integrity."
        },
        {
          "metric_id": "attacker-momentum",
          "operator": "subtract",
          "value": 1,
          "destination_metric_id": null,
          "description": "Close known entry points (-1 momentum)."
        },
        {
          "metric_id": "operational-continuity",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Brief maintenance windows (-3%)."
        }
      ]
    },
    {
      "action_id": "launch-threat-hunt",
      "title": "Launch Threat Hunt",
      "description": "Proactively search for persistence and evict the attacker from footholds it already holds. Forensics briefly pause services.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "subtract",
          "value": 30,
          "destination_metric_id": null,
          "description": "Commit 30 responder hours to hunting."
        },
        {
          "metric_id": "threat-level",
          "operator": "subtract",
          "value": 12,
          "destination_metric_id": null,
          "description": "Evict known footholds (-12 Threat Level)."
        },
        {
          "metric_id": "operational-continuity",
          "operator": "subtract",
          "value": 4,
          "destination_metric_id": null,
          "description": "Forensic imaging pauses some services (-4%)."
        }
      ]
    },
    {
      "action_id": "brief-stakeholders",
      "title": "Brief Stakeholders Transparently",
      "description": "Give leadership, customers, and regulators a candid status update and a clear remediation plan.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "subtract",
          "value": 10,
          "destination_metric_id": null,
          "description": "Commit 10 hours to communications."
        },
        {
          "metric_id": "stakeholder-trust",
          "operator": "add",
          "value": 8,
          "destination_metric_id": null,
          "description": "Improve Stakeholder Trust by 8."
        },
        {
          "metric_id": "operational-continuity",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Divert leadership attention (-2%)."
        }
      ]
    },
    {
      "action_id": "restore-services",
      "title": "Restore Services and Rotate Staff",
      "description": "Bring business systems back online and rest the response team. Recovers capacity, but the attacker keeps operating.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "operational-continuity",
          "operator": "add",
          "value": 8,
          "destination_metric_id": null,
          "description": "Restore services (+8%)."
        },
        {
          "metric_id": "response-resources",
          "operator": "add",
          "value": 20,
          "destination_metric_id": null,
          "description": "Recover 20 responder hours through rest."
        },
        {
          "metric_id": "attacker-momentum",
          "operator": "add",
          "value": 2,
          "destination_metric_id": null,
          "description": "Reduced vigilance lets the attacker advance (+2)."
        }
      ]
    },
    {
      "action_id": "engage-external-responders",
      "title": "Engage External Responders",
      "description": "Call in an outside incident-response firm. Adds substantial capacity, but signals that the crisis is serious.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "response-resources",
          "operator": "add",
          "value": 45,
          "destination_metric_id": null,
          "description": "Add 45 hours of external responder capacity."
        },
        {
          "metric_id": "stakeholder-trust",
          "operator": "subtract",
          "value": 7,
          "destination_metric_id": null,
          "description": "Stakeholders read the escalation as a warning (-7)."
        }
      ]
    }
  ],
  "scenario": {
    "title": "Cybersecurity Crisis",
    "description": "Lead a fictional organization's incident-response team through twelve rounds of an escalating security crisis while keeping operations running.",
    "objective": "Contain the attack within 12 decision rounds while preserving system integrity, operational continuity, and stakeholder trust.",
    "turn": {
      "duration": 1,
      "unit": "round",
      "max_turns": 12
    },
    "metrics": [
      {
        "metric_id": "system-integrity",
        "title": "System Integrity",
        "description": "How much of the environment remains trustworthy and uncompromised.",
        "kind": "score",
        "unit": "points",
        "format": {
          "style": "score",
          "decimals": 0,
          "currency_code": null,
          "suffix": "/100"
        },
        "initial_value": 72,
        "min_value": 0,
        "max_value": 100,
        "capacity": null,
        "critical_threshold": 20,
        "favorable_direction": "higher"
      },
      {
        "metric_id": "threat-level",
        "title": "Threat Level",
        "description": "Attacker foothold and potential impact. Rises each round by Attacker Momentum.",
        "kind": "score",
        "unit": "points",
        "format": {
          "style": "score",
          "decimals": 0,
          "currency_code": null,
          "suffix": "/100"
        },
        "initial_value": 30,
        "min_value": 0,
        "max_value": 100,
        "capacity": null,
        "critical_threshold": 90,
        "favorable_direction": "lower"
      },
      {
        "metric_id": "attacker-momentum",
        "title": "Attacker Momentum",
        "description": "Threat Level added at the end of every round until containment slows the attacker.",
        "kind": "count",
        "unit": "points",
        "format": {
          "style": "number",
          "decimals": 0,
          "currency_code": null,
          "suffix": " /round"
        },
        "initial_value": 4,
        "min_value": 0,
        "max_value": 10,
        "capacity": null,
        "critical_threshold": 8,
        "favorable_direction": "lower"
      },
      {
        "metric_id": "operational-continuity",
        "title": "Operational Continuity",
        "description": "Share of critical business services still operating normally.",
        "kind": "percentage",
        "unit": "percent",
        "format": {
          "style": "percentage",
          "decimals": 0,
          "currency_code": null,
          "suffix": null
        },
        "initial_value": 90,
        "min_value": 0,
        "max_value": 100,
        "capacity": null,
        "critical_threshold": 25,
        "favorable_direction": "higher"
      },
      {
        "metric_id": "stakeholder-trust",
        "title": "Stakeholder Trust",
        "description": "Confidence of leadership, customers, regulators, and partners in the response.",
        "kind": "score",
        "unit": "points",
        "format": {
          "style": "score",
          "decimals": 0,
          "currency_code": null,
          "suffix": "/100"
        },
        "initial_value": 70,
        "min_value": 0,
        "max_value": 100,
        "capacity": null,
        "critical_threshold": 15,
        "favorable_direction": "higher"
      },
      {
        "metric_id": "response-resources",
        "title": "Response Resources",
        "description": "Responder hours, tooling, and support available to commit. Does not refill on its own.",
        "kind": "resource",
        "unit": "hours",
        "format": {
          "style": "number",
          "decimals": 0,
          "currency_code": null,
          "suffix": " hrs"
        },
        "initial_value": 140,
        "min_value": 0,
        "max_value": 999,
        "capacity": null,
        "critical_threshold": 20,
        "favorable_direction": "higher"
      }
    ]
  }
}) as unknown as never;

export const cyberTurnsFixture: GameTurnResponse[] = ([
  {
    "scenario_id": "cybersecurity-crisis",
    "scenario_version": "1.0.0",
    "seed": 42,
    "state": {
      "scenario_id": "cybersecurity-crisis",
      "scenario_version": "1.0.0",
      "current_turn": 2,
      "max_turns": 12,
      "metric_values": {
        "system-integrity": 72,
        "threat-level": 31,
        "attacker-momentum": 3,
        "operational-continuity": 80,
        "stakeholder-trust": 70,
        "response-resources": 120
      },
      "status": "active",
      "decision_history": [
        {
          "action_id": "isolate-affected-systems",
          "action_title": "Isolate Affected Systems",
          "turn": 1,
          "sequence": 1,
          "source": "scripted",
          "director_proposal_digest": null,
          "event_id": "phishing-campaign",
          "eligible_event_ids": [
            "phishing-campaign"
          ],
          "event_random_draw": 1,
          "metric_changes": [
            {
              "metric_id": "threat-level",
              "previous_value": 30,
              "new_value": 31,
              "delta": 1,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "attacker-momentum",
              "previous_value": 4,
              "new_value": 3,
              "delta": -1,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "operational-continuity",
              "previous_value": 90,
              "new_value": 80,
              "delta": -10,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "response-resources",
              "previous_value": 140,
              "new_value": 120,
              "delta": -20,
              "exhausted": false,
              "attempted_value": null
            }
          ],
          "resulting_status": "active",
          "outcome_reason": "turn-completed"
        }
      ],
      "seed": {
        "seed": 42,
        "stream_version": "scenario-seed-v1"
      }
    },
    "turn_result": {
      "previous_state": {
        "scenario_id": "cybersecurity-crisis",
        "scenario_version": "1.0.0",
        "current_turn": 1,
        "max_turns": 12,
        "metric_values": {
          "system-integrity": 72,
          "threat-level": 30,
          "attacker-momentum": 4,
          "operational-continuity": 90,
          "stakeholder-trust": 70,
          "response-resources": 140
        },
        "status": "not-started",
        "decision_history": [],
        "seed": {
          "seed": 42,
          "stream_version": "scenario-seed-v1"
        }
      },
      "new_state": {
        "scenario_id": "cybersecurity-crisis",
        "scenario_version": "1.0.0",
        "current_turn": 2,
        "max_turns": 12,
        "metric_values": {
          "system-integrity": 72,
          "threat-level": 31,
          "attacker-momentum": 3,
          "operational-continuity": 80,
          "stakeholder-trust": 70,
          "response-resources": 120
        },
        "status": "active",
        "decision_history": [
          {
            "action_id": "isolate-affected-systems",
            "action_title": "Isolate Affected Systems",
            "turn": 1,
            "sequence": 1,
            "source": "scripted",
            "director_proposal_digest": null,
            "event_id": "phishing-campaign",
            "eligible_event_ids": [
              "phishing-campaign"
            ],
            "event_random_draw": 1,
            "metric_changes": [
              {
                "metric_id": "threat-level",
                "previous_value": 30,
                "new_value": 31,
                "delta": 1,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "attacker-momentum",
                "previous_value": 4,
                "new_value": 3,
                "delta": -1,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "operational-continuity",
                "previous_value": 90,
                "new_value": 80,
                "delta": -10,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "response-resources",
                "previous_value": 140,
                "new_value": 120,
                "delta": -20,
                "exhausted": false,
                "attempted_value": null
              }
            ],
            "resulting_status": "active",
            "outcome_reason": "turn-completed"
          }
        ],
        "seed": {
          "seed": 42,
          "stream_version": "scenario-seed-v1"
        }
      },
      "selected_action": {
        "action_id": "isolate-affected-systems",
        "title": "Isolate Affected Systems",
        "description": "Segment compromised hosts and cut attacker pathways. Slows the attack sharply but takes services offline.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "response-resources",
            "operator": "subtract",
            "value": 20,
            "destination_metric_id": null,
            "description": "Commit 20 responder hours to containment."
          },
          {
            "metric_id": "attacker-momentum",
            "operator": "subtract",
            "value": 3,
            "destination_metric_id": null,
            "description": "Reduce Attacker Momentum by 3."
          },
          {
            "metric_id": "operational-continuity",
            "operator": "subtract",
            "value": 10,
            "destination_metric_id": null,
            "description": "Take isolated services offline (-10%)."
          },
          {
            "metric_id": "system-integrity",
            "operator": "add",
            "value": 3,
            "destination_metric_id": null,
            "description": "Stop further spread inside isolated segments."
          }
        ]
      },
      "triggered_event": {
        "event_id": "phishing-campaign",
        "title": "Targeted Phishing Campaign",
        "description": "Convincing emails impersonating the finance team reach hundreds of employees, and several click the link.",
        "trigger": {
          "logic": "all",
          "conditions": [
            {
              "reference": "turn",
              "operator": "gte",
              "value": 1,
              "metric_id": null,
              "action_id": null
            }
          ],
          "earliest_turn": 1,
          "latest_turn": 3
        },
        "effects": [
          {
            "metric_id": "attacker-momentum",
            "operator": "add",
            "value": 2,
            "destination_metric_id": null,
            "description": "New access paths add 2 Attacker Momentum."
          },
          {
            "metric_id": "system-integrity",
            "operator": "subtract",
            "value": 3,
            "destination_metric_id": null,
            "description": "Infected endpoints reduce integrity by 3."
          }
        ],
        "weight": 3,
        "max_occurrences": 1,
        "fallback_eligible": true
      },
      "eligible_event_ids": [
        "phishing-campaign"
      ],
      "event_random_draw": 1,
      "metric_changes": [
        {
          "metric_id": "threat-level",
          "previous_value": 30,
          "new_value": 31,
          "delta": 1,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "attacker-momentum",
          "previous_value": 4,
          "new_value": 3,
          "delta": -1,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "operational-continuity",
          "previous_value": 90,
          "new_value": 80,
          "delta": -10,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "response-resources",
          "previous_value": 140,
          "new_value": 120,
          "delta": -20,
          "exhausted": false,
          "attempted_value": null
        }
      ],
      "completed_turn_index": 1,
      "resulting_status": "active",
      "outcome_reason": "turn-completed",
      "decision_record": {
        "action_id": "isolate-affected-systems",
        "action_title": "Isolate Affected Systems",
        "turn": 1,
        "sequence": 1,
        "source": "scripted",
        "director_proposal_digest": null,
        "event_id": "phishing-campaign",
        "eligible_event_ids": [
          "phishing-campaign"
        ],
        "event_random_draw": 1,
        "metric_changes": [
          {
            "metric_id": "threat-level",
            "previous_value": 30,
            "new_value": 31,
            "delta": 1,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "attacker-momentum",
            "previous_value": 4,
            "new_value": 3,
            "delta": -1,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "operational-continuity",
            "previous_value": 90,
            "new_value": 80,
            "delta": -10,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "response-resources",
            "previous_value": 140,
            "new_value": 120,
            "delta": -20,
            "exhausted": false,
            "attempted_value": null
          }
        ],
        "resulting_status": "active",
        "outcome_reason": "turn-completed"
      }
    },
    "available_actions": [
      {
        "action_id": "isolate-affected-systems",
        "title": "Isolate Affected Systems",
        "description": "Segment compromised hosts and cut attacker pathways. Slows the attack sharply but takes services offline.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "response-resources",
            "operator": "subtract",
            "value": 20,
            "destination_metric_id": null,
            "description": "Commit 20 responder hours to containment."
          },
          {
            "metric_id": "attacker-momentum",
            "operator": "subtract",
            "value": 3,
            "destination_metric_id": null,
            "description": "Reduce Attacker Momentum by 3."
          },
          {
            "metric_id": "operational-continuity",
            "operator": "subtract",
            "value": 10,
            "destination_metric_id": null,
            "description": "Take isolated services offline (-10%)."
          },
          {
            "metric_id": "system-integrity",
            "operator": "add",
            "value": 3,
            "destination_metric_id": null,
            "description": "Stop further spread inside isolated segments."
          }
        ]
      },
      {
        "action_id": "patch-and-harden",
        "title": "Patch and Harden Systems",
        "description": "Roll out emergency patches, rotate credentials, and enforce multi-factor authentication across the estate.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "response-resources",
            "operator": "subtract",
            "value": 25,
            "destination_metric_id": null,
            "description": "Commit 25 responder hours to remediation."
          },
          {
            "metric_id": "system-integrity",
            "operator": "add",
            "value": 10,
            "destination_metric_id": null,
            "description": "Restore 10 points of System Integrity."
          },
          {
            "metric_id": "attacker-momentum",
            "operator": "subtract",
            "value": 1,
            "destination_metric_id": null,
            "description": "Close known entry points (-1 momentum)."
          },
          {
            "metric_id": "operational-continuity",
            "operator": "subtract",
            "value": 3,
            "destination_metric_id": null,
            "description": "Brief maintenance windows (-3%)."
          }
        ]
      },
      {
        "action_id": "launch-threat-hunt",
        "title": "Launch Threat Hunt",
        "description": "Proactively search for persistence and evict the attacker from footholds it already holds. Forensics briefly pause services.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "response-resources",
            "operator": "subtract",
            "value": 30,
            "destination_metric_id": null,
            "description": "Commit 30 responder hours to hunting."
          },
          {
            "metric_id": "threat-level",
            "operator": "subtract",
            "value": 12,
            "destination_metric_id": null,
            "description": "Evict known footholds (-12 Threat Level)."
          },
          {
            "metric_id": "operational-continuity",
            "operator": "subtract",
            "value": 4,
            "destination_metric_id": null,
            "description": "Forensic imaging pauses some services (-4%)."
          }
        ]
      },
      {
        "action_id": "brief-stakeholders",
        "title": "Brief Stakeholders Transparently",
        "description": "Give leadership, customers, and regulators a candid status update and a clear remediation plan.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "response-resources",
            "operator": "subtract",
            "value": 10,
            "destination_metric_id": null,
            "description": "Commit 10 hours to communications."
          },
          {
            "metric_id": "stakeholder-trust",
            "operator": "add",
            "value": 8,
            "destination_metric_id": null,
            "description": "Improve Stakeholder Trust by 8."
          },
          {
            "metric_id": "operational-continuity",
            "operator": "subtract",
            "value": 2,
            "destination_metric_id": null,
            "description": "Divert leadership attention (-2%)."
          }
        ]
      },
      {
        "action_id": "restore-services",
        "title": "Restore Services and Rotate Staff",
        "description": "Bring business systems back online and rest the response team. Recovers capacity, but the attacker keeps operating.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "operational-continuity",
            "operator": "add",
            "value": 8,
            "destination_metric_id": null,
            "description": "Restore services (+8%)."
          },
          {
            "metric_id": "response-resources",
            "operator": "add",
            "value": 20,
            "destination_metric_id": null,
            "description": "Recover 20 responder hours through rest."
          },
          {
            "metric_id": "attacker-momentum",
            "operator": "add",
            "value": 2,
            "destination_metric_id": null,
            "description": "Reduced vigilance lets the attacker advance (+2)."
          }
        ]
      },
      {
        "action_id": "engage-external-responders",
        "title": "Engage External Responders",
        "description": "Call in an outside incident-response firm. Adds substantial capacity, but signals that the crisis is serious.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "response-resources",
            "operator": "add",
            "value": 45,
            "destination_metric_id": null,
            "description": "Add 45 hours of external responder capacity."
          },
          {
            "metric_id": "stakeholder-trust",
            "operator": "subtract",
            "value": 7,
            "destination_metric_id": null,
            "description": "Stakeholders read the escalation as a warning (-7)."
          }
        ]
      }
    ],
    "action_history": [
      "isolate-affected-systems"
    ]
  },
  {
    "scenario_id": "cybersecurity-crisis",
    "scenario_version": "1.0.0",
    "seed": 42,
    "state": {
      "scenario_id": "cybersecurity-crisis",
      "scenario_version": "1.0.0",
      "current_turn": 3,
      "max_turns": 12,
      "metric_values": {
        "system-integrity": 75,
        "threat-level": 31,
        "attacker-momentum": 0,
        "operational-continuity": 70,
        "stakeholder-trust": 70,
        "response-resources": 100
      },
      "status": "active",
      "decision_history": [
        {
          "action_id": "isolate-affected-systems",
          "action_title": "Isolate Affected Systems",
          "turn": 1,
          "sequence": 1,
          "source": "scripted",
          "director_proposal_digest": null,
          "event_id": "phishing-campaign",
          "eligible_event_ids": [
            "phishing-campaign"
          ],
          "event_random_draw": 1,
          "metric_changes": [
            {
              "metric_id": "threat-level",
              "previous_value": 30,
              "new_value": 31,
              "delta": 1,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "attacker-momentum",
              "previous_value": 4,
              "new_value": 3,
              "delta": -1,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "operational-continuity",
              "previous_value": 90,
              "new_value": 80,
              "delta": -10,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "response-resources",
              "previous_value": 140,
              "new_value": 120,
              "delta": -20,
              "exhausted": false,
              "attempted_value": null
            }
          ],
          "resulting_status": "active",
          "outcome_reason": "turn-completed"
        },
        {
          "action_id": "isolate-affected-systems",
          "action_title": "Isolate Affected Systems",
          "turn": 2,
          "sequence": 2,
          "source": "scripted",
          "director_proposal_digest": null,
          "event_id": null,
          "eligible_event_ids": [],
          "event_random_draw": null,
          "metric_changes": [
            {
              "metric_id": "system-integrity",
              "previous_value": 72,
              "new_value": 75,
              "delta": 3,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "attacker-momentum",
              "previous_value": 3,
              "new_value": 0,
              "delta": -3,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "operational-continuity",
              "previous_value": 80,
              "new_value": 70,
              "delta": -10,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "response-resources",
              "previous_value": 120,
              "new_value": 100,
              "delta": -20,
              "exhausted": false,
              "attempted_value": null
            }
          ],
          "resulting_status": "active",
          "outcome_reason": "turn-completed"
        }
      ],
      "seed": {
        "seed": 42,
        "stream_version": "scenario-seed-v1"
      }
    },
    "turn_result": {
      "previous_state": {
        "scenario_id": "cybersecurity-crisis",
        "scenario_version": "1.0.0",
        "current_turn": 2,
        "max_turns": 12,
        "metric_values": {
          "system-integrity": 72,
          "threat-level": 31,
          "attacker-momentum": 3,
          "operational-continuity": 80,
          "stakeholder-trust": 70,
          "response-resources": 120
        },
        "status": "active",
        "decision_history": [
          {
            "action_id": "isolate-affected-systems",
            "action_title": "Isolate Affected Systems",
            "turn": 1,
            "sequence": 1,
            "source": "scripted",
            "director_proposal_digest": null,
            "event_id": "phishing-campaign",
            "eligible_event_ids": [
              "phishing-campaign"
            ],
            "event_random_draw": 1,
            "metric_changes": [
              {
                "metric_id": "threat-level",
                "previous_value": 30,
                "new_value": 31,
                "delta": 1,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "attacker-momentum",
                "previous_value": 4,
                "new_value": 3,
                "delta": -1,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "operational-continuity",
                "previous_value": 90,
                "new_value": 80,
                "delta": -10,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "response-resources",
                "previous_value": 140,
                "new_value": 120,
                "delta": -20,
                "exhausted": false,
                "attempted_value": null
              }
            ],
            "resulting_status": "active",
            "outcome_reason": "turn-completed"
          }
        ],
        "seed": {
          "seed": 42,
          "stream_version": "scenario-seed-v1"
        }
      },
      "new_state": {
        "scenario_id": "cybersecurity-crisis",
        "scenario_version": "1.0.0",
        "current_turn": 3,
        "max_turns": 12,
        "metric_values": {
          "system-integrity": 75,
          "threat-level": 31,
          "attacker-momentum": 0,
          "operational-continuity": 70,
          "stakeholder-trust": 70,
          "response-resources": 100
        },
        "status": "active",
        "decision_history": [
          {
            "action_id": "isolate-affected-systems",
            "action_title": "Isolate Affected Systems",
            "turn": 1,
            "sequence": 1,
            "source": "scripted",
            "director_proposal_digest": null,
            "event_id": "phishing-campaign",
            "eligible_event_ids": [
              "phishing-campaign"
            ],
            "event_random_draw": 1,
            "metric_changes": [
              {
                "metric_id": "threat-level",
                "previous_value": 30,
                "new_value": 31,
                "delta": 1,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "attacker-momentum",
                "previous_value": 4,
                "new_value": 3,
                "delta": -1,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "operational-continuity",
                "previous_value": 90,
                "new_value": 80,
                "delta": -10,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "response-resources",
                "previous_value": 140,
                "new_value": 120,
                "delta": -20,
                "exhausted": false,
                "attempted_value": null
              }
            ],
            "resulting_status": "active",
            "outcome_reason": "turn-completed"
          },
          {
            "action_id": "isolate-affected-systems",
            "action_title": "Isolate Affected Systems",
            "turn": 2,
            "sequence": 2,
            "source": "scripted",
            "director_proposal_digest": null,
            "event_id": null,
            "eligible_event_ids": [],
            "event_random_draw": null,
            "metric_changes": [
              {
                "metric_id": "system-integrity",
                "previous_value": 72,
                "new_value": 75,
                "delta": 3,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "attacker-momentum",
                "previous_value": 3,
                "new_value": 0,
                "delta": -3,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "operational-continuity",
                "previous_value": 80,
                "new_value": 70,
                "delta": -10,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "response-resources",
                "previous_value": 120,
                "new_value": 100,
                "delta": -20,
                "exhausted": false,
                "attempted_value": null
              }
            ],
            "resulting_status": "active",
            "outcome_reason": "turn-completed"
          }
        ],
        "seed": {
          "seed": 42,
          "stream_version": "scenario-seed-v1"
        }
      },
      "selected_action": {
        "action_id": "isolate-affected-systems",
        "title": "Isolate Affected Systems",
        "description": "Segment compromised hosts and cut attacker pathways. Slows the attack sharply but takes services offline.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "response-resources",
            "operator": "subtract",
            "value": 20,
            "destination_metric_id": null,
            "description": "Commit 20 responder hours to containment."
          },
          {
            "metric_id": "attacker-momentum",
            "operator": "subtract",
            "value": 3,
            "destination_metric_id": null,
            "description": "Reduce Attacker Momentum by 3."
          },
          {
            "metric_id": "operational-continuity",
            "operator": "subtract",
            "value": 10,
            "destination_metric_id": null,
            "description": "Take isolated services offline (-10%)."
          },
          {
            "metric_id": "system-integrity",
            "operator": "add",
            "value": 3,
            "destination_metric_id": null,
            "description": "Stop further spread inside isolated segments."
          }
        ]
      },
      "triggered_event": null,
      "eligible_event_ids": [],
      "event_random_draw": null,
      "metric_changes": [
        {
          "metric_id": "system-integrity",
          "previous_value": 72,
          "new_value": 75,
          "delta": 3,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "attacker-momentum",
          "previous_value": 3,
          "new_value": 0,
          "delta": -3,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "operational-continuity",
          "previous_value": 80,
          "new_value": 70,
          "delta": -10,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "response-resources",
          "previous_value": 120,
          "new_value": 100,
          "delta": -20,
          "exhausted": false,
          "attempted_value": null
        }
      ],
      "completed_turn_index": 2,
      "resulting_status": "active",
      "outcome_reason": "turn-completed",
      "decision_record": {
        "action_id": "isolate-affected-systems",
        "action_title": "Isolate Affected Systems",
        "turn": 2,
        "sequence": 2,
        "source": "scripted",
        "director_proposal_digest": null,
        "event_id": null,
        "eligible_event_ids": [],
        "event_random_draw": null,
        "metric_changes": [
          {
            "metric_id": "system-integrity",
            "previous_value": 72,
            "new_value": 75,
            "delta": 3,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "attacker-momentum",
            "previous_value": 3,
            "new_value": 0,
            "delta": -3,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "operational-continuity",
            "previous_value": 80,
            "new_value": 70,
            "delta": -10,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "response-resources",
            "previous_value": 120,
            "new_value": 100,
            "delta": -20,
            "exhausted": false,
            "attempted_value": null
          }
        ],
        "resulting_status": "active",
        "outcome_reason": "turn-completed"
      }
    },
    "available_actions": [
      {
        "action_id": "launch-threat-hunt",
        "title": "Launch Threat Hunt",
        "description": "Proactively search for persistence and evict the attacker from footholds it already holds. Forensics briefly pause services.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "response-resources",
            "operator": "subtract",
            "value": 30,
            "destination_metric_id": null,
            "description": "Commit 30 responder hours to hunting."
          },
          {
            "metric_id": "threat-level",
            "operator": "subtract",
            "value": 12,
            "destination_metric_id": null,
            "description": "Evict known footholds (-12 Threat Level)."
          },
          {
            "metric_id": "operational-continuity",
            "operator": "subtract",
            "value": 4,
            "destination_metric_id": null,
            "description": "Forensic imaging pauses some services (-4%)."
          }
        ]
      },
      {
        "action_id": "brief-stakeholders",
        "title": "Brief Stakeholders Transparently",
        "description": "Give leadership, customers, and regulators a candid status update and a clear remediation plan.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "response-resources",
            "operator": "subtract",
            "value": 10,
            "destination_metric_id": null,
            "description": "Commit 10 hours to communications."
          },
          {
            "metric_id": "stakeholder-trust",
            "operator": "add",
            "value": 8,
            "destination_metric_id": null,
            "description": "Improve Stakeholder Trust by 8."
          },
          {
            "metric_id": "operational-continuity",
            "operator": "subtract",
            "value": 2,
            "destination_metric_id": null,
            "description": "Divert leadership attention (-2%)."
          }
        ]
      },
      {
        "action_id": "restore-services",
        "title": "Restore Services and Rotate Staff",
        "description": "Bring business systems back online and rest the response team. Recovers capacity, but the attacker keeps operating.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "operational-continuity",
            "operator": "add",
            "value": 8,
            "destination_metric_id": null,
            "description": "Restore services (+8%)."
          },
          {
            "metric_id": "response-resources",
            "operator": "add",
            "value": 20,
            "destination_metric_id": null,
            "description": "Recover 20 responder hours through rest."
          },
          {
            "metric_id": "attacker-momentum",
            "operator": "add",
            "value": 2,
            "destination_metric_id": null,
            "description": "Reduced vigilance lets the attacker advance (+2)."
          }
        ]
      },
      {
        "action_id": "engage-external-responders",
        "title": "Engage External Responders",
        "description": "Call in an outside incident-response firm. Adds substantial capacity, but signals that the crisis is serious.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "response-resources",
            "operator": "add",
            "value": 45,
            "destination_metric_id": null,
            "description": "Add 45 hours of external responder capacity."
          },
          {
            "metric_id": "stakeholder-trust",
            "operator": "subtract",
            "value": 7,
            "destination_metric_id": null,
            "description": "Stakeholders read the escalation as a warning (-7)."
          }
        ]
      }
    ],
    "action_history": [
      "isolate-affected-systems",
      "isolate-affected-systems"
    ]
  }
]) as unknown as never;

export const cyberBriefingFixture: AIBriefingResponse = ({
  "headline": "Targeted Phishing Campaign Shapes the Latest Turn",
  "situation_summary": "The team chose Isolate Affected Systems: Segment compromised hosts and cut attacker pathways. Slows the attack sharply but takes services offline. The simulation also recorded Targeted Phishing Campaign.",
  "consequence_explanation": "The authoritative engine recorded these movements: Threat Level increased, Attacker Momentum decreased, Operational Continuity decreased, Response Resources decreased.",
  "strategic_insight": "Keep close watch on Threat Level, Operational Continuity, Response Resources after this tradeoff.",
  "next_turn_teaser": "A future turn may test whether this choice remains resilient as conditions change.",
  "source": "fallback"
}) as unknown as never;

export const spaceDefinitionFixture: ScenarioDefinition = ({
  "scenario_id": "space-colony",
  "schema_version": "1.0",
  "version": "1.0.0",
  "title": "Space Colony",
  "description": "Command a fictional Mars settlement of 50 astronauts through twelve mission cycles of scarce oxygen, food, and energy.",
  "category": "space",
  "metadata": {
    "objective": "Sustain all 50 astronauts through 12 mission cycles with life-support reserves, crew morale, and habitat integrity intact.",
    "author": "ScenarioLab",
    "content_locale": "en-US",
    "source": "predefined",
    "tags": [
      "space",
      "resource-management",
      "strategy"
    ],
    "disclaimer": "This fictional simulation uses simplified, illustrative values and is not an engineering or mission-planning model.",
    "source_references": []
  },
  "initial_state": {
    "oxygen": 30,
    "oxygen-balance": -2,
    "food": 36,
    "food-balance": -3,
    "energy": 34,
    "energy-balance": -2,
    "crew-morale": 72,
    "colony-integrity": 80
  },
  "metrics": [
    {
      "metric_id": "oxygen",
      "title": "Oxygen Reserve",
      "description": "Days of breathable air stored for the colony.",
      "kind": "resource",
      "unit": "days",
      "format": {
        "style": "number",
        "decimals": 0,
        "currency_code": null,
        "suffix": " days"
      },
      "initial_value": 30,
      "min_value": 0,
      "max_value": 999,
      "capacity": null,
      "critical_threshold": 8,
      "favorable_direction": "higher"
    },
    {
      "metric_id": "oxygen-balance",
      "title": "Oxygen Balance",
      "description": "Net oxygen production minus consumption, applied to the reserve every cycle.",
      "kind": "count",
      "unit": "days",
      "format": {
        "style": "number",
        "decimals": 0,
        "currency_code": null,
        "suffix": " days/cycle"
      },
      "initial_value": -2,
      "min_value": -12,
      "max_value": 12,
      "capacity": null,
      "critical_threshold": null,
      "favorable_direction": "higher"
    },
    {
      "metric_id": "food",
      "title": "Food Stores",
      "description": "Days of food available for all 50 astronauts.",
      "kind": "resource",
      "unit": "days",
      "format": {
        "style": "number",
        "decimals": 0,
        "currency_code": null,
        "suffix": " days"
      },
      "initial_value": 36,
      "min_value": 0,
      "max_value": 999,
      "capacity": null,
      "critical_threshold": 8,
      "favorable_direction": "higher"
    },
    {
      "metric_id": "food-balance",
      "title": "Food Balance",
      "description": "Net hydroponic harvest minus consumption, applied to stores every cycle.",
      "kind": "count",
      "unit": "days",
      "format": {
        "style": "number",
        "decimals": 0,
        "currency_code": null,
        "suffix": " days/cycle"
      },
      "initial_value": -3,
      "min_value": -12,
      "max_value": 12,
      "capacity": null,
      "critical_threshold": null,
      "favorable_direction": "higher"
    },
    {
      "metric_id": "energy",
      "title": "Energy Reserve",
      "description": "Days of stored power for habitat, labs, and life support.",
      "kind": "resource",
      "unit": "days",
      "format": {
        "style": "number",
        "decimals": 0,
        "currency_code": null,
        "suffix": " days"
      },
      "initial_value": 34,
      "min_value": 0,
      "max_value": 999,
      "capacity": null,
      "critical_threshold": 8,
      "favorable_direction": "higher"
    },
    {
      "metric_id": "energy-balance",
      "title": "Energy Balance",
      "description": "Net generation minus demand, applied to the energy reserve every cycle.",
      "kind": "count",
      "unit": "days",
      "format": {
        "style": "number",
        "decimals": 0,
        "currency_code": null,
        "suffix": " days/cycle"
      },
      "initial_value": -2,
      "min_value": -12,
      "max_value": 12,
      "capacity": null,
      "critical_threshold": null,
      "favorable_direction": "higher"
    },
    {
      "metric_id": "crew-morale",
      "title": "Crew Morale",
      "description": "Psychological resilience and cohesion of the 50-person crew.",
      "kind": "score",
      "unit": "points",
      "format": {
        "style": "score",
        "decimals": 0,
        "currency_code": null,
        "suffix": "/100"
      },
      "initial_value": 72,
      "min_value": 0,
      "max_value": 100,
      "capacity": null,
      "critical_threshold": 15,
      "favorable_direction": "higher"
    },
    {
      "metric_id": "colony-integrity",
      "title": "Colony Integrity",
      "description": "Structural and mechanical condition of habitats and equipment.",
      "kind": "score",
      "unit": "points",
      "format": {
        "style": "score",
        "decimals": 0,
        "currency_code": null,
        "suffix": "/100"
      },
      "initial_value": 80,
      "min_value": 0,
      "max_value": 100,
      "capacity": null,
      "critical_threshold": 20,
      "favorable_direction": "higher"
    }
  ],
  "turn": {
    "duration": 1,
    "unit": "cycle",
    "max_turns": 12
  },
  "actions": [
    {
      "action_id": "repair-oxygen-generators",
      "title": "Overhaul Oxygen Generators",
      "description": "Rebuild electrolysis stacks and scrubbers. Improves oxygen output every cycle, but draws heavily on stored power.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Draw 3 days of stored energy."
        },
        {
          "metric_id": "oxygen-balance",
          "operator": "add",
          "value": 2,
          "destination_metric_id": null,
          "description": "Improve Oxygen Balance by 2 days per cycle."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Long maintenance shifts (-2 morale)."
        }
      ]
    },
    {
      "action_id": "expand-hydroponics",
      "title": "Expand Hydroponics Bay",
      "description": "Bring new grow racks online. Plants add food and a little oxygen every cycle, but lighting costs energy.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Draw 3 days of stored energy for lighting."
        },
        {
          "metric_id": "food-balance",
          "operator": "add",
          "value": 2,
          "destination_metric_id": null,
          "description": "Improve Food Balance by 2 days per cycle."
        },
        {
          "metric_id": "oxygen-balance",
          "operator": "add",
          "value": 1,
          "destination_metric_id": null,
          "description": "Plants improve Oxygen Balance by 1."
        },
        {
          "metric_id": "energy-balance",
          "operator": "subtract",
          "value": 1,
          "destination_metric_id": null,
          "description": "Grow lights add ongoing demand (-1 per cycle)."
        }
      ]
    },
    {
      "action_id": "deploy-solar-arrays",
      "title": "Deploy Additional Solar Arrays",
      "description": "Send surface crews to assemble new panels. Raises generation every cycle at the cost of risky, exhausting surface work.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "energy-balance",
          "operator": "add",
          "value": 3,
          "destination_metric_id": null,
          "description": "Improve Energy Balance by 3 days per cycle."
        },
        {
          "metric_id": "food",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Extra rations for surface crews (-2 days)."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 4,
          "destination_metric_id": null,
          "description": "Hazardous surface work (-4 morale)."
        }
      ]
    },
    {
      "action_id": "habitat-maintenance",
      "title": "Run Habitat Maintenance",
      "description": "Seal micro-leaks, replace worn seals, and service airlocks before small failures become emergencies.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "colony-integrity",
          "operator": "add",
          "value": 9,
          "destination_metric_id": null,
          "description": "Restore 9 points of Colony Integrity."
        },
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Draw 2 days of stored energy."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Tedious maintenance rotation (-2 morale)."
        }
      ]
    },
    {
      "action_id": "crew-rest-rotation",
      "title": "Crew Rest and Recreation",
      "description": "Pause nonessential work for rest, communication with Earth, and a shared meal. Restores the crew but consumes supplies.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "crew-morale",
          "operator": "add",
          "value": 10,
          "destination_metric_id": null,
          "description": "Improve Crew Morale by 10."
        },
        {
          "metric_id": "food",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Shared meal uses 3 days of food."
        }
      ]
    },
    {
      "action_id": "emergency-rationing",
      "title": "Emergency Rationing Protocol",
      "description": "Cut rations, dim habitats, and limit activity. Immediately banks reserves, but the crew bears the strain.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "oxygen",
          "operator": "add",
          "value": 3,
          "destination_metric_id": null,
          "description": "Reduced activity saves 3 days of oxygen."
        },
        {
          "metric_id": "food",
          "operator": "add",
          "value": 5,
          "destination_metric_id": null,
          "description": "Smaller rations save 5 days of food."
        },
        {
          "metric_id": "energy",
          "operator": "add",
          "value": 4,
          "destination_metric_id": null,
          "description": "Dimmed habitats save 4 days of energy."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 9,
          "destination_metric_id": null,
          "description": "Hardship lowers Crew Morale by 9."
        }
      ]
    },
    {
      "action_id": "survey-expedition",
      "title": "Launch Survey Expedition",
      "description": "Send a rover team to survey nearby terrain for subsurface ice and minerals. Costly now, potentially transformative later.",
      "preconditions": [
        {
          "reference": "action-count",
          "operator": "lt",
          "value": 2,
          "metric_id": null,
          "action_id": "survey-expedition"
        }
      ],
      "effects": [
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 4,
          "destination_metric_id": null,
          "description": "Rover operations draw 4 days of energy."
        },
        {
          "metric_id": "food",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Expedition supplies use 3 days of food."
        },
        {
          "metric_id": "crew-morale",
          "operator": "add",
          "value": 5,
          "destination_metric_id": null,
          "description": "Discovery work lifts Crew Morale by 5."
        }
      ]
    }
  ],
  "recurring_rules": [
    {
      "rule_id": "oxygen-cycle",
      "target_metric_id": "oxygen",
      "terms": [
        {
          "metric_id": "oxygen-balance",
          "operator": "add"
        }
      ],
      "underflow_behavior": "exhaust-at-minimum",
      "description": "Apply the net Oxygen Balance to the Oxygen Reserve each cycle."
    },
    {
      "rule_id": "food-cycle",
      "target_metric_id": "food",
      "terms": [
        {
          "metric_id": "food-balance",
          "operator": "add"
        }
      ],
      "underflow_behavior": "exhaust-at-minimum",
      "description": "Apply the net Food Balance to Food Stores each cycle."
    },
    {
      "rule_id": "energy-cycle",
      "target_metric_id": "energy",
      "terms": [
        {
          "metric_id": "energy-balance",
          "operator": "add"
        }
      ],
      "underflow_behavior": "exhaust-at-minimum",
      "description": "Apply the net Energy Balance to the Energy Reserve each cycle."
    }
  ],
  "events": [
    {
      "event_id": "oxygen-scrubber-malfunction",
      "title": "Oxygen Scrubber Malfunction",
      "description": "A carbon-dioxide scrubber fails in the main habitat, and backup units must run at full load.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "turn",
            "operator": "gte",
            "value": 2,
            "metric_id": null,
            "action_id": null
          }
        ],
        "earliest_turn": 2,
        "latest_turn": 7
      },
      "effects": [
        {
          "metric_id": "oxygen-balance",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Lost capacity worsens Oxygen Balance by 2."
        },
        {
          "metric_id": "oxygen",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Emergency venting costs 2 days of oxygen."
        }
      ],
      "weight": 2,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "crop-blight",
      "title": "Hydroponic Crop Blight",
      "description": "A fungal blight spreads through the grow racks before it can be contained.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "lte",
            "value": -1,
            "metric_id": "food-balance",
            "action_id": null
          }
        ],
        "earliest_turn": 3,
        "latest_turn": 10
      },
      "effects": [
        {
          "metric_id": "food",
          "operator": "subtract",
          "value": 5,
          "destination_metric_id": null,
          "description": "Destroyed crops cost 5 days of food."
        },
        {
          "metric_id": "food-balance",
          "operator": "subtract",
          "value": 1,
          "destination_metric_id": null,
          "description": "Damaged racks worsen Food Balance by 1."
        }
      ],
      "weight": 2,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "solar-storm",
      "title": "Solar Storm",
      "description": "A coronal mass ejection forces the crew into shielded quarters and disrupts surface power systems.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "turn",
            "operator": "gte",
            "value": 4,
            "metric_id": null,
            "action_id": null
          }
        ],
        "earliest_turn": 4,
        "latest_turn": 11
      },
      "effects": [
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 5,
          "destination_metric_id": null,
          "description": "Shielding and outages cost 5 days of energy."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 4,
          "destination_metric_id": null,
          "description": "Days in the storm shelter lower morale by 4."
        },
        {
          "metric_id": "colony-integrity",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Radiation damages exposed equipment (-3)."
        }
      ],
      "weight": 2,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "power-system-failure",
      "title": "Power Distribution Failure",
      "description": "An overloaded power bus fails, and engineers reroute critical loads through aging backup lines.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "lte",
            "value": 16,
            "metric_id": "energy",
            "action_id": null
          }
        ],
        "earliest_turn": 3,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "energy-balance",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Inefficient backup lines worsen Energy Balance by 2."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Rolling blackouts lower morale by 3."
        }
      ],
      "weight": 3,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "habitat-breach",
      "title": "Micrometeoroid Habitat Breach",
      "description": "A micrometeoroid punctures a worn habitat module, and the crew seals it off after losing pressure.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "lte",
            "value": 70,
            "metric_id": "colony-integrity",
            "action_id": null
          }
        ],
        "earliest_turn": 5,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "colony-integrity",
          "operator": "subtract",
          "value": 10,
          "destination_metric_id": null,
          "description": "Structural damage reduces integrity by 10."
        },
        {
          "metric_id": "oxygen",
          "operator": "subtract",
          "value": 4,
          "destination_metric_id": null,
          "description": "Lost atmosphere costs 4 days of oxygen."
        }
      ],
      "weight": 3,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "crew-conflict",
      "title": "Crew Conflict",
      "description": "Tension over workloads and rations erupts into an open dispute between two work teams.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "lte",
            "value": 55,
            "metric_id": "crew-morale",
            "action_id": null
          }
        ],
        "earliest_turn": 3,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 6,
          "destination_metric_id": null,
          "description": "Open conflict lowers morale by 6."
        },
        {
          "metric_id": "colony-integrity",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Neglected duties reduce integrity by 2."
        }
      ],
      "weight": 3,
      "max_occurrences": 2,
      "fallback_eligible": true
    },
    {
      "event_id": "medical-emergency",
      "title": "Medical Emergency",
      "description": "An astronaut is seriously injured in a workshop accident, and the medical bay runs around the clock.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "turn",
            "operator": "gte",
            "value": 4,
            "metric_id": null,
            "action_id": null
          }
        ],
        "earliest_turn": 4,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Medical equipment draws 2 days of energy."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 5,
          "destination_metric_id": null,
          "description": "Worry for a crewmate lowers morale by 5."
        }
      ],
      "weight": 1,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "dust-storm",
      "title": "Regional Dust Storm",
      "description": "A dust storm darkens the sky for weeks, coating panels and cutting solar generation.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "turn",
            "operator": "gte",
            "value": 6,
            "metric_id": null,
            "action_id": null
          }
        ],
        "earliest_turn": 6,
        "latest_turn": 11
      },
      "effects": [
        {
          "metric_id": "energy-balance",
          "operator": "subtract",
          "value": 1,
          "destination_metric_id": null,
          "description": "Dusty panels worsen Energy Balance by 1."
        },
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Lost generation costs 3 days of energy."
        }
      ],
      "weight": 2,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "subsurface-ice-discovery",
      "title": "Subsurface Ice Discovery",
      "description": "The survey team confirms a shallow ice deposit within reach of the colony's drilling rig.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "action-count",
            "operator": "gte",
            "value": 1,
            "metric_id": null,
            "action_id": "survey-expedition"
          }
        ],
        "earliest_turn": 2,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "oxygen-balance",
          "operator": "add",
          "value": 2,
          "destination_metric_id": null,
          "description": "Ice electrolysis improves Oxygen Balance by 2."
        },
        {
          "metric_id": "food-balance",
          "operator": "add",
          "value": 1,
          "destination_metric_id": null,
          "description": "More water for crops improves Food Balance by 1."
        },
        {
          "metric_id": "crew-morale",
          "operator": "add",
          "value": 4,
          "destination_metric_id": null,
          "description": "A major discovery lifts morale by 4."
        }
      ],
      "weight": 4,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "resupply-lander",
      "title": "Resupply Lander Arrives",
      "description": "A cargo lander from Earth touches down on the colony's landing pad with supplies and spare parts.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "gte",
            "value": 50,
            "metric_id": "colony-integrity",
            "action_id": null
          }
        ],
        "earliest_turn": 7,
        "latest_turn": 9
      },
      "effects": [
        {
          "metric_id": "food",
          "operator": "add",
          "value": 8,
          "destination_metric_id": null,
          "description": "Delivered supplies add 8 days of food."
        },
        {
          "metric_id": "oxygen",
          "operator": "add",
          "value": 5,
          "destination_metric_id": null,
          "description": "Delivered tanks add 5 days of oxygen."
        },
        {
          "metric_id": "crew-morale",
          "operator": "add",
          "value": 3,
          "destination_metric_id": null,
          "description": "Letters from home lift morale by 3."
        }
      ],
      "weight": 3,
      "max_occurrences": 1,
      "fallback_eligible": true
    },
    {
      "event_id": "record-harvest",
      "title": "Record Harvest",
      "description": "The expanded grow racks deliver the colony's best harvest yet.",
      "trigger": {
        "logic": "all",
        "conditions": [
          {
            "reference": "metric",
            "operator": "gte",
            "value": 1,
            "metric_id": "food-balance",
            "action_id": null
          },
          {
            "reference": "action-count",
            "operator": "gte",
            "value": 1,
            "metric_id": null,
            "action_id": "expand-hydroponics"
          }
        ],
        "earliest_turn": 4,
        "latest_turn": 12
      },
      "effects": [
        {
          "metric_id": "food",
          "operator": "add",
          "value": 6,
          "destination_metric_id": null,
          "description": "Surplus crops add 6 days of food."
        },
        {
          "metric_id": "crew-morale",
          "operator": "add",
          "value": 3,
          "destination_metric_id": null,
          "description": "Fresh produce lifts morale by 3."
        }
      ],
      "weight": 2,
      "max_occurrences": 1,
      "fallback_eligible": true
    }
  ],
  "win_conditions": [
    {
      "condition_id": "colony-sustained",
      "title": "Colony Sustained",
      "description": "After cycle twelve, all 50 astronauts are sustained with every reserve at 10 days or more and a stable, motivated crew.",
      "logic": "all",
      "conditions": [
        {
          "reference": "turn",
          "operator": "gte",
          "value": 12,
          "metric_id": null,
          "action_id": null
        },
        {
          "reference": "metric",
          "operator": "gte",
          "value": 10,
          "metric_id": "oxygen",
          "action_id": null
        },
        {
          "reference": "metric",
          "operator": "gte",
          "value": 10,
          "metric_id": "food",
          "action_id": null
        },
        {
          "reference": "metric",
          "operator": "gte",
          "value": 10,
          "metric_id": "energy",
          "action_id": null
        },
        {
          "reference": "metric",
          "operator": "gte",
          "value": 35,
          "metric_id": "crew-morale",
          "action_id": null
        },
        {
          "reference": "metric",
          "operator": "gte",
          "value": 40,
          "metric_id": "colony-integrity",
          "action_id": null
        }
      ],
      "priority": 50
    }
  ],
  "loss_conditions": [
    {
      "condition_id": "life-support-failure",
      "title": "Life Support Failure",
      "description": "The colony must evacuate when the Oxygen Reserve is exhausted.",
      "logic": "all",
      "conditions": [
        {
          "reference": "metric",
          "operator": "lte",
          "value": 0,
          "metric_id": "oxygen",
          "action_id": null
        }
      ],
      "priority": 100
    },
    {
      "condition_id": "food-exhausted",
      "title": "Food Supplies Exhausted",
      "description": "The mission is abandoned when Food Stores run out.",
      "logic": "all",
      "conditions": [
        {
          "reference": "metric",
          "operator": "lte",
          "value": 0,
          "metric_id": "food",
          "action_id": null
        }
      ],
      "priority": 95
    },
    {
      "condition_id": "total-power-loss",
      "title": "Total Power Loss",
      "description": "Life support cannot run when the Energy Reserve is exhausted.",
      "logic": "all",
      "conditions": [
        {
          "reference": "metric",
          "operator": "lte",
          "value": 0,
          "metric_id": "energy",
          "action_id": null
        }
      ],
      "priority": 90
    },
    {
      "condition_id": "habitat-collapse",
      "title": "Habitat Collapse",
      "description": "The habitat becomes unsafe when Colony Integrity falls to 20 or below.",
      "logic": "all",
      "conditions": [
        {
          "reference": "metric",
          "operator": "lte",
          "value": 20,
          "metric_id": "colony-integrity",
          "action_id": null
        }
      ],
      "priority": 85
    },
    {
      "condition_id": "crew-breakdown",
      "title": "Crew Breakdown",
      "description": "Mission command recalls the crew when Crew Morale falls to 15 or below.",
      "logic": "all",
      "conditions": [
        {
          "reference": "metric",
          "operator": "lte",
          "value": 15,
          "metric_id": "crew-morale",
          "action_id": null
        }
      ],
      "priority": 80
    },
    {
      "condition_id": "colony-unsustainable",
      "title": "Colony Unsustainable",
      "description": "After cycle twelve, the mission ends unsuccessfully if reserves, morale, or habitat integrity are too low to continue.",
      "logic": "all",
      "conditions": [
        {
          "reference": "turn",
          "operator": "gte",
          "value": 12,
          "metric_id": null,
          "action_id": null
        }
      ],
      "priority": 0
    }
  ],
  "calculation": {
    "numeric_mode": "strict-integer-v1",
    "money_mode": "integer-cents",
    "bound_violation": "reject",
    "unsupported_operator": "reject",
    "missing_reference": "reject",
    "effect_order": [
      "action-effects",
      "recurring-rules",
      "event-effects",
      "outcome-evaluation"
    ],
    "random_stream_version": "scenario-seed-v1"
  },
  "fallback": {
    "event_ids": [
      "oxygen-scrubber-malfunction",
      "crop-blight",
      "solar-storm",
      "power-system-failure",
      "habitat-breach",
      "crew-conflict",
      "medical-emergency",
      "dust-storm",
      "subsurface-ice-discovery",
      "resupply-lander",
      "record-harvest"
    ],
    "no_event_allowed": true
  }
}) as unknown as never;

export const spaceStartFixture: GameStartResponse = ({
  "scenario_id": "space-colony",
  "scenario_version": "1.0.0",
  "seed": 42,
  "state": {
    "scenario_id": "space-colony",
    "scenario_version": "1.0.0",
    "current_turn": 1,
    "max_turns": 12,
    "metric_values": {
      "oxygen": 30,
      "oxygen-balance": -2,
      "food": 36,
      "food-balance": -3,
      "energy": 34,
      "energy-balance": -2,
      "crew-morale": 72,
      "colony-integrity": 80
    },
    "status": "not-started",
    "decision_history": [],
    "seed": {
      "seed": 42,
      "stream_version": "scenario-seed-v1"
    }
  },
  "available_actions": [
    {
      "action_id": "repair-oxygen-generators",
      "title": "Overhaul Oxygen Generators",
      "description": "Rebuild electrolysis stacks and scrubbers. Improves oxygen output every cycle, but draws heavily on stored power.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Draw 3 days of stored energy."
        },
        {
          "metric_id": "oxygen-balance",
          "operator": "add",
          "value": 2,
          "destination_metric_id": null,
          "description": "Improve Oxygen Balance by 2 days per cycle."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Long maintenance shifts (-2 morale)."
        }
      ]
    },
    {
      "action_id": "expand-hydroponics",
      "title": "Expand Hydroponics Bay",
      "description": "Bring new grow racks online. Plants add food and a little oxygen every cycle, but lighting costs energy.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Draw 3 days of stored energy for lighting."
        },
        {
          "metric_id": "food-balance",
          "operator": "add",
          "value": 2,
          "destination_metric_id": null,
          "description": "Improve Food Balance by 2 days per cycle."
        },
        {
          "metric_id": "oxygen-balance",
          "operator": "add",
          "value": 1,
          "destination_metric_id": null,
          "description": "Plants improve Oxygen Balance by 1."
        },
        {
          "metric_id": "energy-balance",
          "operator": "subtract",
          "value": 1,
          "destination_metric_id": null,
          "description": "Grow lights add ongoing demand (-1 per cycle)."
        }
      ]
    },
    {
      "action_id": "deploy-solar-arrays",
      "title": "Deploy Additional Solar Arrays",
      "description": "Send surface crews to assemble new panels. Raises generation every cycle at the cost of risky, exhausting surface work.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "energy-balance",
          "operator": "add",
          "value": 3,
          "destination_metric_id": null,
          "description": "Improve Energy Balance by 3 days per cycle."
        },
        {
          "metric_id": "food",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Extra rations for surface crews (-2 days)."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 4,
          "destination_metric_id": null,
          "description": "Hazardous surface work (-4 morale)."
        }
      ]
    },
    {
      "action_id": "habitat-maintenance",
      "title": "Run Habitat Maintenance",
      "description": "Seal micro-leaks, replace worn seals, and service airlocks before small failures become emergencies.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "colony-integrity",
          "operator": "add",
          "value": 9,
          "destination_metric_id": null,
          "description": "Restore 9 points of Colony Integrity."
        },
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Draw 2 days of stored energy."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 2,
          "destination_metric_id": null,
          "description": "Tedious maintenance rotation (-2 morale)."
        }
      ]
    },
    {
      "action_id": "crew-rest-rotation",
      "title": "Crew Rest and Recreation",
      "description": "Pause nonessential work for rest, communication with Earth, and a shared meal. Restores the crew but consumes supplies.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "crew-morale",
          "operator": "add",
          "value": 10,
          "destination_metric_id": null,
          "description": "Improve Crew Morale by 10."
        },
        {
          "metric_id": "food",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Shared meal uses 3 days of food."
        }
      ]
    },
    {
      "action_id": "emergency-rationing",
      "title": "Emergency Rationing Protocol",
      "description": "Cut rations, dim habitats, and limit activity. Immediately banks reserves, but the crew bears the strain.",
      "preconditions": [],
      "effects": [
        {
          "metric_id": "oxygen",
          "operator": "add",
          "value": 3,
          "destination_metric_id": null,
          "description": "Reduced activity saves 3 days of oxygen."
        },
        {
          "metric_id": "food",
          "operator": "add",
          "value": 5,
          "destination_metric_id": null,
          "description": "Smaller rations save 5 days of food."
        },
        {
          "metric_id": "energy",
          "operator": "add",
          "value": 4,
          "destination_metric_id": null,
          "description": "Dimmed habitats save 4 days of energy."
        },
        {
          "metric_id": "crew-morale",
          "operator": "subtract",
          "value": 9,
          "destination_metric_id": null,
          "description": "Hardship lowers Crew Morale by 9."
        }
      ]
    },
    {
      "action_id": "survey-expedition",
      "title": "Launch Survey Expedition",
      "description": "Send a rover team to survey nearby terrain for subsurface ice and minerals. Costly now, potentially transformative later.",
      "preconditions": [
        {
          "reference": "action-count",
          "operator": "lt",
          "value": 2,
          "metric_id": null,
          "action_id": "survey-expedition"
        }
      ],
      "effects": [
        {
          "metric_id": "energy",
          "operator": "subtract",
          "value": 4,
          "destination_metric_id": null,
          "description": "Rover operations draw 4 days of energy."
        },
        {
          "metric_id": "food",
          "operator": "subtract",
          "value": 3,
          "destination_metric_id": null,
          "description": "Expedition supplies use 3 days of food."
        },
        {
          "metric_id": "crew-morale",
          "operator": "add",
          "value": 5,
          "destination_metric_id": null,
          "description": "Discovery work lifts Crew Morale by 5."
        }
      ]
    }
  ],
  "scenario": {
    "title": "Space Colony",
    "description": "Command a fictional Mars settlement of 50 astronauts through twelve mission cycles of scarce oxygen, food, and energy.",
    "objective": "Sustain all 50 astronauts through 12 mission cycles with life-support reserves, crew morale, and habitat integrity intact.",
    "turn": {
      "duration": 1,
      "unit": "cycle",
      "max_turns": 12
    },
    "metrics": [
      {
        "metric_id": "oxygen",
        "title": "Oxygen Reserve",
        "description": "Days of breathable air stored for the colony.",
        "kind": "resource",
        "unit": "days",
        "format": {
          "style": "number",
          "decimals": 0,
          "currency_code": null,
          "suffix": " days"
        },
        "initial_value": 30,
        "min_value": 0,
        "max_value": 999,
        "capacity": null,
        "critical_threshold": 8,
        "favorable_direction": "higher"
      },
      {
        "metric_id": "oxygen-balance",
        "title": "Oxygen Balance",
        "description": "Net oxygen production minus consumption, applied to the reserve every cycle.",
        "kind": "count",
        "unit": "days",
        "format": {
          "style": "number",
          "decimals": 0,
          "currency_code": null,
          "suffix": " days/cycle"
        },
        "initial_value": -2,
        "min_value": -12,
        "max_value": 12,
        "capacity": null,
        "critical_threshold": null,
        "favorable_direction": "higher"
      },
      {
        "metric_id": "food",
        "title": "Food Stores",
        "description": "Days of food available for all 50 astronauts.",
        "kind": "resource",
        "unit": "days",
        "format": {
          "style": "number",
          "decimals": 0,
          "currency_code": null,
          "suffix": " days"
        },
        "initial_value": 36,
        "min_value": 0,
        "max_value": 999,
        "capacity": null,
        "critical_threshold": 8,
        "favorable_direction": "higher"
      },
      {
        "metric_id": "food-balance",
        "title": "Food Balance",
        "description": "Net hydroponic harvest minus consumption, applied to stores every cycle.",
        "kind": "count",
        "unit": "days",
        "format": {
          "style": "number",
          "decimals": 0,
          "currency_code": null,
          "suffix": " days/cycle"
        },
        "initial_value": -3,
        "min_value": -12,
        "max_value": 12,
        "capacity": null,
        "critical_threshold": null,
        "favorable_direction": "higher"
      },
      {
        "metric_id": "energy",
        "title": "Energy Reserve",
        "description": "Days of stored power for habitat, labs, and life support.",
        "kind": "resource",
        "unit": "days",
        "format": {
          "style": "number",
          "decimals": 0,
          "currency_code": null,
          "suffix": " days"
        },
        "initial_value": 34,
        "min_value": 0,
        "max_value": 999,
        "capacity": null,
        "critical_threshold": 8,
        "favorable_direction": "higher"
      },
      {
        "metric_id": "energy-balance",
        "title": "Energy Balance",
        "description": "Net generation minus demand, applied to the energy reserve every cycle.",
        "kind": "count",
        "unit": "days",
        "format": {
          "style": "number",
          "decimals": 0,
          "currency_code": null,
          "suffix": " days/cycle"
        },
        "initial_value": -2,
        "min_value": -12,
        "max_value": 12,
        "capacity": null,
        "critical_threshold": null,
        "favorable_direction": "higher"
      },
      {
        "metric_id": "crew-morale",
        "title": "Crew Morale",
        "description": "Psychological resilience and cohesion of the 50-person crew.",
        "kind": "score",
        "unit": "points",
        "format": {
          "style": "score",
          "decimals": 0,
          "currency_code": null,
          "suffix": "/100"
        },
        "initial_value": 72,
        "min_value": 0,
        "max_value": 100,
        "capacity": null,
        "critical_threshold": 15,
        "favorable_direction": "higher"
      },
      {
        "metric_id": "colony-integrity",
        "title": "Colony Integrity",
        "description": "Structural and mechanical condition of habitats and equipment.",
        "kind": "score",
        "unit": "points",
        "format": {
          "style": "score",
          "decimals": 0,
          "currency_code": null,
          "suffix": "/100"
        },
        "initial_value": 80,
        "min_value": 0,
        "max_value": 100,
        "capacity": null,
        "critical_threshold": 20,
        "favorable_direction": "higher"
      }
    ]
  }
}) as unknown as never;

export const spaceTurnsFixture: GameTurnResponse[] = ([
  {
    "scenario_id": "space-colony",
    "scenario_version": "1.0.0",
    "seed": 42,
    "state": {
      "scenario_id": "space-colony",
      "scenario_version": "1.0.0",
      "current_turn": 2,
      "max_turns": 12,
      "metric_values": {
        "oxygen": 29,
        "oxygen-balance": -1,
        "food": 35,
        "food-balance": -1,
        "energy": 28,
        "energy-balance": -3,
        "crew-morale": 72,
        "colony-integrity": 80
      },
      "status": "active",
      "decision_history": [
        {
          "action_id": "expand-hydroponics",
          "action_title": "Expand Hydroponics Bay",
          "turn": 1,
          "sequence": 1,
          "source": "scripted",
          "director_proposal_digest": null,
          "event_id": null,
          "eligible_event_ids": [],
          "event_random_draw": null,
          "metric_changes": [
            {
              "metric_id": "oxygen",
              "previous_value": 30,
              "new_value": 29,
              "delta": -1,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "oxygen-balance",
              "previous_value": -2,
              "new_value": -1,
              "delta": 1,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "food",
              "previous_value": 36,
              "new_value": 35,
              "delta": -1,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "food-balance",
              "previous_value": -3,
              "new_value": -1,
              "delta": 2,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "energy",
              "previous_value": 34,
              "new_value": 28,
              "delta": -6,
              "exhausted": false,
              "attempted_value": null
            },
            {
              "metric_id": "energy-balance",
              "previous_value": -2,
              "new_value": -3,
              "delta": -1,
              "exhausted": false,
              "attempted_value": null
            }
          ],
          "resulting_status": "active",
          "outcome_reason": "turn-completed"
        }
      ],
      "seed": {
        "seed": 42,
        "stream_version": "scenario-seed-v1"
      }
    },
    "turn_result": {
      "previous_state": {
        "scenario_id": "space-colony",
        "scenario_version": "1.0.0",
        "current_turn": 1,
        "max_turns": 12,
        "metric_values": {
          "oxygen": 30,
          "oxygen-balance": -2,
          "food": 36,
          "food-balance": -3,
          "energy": 34,
          "energy-balance": -2,
          "crew-morale": 72,
          "colony-integrity": 80
        },
        "status": "not-started",
        "decision_history": [],
        "seed": {
          "seed": 42,
          "stream_version": "scenario-seed-v1"
        }
      },
      "new_state": {
        "scenario_id": "space-colony",
        "scenario_version": "1.0.0",
        "current_turn": 2,
        "max_turns": 12,
        "metric_values": {
          "oxygen": 29,
          "oxygen-balance": -1,
          "food": 35,
          "food-balance": -1,
          "energy": 28,
          "energy-balance": -3,
          "crew-morale": 72,
          "colony-integrity": 80
        },
        "status": "active",
        "decision_history": [
          {
            "action_id": "expand-hydroponics",
            "action_title": "Expand Hydroponics Bay",
            "turn": 1,
            "sequence": 1,
            "source": "scripted",
            "director_proposal_digest": null,
            "event_id": null,
            "eligible_event_ids": [],
            "event_random_draw": null,
            "metric_changes": [
              {
                "metric_id": "oxygen",
                "previous_value": 30,
                "new_value": 29,
                "delta": -1,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "oxygen-balance",
                "previous_value": -2,
                "new_value": -1,
                "delta": 1,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "food",
                "previous_value": 36,
                "new_value": 35,
                "delta": -1,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "food-balance",
                "previous_value": -3,
                "new_value": -1,
                "delta": 2,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "energy",
                "previous_value": 34,
                "new_value": 28,
                "delta": -6,
                "exhausted": false,
                "attempted_value": null
              },
              {
                "metric_id": "energy-balance",
                "previous_value": -2,
                "new_value": -3,
                "delta": -1,
                "exhausted": false,
                "attempted_value": null
              }
            ],
            "resulting_status": "active",
            "outcome_reason": "turn-completed"
          }
        ],
        "seed": {
          "seed": 42,
          "stream_version": "scenario-seed-v1"
        }
      },
      "selected_action": {
        "action_id": "expand-hydroponics",
        "title": "Expand Hydroponics Bay",
        "description": "Bring new grow racks online. Plants add food and a little oxygen every cycle, but lighting costs energy.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "energy",
            "operator": "subtract",
            "value": 3,
            "destination_metric_id": null,
            "description": "Draw 3 days of stored energy for lighting."
          },
          {
            "metric_id": "food-balance",
            "operator": "add",
            "value": 2,
            "destination_metric_id": null,
            "description": "Improve Food Balance by 2 days per cycle."
          },
          {
            "metric_id": "oxygen-balance",
            "operator": "add",
            "value": 1,
            "destination_metric_id": null,
            "description": "Plants improve Oxygen Balance by 1."
          },
          {
            "metric_id": "energy-balance",
            "operator": "subtract",
            "value": 1,
            "destination_metric_id": null,
            "description": "Grow lights add ongoing demand (-1 per cycle)."
          }
        ]
      },
      "triggered_event": null,
      "eligible_event_ids": [],
      "event_random_draw": null,
      "metric_changes": [
        {
          "metric_id": "oxygen",
          "previous_value": 30,
          "new_value": 29,
          "delta": -1,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "oxygen-balance",
          "previous_value": -2,
          "new_value": -1,
          "delta": 1,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "food",
          "previous_value": 36,
          "new_value": 35,
          "delta": -1,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "food-balance",
          "previous_value": -3,
          "new_value": -1,
          "delta": 2,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "energy",
          "previous_value": 34,
          "new_value": 28,
          "delta": -6,
          "exhausted": false,
          "attempted_value": null
        },
        {
          "metric_id": "energy-balance",
          "previous_value": -2,
          "new_value": -3,
          "delta": -1,
          "exhausted": false,
          "attempted_value": null
        }
      ],
      "completed_turn_index": 1,
      "resulting_status": "active",
      "outcome_reason": "turn-completed",
      "decision_record": {
        "action_id": "expand-hydroponics",
        "action_title": "Expand Hydroponics Bay",
        "turn": 1,
        "sequence": 1,
        "source": "scripted",
        "director_proposal_digest": null,
        "event_id": null,
        "eligible_event_ids": [],
        "event_random_draw": null,
        "metric_changes": [
          {
            "metric_id": "oxygen",
            "previous_value": 30,
            "new_value": 29,
            "delta": -1,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "oxygen-balance",
            "previous_value": -2,
            "new_value": -1,
            "delta": 1,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "food",
            "previous_value": 36,
            "new_value": 35,
            "delta": -1,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "food-balance",
            "previous_value": -3,
            "new_value": -1,
            "delta": 2,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "energy",
            "previous_value": 34,
            "new_value": 28,
            "delta": -6,
            "exhausted": false,
            "attempted_value": null
          },
          {
            "metric_id": "energy-balance",
            "previous_value": -2,
            "new_value": -3,
            "delta": -1,
            "exhausted": false,
            "attempted_value": null
          }
        ],
        "resulting_status": "active",
        "outcome_reason": "turn-completed"
      }
    },
    "available_actions": [
      {
        "action_id": "repair-oxygen-generators",
        "title": "Overhaul Oxygen Generators",
        "description": "Rebuild electrolysis stacks and scrubbers. Improves oxygen output every cycle, but draws heavily on stored power.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "energy",
            "operator": "subtract",
            "value": 3,
            "destination_metric_id": null,
            "description": "Draw 3 days of stored energy."
          },
          {
            "metric_id": "oxygen-balance",
            "operator": "add",
            "value": 2,
            "destination_metric_id": null,
            "description": "Improve Oxygen Balance by 2 days per cycle."
          },
          {
            "metric_id": "crew-morale",
            "operator": "subtract",
            "value": 2,
            "destination_metric_id": null,
            "description": "Long maintenance shifts (-2 morale)."
          }
        ]
      },
      {
        "action_id": "expand-hydroponics",
        "title": "Expand Hydroponics Bay",
        "description": "Bring new grow racks online. Plants add food and a little oxygen every cycle, but lighting costs energy.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "energy",
            "operator": "subtract",
            "value": 3,
            "destination_metric_id": null,
            "description": "Draw 3 days of stored energy for lighting."
          },
          {
            "metric_id": "food-balance",
            "operator": "add",
            "value": 2,
            "destination_metric_id": null,
            "description": "Improve Food Balance by 2 days per cycle."
          },
          {
            "metric_id": "oxygen-balance",
            "operator": "add",
            "value": 1,
            "destination_metric_id": null,
            "description": "Plants improve Oxygen Balance by 1."
          },
          {
            "metric_id": "energy-balance",
            "operator": "subtract",
            "value": 1,
            "destination_metric_id": null,
            "description": "Grow lights add ongoing demand (-1 per cycle)."
          }
        ]
      },
      {
        "action_id": "deploy-solar-arrays",
        "title": "Deploy Additional Solar Arrays",
        "description": "Send surface crews to assemble new panels. Raises generation every cycle at the cost of risky, exhausting surface work.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "energy-balance",
            "operator": "add",
            "value": 3,
            "destination_metric_id": null,
            "description": "Improve Energy Balance by 3 days per cycle."
          },
          {
            "metric_id": "food",
            "operator": "subtract",
            "value": 2,
            "destination_metric_id": null,
            "description": "Extra rations for surface crews (-2 days)."
          },
          {
            "metric_id": "crew-morale",
            "operator": "subtract",
            "value": 4,
            "destination_metric_id": null,
            "description": "Hazardous surface work (-4 morale)."
          }
        ]
      },
      {
        "action_id": "habitat-maintenance",
        "title": "Run Habitat Maintenance",
        "description": "Seal micro-leaks, replace worn seals, and service airlocks before small failures become emergencies.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "colony-integrity",
            "operator": "add",
            "value": 9,
            "destination_metric_id": null,
            "description": "Restore 9 points of Colony Integrity."
          },
          {
            "metric_id": "energy",
            "operator": "subtract",
            "value": 2,
            "destination_metric_id": null,
            "description": "Draw 2 days of stored energy."
          },
          {
            "metric_id": "crew-morale",
            "operator": "subtract",
            "value": 2,
            "destination_metric_id": null,
            "description": "Tedious maintenance rotation (-2 morale)."
          }
        ]
      },
      {
        "action_id": "crew-rest-rotation",
        "title": "Crew Rest and Recreation",
        "description": "Pause nonessential work for rest, communication with Earth, and a shared meal. Restores the crew but consumes supplies.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "crew-morale",
            "operator": "add",
            "value": 10,
            "destination_metric_id": null,
            "description": "Improve Crew Morale by 10."
          },
          {
            "metric_id": "food",
            "operator": "subtract",
            "value": 3,
            "destination_metric_id": null,
            "description": "Shared meal uses 3 days of food."
          }
        ]
      },
      {
        "action_id": "emergency-rationing",
        "title": "Emergency Rationing Protocol",
        "description": "Cut rations, dim habitats, and limit activity. Immediately banks reserves, but the crew bears the strain.",
        "preconditions": [],
        "effects": [
          {
            "metric_id": "oxygen",
            "operator": "add",
            "value": 3,
            "destination_metric_id": null,
            "description": "Reduced activity saves 3 days of oxygen."
          },
          {
            "metric_id": "food",
            "operator": "add",
            "value": 5,
            "destination_metric_id": null,
            "description": "Smaller rations save 5 days of food."
          },
          {
            "metric_id": "energy",
            "operator": "add",
            "value": 4,
            "destination_metric_id": null,
            "description": "Dimmed habitats save 4 days of energy."
          },
          {
            "metric_id": "crew-morale",
            "operator": "subtract",
            "value": 9,
            "destination_metric_id": null,
            "description": "Hardship lowers Crew Morale by 9."
          }
        ]
      },
      {
        "action_id": "survey-expedition",
        "title": "Launch Survey Expedition",
        "description": "Send a rover team to survey nearby terrain for subsurface ice and minerals. Costly now, potentially transformative later.",
        "preconditions": [
          {
            "reference": "action-count",
            "operator": "lt",
            "value": 2,
            "metric_id": null,
            "action_id": "survey-expedition"
          }
        ],
        "effects": [
          {
            "metric_id": "energy",
            "operator": "subtract",
            "value": 4,
            "destination_metric_id": null,
            "description": "Rover operations draw 4 days of energy."
          },
          {
            "metric_id": "food",
            "operator": "subtract",
            "value": 3,
            "destination_metric_id": null,
            "description": "Expedition supplies use 3 days of food."
          },
          {
            "metric_id": "crew-morale",
            "operator": "add",
            "value": 5,
            "destination_metric_id": null,
            "description": "Discovery work lifts Crew Morale by 5."
          }
        ]
      }
    ],
    "action_history": [
      "expand-hydroponics"
    ]
  }
]) as unknown as never;

export const spaceBriefingFixture: AIBriefingResponse = ({
  "headline": "Expand Hydroponics Bay Sets the Course",
  "situation_summary": "The team chose Expand Hydroponics Bay: Bring new grow racks online. Plants add food and a little oxygen every cycle, but lighting costs energy.",
  "consequence_explanation": "The authoritative engine recorded these movements: Oxygen Reserve decreased, Oxygen Balance increased, Food Stores decreased, Food Balance increased, Energy Reserve decreased, Energy Balance decreased.",
  "strategic_insight": "Keep close watch on Oxygen Reserve, Food Stores, Energy Reserve, Energy Balance after this tradeoff.",
  "next_turn_teaser": "A future turn may test whether this choice remains resilient as conditions change.",
  "source": "fallback"
}) as unknown as never;

export const catalogFixture: ScenarioCatalogEntry[] = ([
  {
    "scenario_id": "startup-survival",
    "title": "Startup Survival",
    "description": "Guide an early-stage company through twelve months of difficult financial, customer, and team tradeoffs.",
    "category": "business",
    "objective": "Keep a startup alive for 12 simulated months.",
    "availability": "available",
    "planned_key_metrics": [
      "Cash",
      "Monthly Revenue",
      "Monthly Expenses",
      "Active Users",
      "Employees",
      "Customer Satisfaction",
      "Team Morale"
    ],
    "ai_features": [
      "scenario-director",
      "live-briefings"
    ]
  },
  {
    "scenario_id": "cybersecurity-crisis",
    "title": "Cybersecurity Crisis",
    "description": "Lead an incident-response team through twelve rounds of an escalating attack while balancing containment, continuity, and trust.",
    "category": "cybersecurity",
    "objective": "Contain the attack within 12 rounds while keeping the organization operating.",
    "availability": "available",
    "planned_key_metrics": [
      "System Integrity",
      "Threat Level",
      "Attacker Momentum",
      "Operational Continuity",
      "Stakeholder Trust",
      "Response Resources"
    ],
    "ai_features": []
  },
  {
    "scenario_id": "space-colony",
    "title": "Space Colony",
    "description": "Keep a Mars settlement of 50 astronauts alive through twelve mission cycles of shortages, equipment failures, and discoveries.",
    "category": "space",
    "objective": "Sustain a 50-astronaut Mars colony for 12 mission cycles.",
    "availability": "available",
    "planned_key_metrics": [
      "Oxygen",
      "Food",
      "Energy",
      "Crew Morale",
      "Colony Integrity"
    ],
    "ai_features": []
  }
]) as unknown as never;
