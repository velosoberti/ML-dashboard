"""Flask app factory pattern."""

from flask import Flask

from api.config import APIConfig
from prediction.config import load_prediction_config
from prediction.model_loader import ModelLoader


def create_app(api_config: APIConfig | None = None) -> Flask:
    """Create and configure the Flask application."""

    if api_config is None:
        api_config = APIConfig()

    app = Flask(__name__)

    # Try to load model on startup (non-fatal if MLflow not ready or no model yet)
    with app.app_context():
        try:
            config = load_prediction_config()
            loader = ModelLoader()
            loader.load(config)
        except Exception as e:
            print(f"[WARN] Could not load model on startup: {e}")
            print("[WARN] API running without model. Train and register a model, then restart or use /model/switch.")

    # Register blueprints
    from api.routes.health import health_bp
    from api.routes.predict import predict_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(predict_bp)

    return app
