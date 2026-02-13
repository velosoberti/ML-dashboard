"""
Feature Store Materialization Script.

Materializes processed features into the Feast online store,
making them available for low-latency serving at inference time.

This script is called by Airflow AFTER the processing pipeline
has written fresh data to the offline store (Parquet files).

Design decisions:
    - Pydantic validates config (repo path exists, end_date is sane)
    - Class wraps Feast calls for testability and consistent logging
    - run() is the single entry point for Airflow's PythonOperator
"""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from feast import FeatureStore


# =============================================================================
# 1. CONFIGURATION (Pydantic)
# =============================================================================

class MaterializationConfig(BaseModel):
    """
    Validates materialization parameters before touching Feast.

    Why Pydantic here?
        - repo_path typo → Feast throws 'FeastObjectNotFoundException'
          with zero context. We catch it early with a clear message.
        - end_date in the future or absurdly in the past → silent bugs
          in feature freshness. We guard against that.
    """

    repo_path: Path = Field(
        ...,
        description="Path to the Feast feature repository (contains feature_store.yaml)",
    )
    end_date: datetime = Field(
        default_factory=datetime.now,
        description="Materialize features up to this timestamp",
    )

    @field_validator("repo_path")
    @classmethod
    def repo_must_exist(cls, v: Path) -> Path:
        if not v.exists():
            raise FileNotFoundError(
                f"Feast repo not found at: {v}. "
                f"Check your path or run 'feast init' first."
            )
        feature_store_yaml = v / "feature_store.yaml"
        if not feature_store_yaml.exists():
            raise FileNotFoundError(
                f"No feature_store.yaml found in {v}. "
                f"This doesn't look like a valid Feast repository."
            )
        return v

    @field_validator("end_date")
    @classmethod
    def end_date_must_be_reasonable(cls, v: datetime) -> datetime:
        now = datetime.now()
        if v > now + timedelta(hours=1):
            raise ValueError(
                f"end_date is in the future ({v}). "
                f"Feast cannot materialize data that doesn't exist yet."
            )
        return v


# =============================================================================
# 2. MATERIALIZER
# =============================================================================

class FeatureStoreMaterializer:
    """
    Handles Feast feature materialization with proper validation and logging.

    Usage:
        config = MaterializationConfig(
            repo_path=Path("feature_repo/feature_repo"),
        )
        materializer = FeatureStoreMaterializer(config)
        materializer.run()
    """

    def __init__(self, config: MaterializationConfig) -> None:
        self._config = config
        self._store: Optional[FeatureStore] = None

    def connect(self) -> FeatureStore:
        """Initialize connection to the Feast feature store."""
        self._store = FeatureStore(
            repo_path=str(self._config.repo_path)
        )
        print(f"[CONNECT] Connected to Feast repo at {self._config.repo_path}")
        return self._store

    def apply_definitions(self) -> None:
        """
        Sync feature definitions (entities, views, services) to the registry.

        Imports definitions directly from the features.py module so the
        registry always reflects the latest code, not stale cached values.
        """
        if self._store is None:
            raise RuntimeError("Not connected. Call connect() first.")

        import importlib
        import sys

        # Add the feature repo to sys.path so we can import features.py
        repo_str = str(self._config.repo_path)
        if repo_str not in sys.path:
            sys.path.insert(0, repo_str)

        # Force reimport to pick up any changes (e.g. env-based paths)
        if "features" in sys.modules:
            del sys.modules["features"]
        features_mod = importlib.import_module("features")

        objects = [
            features_mod.patient,
            features_mod.patient_features,
        ]
        self._store.apply(objects)
        print("[APPLY] Feature definitions synced to registry from features.py")

    def materialize(self) -> None:
        """
        Materialize features incrementally up to end_date.

        'Incremental' means Feast only processes data since the last
        materialization — not the entire history. This is what you
        want for daily Airflow runs.
        """
        if self._store is None:
            raise RuntimeError("Not connected. Call connect() first.")

        print(
            f"[MATERIALIZE] Running incremental materialization "
            f"up to {self._config.end_date.isoformat()}"
        )

        self._store.materialize_incremental(
            end_date=self._config.end_date
        )

        print("[MATERIALIZE] Materialization complete")

    def run(self) -> None:
        """
        Full materialization pipeline:
            connect → apply → materialize

        This is what Airflow calls.
        """
        print("=" * 60)
        print("FEATURE STORE MATERIALIZATION")
        print("=" * 60)

        self.connect()
        self.apply_definitions()
        self.materialize()

        print("=" * 60)
        print("Materialization pipeline complete")
        print("=" * 60)


# =============================================================================
# 3. ENTRYPOINT
# =============================================================================

if __name__ == "__main__":
    config = MaterializationConfig(
        repo_path=Path("feature_repo/feature_repo"),
    )

    materializer = FeatureStoreMaterializer(config)
    materializer.run()