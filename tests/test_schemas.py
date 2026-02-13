"""Test Pydantic schemas — validation boundaries."""

import pytest
from prediction.schemas import PredictionInput, PredictionOutput
from training.schemas import PatientFeatures


class TestPredictionInput:

    def test_valid_input(self, valid_patient_data):
        p = PredictionInput(**valid_patient_data)
        assert p.Glucose == 148.0
        assert p.Age == 50

    def test_rejects_negative_glucose(self, valid_patient_data):
        valid_patient_data["Glucose"] = -1
        with pytest.raises(Exception):
            PredictionInput(**valid_patient_data)

    def test_rejects_age_below_18(self, valid_patient_data):
        valid_patient_data["Age"] = 10
        with pytest.raises(Exception):
            PredictionInput(**valid_patient_data)

    def test_rejects_missing_field(self):
        with pytest.raises(Exception):
            PredictionInput(Glucose=100.0)

    def test_boundary_values(self):
        p = PredictionInput(
            Pregnancies=0, Glucose=0, BloodPressure=0,
            SkinThickness=0, Insulin=0, BMI=0,
            DiabetesPedigreeFunction=0.0, Age=18,
        )
        assert p.Pregnancies == 0

    def test_upper_boundary(self):
        p = PredictionInput(
            Pregnancies=20, Glucose=250, BloodPressure=200,
            SkinThickness=120, Insulin=900, BMI=80,
            DiabetesPedigreeFunction=3.0, Age=100,
        )
        assert p.Age == 100


class TestPredictionOutput:

    def test_valid_output(self):
        o = PredictionOutput(prediction=1, probability=0.85, model_name="dt")
        assert o.prediction == 1

    def test_rejects_probability_above_1(self):
        with pytest.raises(Exception):
            PredictionOutput(prediction=0, probability=1.5, model_name="dt")


class TestPatientFeatures:

    def test_valid_record(self, valid_patient_with_outcome):
        p = PatientFeatures(**valid_patient_with_outcome)
        assert p.Outcome == 1

    def test_rejects_invalid_outcome(self, valid_patient_with_outcome):
        valid_patient_with_outcome["Outcome"] = 5
        with pytest.raises(Exception):
            PatientFeatures(**valid_patient_with_outcome)
