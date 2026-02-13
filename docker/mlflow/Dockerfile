FROM python:3.13

RUN pip install --no-cache-dir mlflow[extras]==3.9.0

EXPOSE 5000

CMD ["mlflow", "server", "--host", "0.0.0.0", "--port", "5000"]