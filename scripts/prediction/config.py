"""Pydantic configuration for prediction pipeline."""

from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel


class PredictionMLflowConfig(BaseModel):
    tracking_uri: str
    experiment_name: str
    model_name: str = "decision_tree"  # fallback if no registry_name
    registry_name: Optional[str] = None  # registered model name in MLflow
    alias: str = "latest"  # registry alias: latest, champion, etc.


class PredictionConfig(BaseModel):
    mlflow: PredictionMLflowConfig


def load_prediction_config(path: str | None = None) -> PredictionConfig:
    if path is None:
        path = str(Path(__file__).parent.parent / "config" / "prediction_config.yaml")
    with open(path, "r") as f:
        raw = yaml.safe_load(f)
    return PredictionConfig(**raw)
