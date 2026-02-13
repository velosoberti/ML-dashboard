import os
from datetime import timedelta
from feast import Entity, FeatureView, Field, FileSource
from feast.types import Float32, Int64
from feast.value_type import ValueType

# Resolve data path: works both locally and inside Docker (Airflow)
# Set DATA_BASE_PATH env var in Docker, defaults to local path
_default_base = "/home/luisveloso/a5x/projects"
_base = os.environ.get("DATA_BASE_PATH", _default_base)

patient_source = FileSource(
    path=f"{_base}/data/processed/patient_features.parquet",
    timestamp_field="event_timestamp",
)

patient = Entity(
    name="patient_id",
    join_keys=["patient_id"],
    value_type=ValueType.INT64,
)

patient_features = FeatureView(
    name="patient_features",
    entities=[patient],
    ttl=timedelta(days=365),
    schema=[
        Field(name="Pregnancies", dtype=Int64),
        Field(name="Glucose", dtype=Int64),
        Field(name="BloodPressure", dtype=Int64),
        Field(name="SkinThickness", dtype=Int64),
        Field(name="Insulin", dtype=Int64),
        Field(name="BMI", dtype=Float32),
        Field(name="DiabetesPedigreeFunction", dtype=Float32),
        Field(name="Age", dtype=Int64),
        # Outcome is your target (y), don't include it as a feature
    ],
    source=patient_source,
    online=True,
)