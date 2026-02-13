/**
 * Data Loader Utility
 * Provides async functions to fetch data from the backend API
 * with error handling, retry logic, and caching
 */
class DataLoader {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache expiry
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        this.pendingRequests = new Map(); // Track in-flight requests
    }

    /**
     * Generate a cache key from URL and params
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {string} - Cache key
     */
    getCacheKey(endpoint, params = {}) {
        const paramStr = Object.keys(params)
            .sort()
            .map(k => `${k}=${params[k]}`)
            .join('&');
        return `${endpoint}?${paramStr}`;
    }

    /**
     * Check if cached data is still valid
     * @param {string} key - Cache key
     * @returns {boolean} - True if cache is valid
     */
    isCacheValid(key) {
        const cached = this.cache.get(key);
        if (!cached) return false;
        return Date.now() - cached.timestamp < this.cacheExpiry;
    }

    /**
     * Get data from cache
     * @param {string} key - Cache key
     * @returns {*} - Cached data or null
     */
    getFromCache(key) {
        if (this.isCacheValid(key)) {
            return this.cache.get(key).data;
        }
        return null;
    }

    /**
     * Store data in cache
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     */
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear all cached data
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Clear cache for a specific endpoint
     * @param {string} endpoint - API endpoint
     */
    clearCacheFor(endpoint) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(endpoint)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Sleep for a specified duration
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fetch data from API with retry logic
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @param {number} retryCount - Current retry count
     * @returns {Promise<Object>} - Response data
     */
    async fetchWithRetry(endpoint, options = {}, retryCount = 0) {
        const url = `${this.baseUrl}${endpoint}`;
        
        // Check for pending request to avoid duplicate calls
        const requestKey = `${options.method || 'GET'}:${url}`;
        if (this.pendingRequests.has(requestKey)) {
            return this.pendingRequests.get(requestKey);
        }
        
        const fetchPromise = this._doFetch(url, options, retryCount);
        this.pendingRequests.set(requestKey, fetchPromise);
        
        try {
            const result = await fetchPromise;
            return result;
        } finally {
            this.pendingRequests.delete(requestKey);
        }
    }

    /**
     * Internal fetch implementation
     * @private
     */
    async _doFetch(url, options, retryCount) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new DataLoaderError(
                    errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                    errorData.code || 'HTTP_ERROR',
                    response.status
                );
            }

            return await response.json();
        } catch (error) {
            // Don't retry for client errors (4xx)
            if (error instanceof DataLoaderError && error.status >= 400 && error.status < 500) {
                throw error;
            }

            // Retry for network errors and server errors
            if (retryCount < this.maxRetries) {
                console.warn(`Request failed, retrying (${retryCount + 1}/${this.maxRetries})...`);
                await this.sleep(this.retryDelay * (retryCount + 1));
                return this._doFetch(url, options, retryCount + 1);
            }

            throw new DataLoaderError(
                error.message || 'Network error - please check if the server is running',
                'NETWORK_ERROR',
                0
            );
        }
    }

    /**
     * Fetch dataset with pagination
     * @param {number} page - Page number (1-indexed)
     * @param {number} pageSize - Number of rows per page
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} - Dataset response
     */
    async fetchDataset(page = 1, pageSize = 100, useCache = true) {
        const endpoint = '/api/dataset';
        const params = { page, pageSize };
        const cacheKey = this.getCacheKey(endpoint, params);

        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        const queryString = new URLSearchParams(params).toString();
        const data = await this.fetchWithRetry(`${endpoint}?${queryString}`);
        
        this.setCache(cacheKey, data);
        return data;
    }

    /**
     * Fetch DVC version information
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} - DVC info response
     */
    async fetchDVCInfo(useCache = true) {
        const endpoint = '/api/dvc-info';
        const cacheKey = this.getCacheKey(endpoint);

        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        const data = await this.fetchWithRetry(endpoint);
        this.setCache(cacheKey, data);
        return data;
    }

    /**
     * Fetch feature store configuration
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} - Feature store config response
     */
    async fetchFeatureStoreConfig(useCache = true) {
        const endpoint = '/api/feature-store/config';
        const cacheKey = this.getCacheKey(endpoint);

        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        const data = await this.fetchWithRetry(endpoint);
        this.setCache(cacheKey, data);
        return data;
    }

    /**
     * Fetch feature store views (entities and feature views)
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} - Feature store views response
     */
    async fetchFeatureStoreViews(useCache = true) {
        const endpoint = '/api/feature-store/views';
        const cacheKey = this.getCacheKey(endpoint);

        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        const data = await this.fetchWithRetry(endpoint);
        this.setCache(cacheKey, data);
        return data;
    }

    /**
     * Fetch feature store data (predictors and targets)
     * @param {number} page - Page number (1-indexed)
     * @param {number} pageSize - Number of rows per page
     * @param {boolean} useCache - Whether to use cache
     * @returns {Promise<Object>} - Feature store data response
     */
    async fetchFeatureStoreData(page = 1, pageSize = 50, useCache = true) {
        const endpoint = '/api/feature-store/data';
        const params = { page, pageSize };
        const cacheKey = this.getCacheKey(endpoint, params);

        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        const queryString = new URLSearchParams(params).toString();
        const data = await this.fetchWithRetry(`${endpoint}?${queryString}`);
        
        this.setCache(cacheKey, data);
        return data;
    }
}

/**
 * Custom error class for data loading errors
 */
class DataLoaderError extends Error {
    constructor(message, code, status) {
        super(message);
        this.name = 'DataLoaderError';
        this.code = code;
        this.status = status;
    }

    /**
     * Check if error is recoverable (can retry)
     * @returns {boolean}
     */
    isRecoverable() {
        return this.code === 'NETWORK_ERROR' || (this.status >= 500 && this.status < 600);
    }

    /**
     * Get user-friendly error message
     * @returns {string}
     */
    getUserMessage() {
        switch (this.code) {
            case 'NETWORK_ERROR':
                return 'Unable to connect to the server. Please ensure the backend is running.';
            case 'HTTP_ERROR':
                if (this.status === 404) {
                    return 'The requested resource was not found.';
                } else if (this.status >= 500) {
                    return 'Server error. Please try again later.';
                }
                return this.message;
            default:
                return this.message;
        }
    }
}

/**
 * Helper function to render loading state
 * @param {string} message - Loading message
 * @param {string} size - Spinner size ('small', 'normal', 'large')
 * @returns {string} - HTML string
 */
function renderLoadingState(message = 'Loading...', size = 'normal') {
    const spinnerClass = size === 'small' ? 'loading-spinner small' : 
                         size === 'large' ? 'loading-spinner large' : 'loading-spinner';
    return `
        <div class="loading">
            <div class="${spinnerClass}"></div>
            <span class="loading-text">${message}</span>
        </div>
    `;
}

/**
 * Helper function to render error state with retry button
 * @param {Error} error - Error object
 * @param {string} retryButtonId - ID for retry button
 * @returns {string} - HTML string
 */
function renderErrorState(error, retryButtonId = 'retry-btn') {
    const isRecoverable = error instanceof DataLoaderError ? error.isRecoverable() : true;
    const message = error instanceof DataLoaderError ? error.getUserMessage() : error.message;
    
    return `
        <div class="error-container">
            <div class="error-title">Something went wrong</div>
            <div class="error-description">${message}</div>
            ${isRecoverable ? `
                <div class="error-actions">
                    <button class="btn btn-retry" id="${retryButtonId}">
                        Try Again
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// Create a global instance
const dataLoader = new DataLoader();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.DataLoader = DataLoader;
    window.DataLoaderError = DataLoaderError;
    window.dataLoader = dataLoader;
    window.renderLoadingState = renderLoadingState;
    window.renderErrorState = renderErrorState;
}
