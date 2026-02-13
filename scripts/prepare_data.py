from datetime import datetime
from pathlib import Path
from typing import Optional
import pandas as pd
from pydantic import BaseModel, Field, field_validator



class PatientRecordSchema(BaseModel):

    Pregnancies: int = Field(
        ..., ge=0, le=20,
        description="Number of pregnancies"
    )
    Glucose: float = Field(
        ..., ge=0, le=250,
        description="Plasma glucose concentration (mg/dL)"
    )
    BloodPressure: float = Field(
        ..., ge=0, le=200,
        description="Diastolic blood pressure (mmHg)"
    )
    SkinThickness: float = Field(
        ..., ge=0, le=120,
        description="Triceps skin fold thickness (mm)"
    )
    Insulin: float = Field(
        ..., ge=0, le=900,
        description="2-Hour serum insulin (mu U/ml)"
    )
    BMI: float = Field(
        ..., ge=0, le=80,
        description="Body mass index (kg/m²)"
    )
    DiabetesPedigreeFunction: float = Field(
        ..., ge=0.0, le=3.0,
        description="Diabetes pedigree function score"
    )
    Age: int = Field(
        ..., ge=18, le=100,
        description="Patient age in years"
    )
    Outcome: int = Field(
        ..., ge=0, le=1,
        description="Diabetes diagnosis (0=No, 1=Yes)"
    )

    class Config:
        from_attributes = True



class ProcessingConfig(BaseModel):
    raw_data_path: Path = Field()
    output_path: Path = Field()
    timestamp: datetime = Field(

    )

    @field_validator('raw_data_path')
    @classmethod
    def raw_data_must_exist(cls, v: Path) -> Path:
        if not v.exists():
            raise FileNotFoundError(f'Raw data not found at: {v}')
        return v

    @field_validator('output_path')
    @classmethod
    def output_must_be_parquet(cls, v: Path) -> Path:
        if v.suffix != ".parquet":
            raise ValueError(f'Output path must be .parquet, got: {v.suffix}')
        return v


class PatientDataProcessor:

    def __init__(self, config: ProcessingConfig) -> None:
        self._config = config
        self._raw_df: Optional[pd.DataFrame] = None
        self._processed_df: Optional[pd.DataFrame] = None
    
    def load_raw_data(self) -> pd.DataFrame:
        path = self._config.raw_data_path

        readers = {
            '.csv': pd.read_csv,
            '.parquet': pd.read_parquet
        }

        reader = readers.get(path.suffix)
        if reader is None:
            raise ValueError(f'Unsupported file Format: {path.suffix}')
        
        self._raw_df = reader(path)
        return self._raw_df

    def validate_data_diabetes(self) -> pd.DataFrame:
        if self._raw_df is None:
            raise RuntimeError("No data loaded. Call load_raw_data() first.")

        records = self._raw_df.to_dict(orient='records')
        validate_records = []        

        errors = []
        for i, record in enumerate(records):
            try:
                validated = PatientRecordSchema(**record)
                validate_records.append(validated.model_dump())
            except Exception as e:
                errors.append(f'Row {i}: {e}')

        if errors:
            error_summary = "\n".join(errors[:10])  # Show first 10
            raise ValueError(
                f"Validation failed for {len(errors)}/{len(records)} records:\n"
                f"{error_summary}"
            )

        return self._raw_df

    
    def add_feast_metadata(self) -> pd.DataFrame:

        if self._raw_df is None:
            raise RuntimeError("No data loaded. Call load_raw_data() first.")

        self._processed_df = self._raw_df.copy()
        self._processed_df["patient_id"] = self._processed_df.index

        # Incremental: preserve existing timestamps from previous runs
        existing_parquet = self._config.output_path
        if existing_parquet.exists():
            existing_df = pd.read_parquet(existing_parquet)
            n_existing = len(existing_df)
            n_current = len(self._processed_df)

            if n_current > n_existing:
                # Keep timestamps for rows that already existed
                self._processed_df.loc[:n_existing - 1, "event_timestamp"] = (
                    existing_df["event_timestamp"].values
                )
                # Only new rows get the current timestamp
                self._processed_df.loc[n_existing:, "event_timestamp"] = pd.to_datetime(
                    self._config.timestamp
                )
                print(
                    f"[ENRICH] Incremental: kept {n_existing} existing timestamps, "
                    f"stamped {n_current - n_existing} new rows with "
                    f"{self._config.timestamp.isoformat()}"
                )
            elif n_current == n_existing:
                # No new rows — keep all existing timestamps
                self._processed_df["event_timestamp"] = existing_df["event_timestamp"].values
                print(f"[ENRICH] No new rows. Preserved all {n_existing} timestamps.")
            else:
                # Dataset shrank (rows deleted?) — re-stamp everything
                self._processed_df["event_timestamp"] = pd.to_datetime(
                    self._config.timestamp
                )
                print(
                    f"[ENRICH] Dataset shrank ({n_existing} -> {n_current}). "
                    f"Re-stamped all rows with {self._config.timestamp.isoformat()}"
                )
        else:
            # First run — stamp everything
            self._processed_df["event_timestamp"] = pd.to_datetime(
                self._config.timestamp
            )
            print(
                f"[ENRICH] First run: stamped {len(self._processed_df)} rows "
                f"with {self._config.timestamp.isoformat()}"
            )

        return self._processed_df

    def export_to_parquet(self) -> Path:
        """Write processed DataFrame to Parquet at the configured output path."""
        if self._processed_df is None:
            raise RuntimeError(
                "No processed data. Call add_feast_metadata() first."
            )

        # Ensure output directory exists
        self._config.output_path.parent.mkdir(parents=True, exist_ok=True)

        self._processed_df.to_parquet(
            self._config.output_path,
            index=False,
            engine="pyarrow",
        )

        print(
            f"[EXPORT] Wrote {len(self._processed_df)} records "
            f"to {self._config.output_path}"
        )
        return self._config.output_path

    def run(self) -> Path:
        self.load_raw_data()
        self.validate_data_diabetes()
        self.add_feast_metadata()
        return self.export_to_parquet()
