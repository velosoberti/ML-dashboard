"""Model visualization artifacts for MLflow logging."""

import tempfile
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    RocCurveDisplay,
    PrecisionRecallDisplay,
    classification_report,
)


def plot_confusion_matrix(model, X_test: pd.DataFrame, y_test: pd.Series, model_name: str) -> Path:
    """Generate and save confusion matrix plot."""
    fig, ax = plt.subplots(figsize=(8, 6))
    ConfusionMatrixDisplay.from_estimator(model, X_test, y_test, ax=ax, cmap="Blues")
    ax.set_title(f"Confusion Matrix — {model_name}")
    path = Path(tempfile.mktemp(suffix=".png"))
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_roc_curve(model, X_test: pd.DataFrame, y_test: pd.Series, model_name: str) -> Path:
    """Generate and save ROC curve plot."""
    fig, ax = plt.subplots(figsize=(8, 6))
    RocCurveDisplay.from_estimator(model, X_test, y_test, ax=ax)
    ax.plot([0, 1], [0, 1], "k--", alpha=0.5)
    ax.set_title(f"ROC Curve — {model_name}")
    path = Path(tempfile.mktemp(suffix=".png"))
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_precision_recall(model, X_test: pd.DataFrame, y_test: pd.Series, model_name: str) -> Path:
    """Generate and save precision-recall curve plot."""
    fig, ax = plt.subplots(figsize=(8, 6))
    PrecisionRecallDisplay.from_estimator(model, X_test, y_test, ax=ax)
    ax.set_title(f"Precision-Recall Curve — {model_name}")
    path = Path(tempfile.mktemp(suffix=".png"))
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_feature_importance(model, feature_names: list[str], model_name: str) -> Path | None:
    """Generate feature importance plot (tree-based models only)."""
    if not hasattr(model, "feature_importances_"):
        return None

    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.barh(
        [feature_names[i] for i in indices],
        importances[indices],
        color="steelblue",
    )
    ax.set_xlabel("Importance")
    ax.set_title(f"Feature Importance — {model_name}")
    ax.invert_yaxis()
    path = Path(tempfile.mktemp(suffix=".png"))
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def save_classification_report(model, X_test: pd.DataFrame, y_test: pd.Series) -> Path:
    """Save classification report as text artifact."""
    y_pred = model.predict(X_test)
    report = classification_report(y_test, y_pred, target_names=["No Diabetes", "Diabetes"])
    path = Path(tempfile.mktemp(suffix=".txt"))
    path.write_text(report)
    return path


def save_feature_list(feature_names: list[str]) -> Path:
    """Save feature names as text artifact."""
    path = Path(tempfile.mktemp(suffix=".txt"))
    path.write_text("\n".join(feature_names))
    return path


def generate_all_artifacts(
    model,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    feature_names: list[str],
    model_name: str,
) -> list[Path]:
    """Generate all visualization artifacts, return list of file paths."""
    artifacts = [
        plot_confusion_matrix(model, X_test, y_test, model_name),
        plot_roc_curve(model, X_test, y_test, model_name),
        plot_precision_recall(model, X_test, y_test, model_name),
        save_classification_report(model, X_test, y_test),
        save_feature_list(feature_names),
    ]

    importance_plot = plot_feature_importance(model, feature_names, model_name)
    if importance_plot:
        artifacts.append(importance_plot)

    return artifacts
