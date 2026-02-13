"""Test data preparation schemas and processor logic."""

import sys
from pathlib import Path
from datetime import datetime

import pytest

# Import directly from the module file to avoid scripts/__init__.py broken re-exports
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from prepare_data import PatientRecordSchema, ProcessingConfig


class TestPatientRecordSchema:

    def test_valid_record(self, valid_patient_with_outcome):
        r = PatientRecordSchema(**valid_patient_with_outcome)
        assert r.Glucose == 148.0

    def test_rejects_bmi_over_80(self, valid_patient_with_outcome):
        valid_patient_with_outcome["BMI"] = 90.0
        with pytest.raises(Exception):
            PatientRecordSchema(**valid_patient_with_outcome)

    def test_rejects_negative_pregnancies(self, valid_patient_with_outcome):
        valid_patient_with_outcome["Pregnancies"] = -1
        with pytest.raises(Exception):
            PatientRecordSchema(**valid_patient_with_outcome)


class TestProcessingConfig:

    def test_rejects_nonexistent_raw_path(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            ProcessingConfig(
                raw_data_path=tmp_path / "nope.csv",
                output_path=tmp_path / "out.parquet",
                timestamp=datetime.now(),
            )

    def test_rejects_non_parquet_output(self, tmp_path):
        raw = tmp_path / "data.csv"
        raw.write_text("a,b\n1,2")
        with pytest.raises(ValueError):
            ProcessingConfig(
                raw_data_path=raw,
                output_path=tmp_path / "out.csv",
                timestamp=datetime.now(),
            )

    def test_valid_config(self, tmp_path):
        raw = tmp_path / "data.csv"
        raw.write_text("a,b\n1,2")
        cfg = ProcessingConfig(
            raw_data_path=raw,
            output_path=tmp_path / "out.parquet",
            timestamp=datetime.now(),
        )
        assert cfg.output_path.suffix == ".parquet"
