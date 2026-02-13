"""Test model factory and trainers."""

import numpy as np
import pandas as pd
from training.models import ModelFactory, DecisionTreeTrainer, KNNTrainer
from training.config import ModelsConfig, ModelParams


class TestModelFactory:

    def test_creates_both_models_when_enabled(self):
        config = ModelsConfig(
            decision_tree=ModelParams(enabled=True, params={"max_depth": 3}),
            knn=ModelParams(enabled=True, params={"n_neighbors": 5}),
        )
        trainers = ModelFactory.create(config)
        names = [t.name() for t in trainers]
        assert "decision_tree" in names
        assert "knn" in names

    def test_skips_disabled_model(self):
        config = ModelsConfig(
            decision_tree=ModelParams(enabled=False),
            knn=ModelParams(enabled=True, params={"n_neighbors": 3}),
        )
        trainers = ModelFactory.create(config)
        assert len(trainers) == 1
        assert trainers[0].name() == "knn"

    def test_empty_when_all_disabled(self):
        config = ModelsConfig(
            decision_tree=ModelParams(enabled=False),
            knn=ModelParams(enabled=False),
        )
        assert ModelFactory.create(config) == []


class TestDecisionTreeTrainer:

    def test_builds_and_fits(self):
        trainer = DecisionTreeTrainer({"max_depth": 3, "random_state": 42})
        model = trainer.build()
        X = pd.DataFrame(np.random.rand(50, 4), columns=["a", "b", "c", "d"])
        y = pd.Series(np.random.randint(0, 2, 50))
        model.fit(X, y)
        preds = model.predict(X)
        assert len(preds) == 50
        assert set(preds).issubset({0, 1})


class TestKNNTrainer:

    def test_builds_and_fits(self):
        trainer = KNNTrainer({"n_neighbors": 3})
        model = trainer.build()
        X = pd.DataFrame(np.random.rand(50, 4), columns=["a", "b", "c", "d"])
        y = pd.Series(np.random.randint(0, 2, 50))
        model.fit(X, y)
        preds = model.predict(X)
        assert len(preds) == 50
