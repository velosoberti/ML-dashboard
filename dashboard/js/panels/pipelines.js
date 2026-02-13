/**
 * Pipelines Panel — trigger Airflow DAGs and ZenML pipelines with config editing
 */
class PipelinesPanel {
    constructor() {
        this.panelId = 'pipelines';
        this.container = null;
        this.trainingConfig = null;
        this.predictionConfig = null;
    }

    init() {
        const panel = document.getElementById(`panel-${this.panelId}`);
        if (!panel) return;
        this.container = panel.querySelector('.panel-content');
        if (!this.container) return;
        this.render();
        this.setupEventListeners(panel);
    }

    render() {
        this.container.innerHTML = '';
        this.container.classList.add('stacked-layout');

        // Airflow card
        const airflowCard = document.createElement('div');
        airflowCard.className = 'card';
        airflowCard.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">Airflow Pipelines</h3>
                <a href="http://localhost:8080" target="_blank" class="btn btn-outline btn-sm">Open Airflow UI</a>
            </div>
            <div class="card-body">
                <p class="text-muted" style="margin-bottom: 16px;">
                    Data processing pipelines running in Docker. Handle raw data ingestion and feature materialization.
                </p>
                <div id="airflow-dags-container">
                    <div class="loading"><div class="loading-spinner"></div><span>Loading DAGs...</span></div>
                </div>
            </div>
        `;
        this.container.appendChild(airflowCard);

        // ZenML card with config
        const zenmlCard = document.createElement('div');
        zenmlCard.className = 'card';
        zenmlCard.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">ZenML Pipelines</h3>
                <a href="http://localhost:8237" target="_blank" class="btn btn-outline btn-sm">Open ZenML UI</a>
            </div>
            <div class="card-body">
                <p class="text-muted" style="margin-bottom: 16px;">
                    ML orchestration pipelines. Configure parameters below before running.
                </p>

                <!-- Training Pipeline -->
                <div class="pipeline-action-card" style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div>
                            <h4>Training Pipeline</h4>
                            <p class="text-muted" style="font-size: 0.85rem; margin-top: 4px;">
                                load_data → split_data → train → evaluate → log_to_mlflow
                            </p>
                        </div>
                        <button class="btn btn-primary btn-sm" id="run-training-btn">Run Training</button>
                    </div>
                    <div id="training-config-container">
                        <div class="loading"><div class="loading-spinner small"></div><span>Loading config...</span></div>
                    </div>
                    <div id="training-output" class="pipeline-output hidden"></div>
                </div>

                <!-- Prediction Pipeline -->
                <div class="pipeline-action-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div>
                            <h4>Prediction Pipeline</h4>
                            <p class="text-muted" style="font-size: 0.85rem; margin-top: 4px;">
                                load_model → predict (sample patients)
                            </p>
                        </div>
                        <button class="btn btn-primary btn-sm" id="run-prediction-btn">Run Prediction</button>
                    </div>
                    <div id="prediction-config-container">
                        <div class="loading"><div class="loading-spinner small"></div><span>Loading config...</span></div>
                    </div>
                    <div id="prediction-output" class="pipeline-output hidden"></div>
                </div>
            </div>
        `;
        this.container.appendChild(zenmlCard);

        setTimeout(() => {
            document.getElementById('run-training-btn')?.addEventListener('click', () => this.runZenML('training'));
            document.getElementById('run-prediction-btn')?.addEventListener('click', () => this.runZenML('prediction'));
        }, 0);
    }

    /* ---- Config Loading ---- */

    async loadTrainingConfig() {
        const container = document.getElementById('training-config-container');
        if (!container) return;
        try {
            const resp = await fetch('/api/config/training');
            this.trainingConfig = await resp.json();
            if (this.trainingConfig.error) {
                container.innerHTML = `<div class="warning-message"><span>${this.trainingConfig.message}</span></div>`;
                return;
            }
            this.renderTrainingConfig(container);
        } catch (err) {
            container.innerHTML = `<div class="error-message"><span>Could not load config: ${err.message}</span></div>`;
        }
    }

    async loadPredictionConfig() {
        const container = document.getElementById('prediction-config-container');
        if (!container) return;
        try {
            const resp = await fetch('/api/config/prediction');
            this.predictionConfig = await resp.json();
            if (this.predictionConfig.error) {
                container.innerHTML = `<div class="warning-message"><span>${this.predictionConfig.message}</span></div>`;
                return;
            }
            this.renderPredictionConfig(container);
        } catch (err) {
            container.innerHTML = `<div class="error-message"><span>Could not load config: ${err.message}</span></div>`;
        }
    }

    /* ---- Training Config Render ---- */

    renderTrainingConfig(container) {
        const c = this.trainingConfig;
        container.innerHTML = `
            <!-- MLflow Settings -->
            ${this._configSection('train-mlflow', 'MLflow Settings', `
                <div class="config-row">
                    <div class="config-field">
                        <label>Tracking URI</label>
                        <input class="input" id="tc-tracking-uri" value="${c.mlflow?.tracking_uri || ''}">
                    </div>
                    <div class="config-field">
                        <label>Experiment Name</label>
                        <input class="input" id="tc-experiment" value="${c.mlflow?.experiment_name || ''}">
                    </div>
                </div>
            `)}

            <!-- Data Settings -->
            ${this._configSection('train-data', 'Data Settings', `
                <div class="config-row">
                    <div class="config-field">
                        <label>Test Size</label>
                        <input class="input" type="number" step="0.05" min="0.05" max="0.5" id="tc-test-size" value="${c.data?.test_size || 0.2}">
                    </div>
                    <div class="config-field">
                        <label>Random State</label>
                        <input class="input" type="number" id="tc-random-state" value="${c.data?.random_state || 42}">
                    </div>
                </div>
            `)}

            <!-- Decision Tree -->
            ${this._configSection('train-dt', 'Decision Tree', `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="tc-dt-enabled" ${c.models?.decision_tree?.enabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">Enabled</span>
                </div>
                <div class="config-row">
                    <div class="config-field">
                        <label>Max Depth</label>
                        <input class="input" type="number" min="1" max="50" id="tc-dt-max-depth" value="${c.models?.decision_tree?.params?.max_depth || 5}">
                    </div>
                    <div class="config-field">
                        <label>Min Samples Split</label>
                        <input class="input" type="number" min="2" id="tc-dt-min-split" value="${c.models?.decision_tree?.params?.min_samples_split || 10}">
                    </div>
                </div>
                <div class="config-row">
                    <div class="config-field">
                        <label>Min Samples Leaf</label>
                        <input class="input" type="number" min="1" id="tc-dt-min-leaf" value="${c.models?.decision_tree?.params?.min_samples_leaf || 4}">
                    </div>
                    <div class="config-field">
                        <label>Criterion</label>
                        <select class="input" id="tc-dt-criterion">
                            <option value="gini" ${c.models?.decision_tree?.params?.criterion === 'gini' ? 'selected' : ''}>gini</option>
                            <option value="entropy" ${c.models?.decision_tree?.params?.criterion === 'entropy' ? 'selected' : ''}>entropy</option>
                            <option value="log_loss" ${c.models?.decision_tree?.params?.criterion === 'log_loss' ? 'selected' : ''}>log_loss</option>
                        </select>
                    </div>
                </div>
            `)}

            <!-- KNN -->
            ${this._configSection('train-knn', 'K-Nearest Neighbors', `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="tc-knn-enabled" ${c.models?.knn?.enabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">Enabled</span>
                </div>
                <div class="config-row">
                    <div class="config-field">
                        <label>N Neighbors</label>
                        <input class="input" type="number" min="1" max="50" id="tc-knn-neighbors" value="${c.models?.knn?.params?.n_neighbors || 7}">
                    </div>
                    <div class="config-field">
                        <label>Weights</label>
                        <select class="input" id="tc-knn-weights">
                            <option value="uniform" ${c.models?.knn?.params?.weights === 'uniform' ? 'selected' : ''}>uniform</option>
                            <option value="distance" ${c.models?.knn?.params?.weights === 'distance' ? 'selected' : ''}>distance</option>
                        </select>
                    </div>
                </div>
                <div class="config-row">
                    <div class="config-field">
                        <label>Metric</label>
                        <select class="input" id="tc-knn-metric">
                            <option value="minkowski" ${c.models?.knn?.params?.metric === 'minkowski' ? 'selected' : ''}>minkowski</option>
                            <option value="euclidean" ${c.models?.knn?.params?.metric === 'euclidean' ? 'selected' : ''}>euclidean</option>
                            <option value="manhattan" ${c.models?.knn?.params?.metric === 'manhattan' ? 'selected' : ''}>manhattan</option>
                        </select>
                    </div>
                    <div class="config-field">
                        <label>P (Minkowski power)</label>
                        <input class="input" type="number" min="1" max="5" id="tc-knn-p" value="${c.models?.knn?.params?.p || 2}">
                    </div>
                </div>
            `)}

            <div class="config-actions">
                <button class="btn btn-primary btn-sm" id="save-training-config">Save Configuration</button>
                <button class="btn btn-outline btn-sm" id="reset-training-config">Reset</button>
                <span class="config-status" id="training-config-status"></span>
            </div>
        `;

        // Toggle sections
        container.querySelectorAll('.config-section-header').forEach(h => {
            h.addEventListener('click', () => {
                const body = h.nextElementSibling;
                const icon = h.querySelector('.config-section-toggle');
                body.classList.toggle('open');
                icon.classList.toggle('open');
            });
        });

        document.getElementById('save-training-config')?.addEventListener('click', () => this.saveTrainingConfig());
        document.getElementById('reset-training-config')?.addEventListener('click', () => this.loadTrainingConfig());
    }

    /* ---- Prediction Config Render ---- */

    renderPredictionConfig(container) {
        const c = this.predictionConfig;
        container.innerHTML = `
            ${this._configSection('pred-settings', 'Prediction Settings', `
                <div class="config-row">
                    <div class="config-field">
                        <label>Tracking URI</label>
                        <input class="input" id="pc-tracking-uri" value="${c.mlflow?.tracking_uri || ''}">
                    </div>
                    <div class="config-field">
                        <label>Experiment Name</label>
                        <input class="input" id="pc-experiment" value="${c.mlflow?.experiment_name || ''}">
                    </div>
                </div>
                <div class="config-row">
                    <div class="config-field">
                        <label>Model Name</label>
                        <select class="input" id="pc-model-name">
                            <option value="decision_tree" ${c.mlflow?.model_name === 'decision_tree' ? 'selected' : ''}>Decision Tree</option>
                            <option value="knn" ${c.mlflow?.model_name === 'knn' ? 'selected' : ''}>KNN</option>
                        </select>
                    </div>
                    <div class="config-field"></div>
                </div>
            `)}

            <div class="config-actions">
                <button class="btn btn-primary btn-sm" id="save-prediction-config">Save Configuration</button>
                <button class="btn btn-outline btn-sm" id="reset-prediction-config">Reset</button>
                <span class="config-status" id="prediction-config-status"></span>
            </div>
        `;

        container.querySelectorAll('.config-section-header').forEach(h => {
            h.addEventListener('click', () => {
                const body = h.nextElementSibling;
                const icon = h.querySelector('.config-section-toggle');
                body.classList.toggle('open');
                icon.classList.toggle('open');
            });
        });

        document.getElementById('save-prediction-config')?.addEventListener('click', () => this.savePredictionConfig());
        document.getElementById('reset-prediction-config')?.addEventListener('click', () => this.loadPredictionConfig());
    }

    /* ---- Config Section Helper ---- */

    _configSection(id, title, bodyHTML) {
        return `
            <div class="config-section">
                <div class="config-section-header" data-section="${id}">
                    <span class="config-section-title">${title}</span>
                    <svg class="config-section-toggle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div class="config-section-body">${bodyHTML}</div>
            </div>
        `;
    }

    /* ---- Save Configs ---- */

    async saveTrainingConfig() {
        const status = document.getElementById('training-config-status');
        const val = (id) => document.getElementById(id)?.value;
        const num = (id) => parseFloat(document.getElementById(id)?.value);
        const int = (id) => parseInt(document.getElementById(id)?.value, 10);
        const checked = (id) => document.getElementById(id)?.checked;

        const config = {
            mlflow: {
                tracking_uri: val('tc-tracking-uri'),
                experiment_name: val('tc-experiment'),
            },
            data: {
                ...this.trainingConfig.data,
                test_size: num('tc-test-size'),
                random_state: int('tc-random-state'),
            },
            models: {
                decision_tree: {
                    enabled: checked('tc-dt-enabled'),
                    params: {
                        max_depth: int('tc-dt-max-depth'),
                        min_samples_split: int('tc-dt-min-split'),
                        min_samples_leaf: int('tc-dt-min-leaf'),
                        criterion: val('tc-dt-criterion'),
                        random_state: int('tc-random-state'),
                    }
                },
                knn: {
                    enabled: checked('tc-knn-enabled'),
                    params: {
                        n_neighbors: int('tc-knn-neighbors'),
                        weights: val('tc-knn-weights'),
                        metric: val('tc-knn-metric'),
                        p: int('tc-knn-p'),
                    }
                }
            }
        };

        try {
            const resp = await fetch('/api/config/training', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const data = await resp.json();
            if (data.success) {
                this.trainingConfig = config;
                if (status) { status.innerHTML = `<span style="color: var(--success);">Saved</span>`; }
            } else {
                if (status) { status.innerHTML = `<span style="color: var(--danger);">${data.message}</span>`; }
            }
        } catch (err) {
            if (status) { status.innerHTML = `<span style="color: var(--danger);">${err.message}</span>`; }
        }
        setTimeout(() => { if (status) status.innerHTML = ''; }, 3000);
    }

    async savePredictionConfig() {
        const status = document.getElementById('prediction-config-status');
        const val = (id) => document.getElementById(id)?.value;

        const config = {
            mlflow: {
                tracking_uri: val('pc-tracking-uri'),
                experiment_name: val('pc-experiment'),
                model_name: val('pc-model-name'),
            }
        };

        try {
            const resp = await fetch('/api/config/prediction', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const data = await resp.json();
            if (data.success) {
                this.predictionConfig = config;
                if (status) { status.innerHTML = `<span style="color: var(--success);">Saved</span>`; }
            } else {
                if (status) { status.innerHTML = `<span style="color: var(--danger);">${data.message}</span>`; }
            }
        } catch (err) {
            if (status) { status.innerHTML = `<span style="color: var(--danger);">${err.message}</span>`; }
        }
        setTimeout(() => { if (status) status.innerHTML = ''; }, 3000);
    }

    /* ---- Airflow DAGs ---- */

    async loadAirflowDags() {
        const container = document.getElementById('airflow-dags-container');
        if (!container) return;

        try {
            const resp = await fetch('/api/airflow/dags');
            const data = await resp.json();

            if (data.error) {
                container.innerHTML = `<div class="warning-message"><span>${data.message}</span></div>`;
                return;
            }

            const dags = data.dags || [];
            if (dags.length === 0) {
                container.innerHTML = `<div class="info-message"><span>No DAGs found. Check Airflow is running.</span></div>`;
                return;
            }

            container.innerHTML = dags.map(dag => `
                <div class="pipeline-action-card" style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0;">${dag.dag_id}</h4>
                            <span class="text-muted" style="font-size: 0.8rem;">
                                ${dag.schedule_interval || 'No schedule'} · ${dag.is_paused ? 'Paused' : 'Active'}
                            </span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-primary btn-sm trigger-dag-btn" data-dag="${dag.dag_id}">Trigger</button>
                            <button class="btn btn-outline btn-sm show-runs-btn" data-dag="${dag.dag_id}">Runs</button>
                        </div>
                    </div>
                    <div id="dag-runs-${dag.dag_id}" class="pipeline-output hidden" style="margin-top: 12px;"></div>
                    <div id="dag-trigger-${dag.dag_id}" class="hidden" style="margin-top: 8px;"></div>
                </div>
            `).join('');

            container.querySelectorAll('.trigger-dag-btn').forEach(btn => {
                btn.addEventListener('click', () => this.triggerDag(btn.dataset.dag));
            });
            container.querySelectorAll('.show-runs-btn').forEach(btn => {
                btn.addEventListener('click', () => this.showRuns(btn.dataset.dag));
            });

        } catch (err) {
            container.innerHTML = `<div class="error-message"><span>Cannot connect to Airflow: ${err.message}</span></div>`;
        }
    }

    async triggerDag(dagId) {
        const resultDiv = document.getElementById(`dag-trigger-${dagId}`);
        if (!resultDiv) return;
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = `<div class="loading"><div class="loading-spinner small"></div><span>Triggering ${dagId}...</span></div>`;

        try {
            const resp = await fetch(`/api/airflow/trigger/${dagId}`, { method: 'POST' });
            const data = await resp.json();
            if (data.success) {
                resultDiv.innerHTML = `<div class="success-message"><span>DAG triggered successfully</span></div>`;
            } else {
                resultDiv.innerHTML = `<div class="error-message"><span>${data.message}</span></div>`;
            }
        } catch (err) {
            resultDiv.innerHTML = `<div class="error-message"><span>${err.message}</span></div>`;
        }
    }

    async showRuns(dagId) {
        const container = document.getElementById(`dag-runs-${dagId}`);
        if (!container) return;
        container.classList.toggle('hidden');
        if (container.classList.contains('hidden')) return;

        container.innerHTML = `<div class="loading"><div class="loading-spinner small"></div><span>Loading runs...</span></div>`;

        try {
            const resp = await fetch(`/api/airflow/runs/${dagId}`);
            const data = await resp.json();
            const runs = data.runs || [];

            if (runs.length === 0) {
                container.innerHTML = `<span class="text-muted">No runs found</span>`;
                return;
            }

            container.innerHTML = `
                <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>Run ID</th><th>State</th><th>Execution Date</th></tr></thead>
                        <tbody>
                            ${runs.map(r => `
                                <tr>
                                    <td><code style="font-size: 0.75rem;">${(r.run_id || r.dag_run_id || '').substring(0, 30)}...</code></td>
                                    <td><span class="badge ${r.state === 'success' ? 'badge-success' : r.state === 'failed' ? 'badge-warning' : 'badge-primary'}">${r.state}</span></td>
                                    <td>${r.execution_date || r.logical_date || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (err) {
            container.innerHTML = `<div class="error-message"><span>${err.message}</span></div>`;
        }
    }

    /* ---- ZenML Pipeline Execution ---- */

    async runZenML(type) {
        const btnId = type === 'training' ? 'run-training-btn' : 'run-prediction-btn';
        const outputId = type === 'training' ? 'training-output' : 'prediction-output';
        const endpoint = type === 'training' ? '/api/zenml/run-training' : '/api/zenml/run-prediction';

        const btn = document.getElementById(btnId);
        const output = document.getElementById(outputId);
        if (!btn || !output) return;

        btn.disabled = true;
        btn.innerHTML = `<span class="loading-spinner small"></span> Running...`;
        output.classList.remove('hidden');
        output.innerHTML = `<div class="loading"><div class="loading-spinner small"></div><span>Pipeline running... this may take a few minutes.</span></div>`;

        try {
            const resp = await fetch(endpoint, { method: 'POST' });
            const data = await resp.json();

            if (data.success) {
                const lastLines = (data.stdout || '').split('\n').slice(-10).join('\n');
                output.innerHTML = `
                    <div class="success-message" style="margin-bottom: 8px;"><span>Pipeline completed successfully</span></div>
                    <pre class="code-block" style="max-height: 200px; overflow-y: auto; font-size: 0.8rem;">${lastLines}</pre>
                `;
            } else {
                const errText = data.stderr || data.message || 'Unknown error';
                output.innerHTML = `
                    <div class="error-message" style="margin-bottom: 8px;"><span>Pipeline failed</span></div>
                    <pre class="code-block" style="max-height: 200px; overflow-y: auto; font-size: 0.8rem;">${errText.slice(-1000)}</pre>
                `;
            }
        } catch (err) {
            output.innerHTML = `<div class="error-message"><span>${err.message}</span></div>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = `Run ${type === 'training' ? 'Training' : 'Prediction'}`;
        }
    }

    /* ---- Lifecycle ---- */

    setupEventListeners(panel) {
        panel.addEventListener('panel:activate', () => {
            this.loadAirflowDags();
            this.loadTrainingConfig();
            this.loadPredictionConfig();
        });
        panel.addEventListener('panel:deactivate', () => {});
    }
}

document.addEventListener('DOMContentLoaded', () => { new PipelinesPanel().init(); });
if (typeof window !== 'undefined') window.PipelinesPanel = PipelinesPanel;
