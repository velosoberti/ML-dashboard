/**
 * Dataset Panel - view CSV data and add new rows
 */
class DatasetPanel {
    constructor() {
        this.panelId = 'dataset';
        this.container = null;
        this.datasetInfo = null;
        this.currentPage = 1;
        this.pageSize = 50;
        this.isLoading = false;
        this.columns = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
                        'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome'];
        // Must match PatientRecordSchema in prepare_data.py
        this.fieldConstraints = {
            Pregnancies:              { min: 0,   max: 20,  step: 1 },
            Glucose:                  { min: 0,   max: 250, step: 1 },
            BloodPressure:            { min: 0,   max: 200, step: 1 },
            SkinThickness:            { min: 0,   max: 120, step: 1 },
            Insulin:                  { min: 0,   max: 900, step: 1 },
            BMI:                      { min: 0,   max: 80,  step: 0.01 },
            DiabetesPedigreeFunction: { min: 0,   max: 3,   step: 0.01 },
            Age:                      { min: 18,  max: 100, step: 1 },
            Outcome:                  { min: 0,   max: 1,   step: 1 },
        };
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

        const addCard = document.createElement('div');
        addCard.className = 'card prediction-section';
        addCard.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">Add New Patient Record</h3>
            </div>
            <div class="card-body">
                <div class="field-reference" style="margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">Field Constraints Reference</div>
                    <div class="table-container">
                        <table class="data-table" style="font-size: 0.85rem;">
                            <thead>
                                <tr>
                                    <th>Field</th>
                                    <th>Min</th>
                                    <th>Max</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.columns.map(col => {
                                    const c = this.fieldConstraints[col];
                                    const type = c.step < 1 ? 'decimal' : 'integer';
                                    return `<tr>
                                        <td style="font-weight:500;">${col}</td>
                                        <td>${c.min}</td>
                                        <td>${c.max}</td>
                                        <td>${type}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <form id="add-row-form" class="prediction-form" novalidate>
                    <div class="form-grid">
                        ${this.columns.map(col => {
                            const c = this.fieldConstraints[col];
                            return `
                            <div class="form-group">
                                <label for="add-${col}">${col} <span style="color:var(--text-muted);font-size:0.75rem;">(${c.min}–${c.max})</span></label>
                                <input type="number" id="add-${col}" name="${col}" class="input"
                                    min="${c.min}" max="${c.max}" step="${c.step}"
                                    placeholder="${col}" required />
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary" id="add-row-btn">Add Row</button>
                        <button type="button" class="btn btn-outline" id="clear-add-btn">Clear</button>
                    </div>
                </form>
                <div id="add-row-result" class="prediction-result hidden"></div>
            </div>
        `;
        this.container.appendChild(addCard);

        const tableCard = document.createElement('div');
        tableCard.className = 'card';
        tableCard.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">diabetes.csv</h3>
                <button class="btn btn-outline btn-sm" id="refresh-dataset-btn">Refresh</button>
            </div>
            <div class="card-body" id="dataset-table-container">
                <div class="loading"><div class="loading-spinner"></div><span>Loading dataset...</span></div>
            </div>
        `;
        this.container.appendChild(tableCard);

        setTimeout(() => {
            document.getElementById('add-row-form')?.addEventListener('submit', (e) => this.handleAddRow(e));
            document.getElementById('clear-add-btn')?.addEventListener('click', () => {
                document.getElementById('add-row-form')?.reset();
                document.getElementById('add-row-result')?.classList.add('hidden');
            });
            document.getElementById('refresh-dataset-btn')?.addEventListener('click', () => this.loadDataset());
        }, 0);
    }

    async handleAddRow(e) {
        e.preventDefault();
        const form = e.target;
        const resultDiv = document.getElementById('add-row-result');
        const data = {};
        const errors = [];

        // Client-side validation
        this.columns.forEach(col => {
            const raw = new FormData(form).get(col);
            if (raw === null || raw === '') {
                errors.push(`${col} is required`);
                return;
            }
            const val = parseFloat(raw);
            data[col] = val;
            const c = this.fieldConstraints[col];
            if (val < c.min || val > c.max) {
                errors.push(`${col} must be between ${c.min} and ${c.max} (got ${val})`);
            }
        });

        if (errors.length > 0) {
            resultDiv.classList.remove('hidden');
            resultDiv.innerHTML = `<div class="error-message"><strong>Validation failed</strong><ul style="margin:6px 0 0 16px;text-align:left;">${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>`;
            return;
        }

        const btn = document.getElementById('add-row-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner small"></span> Adding...';

        try {
            const resp = await fetch('/api/dataset/add-row', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await resp.json();
            resultDiv.classList.remove('hidden');
            if (result.success) {
                resultDiv.innerHTML = `<div class="success-message"><span>Row added. Total rows: ${result.total_rows}</span></div>`;
                form.reset();
                this.loadDataset();
            } else {
                let msg = result.message || 'Unknown error';
                if (result.details && Array.isArray(result.details)) {
                    msg = `<strong>${msg}</strong><ul style="margin:6px 0 0 16px;text-align:left;">${result.details.map(d => `<li>${d}</li>`).join('')}</ul>`;
                }
                resultDiv.innerHTML = `<div class="error-message">${msg}</div>`;
            }
        } catch (err) {
            resultDiv.classList.remove('hidden');
            resultDiv.innerHTML = `<div class="error-message"><span>${err.message}</span></div>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Add Row';
        }
    }

    async loadDataset() {
        const container = document.getElementById('dataset-table-container');
        if (!container) return;
        this.isLoading = true;
        container.innerHTML = `<div class="loading"><div class="loading-spinner"></div><span>Loading...</span></div>`;

        try {
            const resp = await fetch(`/api/dataset?page=${this.currentPage}&pageSize=${this.pageSize}`);
            const data = await resp.json();
            if (data.error) {
                container.innerHTML = `<div class="error-message"><span>${data.message}</span></div>`;
                return;
            }
            this.datasetInfo = data;
            this.renderTable(container, data);
        } catch (err) {
            container.innerHTML = `<div class="error-message"><span>${err.message}</span></div>`;
        } finally {
            this.isLoading = false;
        }
    }

    renderTable(container, data) {
        const headers = data.columns.map(c => `<th>${c}</th>`).join('');
        const rows = data.data.map(row => {
            const cells = data.columns.map(c => `<td>${row[c] ?? ''}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        const prevDisabled = data.page <= 1 ? 'disabled' : '';
        const nextDisabled = data.page >= data.totalPages ? 'disabled' : '';

        container.innerHTML = `
            <div style="margin-bottom: 12px; color: var(--text-muted); font-size: 0.875rem;">
                ${data.total} rows - Page ${data.page} of ${data.totalPages}
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead><tr>${headers}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="pagination" style="margin-top: 16px;">
                <button class="pagination-btn" id="ds-prev" ${prevDisabled}>Prev</button>
                <span class="pagination-info">Page ${data.page} / ${data.totalPages}</span>
                <button class="pagination-btn" id="ds-next" ${nextDisabled}>Next</button>
            </div>
        `;

        document.getElementById('ds-prev')?.addEventListener('click', () => {
            if (this.currentPage > 1) { this.currentPage--; this.loadDataset(); }
        });
        document.getElementById('ds-next')?.addEventListener('click', () => {
            if (this.currentPage < data.totalPages) { this.currentPage++; this.loadDataset(); }
        });
    }

    setupEventListeners(panel) {
        panel.addEventListener('panel:activate', () => {
            if (!this.datasetInfo && !this.isLoading) this.loadDataset();
        });
        panel.addEventListener('panel:deactivate', () => {});
    }
}

document.addEventListener('DOMContentLoaded', () => { new DatasetPanel().init(); });
if (typeof window !== 'undefined') window.DatasetPanel = DatasetPanel;
