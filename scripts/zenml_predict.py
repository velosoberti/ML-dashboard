"""ZenML prediction pipeline — load model → predict → return results."""

from typing import Annotated

from zenml import pipeline, step, log_metadata, add_tags

from prediction.config import load_prediction_config
from prediction.model_loader import ModelLoader
from prediction.predictor import predict_batch
from prediction.schemas import PredictionInput


SAMPLE_PATIENTS = [
    {"Pregnancies": 6, "Glucose": 148, "BloodPressure": 72,
     "SkinThickness": 35, "Insulin": 0, "BMI": 33.6,
     "DiabetesPedigreeFunction": 0.627, "Age": 50},
    {"Pregnancies": 1, "Glucose": 85, "BloodPressure": 66,
     "SkinThickness": 29, "Insulin": 0, "BMI": 26.6,
     "DiabetesPedigreeFunction": 0.351, "Age": 31},
]


@step
def load_model() -> Annotated[str, "model_info"]:
    """Load model from MLflow (registry if configured, else run-based fallback)."""
    config = load_prediction_config()
    loader = ModelLoader()
    loader.load(config)

    log_metadata(metadata={
        "model_name": loader.model_name,
        "version": loader.model_version or "run-based",
        "alias": loader.model_alias or "none",
        "experiment": config.mlflow.experiment_name,
    })
    add_tags(tags=["mlflow", loader.model_name or config.mlflow.model_name])

    return loader.model_name or config.mlflow.model_name


@step
def predict(model_name: str) -> Annotated[list[dict], "predictions"]:
    """Run predictions using loaded model."""
    config = load_prediction_config()
    loader = ModelLoader()
    loader.load(config)

    patients = [PredictionInput(**p) for p in SAMPLE_PATIENTS]
    results = predict_batch(patients, loader)

    log_metadata(metadata={
        "n_predictions": len(results),
        "model_used": model_name,
        "positive_predictions": sum(1 for r in results if r.prediction == 1),
    })
    add_tags(tags=["prediction", "diabetes"])

    return [r.model_dump() for r in results]


@pipeline(name="diabetes_predict_v2")
def prediction_pipeline():
    """load_model → predict."""
    model_name = load_model()
    predict(model_name=model_name)


if __name__ == "__main__":
    prediction_pipeline()
