from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
from pathlib import Path
import sys
import yaml

sys.path.insert(0, '/opt/airflow/scripts')
from prepare_data import PatientDataProcessor, ProcessingConfig

CONFIG_PATH = Path('/opt/airflow/dags/config/pipeline_config.yaml')


def _load_config() -> dict:
    with open(CONFIG_PATH, 'r') as f:
        return yaml.safe_load(f)


def _process_data():
    cfg = _load_config()
    config = ProcessingConfig(
        raw_data_path=Path(cfg["raw_data_path"]),
        output_path=Path(cfg["output_path"]),
        timestamp=datetime.utcnow(),
    )
    PatientDataProcessor(config).run()


with DAG(
    dag_id="feature_pipeline",
    schedule_interval="@daily",
    start_date=datetime(2025, 1, 1),
    catchup=False,
) as dag:

    process_data = PythonOperator(
        task_id="process_data",
        python_callable=_process_data,
    )