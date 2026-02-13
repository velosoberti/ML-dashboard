"""Prediction logic — decoupled from Flask and ZenML."""

import pandas as pd

from prediction.model_loader import ModelLoader
from prediction.schemas import PredictionInput, PredictionOutput


def predict_single(patient: PredictionInput, loader: ModelLoader) -> PredictionOutput:
    """Run prediction for a single patient."""

    df = pd.DataFrame([patient.model_dump()])
    model = loader.model

    prediction = int(model.predict(df)[0])
    probability = float(model.predict_proba(df)[0][1])

    return PredictionOutput(
        prediction=prediction,
        probability=round(probability, 4),
        model_name=loader.model_name,
    )


def predict_batch(
    patients: list[PredictionInput], loader: ModelLoader
) -> list[PredictionOutput]:
    """Run prediction for multiple patients."""

    df = pd.DataFrame([p.model_dump() for p in patients])
    model = loader.model

    predictions = model.predict(df)
    probabilities = model.predict_proba(df)[:, 1]

    return [
        PredictionOutput(
            prediction=int(pred),
            probability=round(float(prob), 4),
            model_name=loader.model_name,
        )
        for pred, prob in zip(predictions, probabilities)
    ]
