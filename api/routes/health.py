"""Healthcheck endpoint."""

from flask import Blueprint, jsonify

from prediction.model_loader import ModelLoader
from prediction.schemas import HealthResponse

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def healthcheck():
    loader = ModelLoader()
    response = HealthResponse(
        status="healthy" if loader.is_loaded else "degraded",
        model_loaded=loader.is_loaded,
        model_name=loader.model_name,
    )
    status_code = 200 if loader.is_loaded else 503
    return jsonify(response.model_dump()), status_code
