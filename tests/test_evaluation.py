"""Test evaluation metrics computation."""

import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from training.evaluation import compute_metrics


class TestComputeMetrics:

    def test_returns_all_metric_keys(self):
        X = pd.DataFrame(np.random.rand(100, 4), columns=["a", "b", "c", "d"])
        y = pd.Series(np.random.randint(0, 2, 100))
        model = DecisionTreeClassifier(random_state=42).fit(X, y)

        metrics = compute_metrics(model, X, y)

        assert set(metrics.keys()) == {"accuracy", "precision", "recall", "f1", "roc_auc"}
        for v in metrics.values():
            assert 0.0 <= v <= 1.0

    def test_perfect_model(self):
        X = pd.DataFrame({"a": [0, 0, 1, 1], "b": [0, 0, 1, 1]})
        y = pd.Series([0, 0, 1, 1])
        model = DecisionTreeClassifier(random_state=42).fit(X, y)

        metrics = compute_metrics(model, X, y)
        assert metrics["accuracy"] == 1.0
