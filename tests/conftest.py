"""Shared fixtures for tests."""

import sys
from pathlib import Path

import pytest

# Make scripts/ importable (same as the app does at runtime)
SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))


@pytest.fixture
def valid_patient_data():
    """A valid patient record dict."""
    return {
        "Pregnancies": 6,
        "Glucose": 148.0,
        "BloodPressure": 72.0,
        "SkinThickness": 35.0,
        "Insulin": 0.0,
        "BMI": 33.6,
        "DiabetesPedigreeFunction": 0.627,
        "Age": 50,
    }


@pytest.fixture
def valid_patient_with_outcome(valid_patient_data):
    """A valid patient record with Outcome."""
    return {**valid_patient_data, "Outcome": 1}
