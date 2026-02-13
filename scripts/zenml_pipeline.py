"""
ZenML pipeline — thin step wrappers around existing training modules.
Each step calls existing functions, no duplicated logic.
"""

from typing import Annotated

import pandas as pd
from sklearn.base import ClassifierMixin
from zenml import pipeline, step, log_metadata, add_tags, ArtifactConfig
from zenml.enums import ArtifactType

from training.config import TrainConfig, load_config
from training.data_loader import load_training_data
from training.evaluation import compute_metrics
from training.models import ModelFactory


@step(enable_cache=False)
def load_data(config: TrainConfig) -> Annotated[
    pd.DataFrame,
    ArtifactConfig(name="training_data", artifact_type=ArtifactType.DATA),
]:
    """Load and validate features from Feast offline store."""
    df = load_training_data(config.data)

    log_metadata(metadata={
        "n_rows": len(df),
        "n_columns": len(df.columns),
        "columns": list(df.columns),
    }, infer_artifact=True)
    add_tags(tags=["feast", "diabetes"], infer_artifact=True)

    return df


@step
def split_data(
    df: pd.DataFrame,
    config: TrainConfig,
) -> tuple[
    Annotated[pd.DataFrame, ArtifactConfig(name="X_train", artifact_type=ArtifactType.DATA)],
    Annotated[pd.DataFrame, ArtifactConfig(name="X_test", artifact_type=ArtifactType.DATA)],
    Annotated[pd.Series, "y_train"],
    Annotated[pd.Series, "y_test"],
    Annotated[list[str], "feature_names"],
]:
    """Split into train/test sets."""
    from sklearn.model_selection import train_test_split

    feature_cols = [
        c for c in df.columns
        if c not in (config.data.target_column, "patient_id", "event_timestamp")
    ]
    X = df[feature_cols]
    y = df[config.data.target_column]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=config.data.test_size,
        random_state=config.data.random_state,
    )

    log_metadata(metadata={
        "test_size": config.data.test_size,
        "n_train": len(X_train),
        "n_test": len(X_test),
        "n_features": len(feature_cols),
        "train_positive_ratio": round(float(y_train.mean()), 4),
    })

    return X_train, X_test, y_train, y_test, feature_cols


@step
def train_model(
    trainer_name: str,
    trainer_params: dict,
    X_train: pd.DataFrame,
    y_train: pd.Series,
) -> Annotated[ClassifierMixin, ArtifactConfig(name="trained_model", artifact_type=ArtifactType.MODEL)]:
    """Train a single model."""
    from training.models import DecisionTreeTrainer, KNNTrainer

    registry = {"decision_tree": DecisionTreeTrainer, "knn": KNNTrainer}
    model = registry[trainer_name](trainer_params).build()
    model.fit(X_train, y_train)

    log_metadata(metadata={
        "algorithm": trainer_name,
        "params": trainer_params,
    }, infer_artifact=True)
    add_tags(tags=[trainer_name, "classification"], infer_artifact=True)

    return model


@step
def evaluate(
    model: ClassifierMixin,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> Annotated[dict, ArtifactConfig(name="evaluation_metrics", artifact_type=ArtifactType.DATA)]:
    """Evaluate model metrics."""
    metrics = compute_metrics(model, X_test, y_test)

    log_metadata(metadata=metrics, infer_artifact=True)
    add_tags(tags=["evaluation"], infer_artifact=True)

    return metrics


@step(enable_cache=False)
def log_to_mlflow(
    model: ClassifierMixin,
    metrics: dict,
    trainer_name: str,
    trainer_params: dict,
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    feature_names: list[str],
    config: TrainConfig,
) -> None:
    """Log params, metrics, artifacts and model to MLflow."""
    import mlflow
    from training.visualization import generate_all_artifacts

    mlflow.set_tracking_uri(config.mlflow.tracking_uri)
    mlflow.set_experiment(config.mlflow.experiment_name)

    with mlflow.start_run(run_name=trainer_name):
        mlflow.set_tags({
            "model_type": "classification",
            "algorithm": trainer_name,
            "dataset": "diabetes_dataset",
            "orchestrator": "zenml",
        })
        mlflow.log_params(trainer_params)
        mlflow.log_params({
            "n_features": len(feature_names),
            "n_train_samples": len(X_train),
            "n_test_samples": len(X_test),
            "train_positive_ratio": round(float(y_train.mean()), 4),
            "test_positive_ratio": round(float(y_test.mean()), 4),
        })
        mlflow.log_metrics(metrics)

        for path in generate_all_artifacts(model, X_test, y_test, feature_names, trainer_name):
            mlflow.log_artifact(str(path))

        mlflow.sklearn.log_model(model, name="model")


@pipeline(name="diabetes_training_pipeline", enable_cache=True)
def training_pipeline():
    """load_data → split_data → [train → evaluate → log] per model."""

    config = load_config()

    df = load_data(config=config)
    X_train, X_test, y_train, y_test, feature_names = split_data(df=df, config=config)

    trainers = ModelFactory.create(config.models)

    for trainer in trainers:
        model = train_model(
            trainer_name=trainer.name(),
            trainer_params=trainer.params(),
            X_train=X_train,
            y_train=y_train,
            id=f"train_{trainer.name()}",
        )
        metrics = evaluate(
            model=model,
            X_test=X_test,
            y_test=y_test,
            id=f"evaluate_{trainer.name()}",
        )
        log_to_mlflow(
            model=model,
            metrics=metrics,
            trainer_name=trainer.name(),
            trainer_params=trainer.params(),
            X_train=X_train,
            X_test=X_test,
            y_train=y_train,
            y_test=y_test,
            feature_names=feature_names,
            config=config,
            id=f"log_{trainer.name()}",
        )


if __name__ == "__main__":
    training_pipeline()
