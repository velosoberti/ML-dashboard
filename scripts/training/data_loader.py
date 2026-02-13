"""Feast offline store data retrieval with Pydantic validation."""

import pandas as pd
from feast import FeatureStore

from training.config import DataConfig
from training.schemas import PatientFeatures

FEATURE_LIST = [
    "patient_features:Pregnancies",
    "patient_features:Glucose",
    "patient_features:BloodPressure",
    "patient_features:SkinThickness",
    "patient_features:Insulin",
    "patient_features:BMI",
    "patient_features:DiabetesPedigreeFunction",
    "patient_features:Age",
]


def fetch_training_data(data_config: DataConfig) -> pd.DataFrame:
    """Pull features from Feast offline store and join target from source parquet."""

    # Read source parquet (has all columns including Outcome)
    source_df = pd.read_parquet(data_config.source_data_path)

    store = FeatureStore(repo_path=str(data_config.feature_repo_path))

    # Apply definitions so registry has correct paths for current environment
    _apply_feature_definitions(store, str(data_config.feature_repo_path))

    entity_df = source_df[["patient_id", "event_timestamp"]].copy()

    training_df = store.get_historical_features(
        entity_df=entity_df,
        features=FEATURE_LIST,
    ).to_df()

    # Join target column from source (not in feature store by design)
    training_df = training_df.merge(
        source_df[["patient_id", "Outcome"]],
        on="patient_id",
        how="left",
    )

    return training_df


def _apply_feature_definitions(store: FeatureStore, repo_path: str) -> None:
    """Apply feature definitions from features.py to ensure registry has correct paths."""
    import importlib
    import sys

    if repo_path not in sys.path:
        sys.path.insert(0, repo_path)

    if "features" in sys.modules:
        del sys.modules["features"]
    features_mod = importlib.import_module("features")

    store.apply([features_mod.patient, features_mod.patient_features])
    print("[DATA] Feature definitions applied to registry")


def validate_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Validate each row with Pydantic, drop invalid rows."""

    valid_mask = pd.Series(True, index=df.index)

    for i, row in df.iterrows():
        try:
            PatientFeatures(**row.to_dict())
        except Exception:
            valid_mask[i] = False

    dropped = (~valid_mask).sum()
    if dropped > 0:
        print(f"[DATA] Dropped {dropped} invalid rows")

    return df[valid_mask].reset_index(drop=True)


def load_training_data(data_config: DataConfig) -> pd.DataFrame:
    """Fetch from offline store and validate."""

    df = fetch_training_data(data_config)
    df = validate_dataframe(df)
    print(f"[DATA] {len(df)} valid records loaded")
    return df
