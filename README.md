# Diabetes Prediction ML Platform

End-to-end MLOps platform for diabetes risk prediction using the Pima Indians Diabetes dataset
---

```
PROJECT ARCHITECTURE

  Raw CSV ──▶ Airflow (Docker) ──▶ Processed Parquet
  diabetes.csv   feature_pipeline      patient_features.parquet
                 materialize_features          │
                                               ▼
                              ┌─────────────────────────────┐
                              │     Feast Feature Store      │
                              │     (SQLite online store)    │
                              └──────────────┬──────────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              ▼              │
                              │   ZenML Training Pipeline   │
                              │   DecisionTree + KNN        │
                              │   MLflow experiment logging  │
                              └──────────────┬──────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    ▼                        ▼                        ▼
             Flask API :8000        Dashboard :8085           ZenML Predict
             /predict               Web UI (Vanilla JS)       Pipeline
             /predict/batch         6 panels + theme toggle
```

## Project Structure

```
.
├── api/                        # Flask prediction API (:8000)
│   ├── app.py                  # App factory
│   ├── config.py               # API config
│   ├── run.py                  # Entry point
│   └── routes/                 # /health, /predict, /predict/batch
├── dashboard/                  # Web dashboard (:8085)
│   ├── server/server.py        # Flask backend
│   ├── index.html              # SPA entry
│   ├── css/styles.css          # Dark/light theme
│   └── js/                     # Panels, navigation, app controller
├── scripts/
│   ├── training/               # Decoupled training (factory pattern)
│   ├── prediction/             # Decoupled prediction (MLflow v3)
│   ├── config/                 # YAML configs
│   ├── zenml_pipeline.py       # ZenML training pipeline
│   ├── zenml_predict.py        # ZenML prediction pipeline
│   ├── prepare_data.py         # Data processing
│   └── materialize.py          # Feast materialization
├── feature_repo/               # Feast feature store
│   └── feature_repo/
│       ├── feature_store.yaml
│       ├── features.py
│       └── data/               # SQLite online store
├── docker/
│   ├── airflow/                # Airflow (Docker Compose)
│   └── mlflow/                 # MLflow (Docker Compose)
├── data/
│   ├── raw/diabetes.csv        # Source dataset (768 rows)
│   └── processed/              # Parquet for Feast
└── pyproject.toml
```

## Prerequisites

Before running `start.sh`, make sure you have the following installed:

| Requirement | Why | Install |
|---|---|---|
| Git | Clone the repo | https://git-scm.com/downloads |
| Docker + Docker Compose | Runs MLflow and Airflow containers | https://docs.docker.com/get-docker/ |
| Python 3.13+ | Runtime for the ML code, API, and dashboard | https://www.python.org/downloads/ |
| Bash shell | `start.sh` is a bash script | Linux/macOS: built-in. Windows: use WSL2 or Git Bash |
| curl | Used to auto-install `uv` if missing | Linux/macOS: built-in. Windows WSL2: built-in |
| lsof | Used by `start.sh` to free occupied ports | Linux/macOS: built-in. WSL2: `sudo apt install lsof` |

`uv` (Python package manager) is installed automatically by `start.sh` if not found.

Docker must be running before you execute `start.sh` — the script does not start the Docker daemon for you.

On Windows, use WSL2 (recommended) or Git Bash. Native PowerShell/CMD will not work with `start.sh`.

## Quick Start

The easiest way to get everything running is the all-in-one script:

```bash
chmod +x start.sh
./start.sh
```

This will:
1. Check for `uv` and install it automatically if missing
2. Run `uv sync` to install all Python dependencies (no need to activate a venv)
3. Create the `mlops-network` Docker network
4. Start MLflow (Docker) on port 5000
5. Start Airflow (Docker) on port 8080
6. Start ZenML server on port 8237
7. Start Flask Prediction API on port 8000
8. Start the Dashboard on port 8085

To stop everything:

```bash
./start.sh stop
```

Logs are available at `.log_api.log` and `.log_dashboard.log`.

### Manual Setup (step by step)

If you prefer to start services individually:

### 1. Install Dependencies

```bash
uv sync
```

### 2. Create Docker Network

```bash
docker network create mlops-network
```

### 3. Start MLflow

```bash
docker compose -f docker/mlflow/docker-compose.yaml up -d
```

MLflow UI: http://localhost:5000

### 4. Start Airflow

```bash
docker compose -f docker/airflow/docker-compose.yaml up -d
```

Airflow UI: http://localhost:8080 (user: `airflow` / password: `airflow`)

### 5. Initialize ZenML

```bash
# First time setup
zenml init
zenml up
zenml login --local
```

ZenML Dashboard: http://localhost:8237

If you need a fresh start (loses pipeline history):

```bash
zenml clean
zenml init
zenml up
zenml login --local
```

### 6. Run Training Pipeline

```bash
uv run python scripts/zenml_pipeline.py
```

Trains Decision Tree and KNN models, logs metrics and artifacts to MLflow.

### 7. Register a Model in MLflow (required before predictions)

The training pipeline logs models to MLflow but does not auto-register them. You need to register at least one model before the prediction API or prediction pipeline can work:

1. Open MLflow UI at http://localhost:5000
2. Go to the experiment `diabetes_prediction` and pick a run (e.g. `decision_tree`)
3. In the run's Artifacts section, find the logged `model`
4. Click **Register Model** — name it `decision_tree` (or `knn`, matching `scripts/config/prediction_config.yaml` → `model_name`)
5. After registering, go to the **Models** tab in MLflow, find your model, and set an alias (e.g. `latest` or `champion`) on the version

The prediction config at `scripts/config/prediction_config.yaml` controls which model gets loaded:

```yaml
mlflow:
  tracking_uri: http://localhost:5000
  experiment_name: diabetes_prediction
  model_name: decision_tree    # must match the registered model name
```

> Without a registered model, the Flask API and Dashboard will show "Model not loaded".

### 8. Run Prediction Pipeline

```bash
uv run python scripts/zenml_predict.py
```

### 9. Start Flask Prediction API

```bash
uv run python api/run.py
```

API at http://localhost:8000

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/predict` | POST | Single patient prediction |
| `/predict/batch` | POST | Batch predictions |

### 10. Start Dashboard

```bash
uv run python dashboard/server/server.py --port 8085
```

Dashboard: http://localhost:8085

## ZenML Commands Reference

| Command | Description |
|---------|-------------|
| `zenml init` | Initialize ZenML in the project |
| `zenml up` | Start the ZenML server |
| `zenml down` | Stop the ZenML server |
| `zenml login --local` | Login to local ZenML server |
| `zenml clean` | Remove all ZenML data (pipelines, stacks, artifacts) |
| `zenml pipeline list` | List registered pipelines |
| `zenml stack list` | List available stacks |

## Airflow DAGs

| DAG | Description | Schedule |
|-----|-------------|----------|
| `feature_pipeline` | Process raw CSV into parquet | `@daily` |
| `materialize_features` | Materialize to Feast online store | `@daily` |

## Feast Feature Store

```bash
# Apply definitions
feast -c feature_repo/feature_repo apply

# Materialize to online store
uv run python scripts/materialize.py
```

## Services Summary

| Service | Port | Start Command |
|---------|------|---------------|
| MLflow | 5000 | `docker compose -f docker/mlflow/docker-compose.yaml up -d` |
| Airflow | 8080 | `docker compose -f docker/airflow/docker-compose.yaml up -d` |
| ZenML | 8237 | `zenml up` |
| Flask API | 8000 | `uv run python api/run.py` |
| Dashboard | 8085 | `uv run python dashboard/server/server.py --port 8085` |

## Stopping Services

All at once:

```bash
./start.sh stop
```

Or individually:

```bash
docker compose -f docker/mlflow/docker-compose.yaml down
docker compose -f docker/airflow/docker-compose.yaml down
zenml down
```
