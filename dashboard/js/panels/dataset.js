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
                <form id="add-row-form" class="prediction-form">
                    <div class="form-grid">
                        ${this.columns.map(col => `
                            <div class="form-group">
                                <label for="add-${col}">${col}</label>
                                <input type="number" id="add-${col}" name="${col}" class="input"
                                    step="${col === 'BMI' || col === 'DiabetesPedigreeFunction' ? '0.01' : '1'}"
                                    placeholder="${col}" required />
                            </div>
                        `).join('')}
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
        const data = {};
        this.columns.forEach(col => { data[col] = parseFloat(new FormData(form).get(col)); });

        const btn = document.getElementById('add-row-btn');
        const resultDiv = document.getElementById('add-row-result');
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
                resultDiv.innerHTML = `<div class="error-message"><span>${result.message}</span></div>`;
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
