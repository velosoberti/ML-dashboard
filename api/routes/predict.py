"""Prediction endpoints."""

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from prediction.model_loader import ModelLoader
from prediction.predictor import predict_single, predict_batch
from prediction.schemas import (
    PredictionInput,
    BatchPredictionInput,
    BatchPredictionOutput,
)

predict_bp = Blueprint("predict", __name__)


@predict_bp.route("/predict", methods=["POST"])
def predict_one():
    """Single patient prediction."""
    try:
        patient = PredictionInput(**request.get_json())
    except ValidationError as e:
        return jsonify({"error": "Validation failed", "details": e.errors()}), 422

    loader = ModelLoader()
    if not loader.is_loaded:
        return jsonify({"error": "Model not loaded"}), 503

    result = predict_single(patient, loader)
    return jsonify(result.model_dump()), 200


@predict_bp.route("/predict/batch", methods=["POST"])
def predict_many():
    """Batch patient prediction."""
    try:
        batch = BatchPredictionInput(**request.get_json())
    except ValidationError as e:
        return jsonify({"error": "Validation failed", "details": e.errors()}), 422

    loader = ModelLoader()
    if not loader.is_loaded:
        return jsonify({"error": "Model not loaded"}), 503

    results = predict_batch(batch.patients, loader)
    output = BatchPredictionOutput(predictions=results)
    return jsonify(output.model_dump()), 200
