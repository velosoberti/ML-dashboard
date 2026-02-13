/**
 * Analytics Panel — Rich dataset statistics & drift detection
 * Pure HTML/CSS/JS charts: histograms, boxplots, time series, stat cards
 */
class AnalyticsPanel {
    constructor() {
        this.panelId = 'analytics';
        this.container = null;
        this.statsData = null;
        this.isLoading = false;
        this.selectedFeature = null;
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

        // Controls card
        const ctrl = document.createElement('div');
        ctrl.className = 'card';
        ctrl.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    Data Drift Analysis
                </h3>
            </div>
            <div class="card-body">
                <p class="text-muted" style="margin-bottom:14px;">
                    Split the dataset at a date cutoff and compare distributions before vs after.
                    Rows without <code>created_at</code> (original 768) are always in the "before" group.
                    Drift is detected via KS-test (p&lt;0.05) and PSI.
                </p>
                <div class="an-controls">
                    <div class="config-field">
                        <label>Date Cutoff</label>
                        <input type="date" class="input" id="an-cutoff" value="" />
                    </div>
                    <div class="config-field">
                        <label>Category (Outcome)</label>
                        <select class="input" id="an-category">
                            <option value="all">All</option>
                            <option value="0">Healthy (0)</option>
                            <option value="1">Diabetes (1)</option>
                        </select>
                    </div>
                    <button class="btn btn-primary" id="an-run" style="align-self:flex-end;">Analyze</button>
                </div>
                <div id="an-status" style="margin-top:10px;"></div>
            </div>
        `;
        this.container.appendChild(ctrl);

        // Results container
        const res = document.createElement('div');
        res.id = 'an-results';
        this.container.appendChild(res);
    }

    async loadStats() {
        const status = document.getElementById('an-status');
        const results = document.getElementById('an-results');
        const btn = document.getElementById('an-run');

        const cutoff = document.getElementById('an-cutoff')?.value || '';
        const category = document.getElementById('an-category')?.value || 'all';

        if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
        status.innerHTML = '';
        results.innerHTML = '<div class="loading"><div class="loading-spinner"></div><span>Computing statistics...</span></div>';
        this.isLoading = true;

        try {
            const params = new URLSearchParams();
            if (cutoff) params.set('cutoff', cutoff);
            if (category !== 'all') params.set('category', category);
            const resp = await fetch(`/api/analytics/stats?${params}`);
            const data = await resp.json();

            if (data.error) {
                status.innerHTML = `<div class="error-message"><span>${data.message}</span></div>`;
                results.innerHTML = '';
                return;
            }
            this.statsData = data;
            this.renderResults(results, data);
        } catch (err) {
            status.innerHTML = `<div class="error-message"><span>${err.message}</span></div>`;
            results.innerHTML = '';
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Analyze'; }
            this.isLoading = false;
        }
    }

    renderResults(container, data) {
        const features = data.features || {};
        const names = Object.keys(features);
        const driftCount = names.filter(f => features[f].drift?.drifted).length;

        let html = '';

        // ── Summary cards ──
        html += `<div class="card" style="margin-top:16px;">
            <div class="card-body">
                <div class="an-summary-grid">
                    ${this._summaryCard('Total Rows', data.total_rows)}
                    ${this._summaryCard('Before', data.before_count, 'var(--accent)')}
                    ${this._summaryCard('After', data.after_count, 'var(--info)')}
                    ${this._summaryCard('Drifted', `${driftCount}/${names.length}`,
                        driftCount === 0 ? 'var(--success)' : driftCount <= 2 ? 'var(--warning)' : 'var(--danger)')}
                </div>
                <div style="margin-top:10px;color:var(--text-muted);font-size:0.8rem;">
                    Split: ${data.split_label}
                    ${data.date_range ? ` · Data from ${data.date_range.min?.substring(0,10) || '?'} to ${data.date_range.max?.substring(0,10) || '?'} (${data.date_range.unique_dates?.length || 0} unique dates)` : ''}
                    ${data.after_count === 0 ? ' — <span style="color:var(--warning);">No data after split. Add rows and re-run the pipeline.</span>' : ''}
                </div>
            </div>
        </div>`;

        // ── Drift overview table ──
        html += `<div class="card" style="margin-top:16px;">
            <div class="card-header"><h3 class="card-title">Drift Overview</h3></div>
            <div class="card-body">
                <div class="table-container">
                    <table class="data-table">
                        <thead><tr>
                            <th>Feature</th>
                            <th>Before μ</th><th>After μ</th>
                            <th>Before σ</th><th>After σ</th>
                            <th>Z-score</th>
                            <th>KS Stat</th><th>KS p</th><th>PSI</th>
                            <th>Status</th>
                        </tr></thead>
                        <tbody>${names.map(f => this._driftRow(f, features[f])).join('')}</tbody>
                    </table>
                </div>
            </div>
        </div>`;

        // ── Feature tabs ──
        if (!this.selectedFeature || !features[this.selectedFeature]) {
            this.selectedFeature = names[0];
        }

        html += `<div class="card" style="margin-top:16px;">
            <div class="card-header"><h3 class="card-title">Feature Detail</h3></div>
            <div class="card-body">
                <div class="an-feature-tabs" id="an-feature-tabs">
                    ${names.map(f => `<button class="an-tab ${f === this.selectedFeature ? 'active' : ''}" data-feature="${f}">${f}${features[f].drift?.drifted ? ' ⚠' : ''}</button>`).join('')}
                </div>
                <div id="an-feature-detail"></div>
            </div>
        </div>`;

        container.innerHTML = html;

        // Wire tab clicks
        container.querySelectorAll('.an-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.selectedFeature = tab.dataset.feature;
                container.querySelectorAll('.an-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._renderFeatureDetail(features[this.selectedFeature], this.selectedFeature);
            });
        });

        // Render initial feature detail
        this._renderFeatureDetail(features[this.selectedFeature], this.selectedFeature);
    }

    // ── Helpers ──

    _summaryCard(label, value, color) {
        return `<div class="an-summary-item">
            <div class="an-summary-label">${label}</div>
            <div class="an-summary-value" ${color ? `style="color:${color}"` : ''}>${value}</div>
        </div>`;
    }

    _fmt(v, d = 2) { return v != null ? Number(v).toFixed(d) : '—'; }

    _driftRow(name, f) {
        const d = f.drift || {};
        const b = f.before || {};
        const a = f.after || {};
        const zVal = a?.z_mean;
        const zColor = zVal != null ? (Math.abs(zVal) > 2 ? 'var(--danger)' : Math.abs(zVal) > 1 ? 'var(--warning)' : 'var(--success)') : '';
        const pColor = d.ks_pvalue != null ? (d.ks_pvalue < 0.05 ? 'var(--danger)' : 'var(--success)') : '';
        const psiColor = d.psi != null ? (d.psi > 0.2 ? 'var(--danger)' : d.psi > 0.1 ? 'var(--warning)' : 'var(--success)') : '';
        const bg = d.drifted ? 'background:rgba(239,68,68,0.05);' : '';
        return `<tr style="${bg}">
            <td style="font-weight:600;">${name}</td>
            <td>${this._fmt(b?.mean)}</td><td>${this._fmt(a?.mean)}</td>
            <td>${this._fmt(b?.std)}</td><td>${this._fmt(a?.std)}</td>
            <td style="color:${zColor};font-weight:600;">${this._fmt(zVal, 3)}</td>
            <td>${this._fmt(d.ks_statistic, 4)}</td>
            <td style="color:${pColor};">${this._fmt(d.ks_pvalue, 4)}</td>
            <td style="color:${psiColor};">${this._fmt(d.psi, 4)}</td>
            <td>${d.drifted ? '<span class="badge badge-warning">DRIFT</span>' : '<span class="badge badge-success">OK</span>'}</td>
        </tr>`;
    }

    _renderFeatureDetail(f, name) {
        const el = document.getElementById('an-feature-detail');
        if (!el || !f) return;

        const b = f.before || {};
        const a = f.after || {};
        const d = f.drift || {};

        let html = '';

        // ── Stat cards row — Before vs After comparison ──
        html += `<div class="an-stat-cards">`;
        const statPairs = [
            ['Count', b?.count, a?.count],
            ['Mean', b?.mean, a?.mean],
            ['Std Dev', b?.std, a?.std],
            ['Min', b?.min, a?.min],
            ['Max', b?.max, a?.max],
            ['Sum', b?.sum, a?.sum],
            ['Median', b?.median, a?.median],
            ['Q1', b?.q1, a?.q1],
            ['Q3', b?.q3, a?.q3],
            ['IQR', b?.iqr, a?.iqr],
            ['Skew', b?.skew, a?.skew],
            ['Kurtosis', b?.kurtosis, a?.kurtosis],
        ];
        for (const [label, bv, av] of statPairs) {
            const dec = label === 'Count' ? 0 : 2;
            const diff = (bv != null && av != null) ? av - bv : null;
            const pctChange = (bv != null && av != null && bv !== 0) ? ((av - bv) / Math.abs(bv)) * 100 : null;
            const diffColor = diff != null ? (Math.abs(diff) < 0.001 ? 'var(--text-muted)' : diff > 0 ? 'var(--info)' : 'var(--warning)') : 'var(--text-muted)';
            const diffSign = diff != null && diff > 0 ? '+' : '';
            html += `<div class="an-stat-card">
                <div class="an-stat-label">${label}</div>
                <div class="an-stat-split" style="display:flex;justify-content:space-between;margin-top:4px;">
                    <div style="text-align:center;flex:1;">
                        <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px;"><span class="an-before-dot"></span> Before</div>
                        <div style="font-size:1.1rem;font-weight:700;color:var(--accent);">${this._fmt(bv, dec)}</div>
                    </div>
                    <div style="text-align:center;flex:1;">
                        <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px;"><span class="an-after-dot"></span> After</div>
                        <div style="font-size:1.1rem;font-weight:700;color:var(--info);">${this._fmt(av, dec)}</div>
                    </div>
                </div>
                <div style="text-align:center;margin-top:4px;font-size:0.7rem;color:${diffColor};">
                    ${diff != null ? `${diffSign}${this._fmt(diff, dec)}` : '—'}${pctChange != null ? ` (${diffSign}${pctChange.toFixed(1)}%)` : ''}
                </div>
            </div>`;
        }
        html += `</div>`;

        // ── Charts row: Histogram + Boxplot side by side ──
        html += `<div class="an-charts-row">`;

        // Histogram
        html += `<div class="an-chart-box">
            <div class="an-chart-title">Histogram</div>
            <div class="an-chart-legend">
                <span><span class="an-before-dot"></span> Before</span>
                <span><span class="an-after-dot"></span> After</span>
            </div>
            ${this._buildHistogram(f.histogram)}
        </div>`;

        // Boxplot
        html += `<div class="an-chart-box">
            <div class="an-chart-title">Box Plot</div>
            <div class="an-chart-legend">
                <span><span class="an-before-dot"></span> Before</span>
                <span><span class="an-after-dot"></span> After</span>
            </div>
            ${this._buildBoxplot(b, a)}
        </div>`;

        html += `</div>`;

        // ── Drift detail ──
        html += `<div class="an-drift-detail">
            <div class="an-drift-item">
                <span class="an-drift-label">KS Statistic</span>
                <span class="an-drift-value">${this._fmt(d.ks_statistic, 4)}</span>
            </div>
            <div class="an-drift-item">
                <span class="an-drift-label">KS p-value</span>
                <span class="an-drift-value" style="color:${d.ks_pvalue != null && d.ks_pvalue < 0.05 ? 'var(--danger)' : 'var(--success)'};">${this._fmt(d.ks_pvalue, 6)}</span>
            </div>
            <div class="an-drift-item">
                <span class="an-drift-label">PSI</span>
                <span class="an-drift-value" style="color:${d.psi != null ? (d.psi > 0.2 ? 'var(--danger)' : d.psi > 0.1 ? 'var(--warning)' : 'var(--success)') : ''};">${this._fmt(d.psi, 4)}</span>
            </div>
            <div class="an-drift-item">
                <span class="an-drift-label">Z-score (Δμ)</span>
                <span class="an-drift-value" style="color:${a?.z_mean != null ? (Math.abs(a.z_mean) > 2 ? 'var(--danger)' : Math.abs(a.z_mean) > 1 ? 'var(--warning)' : 'var(--success)') : ''};">${this._fmt(a?.z_mean, 3)}</span>
            </div>
            <div class="an-drift-item">
                <span class="an-drift-label">Status</span>
                <span>${d.drifted ? '<span class="badge badge-warning">DRIFT DETECTED</span>' : '<span class="badge badge-success">NO DRIFT</span>'}</span>
            </div>
        </div>`;

        el.innerHTML = html;
    }

    // ── Pure HTML/CSS Histogram ──
    _buildHistogram(hist) {
        if (!hist || !hist.labels) return '<div class="text-muted" style="padding:20px;">No histogram data</div>';

        const { labels, before, after } = hist;
        const maxVal = Math.max(...before, ...after, 1);
        const barMaxPx = 160; // max bar height in pixels

        let bars = '';
        for (let i = 0; i < labels.length; i++) {
            const bH = Math.max(1, Math.round((before[i] / maxVal) * barMaxPx));
            const aH = Math.max(1, Math.round((after[i] / maxVal) * barMaxPx));
            const showLabel = i % 4 === 0 || i === labels.length - 1;
            bars += `<div class="an-hist-col">
                <div class="an-hist-bar an-bar-before" style="height:${before[i] > 0 ? bH : 0}px;" title="Before: ${before[i]}"></div>
                <div class="an-hist-bar an-bar-after" style="height:${after[i] > 0 ? aH : 0}px;" title="After: ${after[i]}"></div>
                ${showLabel ? `<div class="an-hist-label">${labels[i]}</div>` : ''}
            </div>`;
        }

        // Y-axis labels
        const ySteps = [0, Math.round(maxVal / 4), Math.round(maxVal / 2), Math.round(3 * maxVal / 4), maxVal];

        return `<div class="an-histogram">
            <div class="an-hist-y-axis">
                ${ySteps.reverse().map(v => `<span>${v}</span>`).join('')}
            </div>
            <div class="an-hist-area">${bars}</div>
        </div>`;
    }

    // ── Pure HTML/CSS Boxplot ──
    _buildBoxplot(b, a) {
        if (!b || !a) return '<div class="text-muted" style="padding:20px;">No data</div>';

        const globalMin = Math.min(b.min ?? Infinity, a.min ?? Infinity);
        const globalMax = Math.max(b.max ?? -Infinity, a.max ?? -Infinity);
        const range = globalMax - globalMin || 1;

        const pct = (v) => ((v - globalMin) / range * 100).toFixed(1);

        const buildBox = (s, label, cls) => {
            if (!s || s.count == null || s.count === 0) return `<div class="an-box-row"><span class="an-box-label">${label}</span><span class="text-muted">No data</span></div>`;
            const wLo = pct(s.whisker_lo);
            const q1 = pct(s.q1);
            const med = pct(s.median);
            const q3 = pct(s.q3);
            const wHi = pct(s.whisker_hi);
            return `<div class="an-box-row">
                <span class="an-box-label">${label}</span>
                <div class="an-box-track">
                    <div class="an-box-whisker" style="left:${wLo}%;width:${q1 - wLo}%;"></div>
                    <div class="an-box-rect ${cls}" style="left:${q1}%;width:${q3 - q1}%;">
                        <div class="an-box-median" style="left:${((med - q1) / (q3 - q1 || 1)) * 100}%;"></div>
                    </div>
                    <div class="an-box-whisker" style="left:${q3}%;width:${wHi - q3}%;"></div>
                    <div class="an-box-cap" style="left:${wLo}%;"></div>
                    <div class="an-box-cap" style="left:${wHi}%;"></div>
                </div>
            </div>`;
        };

        // Scale labels
        const ticks = 5;
        let scaleHtml = '<div class="an-box-scale">';
        for (let i = 0; i <= ticks; i++) {
            const v = globalMin + (range * i / ticks);
            scaleHtml += `<span>${v.toFixed(1)}</span>`;
        }
        scaleHtml += '</div>';

        return `<div class="an-boxplot">
            ${buildBox(b, 'Before', 'an-box-before')}
            ${buildBox(a, 'After', 'an-box-after')}
            ${scaleHtml}
        </div>`;
    }

    setupEventListeners(panel) {
        // Bind the analyze button once during init
        setTimeout(() => {
            document.getElementById('an-run')?.addEventListener('click', () => this.loadStats());
        }, 0);

        panel.addEventListener('panel:activate', () => {
            if (!this.statsData && !this.isLoading) this.loadStats();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => { new AnalyticsPanel().init(); });
if (typeof window !== 'undefined') window.AnalyticsPanel = AnalyticsPanel;
