FROM apache/airflow:2.9.1

# 1. Instale as ferramentas de construção C (build-essential)
#    Garantir que os pacotes necessários para compilar extensões Python (como as do pandas) estejam presentes.
#    O `pip` em algumas imagens pode precisar disso.
USER root
RUN apt-get update && \
    apt-get install -y build-essential --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*
USER airflow

# 2. Adicione seus requisitos e instale como o usuário 'airflow'
ADD requirements.txt .

# 3. Execute a instalação
RUN pip install -r requirements.txt