/**
 * Online Store Panel — feature store data with prediction column + Model Registry selector
 * Supports column filtering and sorting
 */
class OnlineStorePanel {
    constructor() {
        this.panelId = 'onlinestore';
        this.container = null;
        this.data = null;
        this.currentPage = 1;
        this.pageSize = 50;
        this.isLoading = false;
        this.registryModels = [];
        this.sortBy = '';
        this.sortOrder = 'asc';
        this.filters = {};
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
                <div style="display:flex;gap:8px;align-items:center;">
                    <button class="btn btn-outline btn-sm" id="os-clear-filters-btn">Clear Filters</button>
                    <button class="btn btn-outline btn-sm" id="refresh-online-btn">Refresh Data</button>
                </div>
            </div>
            <div class="card-body">
                <p class="text-muted" style="margin-bottom: 12px;">
                    Patient features from the materialized feature store with real-time predictions.
                    Switch the registered model to re-score all patients.
                </p>
                <div id="os-model-selector">
                    <div class="loading"><div class="loading-spinner small"></div><span>Loading registered models...</span></div>
                </div>
            </div>
        `;
        this.container.appendChild(modelCard);

        const tableCard = document.createElement('div');
        tableCard.className = 'card';
        tableCard.innerHTML = `
            <div class="card-body" id="online-table-container">
                <div class="loading"><div class="loading-spinner"></div><span>Loading features & predictions...</span></div>
            </div>
        `;
        this.container.appendChild(tableCard);

        setTimeout(() => {
            document.getElementById('refresh-online-btn')?.addEventListener('click', () => {
                this.currentPage = 1;
                this.loadData();
            });
            document.getElementById('os-clear-filters-btn')?.addEventListener('click', () => {
                this.filters = {};
                this.sortBy = '';
                this.sortOrder = 'asc';
                this.currentPage = 1;
                this.loadData();
            });
        }, 0);
    }

    /* ---- Model Registry Selector ---- */

    async loadModels() {
        const container = document.getElementById('os-model-selector');
        if (!container) return;
        try {
            const resp = await fetch('/api/model/list');
            const data = await resp.json();
            this.registryModels = data.models || [];
            const current = data.current;

            if (this.registryModels.length === 0) {
                container.innerHTML = `<div class="warning-message"><span>${data.message || 'No registered models. Run the training pipeline first.'}</span></div>`;
                return;
            }

            const grouped = {};
            for (const m of this.registryModels) {
                if (!grouped[m.registry_name]) grouped[m.registry_name] = [];
                grouped[m.registry_name].push(m);
            }

            const options = Object.entries(grouped).map(([name, versions]) => {
                const latest = versions[0];
                const aliasStr = latest.aliases.length ? ` [${latest.aliases.join(', ')}]` : '';
                const tagAcc = latest.tags.accuracy ? ` acc:${(parseFloat(latest.tags.accuracy) * 100).toFixed(1)}%` : '';
                const tagF1 = latest.tags.f1 ? ` f1:${(parseFloat(latest.tags.f1) * 100).toFixed(1)}%` : '';
                const isCurrent = current && current.name === name;
                return `<option value="${name}" ${isCurrent ? 'selected' : ''}>${name} v${latest.version}${aliasStr}${tagAcc}${tagF1}</option>`;
            }).join('');

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
                        <span>Predictions by: <code>${current.name}</code> v${current.version || '?'}${current.alias ? ` @${current.alias}` : ''}</span>
                    </div>
                    ${(tagBadges || aliasBadges) ? `<div style="margin-top: 8px;">${aliasBadges}${tagBadges}</div>` : ''}
                `;
            } else {
                currentInfo = `<div class="warning-message" style="margin-top: 12px;"><span>No model loaded — prediction columns will be empty</span></div>`;
            }

            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div class="config-field" style="flex: 1; min-width: 220px;">
                        <label>Registered Model</label>
                        <select class="input" id="os-model-select">${options}</select>
                    </div>
                    <div class="config-field" style="min-width: 120px;">
                        <label>Alias</label>
                        <select class="input" id="os-alias-select">
                            <option value="latest">latest</option>
                            <option value="champion">champion</option>
                        </select>
                    </div>
                    <button class="btn btn-primary btn-sm" id="os-switch-model-btn" style="align-self: flex-end;">Load Model</button>
                    <span id="os-model-status" class="config-status" style="align-self: flex-end;"></span>
                </div>
                ${currentInfo}
            `;

            this._updateAliasOptions('os-model-select', 'os-alias-select', grouped);
            document.getElementById('os-model-select')?.addEventListener('change', () => {
                this._updateAliasOptions('os-model-select', 'os-alias-select', grouped);
            });
            document.getElementById('os-switch-model-btn')?.addEventListener('click', () => this.switchModel());
        } catch (err) {
            container.innerHTML = `<div class="error-message"><span>Cannot reach MLflow: ${err.message}</span></div>`;
        }
    }

    _updateAliasOptions(selectId, aliasSelectId, grouped) {
        const select = document.getElementById(selectId);
        const aliasSelect = document.getElementById(aliasSelectId);
        if (!select || !aliasSelect) return;
        const name = select.value;
        const versions = grouped[name] || [];
        const allAliases = new Set(['latest']);
        for (const v of versions) {
            for (const a of (v.aliases || [])) allAliases.add(a);
        }
        allAliases.add('champion');
        aliasSelect.innerHTML = [...allAliases].map(a => `<option value="${a}">${a}</option>`).join('');
    }

    async switchModel() {
        const select = document.getElementById('os-model-select');
        const aliasSelect = document.getElementById('os-alias-select');
        const status = document.getElementById('os-model-status');
        const btn = document.getElementById('os-switch-model-btn');
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
                this.currentPage = 1;
                this.loadData();
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

    /* ---- Data Loading ---- */

    buildQueryString() {
        const params = new URLSearchParams();
        params.set('page', this.currentPage);
        params.set('pageSize', this.pageSize);
        if (this.sortBy) {
            params.set('sort_by', this.sortBy);
            params.set('sort_order', this.sortOrder);
        }
        for (const [col, val] of Object.entries(this.filters)) {
            if (val) params.set(`filter_${col}`, val);
        }
        return params.toString();
    }

    async loadData() {
        const container = document.getElementById('online-table-container');
        if (!container) return;
        this.isLoading = true;
        container.innerHTML = `<div class="loading"><div class="loading-spinner"></div><span>Loading page ${this.currentPage}...</span></div>`;

        try {
            const resp = await fetch(`/api/online-store?${this.buildQueryString()}`);
            const data = await resp.json();

            if (data.error) {
                container.innerHTML = `<div class="warning-message"><span>${data.message}</span></div>`;
                return;
            }

            this.data = data;
            this.renderTable(container, data);
        } catch (err) {
            container.innerHTML = `<div class="error-message"><span>${err.message}</span></div>`;
        } finally {
            this.isLoading = false;
        }
    }

    _sortIcon(col) {
        if (this.sortBy !== col) return `<span class="sort-icon">⇅</span>`;
        return this.sortOrder === 'asc'
            ? `<span class="sort-icon active">↑</span>`
            : `<span class="sort-icon active">↓</span>`;
    }

    renderTable(container, data) {
        const cols = data.columns || [];
        const rows = data.data || [];

        if (rows.length === 0) {
            container.innerHTML = `<div class="info-message"><span>No data. Run the data processing pipeline first.</span></div>`;
            return;
        }

        const headers = cols.map(c => {
            let style = '';
            if (c === 'Prediction' || c === 'Probability') style = 'style="background: rgba(242,153,74,0.15);"';
            return `<th class="sortable-th" data-col="${c}" ${style}>${c} ${this._sortIcon(c)}</th>`;
        }).join('');

        const filterRow = cols.map(c =>
            `<th class="filter-th"><input type="text" class="filter-input" data-col="${c}" placeholder="Filter..." value="${this.filters[c] || ''}" /></th>`
        ).join('');

        const tbody = rows.map(row => {
            const cells = cols.map(c => {
                let val = row[c];
                if (val === null || val === undefined) return `<td class="text-muted">—</td>`;
                if (c === 'Prediction') {
                    const isDiabetes = val === 1;
                    return `<td><span class="badge ${isDiabetes ? 'badge-warning' : 'badge-success'}">${isDiabetes ? 'Diabetes' : 'Healthy'}</span></td>`;
                }
                if (c === 'Probability') {
                    const pct = (val * 100).toFixed(1);
                    const cls = val > 0.7 ? 'confidence-low' : val > 0.4 ? 'confidence-medium' : 'confidence-high';
                    return `<td><span class="${cls}">${pct}%</span></td>`;
                }
                if (typeof val === 'number' && !Number.isInteger(val)) return `<td>${val.toFixed(3)}</td>`;
                return `<td>${val}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        const prevDisabled = data.page <= 1 ? 'disabled' : '';
        const nextDisabled = data.page >= data.totalPages ? 'disabled' : '';

        container.innerHTML = `
            <div style="margin-bottom: 12px; color: var(--text-muted); font-size: 0.875rem;">
                ${data.total} patients · Page ${data.page} of ${data.totalPages}
                ${this.sortBy ? ` · Sorted by ${this.sortBy} ${this.sortOrder}` : ''}
                ${Object.keys(this.filters).length ? ' · Filtered' : ''}
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>${headers}</tr>
                        <tr class="filter-row">${filterRow}</tr>
                    </thead>
                    <tbody>${tbody}</tbody>
                </table>
            </div>
            <div class="pagination" style="margin-top: 16px;">
                <button class="pagination-btn" id="os-prev" ${prevDisabled}>Prev</button>
                <span class="pagination-info">Page ${data.page} / ${data.totalPages}</span>
                <button class="pagination-btn" id="os-next" ${nextDisabled}>Next</button>
            </div>
        `;

        // Sort click handlers
        container.querySelectorAll('.sortable-th').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (this.sortBy === col) {
                    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortBy = col;
                    this.sortOrder = 'asc';
                }
                this.currentPage = 1;
                this.loadData();
            });
        });

        // Filter input handlers (debounced)
        let filterTimeout;
        container.querySelectorAll('.filter-input').forEach(input => {
            input.addEventListener('input', () => {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(() => {
                    const col = input.dataset.col;
                    const val = input.value.trim();
                    if (val) this.filters[col] = val;
                    else delete this.filters[col];
                    this.currentPage = 1;
                    this.loadData();
                }, 500);
            });
        });

        document.getElementById('os-prev')?.addEventListener('click', () => {
            if (this.currentPage > 1) { this.currentPage--; this.loadData(); }
        });
        document.getElementById('os-next')?.addEventListener('click', () => {
            if (this.currentPage < data.totalPages) { this.currentPage++; this.loadData(); }
        });
    }

    setupEventListeners(panel) {
        panel.addEventListener('panel:activate', () => {
            this.loadModels();
            if (!this.data && !this.isLoading) this.loadData();
        });
        panel.addEventListener('panel:deactivate', () => {});
    }
}

document.addEventListener('DOMContentLoaded', () => { new OnlineStorePanel().init(); });
if (typeof window !== 'undefined') window.OnlineStorePanel = OnlineStorePanel;
