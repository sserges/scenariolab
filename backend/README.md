# ScenarioLab API and Engine

The package contains the FastAPI scenario catalog and stateless game transport plus
the pure deterministic simulation engine. `POST /api/games/start` initializes a run;
`POST /api/games/turn` reconstructs prior state from the pinned seed and action IDs
before resolving one new action. No server-side game session is stored.
