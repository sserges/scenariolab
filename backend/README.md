# ScenarioLab API and Engine

The package contains the FastAPI scenario catalog transport and the pure deterministic
simulation engine. Brick 4 does not expose game-session HTTP endpoints; callers use
`scenariolab_api.engine` directly until the application lifecycle is introduced.
