/**
 * ServiceCard Component
 * Reusable card component for displaying service information with external links
 */
class ServiceCard {
    /**
     * Create a ServiceCard instance
     * @param {Object} config - Service card configuration
     * @param {string} config.title - Service title (e.g., "Flask API")
     * @param {string} config.description - Brief description of the service
     * @param {string} config.url - External service URL
     * @param {number} [config.port] - Service port number
     * @param {string[]} [config.endpoints] - List of available endpoints
     * @param {string} [config.icon] - Icon emoji or character
     */
    constructor(config) {
        this.title = config.title || 'Service';
        this.description = config.description || '';
        this.url = config.url || '#';
        this.port = config.port || null;
        this.endpoints = config.endpoints || [];
        this.icon = config.icon || '';
    }

    /**
     * Render the service card as an HTML element
     * @returns {HTMLElement} - The rendered card element
     */
    render() {
        const card = document.createElement('div');
        card.className = 'card service-card';
        card.setAttribute('data-service-url', this.url);

        // Card header with title and external link icon
        const header = document.createElement('div');
        header.className = 'card-header';

        const title = document.createElement('h3');
        title.className = 'card-title';
        title.innerHTML = `<span class="service-icon">${this.icon}</span> ${this.title}`;

        const externalIcon = document.createElement('span');
        externalIcon.className = 'external-link-icon';
        externalIcon.textContent = '↗';
        externalIcon.setAttribute('aria-label', 'Opens in new tab');

        header.appendChild(title);
        header.appendChild(externalIcon);

        // Card body with description and URL
        const body = document.createElement('div');
        body.className = 'card-body';

        const description = document.createElement('p');
        description.className = 'service-description';
        description.textContent = this.description;
        body.appendChild(description);

        // Service URL link
        const urlLink = document.createElement('a');
        urlLink.className = 'service-url';
        urlLink.href = this.url;
        urlLink.target = '_blank';
        urlLink.rel = 'noopener noreferrer';
        urlLink.textContent = this.url;
        body.appendChild(urlLink);

        // Endpoints list (if provided)
        if (this.endpoints.length > 0) {
            const endpointsSection = this.renderEndpoints();
            body.appendChild(endpointsSection);
        }

        card.appendChild(header);
        card.appendChild(body);

        // Make the entire card clickable to open the service URL
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on the URL link itself
            if (e.target.tagName !== 'A') {
                window.open(this.url, '_blank', 'noopener,noreferrer');
            }
        });

        return card;
    }

    /**
     * Render the endpoints list
     * @returns {HTMLElement} - The endpoints section element
     */
    renderEndpoints() {
        const section = document.createElement('div');
        section.className = 'service-endpoints mt-md';

        const label = document.createElement('p');
        label.className = 'endpoints-label text-muted';
        label.textContent = 'Available Endpoints:';
        section.appendChild(label);

        const list = document.createElement('ul');
        list.className = 'endpoints-list';

        this.endpoints.forEach(endpoint => {
            const item = document.createElement('li');
            item.className = 'endpoint-item';
            item.innerHTML = `<code>${endpoint}</code>`;
            list.appendChild(item);
        });

        section.appendChild(list);
        return section;
    }

    /**
     * Get the service URL
     * @returns {string} - The service URL
     */
    getUrl() {
        return this.url;
    }

    /**
     * Get the service title
     * @returns {string} - The service title
     */
    getTitle() {
        return this.title;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ServiceCard = ServiceCard;
}
