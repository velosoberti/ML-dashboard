"""
ML Project Dashboard Backend Server

Flask server providing API endpoints for the dashboard:
- Predictions via the ML model
- Online store data viewer
- CSV data management (add rows)
- Airflow DAG triggers
- ZenML pipeline triggers
- Dataset viewer
- Feature store config
- Analytics & drift detection
"""

import os
import sys
import json
import sqlite3
import subprocess
import math
from pathlib import Path
from datetime import datetime

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent.parent
DASHBOARD_ROOT = Path(__file__).parent.parent

# Add scripts to path for model loading
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from flask import Flask, jsonify, request, send_from_directory, make_response
import pandas as pd
import yaml

app = Flask(__name__, static_folder=str(DASHBOARD_ROOT))

# ============================================================================
# Global state
# ============================================================================
_model_loader = None


def get_model_loader():
    """Lazy-load the model singleton."""
    global _model_loader
    if _model_loader is None:
        try:
            from prediction.config import load_prediction_config
            from prediction.model_loader import ModelLoader
            config = load_prediction_config()
            loader = ModelLoader()
            loader.load(config)
            _model_loader = loader
        except Exception as e:
            print(f"[WARN] Could not load model on startup: {e}")
            _model_loader = None
    return _model_loader


def reload_model(registry_name: str, alias: str = "latest"):
    """Load a specific model from the MLflow Model Registry."""
    global _model_loader
    from prediction.config import load_prediction_config, PredictionConfig, PredictionMLflowConfig
    from prediction.model_loader import ModelLoader

    base_config = load_prediction_config()
    config = PredictionConfig(
        mlflow=PredictionMLflowConfig(
            tracking_uri=base_config.mlflow.tracking_uri,
            experiment_name=base_config.mlflow.experiment_name,
            model_name=registry_name,
            registry_name=registry_name,
            alias=alias,
        )
    )
    # Reset singleton so it creates fresh
    ModelLoader._instance = None
    ModelLoader._model = None
    ModelLoader._model_name = None
    ModelLoader._model_version = None
    ModelLoader._model_alias = None
    ModelLoader._model_tags = None
    loader = ModelLoader()
    loader.load(config)
    _model_loader = loader
    return loader


# ============================================================================
# CORS
# ============================================================================

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response


# ============================================================================
# Static Files
# ============================================================================

@app.route('/')
def serve_index():
    return send_from_directory(str(DASHBOARD_ROOT), 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    if path.startswith('api/'):
        return jsonify({'error': True, 'message': 'Not found'}), 404
    return send_from_directory(str(DASHBOARD_ROOT), path)


# ============================================================================
# PREDICTION API
# ============================================================================

@app.route('/api/predict', methods=['POST'])
def predict():
    """Single patient prediction."""
    try:
        loader = get_model_loader()
        if loader is None or not loader.is_loaded:
            return jsonify({'error': True, 'message': 'Model not loaded. Is MLflow running?'}), 503

        data = request.get_json()
        if not data:
            return jsonify({'error': True, 'message': 'No JSON body provided'}), 400

        from prediction.schemas import PredictionInput
        from prediction.predictor import predict_single

        patient = PredictionInput(**data)
        result = predict_single(patient, loader)
        return jsonify(result.model_dump()), 200

    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 422


@app.route('/api/predict/batch', methods=['POST'])
def predict_batch():
    """Batch patient prediction."""
    try:
        loader = get_model_loader()
        if loader is None or not loader.is_loaded:
            return jsonify({'error': True, 'message': 'Model not loaded'}), 503

        data = request.get_json()
        if not data or 'patients' not in data:
            return jsonify({'error': True, 'message': 'Expected {"patients": [...]}'}), 400

        from prediction.schemas import PredictionInput
        from prediction.predictor import predict_batch as do_batch

        patients = [PredictionInput(**p) for p in data['patients']]
        results = do_batch(patients, loader)
        return jsonify({'predictions': [r.model_dump() for r in results]}), 200

    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 422


@app.route('/api/model/info')
def model_info():
    """Return loaded model info."""
    loader = get_model_loader()
    if loader and loader.is_loaded:
        return jsonify({
            'loaded': True,
            'model_name': loader.model_name,
            'version': loader.model_version,
            'alias': loader.model_alias,
            'tags': loader.model_tags,
        })
    return jsonify({'loaded': False, 'model_name': None})


@app.route('/api/model/list')
def list_models():
    """List registered models from MLflow Model Registry with tags and aliases."""
    try:
        import mlflow
        from mlflow.tracking import MlflowClient
        from prediction.config import load_prediction_config

        config = load_prediction_config()
        mlflow.set_tracking_uri(config.mlflow.tracking_uri)
        client = MlflowClient()

        registered_models = client.search_registered_models()
        models = []

        for rm in registered_models:
            versions = client.search_model_versions(f"name='{rm.name}'")
            aliases = rm.aliases if hasattr(rm, 'aliases') else {}

            # Build alias lookup: version -> list of alias names
            alias_map = {}
            if aliases:
                for alias_name, alias_info in aliases.items():
                    v = alias_info if isinstance(alias_info, str) else getattr(alias_info, 'version', str(alias_info))
                    alias_map.setdefault(v, []).append(alias_name)

            for v in sorted(versions, key=lambda x: int(x.version), reverse=True):
                ver_aliases = alias_map.get(v.version, [])
                ver_tags = dict(v.tags) if v.tags else {}
                models.append({
                    'registry_name': rm.name,
                    'version': v.version,
                    'aliases': ver_aliases,
                    'tags': ver_tags,
                    'model_tags': dict(rm.tags) if rm.tags else {},
                    'description': rm.description or '',
                    'run_id': v.run_id,
                })

        loader = get_model_loader()
        current = {
            'name': loader.model_name,
            'version': loader.model_version,
            'alias': loader.model_alias,
            'tags': loader.model_tags,
        } if loader and loader.is_loaded else None

        return jsonify({'models': models, 'current': current})
    except Exception as e:
        return jsonify({'models': [], 'message': str(e)})


@app.route('/api/model/switch', methods=['POST'])
def switch_model():
    """Switch the active model by registry name + alias."""
    try:
        data = request.get_json()
        if not data or 'registry_name' not in data:
            return jsonify({'error': True, 'message': 'registry_name required'}), 400

        registry_name = data['registry_name']
        alias = data.get('alias', 'latest')
        loader = reload_model(registry_name, alias)

        return jsonify({
            'success': True,
            'model_name': loader.model_name,
            'version': loader.model_version,
            'alias': loader.model_alias,
            'tags': loader.model_tags,
            'message': f'Loaded {registry_name}@{alias} (v{loader.model_version})',
        })
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


@app.route('/api/model/set-alias', methods=['POST'])
def set_model_alias():
    """Set an alias (e.g. champion) on a specific model version."""
    try:
        import mlflow
        from mlflow.tracking import MlflowClient
        from prediction.config import load_prediction_config

        data = request.get_json()
        if not data or 'registry_name' not in data or 'alias' not in data or 'version' not in data:
            return jsonify({'error': True, 'message': 'registry_name, alias, and version required'}), 400

        config = load_prediction_config()
        mlflow.set_tracking_uri(config.mlflow.tracking_uri)
        client = MlflowClient()

        client.set_registered_model_alias(
            name=data['registry_name'],
            alias=data['alias'],
            version=data['version'],
        )

        return jsonify({
            'success': True,
            'message': f"Set alias '{data['alias']}' on {data['registry_name']} v{data['version']}",
        })
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================================================
# ONLINE STORE DATA
# ============================================================================

@app.route('/api/online-store')
def get_online_store():
    """
    Read materialized features from the processed parquet (the source backing
    the online store) and add a prediction column using the loaded model.
    Supports sorting and filtering.
    """
    try:
        parquet_path = PROJECT_ROOT / 'data' / 'processed' / 'patient_features.parquet'
        if not parquet_path.exists():
            return jsonify({
                'error': True,
                'message': 'patient_features.parquet not found. Run the data processing pipeline first.'
            }), 404

        df = pd.read_parquet(parquet_path)

        feature_cols = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
                        'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age']

        # Run predictions if model is available
        loader = get_model_loader()
        if loader and loader.is_loaded:
            X = df[feature_cols]
            preds = loader.model.predict(X)
            probs = loader.model.predict_proba(X)[:, 1]
            df['Prediction'] = preds
            df['Probability'] = probs.round(4)
            model_name = loader.model_name
        else:
            df['Prediction'] = None
            df['Probability'] = None
            model_name = None

        # Select display columns
        display_cols = ['patient_id'] + feature_cols + ['Prediction', 'Probability']
        display_cols = [c for c in display_cols if c in df.columns]
        df = df[display_cols]

        # Column filters
        for col in display_cols:
            fval = request.args.get(f'filter_{col}', '').strip()
            if not fval:
                continue
            if ':' in fval:
                parts = fval.split(':', 1)
                lo, hi = parts[0].strip(), parts[1].strip()
                if lo:
                    df = df[df[col] >= float(lo)]
                if hi:
                    df = df[df[col] <= float(hi)]
            else:
                try:
                    df = df[df[col] == float(fval)]
                except (ValueError, TypeError):
                    df = df[df[col].astype(str).str.contains(fval, case=False, na=False)]

        # Sorting
        sort_by = request.args.get('sort_by', '')
        sort_order = request.args.get('sort_order', 'asc')
        if sort_by and sort_by in df.columns:
            df = df.sort_values(by=sort_by, ascending=(sort_order == 'asc'))

        # Pagination
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('pageSize', 50, type=int)
        total = len(df)
        start = (page - 1) * page_size
        page_df = df.iloc[start:start + page_size]

        records = page_df.to_dict(orient='records')
        # Convert numpy types
        for row in records:
            for k, v in row.items():
                if hasattr(v, 'item'):
                    row[k] = v.item()

        return jsonify({
            'columns': display_cols,
            'data': records,
            'total': total,
            'page': page,
            'pageSize': page_size,
            'totalPages': max(1, (total + page_size - 1) // page_size),
            'model_name': model_name,
        })

    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================================================
# DATASET (CSV) MANAGEMENT
# ============================================================================

@app.route('/api/dataset')
def get_dataset():
    """Return paginated dataset from data/raw/diabetes.csv with sorting and filtering."""
    try:
        csv_path = PROJECT_ROOT / 'data' / 'raw' / 'diabetes.csv'
        if not csv_path.exists():
            return jsonify({'error': True, 'message': 'Dataset not found'}), 404

        df = pd.read_csv(csv_path)
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('pageSize', 50, type=int)
        sort_by = request.args.get('sort_by', '')
        sort_order = request.args.get('sort_order', 'asc')

        # Column filters: filter_<column>=value (supports min:max range or exact)
        for col in df.columns:
            fval = request.args.get(f'filter_{col}', '').strip()
            if not fval:
                continue
            if ':' in fval:
                parts = fval.split(':', 1)
                lo, hi = parts[0].strip(), parts[1].strip()
                if lo:
                    df = df[df[col] >= float(lo)]
                if hi:
                    df = df[df[col] <= float(hi)]
            else:
                try:
                    df = df[df[col] == float(fval)]
                except ValueError:
                    df = df[df[col].astype(str).str.contains(fval, case=False, na=False)]

        # Sorting
        if sort_by and sort_by in df.columns:
            df = df.sort_values(by=sort_by, ascending=(sort_order == 'asc'))

        total_rows = len(df)
        total_pages = max(1, (total_rows + page_size - 1) // page_size)
        start = (page - 1) * page_size
        page_data = df.iloc[start:start + page_size]

        return jsonify({
            'columns': df.columns.tolist(),
            'data': page_data.to_dict(orient='records'),
            'total': total_rows,
            'page': page,
            'pageSize': page_size,
            'totalPages': total_pages,
        })
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


@app.route('/api/dataset/add-row', methods=['POST'])
def add_row():
    """Add a new row to data/raw/diabetes.csv with created_at timestamp."""
    try:
        csv_path = PROJECT_ROOT / 'data' / 'raw' / 'diabetes.csv'
        data = request.get_json()
        if not data:
            return jsonify({'error': True, 'message': 'No data provided'}), 400

        expected = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
                    'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome']

        missing = [c for c in expected if c not in data]
        if missing:
            return jsonify({'error': True, 'message': f'Missing fields: {missing}'}), 400

        df = pd.read_csv(csv_path)
        new_row = {col: data[col] for col in expected}
        # Add created_at timestamp for drift analysis
        new_row['created_at'] = datetime.utcnow().isoformat()
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        df.to_csv(csv_path, index=False)

        return jsonify({'success': True, 'total_rows': len(df), 'added': new_row})
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================================================
# AIRFLOW PIPELINES
# ============================================================================

@app.route('/api/airflow/dags')
def list_airflow_dags():
    """List available Airflow DAGs."""
    try:
        result = subprocess.run(
            ['docker', 'exec', 'airflow-airflow-webserver-1',
             'airflow', 'dags', 'list', '-o', 'json'],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode != 0:
            return jsonify({'error': True, 'message': result.stderr or 'Failed to list DAGs'}), 500

        dags = json.loads(result.stdout) if result.stdout.strip() else []
        return jsonify({'dags': dags})
    except subprocess.TimeoutExpired:
        return jsonify({'error': True, 'message': 'Airflow not responding (timeout)'}), 504
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


@app.route('/api/airflow/trigger/<dag_id>', methods=['POST'])
def trigger_airflow_dag(dag_id):
    """Trigger an Airflow DAG run."""
    try:
        result = subprocess.run(
            ['docker', 'exec', 'airflow-airflow-webserver-1',
             'airflow', 'dags', 'trigger', dag_id],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode != 0:
            return jsonify({'error': True, 'message': result.stderr or 'Failed to trigger DAG'}), 500

        return jsonify({'success': True, 'dag_id': dag_id, 'output': result.stdout.strip()})
    except subprocess.TimeoutExpired:
        return jsonify({'error': True, 'message': 'Airflow not responding'}), 504
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


@app.route('/api/airflow/runs/<dag_id>')
def get_airflow_runs(dag_id):
    """Get recent runs for a DAG."""
    try:
        result = subprocess.run(
            ['docker', 'exec', 'airflow-airflow-webserver-1',
             'airflow', 'dags', 'list-runs', '-d', dag_id, '-o', 'json'],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode != 0:
            return jsonify({'runs': [], 'message': result.stderr.strip()})

        runs = json.loads(result.stdout) if result.stdout.strip() else []
        return jsonify({'runs': runs[:10]})  # Last 10
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================================================
# ZENML PIPELINES
# ============================================================================

@app.route('/api/zenml/run-training', methods=['POST'])
def run_zenml_training():
    """Trigger ZenML training pipeline."""
    try:
        result = subprocess.run(
            [sys.executable, 'zenml_pipeline.py'],
            capture_output=True, text=True, timeout=300,
            cwd=str(PROJECT_ROOT / 'scripts')
        )
        return jsonify({
            'success': result.returncode == 0,
            'stdout': result.stdout[-2000:] if result.stdout else '',
            'stderr': result.stderr[-2000:] if result.stderr else '',
        })
    except subprocess.TimeoutExpired:
        return jsonify({'error': True, 'message': 'Pipeline timed out (5min limit)'}), 504
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


@app.route('/api/zenml/run-prediction', methods=['POST'])
def run_zenml_prediction():
    """Trigger ZenML prediction pipeline."""
    try:
        result = subprocess.run(
            [sys.executable, 'zenml_predict.py'],
            capture_output=True, text=True, timeout=120,
            cwd=str(PROJECT_ROOT / 'scripts')
        )
        return jsonify({
            'success': result.returncode == 0,
            'stdout': result.stdout[-2000:] if result.stdout else '',
            'stderr': result.stderr[-2000:] if result.stderr else '',
        })
    except subprocess.TimeoutExpired:
        return jsonify({'error': True, 'message': 'Pipeline timed out'}), 504
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================================================
# FEATURE STORE CONFIG
# ============================================================================

@app.route('/api/feature-store/config')
def get_feature_store_config():
    """Return Feast feature store configuration."""
    try:
        config_path = PROJECT_ROOT / 'feature_repo' / 'feature_repo' / 'feature_store.yaml'
        if not config_path.exists():
            return jsonify({'error': True, 'message': 'Config not found'}), 404

        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)

        return jsonify(config)
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================================================
# PIPELINE CONFIGURATION
# ============================================================================

TRAIN_CONFIG_PATH = PROJECT_ROOT / 'scripts' / 'config' / 'train_config.yaml'
PREDICTION_CONFIG_PATH = PROJECT_ROOT / 'scripts' / 'config' / 'prediction_config.yaml'


@app.route('/api/config/training')
def get_training_config():
    """Return training pipeline configuration."""
    try:
        if not TRAIN_CONFIG_PATH.exists():
            return jsonify({'error': True, 'message': 'Training config not found'}), 404
        with open(TRAIN_CONFIG_PATH, 'r') as f:
            config = yaml.safe_load(f)
        return jsonify(config)
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


@app.route('/api/config/training', methods=['PUT'])
def update_training_config():
    """Update training pipeline configuration."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': True, 'message': 'No data provided'}), 400
        with open(TRAIN_CONFIG_PATH, 'w') as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)
        return jsonify({'success': True, 'message': 'Training config saved'})
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


@app.route('/api/config/prediction')
def get_prediction_config():
    """Return prediction pipeline configuration."""
    try:
        if not PREDICTION_CONFIG_PATH.exists():
            return jsonify({'error': True, 'message': 'Prediction config not found'}), 404
        with open(PREDICTION_CONFIG_PATH, 'r') as f:
            config = yaml.safe_load(f)
        return jsonify(config)
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


@app.route('/api/config/prediction', methods=['PUT'])
def update_prediction_config():
    """Update prediction pipeline configuration."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': True, 'message': 'No data provided'}), 400
        with open(PREDICTION_CONFIG_PATH, 'w') as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)
        return jsonify({'success': True, 'message': 'Prediction config saved'})
    except Exception as e:
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================================================
# ANALYTICS & DRIFT DETECTION
# ============================================================================

def _safe(val):
    """Convert numpy/pandas types to JSON-safe Python types."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if hasattr(val, 'item'):
        return val.item()
    return val


def _series_stats(s):
    """Compute full stats for a pandas Series."""
    if len(s) == 0:
        return None
    q1 = float(s.quantile(0.25))
    q3 = float(s.quantile(0.75))
    iqr = q3 - q1
    mean = float(s.mean())
    std = float(s.std()) if len(s) > 1 else 0.0
    return {
        'count': int(len(s)),
        'mean': _safe(mean),
        'std': _safe(std),
        'min': _safe(float(s.min())),
        'max': _safe(float(s.max())),
        'sum': _safe(float(s.sum())),
        'median': _safe(float(s.median())),
        'q1': _safe(q1),
        'q3': _safe(q3),
        'iqr': _safe(iqr),
        'whisker_lo': _safe(max(float(s.min()), q1 - 1.5 * iqr)),
        'whisker_hi': _safe(min(float(s.max()), q3 + 1.5 * iqr)),
        'skew': _safe(float(s.skew())) if len(s) > 2 else None,
        'kurtosis': _safe(float(s.kurtosis())) if len(s) > 3 else None,
        'z_mean': 0.0,  # placeholder, computed relative to reference
    }


@app.route('/api/analytics/stats')
def get_analytics_stats():
    """
    Rich analytics using patient_features.parquet with event_timestamp.
    Supports date cutoff and Outcome category filter.
    """
    try:
        from scipy import stats as sp_stats

        parquet_path = PROJECT_ROOT / 'data' / 'processed' / 'patient_features.parquet'
        if not parquet_path.exists():
            return jsonify({'error': True, 'message': 'patient_features.parquet not found. Run the data pipeline first.'}), 404

        df = pd.read_parquet(parquet_path)
        df['event_timestamp'] = pd.to_datetime(df['event_timestamp'], errors='coerce')

        feature_cols = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
                        'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome']

        # Category filter (Outcome)
        cat_filter = request.args.get('category', '').strip()
        if cat_filter and cat_filter != 'all':
            try:
                df = df[df['Outcome'] == int(cat_filter)]
            except (ValueError, KeyError):
                pass

        cutoff_param = request.args.get('cutoff', '').strip()

        # Split based on event_timestamp
        if cutoff_param:
            cutoff_dt = pd.to_datetime(cutoff_param)
            # Include the full cutoff day
            cutoff_end = cutoff_dt + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)
            before = df[df['event_timestamp'] <= cutoff_end].copy()
            after = df[df['event_timestamp'] > cutoff_end].copy()
            split_label = cutoff_param
        else:
            # Default: split by earliest timestamp vs rest
            unique_ts = sorted(df['event_timestamp'].dropna().unique())
            if len(unique_ts) > 1:
                first_ts = unique_ts[0]
                before = df[df['event_timestamp'] <= first_ts].copy()
                after = df[df['event_timestamp'] > first_ts].copy()
                split_label = f'First batch ({pd.Timestamp(first_ts).strftime("%Y-%m-%d %H:%M")})'
            else:
                split_idx = int(len(df) * 0.8)
                before = df.iloc[:split_idx].copy()
                after = df.iloc[split_idx:].copy()
                split_label = f'Row {split_idx} (80/20 — single timestamp)'

        # Date range info
        ts_min = df['event_timestamp'].min()
        ts_max = df['event_timestamp'].max()
        unique_dates = sorted(df['event_timestamp'].dt.date.unique())

        result = {
            'total_rows': len(df),
            'before_count': len(before),
            'after_count': len(after),
            'split_label': split_label,
            'has_dates': True,
            'date_range': {
                'min': ts_min.isoformat() if pd.notna(ts_min) else None,
                'max': ts_max.isoformat() if pd.notna(ts_max) else None,
                'unique_dates': [str(d) for d in unique_dates],
            },
            'features': {},
        }

        for col in feature_cols:
            if col not in df.columns:
                continue

            all_vals = df[col].dropna().astype(float)
            before_vals = before[col].dropna().astype(float)
            after_vals = after[col].dropna().astype(float)

            overall = _series_stats(all_vals)
            bstats = _series_stats(before_vals)
            astats = _series_stats(after_vals)

            if bstats and astats and bstats['std'] and bstats['std'] > 0:
                z = (astats['mean'] - bstats['mean']) / bstats['std']
                astats['z_mean'] = _safe(round(z, 3))

            col_result = {'overall': overall, 'before': bstats, 'after': astats}

            # Drift tests
            if len(before_vals) >= 5 and len(after_vals) >= 5:
                ks_stat, ks_pval = sp_stats.ks_2samp(before_vals.values, after_vals.values)
                psi_val = None
                try:
                    n_bins = 10
                    combined = np.concatenate([before_vals.values, after_vals.values])
                    bins = np.histogram_bin_edges(combined, bins=n_bins)
                    bh, _ = np.histogram(before_vals.values, bins=bins)
                    ah, _ = np.histogram(after_vals.values, bins=bins)
                    bp = (bh + 1e-6) / (bh.sum() + 1e-6 * n_bins)
                    ap = (ah + 1e-6) / (ah.sum() + 1e-6 * n_bins)
                    psi_val = _safe(float(np.sum((ap - bp) * np.log(ap / bp))))
                except Exception:
                    pass
                col_result['drift'] = {
                    'ks_statistic': _safe(ks_stat), 'ks_pvalue': _safe(ks_pval),
                    'psi': psi_val, 'drifted': bool(ks_pval < 0.05),
                }
            else:
                col_result['drift'] = {'ks_statistic': None, 'ks_pvalue': None, 'psi': None, 'drifted': False}

            # Histogram
            if len(all_vals) > 0:
                n_bins = 20
                edges = np.histogram_bin_edges(all_vals.values, bins=n_bins)
                bh, _ = np.histogram(before_vals.values, bins=edges) if len(before_vals) > 0 else (np.zeros(n_bins), edges)
                ah, _ = np.histogram(after_vals.values, bins=edges) if len(after_vals) > 0 else (np.zeros(n_bins), edges)
                mids = [(edges[i] + edges[i + 1]) / 2 for i in range(len(edges) - 1)]
                col_result['histogram'] = {
                    'labels': [round(m, 2) for m in mids],
                    'before': [int(x) for x in bh.tolist()],
                    'after': [int(x) for x in ah.tolist()],
                }
            else:
                col_result['histogram'] = None

            # Time series: rolling mean ordered by event_timestamp, x-axis = dates
            if len(all_vals) >= 20:
                ts_df = df[['event_timestamp', col]].dropna().sort_values('event_timestamp').reset_index(drop=True)
                window = max(10, len(ts_df) // 20)
                ts_df['rolling'] = ts_df[col].rolling(window=window, min_periods=1).mean()
                step = max(1, len(ts_df) // 100)
                sampled = ts_df.iloc[::step]
                col_result['timeseries'] = {
                    'dates': [t.strftime('%Y-%m-%d %H:%M') for t in sampled['event_timestamp']],
                    'values': [_safe(round(v, 3)) for v in sampled['rolling']],
                    'window': window,
                    'split_date': split_label,
                }
            else:
                col_result['timeseries'] = None

            result['features'][col] = col_result

        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': True, 'message': str(e)}), 500


# ============================================================================
# Main
# ============================================================================

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8085, help='Port')
    args = parser.parse_args()

    print(f"Project root: {PROJECT_ROOT}")
    print(f"Dashboard: http://localhost:{args.port}")

    # Pre-load model
    get_model_loader()

    app.run(host='0.0.0.0', port=args.port, debug=True)
