"""Model trainers and factory — decoupled from MLflow and data loading."""

from abc import ABC, abstractmethod
from typing import Any

from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier

from training.config import ModelsConfig


class ModelTrainer(ABC):
    """Interface every trainer must implement."""

    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def build(self) -> Any: ...

    @abstractmethod
    def params(self) -> dict[str, Any]: ...


class DecisionTreeTrainer(ModelTrainer):

    def __init__(self, params: dict[str, Any]) -> None:
        self._params = params

    def name(self) -> str:
        return "decision_tree"

    def build(self) -> DecisionTreeClassifier:
        return DecisionTreeClassifier(**self._params)

    def params(self) -> dict[str, Any]:
        return self._params


class KNNTrainer(ModelTrainer):

    def __init__(self, params: dict[str, Any]) -> None:
        self._params = params

    def name(self) -> str:
        return "knn"

    def build(self) -> KNeighborsClassifier:
        return KNeighborsClassifier(**self._params)

    def params(self) -> dict[str, Any]:
        return self._params


class ModelFactory:
    """Creates trainers based on config — add new models here."""

    _registry: dict[str, type[ModelTrainer]] = {
        "decision_tree": DecisionTreeTrainer,
        "knn": KNNTrainer,
    }

    @classmethod
    def create(cls, config: ModelsConfig) -> list[ModelTrainer]:
        trainers: list[ModelTrainer] = []

        model_configs = {
            "decision_tree": config.decision_tree,
            "knn": config.knn,
        }

        for name, model_cfg in model_configs.items():
            if model_cfg.enabled and name in cls._registry:
                trainers.append(cls._registry[name](model_cfg.params))

        return trainers
