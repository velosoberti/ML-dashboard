/**
 * DataTable Component
 * A reusable table component with pagination and filtering
 */
class DataTable {
    constructor(config = {}) {
        this.columns = config.columns || [];
        this.data = config.data || [];
        this.pageSize = config.pageSize || 100;
        this.currentPage = config.currentPage || 1;
        this.totalRows = config.totalRows || 0;
        this.onPageChange = config.onPageChange || (() => {});
        this.onFilter = config.onFilter || null;
        this.filteredData = [...this.data];
        this.filterValue = '';
        this.container = null;
    }

    /**
     * Calculate total pages
     * @returns {number} - Total number of pages
     */
    get totalPages() {
        return Math.ceil(this.totalRows / this.pageSize);
    }

    /**
     * Update table data
     * @param {Object} config - New configuration
     */
    updateData(config) {
        if (config.columns !== undefined) this.columns = config.columns;
        if (config.data !== undefined) {
            this.data = config.data;
            this.applyFilter();
        }
        if (config.pageSize !== undefined) this.pageSize = config.pageSize;
        if (config.currentPage !== undefined) this.currentPage = config.currentPage;
        if (config.totalRows !== undefined) this.totalRows = config.totalRows;
        
        if (this.container) {
            this.render(this.container);
        }
    }

    /**
     * Apply filter to data
     */
    applyFilter() {
        if (!this.filterValue) {
            this.filteredData = [...this.data];
            return;
        }

        const searchTerm = this.filterValue.toLowerCase();
        this.filteredData = this.data.filter(row => {
            return this.columns.some(col => {
                const value = row[col.key];
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(searchTerm);
            });
        });
    }

    /**
     * Handle filter input change
     * @param {string} value - Filter value
     */
    handleFilter(value) {
        this.filterValue = value;
        this.applyFilter();
        
        if (this.onFilter) {
            this.onFilter(value);
        }
        
        if (this.container) {
            this.renderTable();
            this.renderStats();
        }
    }

    /**
     * Handle page change
     * @param {number} page - New page number
     */
    handlePageChange(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.onPageChange(page);
    }

    /**
     * Render the complete DataTable
     * @param {HTMLElement} container - Container element
     * @returns {HTMLElement} - The container element
     */
    render(container) {
        this.container = container;
        container.innerHTML = '';
        container.className = 'data-table-wrapper';

        // Filter/search input
        const filterSection = this.renderFilterSection();
        container.appendChild(filterSection);

        // Stats section
        const statsSection = document.createElement('div');
        statsSection.className = 'table-stats';
        statsSection.id = 'table-stats';
        container.appendChild(statsSection);
        this.renderStats();

        // Table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';
        tableContainer.id = 'table-container';
        container.appendChild(tableContainer);
        this.renderTable();

        // Pagination
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-wrapper';
        paginationContainer.id = 'pagination-container';
        container.appendChild(paginationContainer);
        this.renderPagination();

        return container;
    }

    /**
     * Render the filter section
     * @returns {HTMLElement} - Filter section element
     */
    renderFilterSection() {
        const section = document.createElement('div');
        section.className = 'filter-section';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input search-input';
        input.placeholder = 'Search in table...';
        input.value = this.filterValue;
        input.addEventListener('input', (e) => this.handleFilter(e.target.value));

        const label = document.createElement('label');
        label.className = 'filter-label';
        label.textContent = '';
        label.appendChild(input);

        section.appendChild(label);
        return section;
    }

    /**
     * Render table statistics
     */
    renderStats() {
        const statsContainer = this.container?.querySelector('#table-stats');
        if (!statsContainer) return;

        const displayedRows = this.filterValue ? this.filteredData.length : this.data.length;
        const startRow = (this.currentPage - 1) * this.pageSize + 1;
        const endRow = Math.min(this.currentPage * this.pageSize, this.totalRows);

        statsContainer.innerHTML = `
            <span class="stats-info">
                Showing ${startRow}-${endRow} of ${this.totalRows} rows
                ${this.filterValue ? `(${displayedRows} matching filter)` : ''}
                • ${this.columns.length} columns
            </span>
        `;
    }

    /**
     * Render the table
     */
    renderTable() {
        const tableContainer = this.container?.querySelector('#table-container');
        if (!tableContainer) return;

        const displayData = this.filterValue ? this.filteredData : this.data;

        if (displayData.length === 0) {
            tableContainer.innerHTML = `
                <div class="empty-state">
                    <p>${this.filterValue ? 'No matching rows found' : 'No data available'}</p>
                </div>
            `;
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        this.columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label || col.key;
            th.setAttribute('data-key', col.key);
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        displayData.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-row-index', index);
            
            this.columns.forEach(col => {
                const td = document.createElement('td');
                const value = row[col.key];
                td.textContent = this.formatValue(value, col.type);
                td.setAttribute('data-key', col.key);
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    /**
     * Format a cell value based on type
     * @param {*} value - Cell value
     * @param {string} type - Column type
     * @returns {string} - Formatted value
     */
    formatValue(value, type) {
        if (value === null || value === undefined) return '-';
        
        switch (type) {
            case 'number':
                return typeof value === 'number' ? value.toLocaleString() : value;
            case 'date':
                return new Date(value).toLocaleDateString();
            default:
                return String(value);
        }
    }

    /**
     * Render pagination controls
     */
    renderPagination() {
        const paginationContainer = this.container?.querySelector('#pagination-container');
        if (!paginationContainer) return;

        const pagination = document.createElement('div');
        pagination.className = 'pagination';

        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '← Prev';
        prevBtn.disabled = this.currentPage <= 1;
        prevBtn.addEventListener('click', () => this.handlePageChange(this.currentPage - 1));
        pagination.appendChild(prevBtn);

        // Page numbers
        const pageNumbers = this.getPageNumbers();
        pageNumbers.forEach(pageNum => {
            if (pageNum === '...') {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pagination.appendChild(ellipsis);
            } else {
                const pageBtn = document.createElement('button');
                pageBtn.className = `pagination-btn${pageNum === this.currentPage ? ' active' : ''}`;
                pageBtn.textContent = pageNum;
                pageBtn.addEventListener('click', () => this.handlePageChange(pageNum));
                pagination.appendChild(pageBtn);
            }
        });

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = 'Next →';
        nextBtn.disabled = this.currentPage >= this.totalPages;
        nextBtn.addEventListener('click', () => this.handlePageChange(this.currentPage + 1));
        pagination.appendChild(nextBtn);

        // Page info
        const pageInfo = document.createElement('span');
        pageInfo.className = 'pagination-info';
        pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        pagination.appendChild(pageInfo);

        paginationContainer.innerHTML = '';
        paginationContainer.appendChild(pagination);
    }

    /**
     * Get page numbers to display
     * @returns {Array} - Array of page numbers and ellipsis
     */
    getPageNumbers() {
        const pages = [];
        const total = this.totalPages;
        const current = this.currentPage;
        const delta = 2;

        if (total <= 7) {
            for (let i = 1; i <= total; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);

            if (current > delta + 2) {
                pages.push('...');
            }

            const start = Math.max(2, current - delta);
            const end = Math.min(total - 1, current + delta);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (current < total - delta - 1) {
                pages.push('...');
            }

            pages.push(total);
        }

        return pages;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.DataTable = DataTable;
}
