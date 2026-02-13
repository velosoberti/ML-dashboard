from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
from pathlib import Path

from materialize import FeatureStoreMaterializer, MaterializationConfig

FEAST_REPO_PATH = Path("/opt/airflow/feature_repo/feature_repo")


def _materialize():
    config = MaterializationConfig(
        repo_path=FEAST_REPO_PATH,
        end_date=datetime.utcnow(),
    )
    FeatureStoreMaterializer(config).run()


with DAG(
    dag_id="materialize_features",
    schedule_interval="@daily",
    start_date=datetime(2025, 1, 1),
    catchup=False,
) as dag:

    materialize = PythonOperator(
        task_id="materialize",
        python_callable=_materialize,
    )
