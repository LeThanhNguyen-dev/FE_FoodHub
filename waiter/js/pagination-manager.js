// PaginationManager - Class quản lý pagination với template HTML
class PaginationManager {
    constructor(config = {}) {
        this.config = {
            templateUrl: config.templateUrl || 'pagination.html',
            containerId: config.containerId,
            maxVisiblePages: config.maxVisiblePages || 10,
            labels: {
                previous: 'Trang trước',
                next: 'Trang sau',
                page: 'Trang',
                previousPages: 'Các trang trước',
                nextPages: 'Các trang sau',
                ariaLabel: 'Phân trang',
                ...config.labels
            },
            onPageChange: config.onPageChange || (() => {}),
            ...config
        };

        this.currentPage = 0;
        this.totalPages = 1;
        this.isInitialized = false;
        this.elements = {};
    }

    // Khởi tạo pagination với template
    async init() {
        try {
            if (!this.config.containerId) {
                throw new Error('Container ID is required');
            }

            const container = document.getElementById(this.config.containerId);
            if (!container) {
                throw new Error(`Container with ID "${this.config.containerId}" not found`);
            }

            // Fetch template HTML
            const templateHtml = await this.fetchTemplate();
            
            // Insert template vào container
            container.innerHTML = templateHtml;

            // Cache các elements
            this.cacheElements(container);

            // Bind events
            this.bindEvents();

            this.isInitialized = true;
            console.log(`Pagination initialized for container: ${this.config.containerId}`);

        } catch (error) {
            console.error('Failed to initialize pagination:', error);
            throw error;
        }
    }

    // Fetch template từ file HTML
    async fetchTemplate() {
        try {
            const response = await fetch(this.config.templateUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch template: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.error('Error fetching pagination template:', error);
            // Fallback template nếu không fetch được
            return this.getFallbackTemplate();
        }
    }

    // Template dự phòng nếu không fetch được file
    getFallbackTemplate() {
        return `
            <div class="pagination-container mt-3" data-pagination-container>
                <div class="d-flex justify-content-center">
                    <div class="pagination-controls">
                        <nav aria-label="${this.config.labels.ariaLabel}">
                            <ul class="pagination mb-0" data-pagination-list></ul>
                        </nav>
                    </div>
                </div>
                <div class="pagination-jump mt-2" data-pagination-jump style="display: none;">
                    <div class="d-flex justify-content-center align-items-center gap-2">
                        <small class="text-muted">Chuyển đến trang:</small>
                        <input type="number" class="form-control form-control-sm" 
                               data-jump-input style="width: 80px;" min="1">
                        <button class="btn btn-sm btn-outline-primary" data-jump-button>Đi</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Cache các elements để tái sử dụng
    cacheElements(container) {
        this.elements = {
            container: container.querySelector('[data-pagination-container]'),
            paginationList: container.querySelector('[data-pagination-list]'),
            jumpContainer: container.querySelector('[data-pagination-jump]'),
            jumpInput: container.querySelector('[data-jump-input]'),
            jumpButton: container.querySelector('[data-jump-button]')
        };
    }

    // Bind events
    bindEvents() {
        if (this.elements.jumpButton) {
            this.elements.jumpButton.addEventListener('click', () => this.jumpToPage());
        }

        if (this.elements.jumpInput) {
            this.elements.jumpInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.jumpToPage();
                }
            });
        }
    }

    // Update pagination với data mới
    update(currentPage, totalPages) {
        if (!this.isInitialized) {
            console.warn('Pagination not initialized. Call init() first.');
            return;
        }

        this.currentPage = currentPage;
        this.totalPages = totalPages;

        this.generatePaginationButtons();
        this.updateJumpFeature();
    }

    // Generate pagination buttons
    generatePaginationButtons() {
        if (!this.elements.paginationList) return;

        this.elements.paginationList.innerHTML = '';

        if (this.totalPages <= 1) return;

        const currentPageDisplay = this.currentPage + 1;
        const { startPage, endPage } = this.calculatePageRange(currentPageDisplay);

        // Previous button
        const prevBtn = this.createPaginationButton('‹', this.currentPage - 1, 
            this.currentPage <= 0, this.config.labels.previous);
        this.elements.paginationList.appendChild(prevBtn);

        // First page + ellipsis (if needed)
        if (startPage > 1) {
            this.elements.paginationList.appendChild(this.createPaginationButton('1', 0));
            if (startPage > 2) {
                this.elements.paginationList.appendChild(this.createPaginationEllipsis('start'));
            }
        }

        // Page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = this.createPaginationButton(
                i.toString(),
                i - 1,
                false,
                `${this.config.labels.page} ${i}`,
                i === currentPageDisplay
            );
            this.elements.paginationList.appendChild(pageBtn);
        }

        // Last page + ellipsis (if needed)
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                this.elements.paginationList.appendChild(this.createPaginationEllipsis('end'));
            }
            this.elements.paginationList.appendChild(
                this.createPaginationButton(this.totalPages.toString(), this.totalPages - 1)
            );
        }

        // Next button
        const nextBtn = this.createPaginationButton('›', this.currentPage + 1, 
            this.currentPage >= this.totalPages - 1, this.config.labels.next);
        this.elements.paginationList.appendChild(nextBtn);
    }

    // Calculate page range to display
    calculatePageRange(currentPageDisplay) {
        let startPage, endPage;

        if (this.totalPages <= this.config.maxVisiblePages) {
            startPage = 1;
            endPage = this.totalPages;
        } else {
            const halfVisible = Math.floor(this.config.maxVisiblePages / 2);

            if (currentPageDisplay <= halfVisible + 1) {
                startPage = 1;
                endPage = this.config.maxVisiblePages;
            } else if (currentPageDisplay >= this.totalPages - halfVisible) {
                startPage = this.totalPages - this.config.maxVisiblePages + 1;
                endPage = this.totalPages;
            } else {
                startPage = currentPageDisplay - halfVisible;
                endPage = currentPageDisplay + halfVisible;
            }
        }

        return { startPage, endPage };
    }

    // Create pagination button element
    createPaginationButton(text, pageIndex, disabled = false, title = '', active = false) {
        const li = document.createElement('li');
        li.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;

        const button = document.createElement('button');
        button.className = 'page-link';
        button.innerHTML = text;
        button.title = title;
        button.disabled = disabled;

        if (!disabled) {
            button.onclick = () => this.goToPage(pageIndex);
        }

        li.appendChild(button);
        return li;
    }

    // Create ellipsis element
    createPaginationEllipsis(position) {
        const li = document.createElement('li');
        li.className = 'page-item disabled';

        const span = document.createElement('span');
        span.className = 'page-link';
        span.innerHTML = '...';
        span.title = position === 'start' ? this.config.labels.previousPages : this.config.labels.nextPages;

        li.appendChild(span);
        return li;
    }

    // Go to specific page
    goToPage(pageIndex) {
        if (pageIndex >= 0 && pageIndex < this.totalPages && pageIndex !== this.currentPage) {
            this.currentPage = pageIndex;
            this.config.onPageChange(pageIndex);
        }
    }

    // Update jump feature
    updateJumpFeature() {
        if (this.elements.jumpContainer && this.elements.jumpInput && this.totalPages > 10) {
            this.elements.jumpContainer.style.display = 'block';
            this.elements.jumpInput.max = this.totalPages;
            this.elements.jumpInput.placeholder = `1-${this.totalPages}`;
        } else if (this.elements.jumpContainer) {
            this.elements.jumpContainer.style.display = 'none';
        }
    }

    // Jump to page functionality
    jumpToPage() {
        if (!this.elements.jumpInput) return;

        const pageNumber = parseInt(this.elements.jumpInput.value);

        if (pageNumber && pageNumber >= 1 && pageNumber <= this.totalPages) {
            this.goToPage(pageNumber - 1);
            this.elements.jumpInput.value = '';
        } else {
            this.elements.jumpInput.classList.add('is-invalid');
            setTimeout(() => {
                this.elements.jumpInput.classList.remove('is-invalid');
            }, 2000);
        }
    }

    // Destroy pagination instance
    destroy() {
        if (this.config.containerId) {
            const container = document.getElementById(this.config.containerId);
            if (container) {
                container.innerHTML = '';
            }
        }
        this.isInitialized = false;
        this.elements = {};
    }
}

// Global pagination instances
let orderPagination;
let menuPagination;

// Khởi tạo pagination cho orders
async function initOrderPagination() {
    orderPagination = new PaginationManager({
        templateUrl: 'pagination.html',
        containerId: 'orderPaginationContainer',
        onPageChange: (pageIndex) => {
            currentOrderPage = pageIndex;
            loadOrders();
        },
        labels: {
            ariaLabel: 'Phân trang đơn hàng'
        }
    });

    await orderPagination.init();
}

// Khởi tạo pagination cho menu
async function initMenuPagination() {
    menuPagination = new PaginationManager({
        templateUrl: 'pagination.html',
        containerId: 'menuPaginationContainer',
        onPageChange: (pageIndex) => {
            currentMenuPage = pageIndex;
            loadMenuItems();
        },
        labels: {
            ariaLabel: 'Phân trang menu'
        }
    });

    await menuPagination.init();
}

// Cập nhật pagination cho orders
function updateOrderPagination() {
    if (orderPagination && orderPagination.isInitialized) {
        orderPagination.update(currentOrderPage, totalOrderPages);
    }
}

// Cập nhật pagination cho menu
function updateMenuPagination() {
    if (menuPagination && menuPagination.isInitialized) {
        menuPagination.update(currentMenuPage, totalMenuPages);
    }
}

// Thay thế các function cũ
function updatePagination() {
    updateOrderPagination();
}

function jumpToOrderPage() {
    if (orderPagination) {
        orderPagination.jumpToPage();
    }
}

// Export cho sử dụng khác
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaginationManager;
}