/**
 * Main Application Controller
 */
class DashboardApp {
    constructor() {
        this.navigation = null;
        this.currentSection = this.loadSection() || 'home';
        this.previousSection = null;
        this.panels = {};
        this.isTransitioning = false;
        this.panelTitles = {
            home: 'Home',
            predict: 'Diabetes Prediction',
            onlinestore: 'Online Feature Store',
            dataset: 'Dataset Manager',
            pipelines: 'Pipelines',
            featurestore: 'Feature Store Config',
            analytics: 'Analytics & Drift Detection'
        };
    }

    init() {
        this.initTheme();
        this.initSidebar();
        this.initNavigation();
        this.initPanels();
        this.renderFooter();
        this.showPanel(this.currentSection);
        this.updatePanelTitle(this.currentSection);
    }

    saveSection(id) { try { sessionStorage.setItem('dashboard_section', id); } catch {} }
    loadSection() { try { return sessionStorage.getItem('dashboard_section'); } catch { return null; } }

    /* ---- Theme ---- */
    initTheme() {
        const saved = localStorage.getItem('dashboard_theme') || 'dark';
        this.setTheme(saved);
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-theme');
            this.setTheme(cur === 'dark' ? 'light' : 'dark');
        });
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('dashboard_theme', theme);
    }

    /* ---- Collapsible Sidebar ---- */
    initSidebar() {
        const sidebar = document.getElementById('navigation');
        const main = document.getElementById('main-content');
        const toggle = document.getElementById('sidebar-toggle');
        if (!sidebar || !toggle) return;

        const collapsed = localStorage.getItem('sidebar_collapsed') === 'true';
        if (collapsed) {
            sidebar.classList.add('collapsed');
            main.classList.add('sidebar-collapsed');
        }

        toggle.addEventListener('click', () => {
            const isCollapsed = sidebar.classList.toggle('collapsed');
            main.classList.toggle('sidebar-collapsed', isCollapsed);
            localStorage.setItem('sidebar_collapsed', isCollapsed);
        });
    }

    /* ---- Navigation ---- */
    initNavigation() {
        const navItems = NavigationComponent.getDefaultItems();
        this.navigation = new NavigationComponent({
            items: navItems,
            activeSection: this.currentSection,
            onNavigate: (id) => this.handleNavigation(id)
        });
        this.navigation.init('navigation');
    }

    initPanels() {
        ['home','predict','onlinestore','dataset','pipelines','featurestore','analytics'].forEach(id => {
            const panel = document.getElementById(`panel-${id}`);
            if (panel) this.panels[id] = panel;
        });
    }

    handleNavigation(sectionId) {
        if (this.isTransitioning) return;
        if (!this.panels[sectionId]) sectionId = 'home';
        if (sectionId === this.currentSection) return;
        this.previousSection = this.currentSection;
        this.currentSection = sectionId;
        this.saveSection(sectionId);
        this.showPanel(sectionId);
        this.updatePanelTitle(sectionId);
    }

    showPanel(sectionId) {
        this.isTransitioning = true;
        Object.entries(this.panels).forEach(([id, panel]) => {
            if (id !== sectionId) { panel.classList.add('hidden'); this.triggerLifecycle(panel, 'deactivate'); }
        });
        const active = this.panels[sectionId];
        if (active) { active.classList.remove('hidden'); this.triggerLifecycle(active, 'activate'); }
        this.isTransitioning = false;
    }

    triggerLifecycle(panel, event) {
        panel.dispatchEvent(new CustomEvent(`panel:${event}`, {
            detail: { panelId: panel.getAttribute('data-panel'), timestamp: Date.now() }
        }));
    }

    updatePanelTitle(sectionId) {
        const el = document.getElementById('panel-title');
        if (el) el.textContent = this.panelTitles[sectionId] || sectionId;
    }

    navigateTo(sectionId) {
        if (this.navigation) this.navigation.setActiveSection(sectionId);
        this.handleNavigation(sectionId);
    }

    /* ---- Footer ---- */
    renderFooter() {
        const footer = document.getElementById('page-footer');
        if (!footer) return;
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        footer.innerHTML = `
            <div class="footer-inner">
                <div class="footer-info">
                    <span class="footer-name">Luis H B Veloso</span>
                    <div class="footer-contact">
                        <a href="mailto:veloso.berti098@gmail.com">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            veloso.berti098@gmail.com
                        </a>
                        <span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            11 98342-2110
                        </span>
                        <a href="https://www.linkedin.com/in/velosoberti/" target="_blank" rel="noopener">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                            LinkedIn
                        </a>
                    </div>
                </div>
                <div class="footer-date">${dateStr}</div>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dashboardApp = new DashboardApp();
    window.dashboardApp.init();
});

if (typeof window !== 'undefined') window.DashboardApp = DashboardApp;
