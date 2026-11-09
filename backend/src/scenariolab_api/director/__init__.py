"""Authenticated Director support for Startup Survival."""

__all__ = ["DirectorFailure", "DirectorService"]


def __getattr__(name: str) -> object:
    if name in __all__:
        from scenariolab_api.director.service import DirectorFailure, DirectorService

        return {
            "DirectorFailure": DirectorFailure,
            "DirectorService": DirectorService,
        }[name]
    raise AttributeError(name)
