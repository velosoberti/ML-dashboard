/**
 * Navigation Component
 * Handles sidebar navigation rendering and section switching
 */
class NavigationComponent {
    constructor(config) {
        this.items = config.items || [];
        this.activeSection = config.activeSection || 'home';
        this.onNavigate = config.onNavigate || (() => {});
        this.container = null;
    }

    /**
     * Default navigation items for the ML Dashboard
     */
    static getDefaultItems() {
        return [
            { id: 'home', label: 'Home', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
            { id: 'predict', label: 'Predict', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' },
            { id: 'onlinestore', label: 'Online Store', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
            { id: 'dataset', label: 'Dataset', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
            { id: 'pipelines', label: 'Pipelines', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
            { id: 'featurestore', label: 'Feature Store', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>' },
            { id: 'analytics', label: 'Analytics', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' }
        ];
    }

    /**
     * Initialize the navigation component
     * @param {string} containerId - ID of the container element
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Navigation container #${containerId} not found`);
            return;
        }
        this.render();
    }

    /**
     * Render the navigation items
     */
    render() {
        const navList = this.container.querySelector('#nav-list') || this.container;
        navList.innerHTML = '';

        this.items.forEach(item => {
            const navItem = this.createNavItem(item);
            navList.appendChild(navItem);
        });
    }

    /**
     * Create a navigation item element
     * @param {Object} item - Navigation item configuration
     * @returns {HTMLElement} - The navigation item element
     */
    createNavItem(item) {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.setAttribute('data-section', item.id);
        li.setAttribute('data-tooltip', item.label);

        const link = document.createElement('a');
        link.className = `nav-link${item.id === this.activeSection ? ' active' : ''}`;
        link.href = '#';
        link.setAttribute('data-section', item.id);

        const icon = document.createElement('span');
        icon.className = 'nav-icon';
        icon.innerHTML = item.icon;

        const label = document.createElement('span');
        label.className = 'nav-label';
        label.textContent = item.label;

        link.appendChild(icon);
        link.appendChild(label);
        li.appendChild(link);

        // Add click event handler
        link.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleNavClick(item.id);
        });

        return li;
    }

    /**
     * Handle navigation click events
     * @param {string} sectionId - The section ID that was clicked
     */
    handleNavClick(sectionId) {
        if (sectionId === this.activeSection) {
            return; // Already on this section
        }

        this.setActiveSection(sectionId);
        this.onNavigate(sectionId);
    }

    /**
     * Set the active section and update styling
     * @param {string} sectionId - The section ID to activate
     */
    setActiveSection(sectionId) {
        this.activeSection = sectionId;
        this.updateActiveState();
    }

    /**
     * Update the active state styling for navigation items
     */
    updateActiveState() {
        if (!this.container) return;

        const links = this.container.querySelectorAll('.nav-link');
        links.forEach(link => {
            const linkSection = link.getAttribute('data-section');
            if (linkSection === this.activeSection) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    /**
     * Get the current active section
     * @returns {string} - The active section ID
     */
    getActiveSection() {
        return this.activeSection;
    }

    /**
     * Get all navigation items
     * @returns {Array} - Array of navigation items
     */
    getItems() {
        return this.items;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.NavigationComponent = NavigationComponent;
}
