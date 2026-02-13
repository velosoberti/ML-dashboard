"""Test prediction logic with a mock model loader."""

from unittest.mock import MagicMock

import numpy as np
from prediction.schemas import PredictionInput
from prediction.predictor import predict_single, predict_batch


def _make_mock_loader():
    """Create a mock ModelLoader with a fake sklearn-like model."""
    model = MagicMock()
    model.predict.return_value = np.array([1])
    model.predict_proba.return_value = np.array([[0.2, 0.8]])

    loader = MagicMock()
    loader.model = model
    loader.model_name = "test_model"
    loader.is_loaded = True
    return loader


class TestPredictSingle:

    def test_returns_prediction_output(self, valid_patient_data):
        loader = _make_mock_loader()
        patient = PredictionInput(**valid_patient_data)
        result = predict_single(patient, loader)

        assert result.prediction == 1
        assert result.probability == 0.8
        assert result.model_name == "test_model"


class TestPredictBatch:

    def test_returns_list_of_outputs(self, valid_patient_data):
        loader = _make_mock_loader()
        loader.model.predict.return_value = np.array([0, 1])
        loader.model.predict_proba.return_value = np.array([[0.9, 0.1], [0.3, 0.7]])

        patients = [PredictionInput(**valid_patient_data)] * 2
        results = predict_batch(patients, loader)

        assert len(results) == 2
        assert results[0].prediction == 0
        assert results[1].prediction == 1
