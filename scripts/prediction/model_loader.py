"""MLflow model loader — loads from Model Registry by registered name + alias."""

import mlflow
from mlflow.tracking import MlflowClient

from prediction.config import PredictionConfig


class ModelLoader:
    """Singleton that loads and caches a model from the MLflow Model Registry."""

    _instance = None
    _model = None
    _model_name: str | None = None
    _model_version: str | None = None
    _model_alias: str | None = None
    _model_tags: dict | None = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load(self, config: PredictionConfig) -> None:
        """Load model from MLflow Model Registry.

        Tries registry name 'diabetes_{model_name}' with alias from config
        (defaults to 'latest'). Falls back to run-based loading if not registered.
        """
        mlflow.set_tracking_uri(config.mlflow.tracking_uri)
        client = MlflowClient()

        registry_name = config.mlflow.registry_name or f"diabetes_{config.mlflow.model_name}"
        alias = config.mlflow.alias or "latest"

        try:
            # Try loading from Model Registry by alias
            mv = client.get_model_version_by_alias(name=registry_name, alias=alias)
            model_uri = f"models:/{registry_name}@{alias}"

            self._model = mlflow.sklearn.load_model(model_uri)
            self._model_name = registry_name
            self._model_version = mv.version
            self._model_alias = alias
            self._model_tags = dict(mv.tags) if mv.tags else {}

            print(
                f"[MODEL] Loaded {registry_name} v{mv.version} "
                f"(alias: {alias}) from registry"
            )
            return

        except Exception as e:
            print(f"[MODEL] Registry lookup failed for {registry_name}@{alias}: {e}")
            print("[MODEL] Falling back to run-based loading...")

        # Fallback: load from experiment runs (backward compat)
        self._load_from_runs(client, config)

    def _load_from_runs(self, client: MlflowClient, config: PredictionConfig) -> None:
        """Fallback: load model from experiment runs by algorithm tag."""
        experiment = client.get_experiment_by_name(config.mlflow.experiment_name)
        if experiment is None:
            raise RuntimeError(
                f"Experiment '{config.mlflow.experiment_name}' not found in MLflow"
            )

        runs = client.search_runs(
            experiment_ids=[experiment.experiment_id],
            filter_string=f"tags.algorithm = '{config.mlflow.model_name}'",
            order_by=["start_time DESC"],
            max_results=1,
        )

        if not runs:
            raise RuntimeError(
                f"No runs found for model '{config.mlflow.model_name}' "
                f"in experiment '{config.mlflow.experiment_name}'"
            )

        run = runs[0]
        run_id = run.info.run_id

        logged_models = client.search_logged_models(
            experiment_ids=[experiment.experiment_id],
        )

        model_uri = None
        for lm in logged_models:
            if lm.source_run_id == run_id:
                model_uri = lm.model_uri
                break

        if model_uri is None:
            raise RuntimeError(
                f"No logged model found for run {run_id}. "
                f"Ensure the training pipeline used mlflow.sklearn.log_model()."
            )

        self._model = mlflow.sklearn.load_model(model_uri)
        self._model_name = config.mlflow.model_name
        self._model_version = None
        self._model_alias = None
        self._model_tags = {}

        print(f"[MODEL] Loaded {self._model_name} from run {run_id} (fallback)")

    @property
    def model(self):
        if self._model is None:
            raise RuntimeError("Model not loaded. Call load() first.")
        return self._model

    @property
    def model_name(self) -> str | None:
        return self._model_name

    @property
    def model_version(self) -> str | None:
        return self._model_version

    @property
    def model_alias(self) -> str | None:
        return self._model_alias

    @property
    def model_tags(self) -> dict:
        return self._model_tags or {}

    @property
    def is_loaded(self) -> bool:
        return self._model is not None
