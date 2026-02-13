/**
 * Predict Panel — interactive diabetes prediction form with Model Registry selector
 */
class PredictPanel {
    constructor() {
        this.panelId = 'predict';
        this.container = null;
        this.isLoading = false;
        this.features = [
            { name: 'Pregnancies', type: 'int', min: 0, max: 20, step: 1, desc: 'Number of pregnancies' },
            { name: 'Glucose', type: 'float', min: 0, max: 250, step: 1, desc: 'Plasma glucose (mg/dL)' },
            { name: 'BloodPressure', type: 'float', min: 0, max: 200, step: 1, desc: 'Diastolic BP (mmHg)' },
            { name: 'SkinThickness', type: 'float', min: 0, max: 120, step: 1, desc: 'Triceps skin fold (mm)' },
            { name: 'Insulin', type: 'float', min: 0, max: 900, step: 1, desc: '2h serum insulin (mu U/ml)' },
            { name: 'BMI', type: 'float', min: 0, max: 80, step: 0.1, desc: 'Body mass index' },
            { name: 'DiabetesPedigreeFunction', type: 'float', min: 0, max: 3, step: 0.01, desc: 'Pedigree function' },
            { name: 'Age', type: 'int', min: 18, max: 100, step: 1, desc: 'Patient age' },
        ];
        this.examples = {
            high_risk: { label: 'High Risk', data: { Pregnancies: 6, Glucose: 148, BloodPressure: 72, SkinThickness: 35, Insulin: 0, BMI: 33.6, DiabetesPedigreeFunction: 0.6, Age: 50 } },
            low_risk: { label: 'Low Risk', data: { Pregnancies: 1, Glucose: 85, BloodPressure: 66, SkinThickness: 29, Insulin: 0, BMI: 26.6, DiabetesPedigreeFunction: 0.3, Age: 31 } },
            medium: { label: 'Medium Risk', data: { Pregnancies: 3, Glucose: 120, BloodPressure: 70, SkinThickness: 30, Insulin: 80, BMI: 30.1, DiabetesPedigreeFunction: 0.5, Age: 40 } },
        };
        this.registryModels = [];
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

        const modelCard = document.createElement('div');
        modelCard.className = 'card';
        modelCard.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">Model Registry</h3>
            </div>
            <div class="card-body" id="predict-model-selector">
                <div class="loading"><div class="loading-spinner small"></div><span>Loading registered models...</span></div>
            </div>
        `;
        this.container.appendChild(modelCard);

        // Model comparison card
        const comparisonCard = document.createElement('div');
        comparisonCard.className = 'card';
        comparisonCard.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">Model Comparison</h3>
            </div>
            <div class="card-body" id="predict-model-comparison">
                <div class="loading"><div class="loading-spinner small"></div><span>Loading metrics...</span></div>
            </div>
        `;
        this.container.appendChild(comparisonCard);

        const formCard = document.createElement('div');
        formCard.className = 'card prediction-section';
        const exampleOpts = Object.entries(this.examples)
            .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

        formCard.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">Make a Prediction</h3>
                <div class="example-selector">
                    <label for="example-select">Load example:</label>
                    <select id="example-select" class="input">
                        <option value="">-- Select --</option>
                        ${exampleOpts}
                    </select>
                </div>
            </div>
            <div class="card-body">
                <form id="prediction-form" class="prediction-form">
                    <div class="form-grid">
                        ${this.features.map(f => `
                            <div class="form-group">
                                <label for="input-${f.name}">${f.name}</label>
                                <input type="number" id="input-${f.name}" name="${f.name}"
                                    class="input" min="${f.min}" max="${f.max}" step="${f.step}"
                                    placeholder="${f.desc}" required />
                                <span class="form-hint">${f.desc}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary" id="predict-btn">Predict</button>
                        <button type="button" class="btn btn-outline" id="clear-btn">Clear</button>
                    </div>
                </form>
                <div id="prediction-result" class="prediction-result hidden"></div>
            </div>
        `;
        this.container.appendChild(formCard);
        setTimeout(() => this.setupFormListeners(), 0);
    }

    /* ---- Model Registry Selector ---- */

    async loadModels() {
        const container = document.getElementById('predict-model-selector');
        if (!container) return;
        try {
            const resp = await fetch('/api/model/list');
            const data = await resp.json();
            this.registryModels = data.models || [];
            const current = data.current;

            if (this.registryModels.length === 0) {
                container.innerHTML = `<div class="warning-message"><span>${data.message || 'No registered models found. Run the training pipeline to register models.'}</span></div>`;
                return;
            }

            // Group by registry_name, show latest version per model
            const grouped = {};
            for (const m of this.registryModels) {
                if (!grouped[m.registry_name]) grouped[m.registry_name] = [];
                grouped[m.registry_name].push(m);
            }

            const options = Object.entries(grouped).map(([name, versions]) => {
                const latest = versions[0]; // already sorted desc
                const aliasStr = latest.aliases.length ? ` [${latest.aliases.join(', ')}]` : '';
                const tagAcc = latest.tags.accuracy ? ` acc:${(parseFloat(latest.tags.accuracy) * 100).toFixed(1)}%` : '';
                const tagF1 = latest.tags.f1 ? ` f1:${(parseFloat(latest.tags.f1) * 100).toFixed(1)}%` : '';
                const isCurrent = current && current.name === name;
                return `<option value="${name}" ${isCurrent ? 'selected' : ''}>${name} v${latest.version}${aliasStr}${tagAcc}${tagF1}</option>`;
            }).join('');

            // Build tags display for currently loaded model
            let currentInfo = '';
            if (current && current.name) {
                const curModels = grouped[current.name];
                const curVer = curModels?.find(m => m.version === current.version) || curModels?.[0];
                const tags = curVer?.tags || {};
                const aliases = curVer?.aliases || [];
                const tagBadges = Object.entries(tags).map(([k, v]) =>
                    `<span class="badge badge-primary" style="margin-right: 4px;">${k}: ${v}</span>`
                ).join('');
                const aliasBadges = aliases.map(a =>
                    `<span class="badge badge-success" style="margin-right: 4px;">${a}</span>`
                ).join('');
                currentInfo = `
                    <div class="success-message" style="margin-top: 12px;">
                        <span>Loaded: <code>${current.name}</code> v${current.version || '?'}${current.alias ? ` @${current.alias}` : ''}</span>
                    </div>
                    ${(tagBadges || aliasBadges) ? `<div style="margin-top: 8px;">${aliasBadges}${tagBadges}</div>` : ''}
                `;
            } else {
                currentInfo = `<div class="warning-message" style="margin-top: 12px;"><span>No model loaded</span></div>`;
            }

            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div class="config-field" style="flex: 1; min-width: 220px;">
                        <label>Registered Model</label>
                        <select class="input" id="predict-model-select">${options}</select>
                    </div>
                    <div class="config-field" style="min-width: 120px;">
                        <label>Alias</label>
                        <select class="input" id="predict-alias-select">
                            <option value="latest">latest</option>
                            <option value="champion">champion</option>
                        </select>
                    </div>
                    <button class="btn btn-primary btn-sm" id="predict-switch-model-btn" style="align-self: flex-end;">Load Model</button>
                    <span id="predict-model-status" class="config-status" style="align-self: flex-end;"></span>
                </div>
                ${currentInfo}
            `;

            // Update alias dropdown options based on selected model
            this._updateAliasOptions('predict-model-select', 'predict-alias-select', grouped);
            document.getElementById('predict-model-select')?.addEventListener('change', () => {
                this._updateAliasOptions('predict-model-select', 'predict-alias-select', grouped);
            });
            document.getElementById('predict-switch-model-btn')?.addEventListener('click', () => this.switchModel());

            // Render model comparison table
            this.renderModelComparison(grouped, current);
        } catch (err) {
            container.innerHTML = `<div class="error-message"><span>Cannot reach MLflow: ${err.message}</span></div>`;
        }
    }

    renderModelComparison(grouped, current) {
        const container = document.getElementById('predict-model-comparison');
        if (!container) return;

        const models = [];
        for (const [name, versions] of Object.entries(grouped)) {
            const latest = versions[0];
            models.push({
                name,
                version: latest.version,
                aliases: latest.aliases,
                accuracy: latest.tags.accuracy ? parseFloat(latest.tags.accuracy) : null,
                precision: latest.tags.precision ? parseFloat(latest.tags.precision) : null,
                recall: latest.tags.recall ? parseFloat(latest.tags.recall) : null,
                f1: latest.tags.f1 ? parseFloat(latest.tags.f1) : null,
                roc_auc: latest.tags.roc_auc ? parseFloat(latest.tags.roc_auc) : null,
                isCurrent: current && current.name === name,
            });
        }

        if (models.length === 0) {
            container.innerHTML = `<div class="warning-message"><span>No models with metrics found</span></div>`;
            return;
        }

        const fmt = (v) => v !== null ? (v * 100).toFixed(1) + '%' : '—';
        const best = (metric) => {
            const vals = models.map(m => m[metric]).filter(v => v !== null);
            return vals.length > 0 ? Math.max(...vals) : null;
        };
        const isBest = (m, metric) => m[metric] !== null && m[metric] === best(metric);

        const rows = models.map(m => {
            const rowClass = m.isCurrent ? 'style="background: rgba(34, 197, 94, 0.1);"' : '';
            const currentBadge = m.isCurrent ? '<span class="badge badge-success" style="margin-left:6px;">loaded</span>' : '';
            const aliasBadges = m.aliases.map(a => `<span class="badge badge-primary" style="margin-left:4px;">${a}</span>`).join('');
            return `<tr ${rowClass}>
                <td style="font-weight:600;">${m.name}${currentBadge}${aliasBadges}</td>
                <td>v${m.version}</td>
                <td style="${isBest(m, 'accuracy') ? 'color:var(--success);font-weight:700;' : ''}">${fmt(m.accuracy)}</td>
                <td style="${isBest(m, 'precision') ? 'color:var(--success);font-weight:700;' : ''}">${fmt(m.precision)}</td>
                <td style="${isBest(m, 'recall') ? 'color:var(--success);font-weight:700;' : ''}">${fmt(m.recall)}</td>
                <td style="${isBest(m, 'f1') ? 'color:var(--success);font-weight:700;' : ''}">${fmt(m.f1)}</td>
                <td style="${isBest(m, 'roc_auc') ? 'color:var(--success);font-weight:700;' : ''}">${fmt(m.roc_auc)}</td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Model</th>
                            <th>Version</th>
                            <th>Accuracy</th>
                            <th>Precision</th>
                            <th>Recall</th>
                            <th>F1</th>
                            <th>ROC AUC</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div style="margin-top:8px;font-size:0.8rem;color:var(--text-muted);">
                Best metric per column highlighted in green
            </div>
        `;
    }

    _updateAliasOptions(selectId, aliasSelectId, grouped) {
        const select = document.getElementById(selectId);
        const aliasSelect = document.getElementById(aliasSelectId);
        if (!select || !aliasSelect) return;
        const name = select.value;
        const versions = grouped[name] || [];
        // Collect all unique aliases across versions
        const allAliases = new Set(['latest']);
        for (const v of versions) {
            for (const a of (v.aliases || [])) allAliases.add(a);
        }
        allAliases.add('champion'); // always show champion as option
        aliasSelect.innerHTML = [...allAliases].map(a => `<option value="${a}">${a}</option>`).join('');
    }

    async switchModel() {
        const select = document.getElementById('predict-model-select');
        const aliasSelect = document.getElementById('predict-alias-select');
        const status = document.getElementById('predict-model-status');
        const btn = document.getElementById('predict-switch-model-btn');
        if (!select) return;

        const registryName = select.value;
        const alias = aliasSelect?.value || 'latest';
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading-spinner small"></span> Loading...'; }

        try {
            const resp = await fetch('/api/model/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registry_name: registryName, alias }),
            });
            const data = await resp.json();
            if (data.success) {
                if (status) status.innerHTML = `<span style="color: var(--success);">${data.message}</span>`;
                this.loadModels();
            } else {
                if (status) status.innerHTML = `<span style="color: var(--danger);">${data.message}</span>`;
            }
        } catch (err) {
            if (status) status.innerHTML = `<span style="color: var(--danger);">${err.message}</span>`;
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = 'Load Model'; }
            setTimeout(() => { if (status) status.innerHTML = ''; }, 4000);
        }
    }

    /* ---- Form ---- */

    setupFormListeners() {
        const form = document.getElementById('prediction-form');
        const exSel = document.getElementById('example-select');
        const clearBtn = document.getElementById('clear-btn');

        if (form) form.addEventListener('submit', (e) => this.handlePredict(e));
        if (exSel) exSel.addEventListener('change', (e) => this.loadExample(e.target.value));
        if (clearBtn) clearBtn.addEventListener('click', () => {
            document.getElementById('prediction-form')?.reset();
            document.getElementById('example-select').value = '';
            document.getElementById('prediction-result')?.classList.add('hidden');
        });
    }

    loadExample(key) {
        if (!key || !this.examples[key]) return;
        Object.entries(this.examples[key].data).forEach(([k, v]) => {
            const input = document.getElementById(`input-${k}`);
            if (input) input.value = v;
        });
        document.getElementById('prediction-result')?.classList.add('hidden');
    }

    async handlePredict(e) {
        e.preventDefault();
        if (this.isLoading) return;

        const form = e.target;
        const data = {};
        this.features.forEach(f => {
            data[f.name] = parseFloat(new FormData(form).get(f.name));
        });

        const btn = document.getElementById('predict-btn');
        const resultDiv = document.getElementById('prediction-result');
        this.isLoading = true;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner small"></span> Predicting...';

        try {
            const resp = await fetch('/api/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await resp.json();
            this.renderResult(resultDiv, resp.ok, result);
        } catch (err) {
            this.renderResult(resultDiv, false, { error: true, message: err.message });
        } finally {
            this.isLoading = false;
            btn.disabled = false;
            btn.innerHTML = 'Predict';
        }
    }

    renderResult(container, ok, result) {
        container.classList.remove('hidden');
        if (ok && !result.error) {
            const isDiabetes = result.prediction === 1;
            const pct = (result.probability * 100).toFixed(1);
            const confClass = result.probability > 0.7 ? 'high' : result.probability > 0.4 ? 'medium' : 'low';
            container.innerHTML = `
                <div class="result-card ${isDiabetes ? 'result-positive' : 'result-negative'}">
                    <div class="result-header">
                        <span class="result-title">${isDiabetes ? 'Diabetes Risk Detected' : 'Low Diabetes Risk'}</span>
                    </div>
                    <div class="result-body">
                        <div class="result-metrics">
                            <div class="metric">
                                <span class="metric-label">Prediction</span>
                                <span class="metric-value">${isDiabetes ? 'Positive' : 'Negative'}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Probability</span>
                                <span class="metric-value confidence-${confClass}">${pct}%</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">Model</span>
                                <span class="metric-value">${result.model_name || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="result-card result-error">
                    <div class="result-header">
                        <span class="result-title">Prediction Failed</span>
                    </div>
                    <div class="result-body">
                        <p>${result.message || result.error || 'Unknown error'}</p>
                    </div>
                </div>
            `;
        }
    }

    setupEventListeners(panel) {
        panel.addEventListener('panel:activate', () => this.loadModels());
        panel.addEventListener('panel:deactivate', () => {});
    }
}

document.addEventListener('DOMContentLoaded', () => { new PredictPanel().init(); });
if (typeof window !== 'undefined') window.PredictPanel = PredictPanel;
