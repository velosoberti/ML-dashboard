"""Pydantic configuration models — validated at startup."""

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator


class MLflowConfig(BaseModel):
    tracking_uri: str
    experiment_name: str


class DataConfig(BaseModel):
    feature_repo_path: Path
    source_data_path: Path
    target_column: str = "Outcome"
    test_size: float = Field(default=0.2, gt=0.0, lt=1.0)
    random_state: int = 42

    @field_validator("feature_repo_path")
    @classmethod
    def repo_must_exist(cls, v: Path) -> Path:
        if not v.exists():
            raise FileNotFoundError(f"Feature repo not found: {v}")
        return v

    @field_validator("source_data_path")
    @classmethod
    def source_must_exist(cls, v: Path) -> Path:
        if not v.exists():
            raise FileNotFoundError(f"Source data not found: {v}")
        return v


class ModelParams(BaseModel):
    enabled: bool = True
    params: dict[str, Any] = Field(default_factory=dict)


class ModelsConfig(BaseModel):
    decision_tree: ModelParams = Field(default_factory=ModelParams)
    knn: ModelParams = Field(default_factory=ModelParams)


class TrainConfig(BaseModel):
    mlflow: MLflowConfig
    data: DataConfig
    models: ModelsConfig


def load_config(path: str | None = None) -> TrainConfig:
    if path is None:
        path = str(Path(__file__).parent.parent / "config" / "train_config.yaml")
    with open(path, "r") as f:
        raw = yaml.safe_load(f)
    return TrainConfig(**raw)
