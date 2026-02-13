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

    # Load model on startup
    with app.app_context():
        config = load_prediction_config()
        loader = ModelLoader()
        loader.load(config)

    # Register blueprints
    from api.routes.health import health_bp
    from api.routes.predict import predict_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(predict_bp)

    return app
