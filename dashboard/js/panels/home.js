/**
 * Home Panel — project overview and quick links
 */
class HomePanel {
    constructor() {
        this.panelId = 'home';
        this.container = null;
    }

    init() {
        const panel = document.getElementById(`panel-${this.panelId}`);
        if (!panel) return;
        this.container = panel.querySelector('.panel-content');
        if (!this.container) return;
        this.render();
        this.setupEventListeners(panel);
    }

    svg(name) {
        const icons = {
            home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            predict: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
            bolt: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
            file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
            code: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
            db: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
            flask: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v7l5 8H4l5-8V3z"/><line x1="8" y1="3" x2="16" y2="3"/></svg>',
            layers: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
            arrow: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
            external: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
        };
        return icons[name] || '';
    }

    render() {
        this.container.innerHTML = '';
        this.container.classList.add('home-layout');

        const welcome = document.createElement('div');
        welcome.className = 'card welcome-section';
        welcome.innerHTML = `
            <div class="card-body">
                <h3 class="welcome-title">Diabetes Prediction ML Platform</h3>
                <p class="welcome-text">
                    End-to-end MLOps platform for diabetes risk prediction. Test the model interactively,
                    browse the online feature store, manage training data, and trigger pipelines.
                </p>
            </div>
        `;
        this.container.appendChild(welcome);

        const grid = document.createElement('div');
        grid.className = 'grid-auto';

        const features = [
            { icon: 'predict', title: 'Predict', desc: 'Run diabetes predictions using the trained model. Enter patient features and get real-time results with probability scores.', nav: 'predict' },
            { icon: 'bolt', title: 'Online Store', desc: 'Browse the Feast online store. View materialized features available for low-latency inference.', nav: 'onlinestore' },
            { icon: 'file', title: 'Dataset Manager', desc: 'View the raw diabetes CSV dataset and add new patient records for the processing pipeline.', nav: 'dataset' },
            { icon: 'code', title: 'Pipelines', desc: 'Trigger Airflow DAGs (data processing, materialization) and ZenML pipelines (training, prediction).', nav: 'pipelines' },
            { icon: 'db', title: 'Feature Store', desc: 'View Feast configuration, entity definitions, and feature view schemas used by the ML pipeline.', nav: 'featurestore' },
            { icon: 'flask', title: 'MLflow', desc: 'Experiment tracking and model registry. View training runs, compare metrics, and manage model versions.', url: 'http://localhost:5000' },
        ];

        features.forEach(f => {
            const card = document.createElement('div');
            card.className = 'card service-card';
            card.innerHTML = `
                <div class="card-header">
                    <h3 class="card-title"><span class="service-icon">${this.svg(f.icon)}</span> ${f.title}</h3>
                    <span class="external-link-icon">${f.url ? this.svg('external') : this.svg('arrow')}</span>
                </div>
                <div class="card-body">
                    <p class="service-description">${f.desc}</p>
                </div>
            `;
            card.addEventListener('click', () => {
                if (f.url) window.open(f.url, '_blank');
                else if (f.nav && window.dashboardApp) window.dashboardApp.navigateTo(f.nav);
            });
            grid.appendChild(card);
        });

        this.container.appendChild(grid);

        const info = document.createElement('div');
        info.className = 'card';
        info.innerHTML = `
            <div class="card-header"><h3 class="card-title"><span class="service-icon">${this.svg('layers')}</span> Architecture</h3></div>
            <div class="card-body">
                <div class="info-grid">
                    <div class="info-item"><span class="info-label">Models</span><span class="info-value">Decision Tree, KNN</span></div>
                    <div class="info-item"><span class="info-label">Feature Store</span><span class="info-value">Feast (SQLite)</span></div>
                    <div class="info-item"><span class="info-label">Experiment Tracking</span><span class="info-value">MLflow</span></div>
                    <div class="info-item"><span class="info-label">Data Pipelines</span><span class="info-value">Airflow (Docker)</span></div>
                    <div class="info-item"><span class="info-label">ML Orchestration</span><span class="info-value">ZenML</span></div>
                    <div class="info-item"><span class="info-label">Prediction API</span><span class="info-value">Flask :8000</span></div>
                </div>
            </div>
        `;
        this.container.appendChild(info);
    }

    setupEventListeners(panel) {
        panel.addEventListener('panel:activate', () => {});
        panel.addEventListener('panel:deactivate', () => {});
    }
}

document.addEventListener('DOMContentLoaded', () => { new HomePanel().init(); });
if (typeof window !== 'undefined') window.HomePanel = HomePanel;
