/**
 * Feature Store Panel — Feast config and feature view definitions
 */
class FeatureStorePanel {
    constructor() {
        this.panelId = 'featurestore';
        this.container = null;
        this.config = null;
        this.isLoading = false;
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

        const configCard = document.createElement('div');
        configCard.className = 'card';
        configCard.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">Feature Store Configuration</h3>
                <button class="btn btn-outline btn-sm" id="refresh-fs-btn">Refresh</button>
            </div>
            <div class="card-body" id="fs-config-content">
                <div class="loading"><div class="loading-spinner"></div><span>Loading config...</span></div>
            </div>
        `;
        this.container.appendChild(configCard);

        const viewCard = document.createElement('div');
        viewCard.className = 'card';
        viewCard.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">Feature View: patient_features</h3>
                <span class="badge badge-success">Online</span>
            </div>
            <div class="card-body">
                <div class="info-grid" style="margin-bottom: 16px;">
                    <div class="info-item">
                        <span class="info-label">Entity</span>
                        <span class="info-value">patient_id (INT64)</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">TTL</span>
                        <span class="info-value">365 days</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Source</span>
                        <span class="info-value">patient_features.parquet</span>
                    </div>
                </div>
                <h4 style="margin-bottom: 8px; font-size: 0.9rem; color: var(--text-muted);">Schema Fields</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>Feature</th><th>Type</th><th>Notes</th></tr></thead>
                        <tbody>
                            <tr><td><code>Pregnancies</code></td><td>Int64</td><td>Number of pregnancies</td></tr>
                            <tr><td><code>Glucose</code></td><td>Int64</td><td>Plasma glucose (mg/dL)</td></tr>
                            <tr><td><code>BloodPressure</code></td><td>Int64</td><td>Diastolic BP (mmHg)</td></tr>
                            <tr><td><code>SkinThickness</code></td><td>Int64</td><td>Triceps skin fold (mm)</td></tr>
                            <tr><td><code>Insulin</code></td><td>Int64</td><td>2h serum insulin</td></tr>
                            <tr><td><code>BMI</code></td><td>Float32</td><td>Body mass index</td></tr>
                            <tr><td><code>DiabetesPedigreeFunction</code></td><td>Float32</td><td>Pedigree function</td></tr>
                            <tr><td><code>Age</code></td><td>Int64</td><td>Patient age</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="info-message" style="margin-top: 12px;">
                    <span><code>Outcome</code> is the target label — intentionally NOT in the feature store. Joined from source parquet at training time.</span>
                </div>
            </div>
        `;
        this.container.appendChild(viewCard);

        setTimeout(() => {
            document.getElementById('refresh-fs-btn')?.addEventListener('click', () => this.loadConfig());
        }, 0);
    }

    async loadConfig() {
        const container = document.getElementById('fs-config-content');
        if (!container) return;
        this.isLoading = true;
        container.innerHTML = `<div class="loading"><div class="loading-spinner"></div><span>Loading...</span></div>`;

        try {
            const resp = await fetch('/api/feature-store/config');
            const data = await resp.json();

            if (data.error) {
                container.innerHTML = `<div class="error-message"><span>${data.message}</span></div>`;
                return;
            }

            this.config = data;
            const online = data.online_store || {};
            container.innerHTML = `
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Project</span>
                        <span class="info-value">${data.project || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Provider</span>
                        <span class="info-value">${data.provider || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Registry</span>
                        <span class="info-value">${data.registry || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Online Store Type</span>
                        <span class="info-value">${online.type || 'sqlite'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Online Store Path</span>
                        <span class="info-value">${online.path || 'data/online_store.db'}</span>
                    </div>
                </div>
            `;
        } catch (err) {
            container.innerHTML = `<div class="error-message"><span>${err.message}</span></div>`;
        } finally {
            this.isLoading = false;
        }
    }

    setupEventListeners(panel) {
        panel.addEventListener('panel:activate', () => {
            if (!this.config && !this.isLoading) this.loadConfig();
        });
        panel.addEventListener('panel:deactivate', () => {});
    }
}

document.addEventListener('DOMContentLoaded', () => { new FeatureStorePanel().init(); });
if (typeof window !== 'undefined') window.FeatureStorePanel = FeatureStorePanel;
