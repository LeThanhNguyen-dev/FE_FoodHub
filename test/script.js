// Global variables
let ordersData = [];
let isReloading = false;
let lastUpdateTime = null;
let currentPage = 0;
let totalPages = 0;
let totalElements = 0;

// Status translations
const statusTranslations = {
    'PENDING': 'Chờ Xử Lý',
    'CONFIRMED': 'Đã Xác Nhận',
    'CANCELLED': 'Đã Hủy',
    'COMPLETED': 'Hoàn Thành',
    'PREPARING': 'Đang Chế Biến',
    'READY': 'Sẵn Sàng'
};

// Status CSS classes
const statusClasses = {
    'PENDING': 'status-pending',
    'CONFIRMED': 'status-confirmed',
    'CANCELLED': 'status-cancelled',
    'COMPLETED': 'status-completed',
    'PREPARING': 'status-preparing',
    'READY': 'status-ready'
};

// Filter and pagination state
let currentFilters = {
    status: '',
    tableId: '',
    minPrice: '',
    maxPrice: '',
    page: 0,
    size: 10,
    sortBy: 'createdAt',
    sort: 'DESC'
};

// Calculate time ago
function timeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) {
        return `${diffMins} phút trước`;
    } else if (diffHours < 24) {
        return `${diffHours} giờ trước`;
    } else {
        return `${Math.floor(diffHours / 24)} ngày trước`;
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// Compare orders data to detect changes
function hasOrdersChanged(newOrders, oldOrders) {
    if (newOrders.length !== oldOrders.length) return true;

    for (let i = 0; i < newOrders.length; i++) {
        const newOrder = newOrders[i];
        const oldOrder = oldOrders[i];

        if (newOrder.id !== oldOrder.id ||
            newOrder.status !== oldOrder.status ||
            newOrder.orderItems?.length !== oldOrder.orderItems?.length) {
            return true;
        }

        if (newOrder.orderItems && oldOrder.orderItems) {
            for (let j = 0; j < newOrder.orderItems.length; j++) {
                if (newOrder.orderItems[j].status !== oldOrder.orderItems[j].status) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Update existing order card
function updateOrderCard(order) {
    const existingCard = document.querySelector(`[data-order-id="${order.id}"]`);
    if (!existingCard) return false;

    const statusBadge = existingCard.querySelector('.status-badge');
    if (statusBadge) {
        statusBadge.className = `status-badge ${statusClasses[order.status]}`;
        statusBadge.textContent = statusTranslations[order.status] || order.status;
    }

    const timeElement = existingCard.querySelector('.order-time small');
    if (timeElement) {
        timeElement.textContent = timeAgo(order.createdAt);
    }

    const itemRows = existingCard.querySelectorAll('.item-row');
    if (order.orderItems && itemRows.length > 0) {
        order.orderItems.slice(0, 3).forEach((item, index) => {
            if (itemRows[index]) {
                const itemStatus = itemRows[index].querySelector('.item-status');
                if (itemStatus) {
                    itemStatus.className = `item-status ${statusClasses[item.status] || 'status-pending'}`;
                    itemStatus.textContent = statusTranslations[item.status] || item.status;
                }
            }
        });
    }

    existingCard.style.transition = 'all 0.3s ease';
    existingCard.style.transform = 'scale(1.02)';
    setTimeout(() => existingCard.style.transform = 'scale(1)', 300);

    return true;
}

// Mock apiFetch function (replace with actual API call)
async function apiFetch(url, options) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                code: 0,
                result: {
                    content: [
                        {
                            id: 1,
                            status: 'PENDING',
                            createdAt: new Date().toISOString(),
                            tableNumber: 'A1',
                            totalAmount: 150000,
                            orderItems: [
                                { menuItemName: 'Phở Bò', quantity: 2, price: 50000, status: 'PENDING' },
                                { menuItemName: 'Cơm Tấm', quantity: 1, price: 50000, status: 'PENDING' }
                            ],
                            note: 'Không hành',
                            orderType: 'DINE_IN',
                            username: 'staff1'
                        }
                    ],
                    number: 0,
                    totalPages: 1,
                    totalElements: 1,
                    numberOfElements: 1
                }
            });
        }, 500);
    });
}

// Load orders
async function loadOrders(isAutoRefresh = false) {
    if (isReloading) return;

    try {
        isReloading = true;

        const ordersGrid = document.getElementById('ordersGrid');
        if (!isAutoRefresh && ordersGrid && ordersData.length === 0) {
            const loadingTemplate = document.getElementById('loadingStateTemplate').content.cloneNode(true);
            ordersGrid.innerHTML = '';
            ordersGrid.appendChild(loadingTemplate);
        }

        const params = new URLSearchParams({
            status: currentFilters.status,
            tableId: currentFilters.tableId,
            minPrice: currentFilters.minPrice,
            maxPrice: currentFilters.maxPrice,
            page: currentPage.toString(),
            size: currentFilters.size.toString(),
            SorderBy: currentFilters.sortBy,
            sort: currentFilters.sort
        });

        console.log('Fetching orders with params:', params.toString());

        const data = await apiFetch(`/orders?${params.toString()}`, { method: 'GET' });

        if (data.code === 0 && data.result) {
            const pageData = data.result;
            const newOrders = pageData.content || [];

            if (isAutoRefresh && !hasOrdersChanged(newOrders, ordersData)) {
                console.log('No changes detected, skipping render');
                return;
            }

            const previousOrders = [...ordersData];
            ordersData = newOrders;
            totalPages = pageData.totalPages;
            totalElements = pageData.totalElements;
            currentPage = pageData.number;

            let needsFullRender = false;
            if (isAutoRefresh && previousOrders.length > 0) {
                const currentIds = new Set(ordersData.map(o => o.id));
                const previousIds = new Set(previousOrders.map(o => o.id));
                if (currentIds.size !== previousIds.size || ![...currentIds].every(id => previousIds.has(id))) {
                    needsFullRender = true;
                }
            } else {
                needsFullRender = true;
            }

            if (needsFullRender) {
                renderOrders(ordersData);
            } else {
                ordersData.forEach(order => updateOrderCard(order));
            }

            updateStats();
            updateSummary(pageData);
            updatePagination();
            lastUpdateTime = new Date();
            console.log('Orders updated successfully:', ordersData.length);
        } else {
            throw new Error('Invalid response format or no data');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showErrorState(error.message);
    } finally {
        isReloading = false;
    }
}

// Render orders
function renderOrders(orders) {
    const ordersGrid = document.getElementById('ordersGrid');
    if (!ordersGrid) return;

    ordersGrid.innerHTML = '';
    const activeOrders = orders.filter(order => order.status !== 'CANCELLED');

    if (activeOrders.length === 0) {
        const emptyTemplate = document.getElementById('emptyStateTemplate').content.cloneNode(true);
        ordersGrid.appendChild(emptyTemplate);
        return;
    }

    activeOrders.forEach(order => {
        const orderCard = document.getElementById('orderCardTemplate').content.cloneNode(true);
        const card = orderCard.querySelector('.order-card');
        card.setAttribute('data-order-id', order.id);

        card.querySelector('.order-number strong').textContent = `Đơn #${order.id.toString().padStart(3, '0')}`;
        card.querySelector('.table-number').textContent = order.tableNumber || 'Bàn N/A';
        card.querySelector('.order-time small').textContent = timeAgo(order.createdAt);
        const statusBadge = card.querySelector('.status-badge');
        statusBadge.className = `status-badge ${statusClasses[order.status]}`;
        statusBadge.textContent = statusTranslations[order.status] || order.status;

        card.querySelector('.total-items').textContent = order.orderItems ? order.orderItems.length : 0;
        card.querySelector('.total-amount').textContent = formatCurrency(order.totalAmount);

        if (order.note) {
            const noteDiv = card.querySelector('.order-note');
            noteDiv.style.display = 'block';
            noteDiv.querySelector('.note-text').textContent = order.note;
        }

        const itemsContainer = card.querySelector('.order-items');
        const visibleItems = order.orderItems ? order.orderItems.slice(0, 3) : [];
        visibleItems.forEach(item => {
            const itemRow = document.getElementById('orderItemRowTemplate').content.cloneNode(true);
            itemRow.querySelector('.item-name').textContent = item.menuItemName || 'Món ăn';
            itemRow.querySelector('.item-quantity').textContent = `x${item.quantity}`;
            const itemStatus = itemRow.querySelector('.item-status');
            itemStatus.className = `item-status ${statusClasses[item.status] || 'status-pending'}`;
            itemStatus.textContent = statusTranslations[item.status] || item.status;
            itemsContainer.appendChild(itemRow);
        });

        const hasMoreItems = order.orderItems && order.orderItems.length > 3;
        if (hasMoreItems) {
            const moreItemsDiv = card.querySelector('.more-items');
            moreItemsDiv.style.display = 'block';
            moreItemsDiv.querySelector('.remaining-count').textContent = `+${order.orderItems.length - 3}`;
            moreItemsDiv.addEventListener('click', () => viewOrderDetails(order.id));
        }

        card.querySelector('.start-cooking').addEventListener('click', () => updateOrderStatus(order.id, 'PREPARING'));
        card.querySelector('.complete-order').addEventListener('click', () => updateOrderStatus(order.id, 'READY'));
        card.querySelector('.view-details').addEventListener('click', () => viewOrderDetails(order.id));

        ordersGrid.appendChild(orderCard);
    });
}

// Update statistics
function updateStats() {
    const pendingCount = ordersData.filter(order => order.status === 'PENDING').length;
    const preparingCount = ordersData.filter(order => order.status === 'PREPARING').length;
    const readyCount = ordersData.filter(order => order.status === 'READY').length;
    const avgTime = '15p';

    function updateStatElement(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (element && element.textContent !== newValue.toString()) {
            element.style.transform = 'scale(1.1)';
            element.textContent = newValue;
            setTimeout(() => element.style.transform = 'scale(1)', 200);
        }
    }

    updateStatElement('pendingCount', pendingCount);
    updateStatElement('preparingCount', preparingCount);
    updateStatElement('readyCount', readyCount);
    updateStatElement('avgTime', avgTime);
}

// View order details
async function viewOrderDetails(orderId) {
    try {
        const data = await apiFetch(`/orders/${orderId}`, { method: 'GET' });
        if (data && data.code === 0 && data.result) {
            displayOrderDetails(data.result);
        } else {
            alert('Không thể lấy thông tin đơn hàng!');
        }
    } catch (error) {
        console.error('Error fetching order details:', error);
        alert('Có lỗi xảy ra khi lấy thông tin đơn hàng: ' + error.message);
    }
}

// Display order details
function displayOrderDetails(orderData) {
    const { id, status, orderType, createdAt, note, tableNumber, username, totalAmount, orderItems } = orderData;
    const modal = document.getElementById('orderDetailsTemplate').content.cloneNode(true);

    modal.querySelector('#modalOrderId').textContent = `Chi tiết đơn hàng #${id}`;
    const statusBadge = modal.querySelector('#modalStatus');
    statusBadge.className = `badge ${getStatusBadgeClass(status)}`;
    statusBadge.textContent = getStatusText(status);
    modal.querySelector('#modalOrderType').textContent = getOrderTypeText(orderType);
    modal.querySelector('#modalCreatedAt').textContent = new Date(createdAt).toLocaleString('vi-VN');
    modal.querySelector('#modalTableNumber').textContent = tableNumber || 'Mang về';
    modal.querySelector('#modalUsername').textContent = username || 'N/A';
    if (note) {
        const noteRow = modal.querySelector('#modalNoteRow');
        noteRow.style.display = 'flex';
        modal.querySelector('#modalNote').textContent = note;
    }
    modal.querySelector('#modalTotalAmount').textContent = `Tổng tiền: ${formatCurrency(totalAmount)}`;

    const itemsContainer = modal.querySelector('#modalOrderItems');
    orderItems.forEach(item => {
        const itemRow = document.getElementById('orderItemTemplate').content.cloneNode(true);
        itemRow.querySelector('.item-name').textContent = item.menuItemName;
        itemRow.querySelector('.item-details').textContent = `SL: ${item.quantity} × ${formatCurrency(item.price)}`;
        const itemStatus = itemRow.querySelector('.badge');
        itemStatus.className = `badge ${getStatusBadgeClass(item.status)}`;
        itemStatus.textContent = getStatusText(item.status);
        itemsContainer.appendChild(itemRow);
    });

    modal.querySelector('#modalUpdateStatus').addEventListener('click', () => updateOrderStatus(id));

    document.body.appendChild(modal);
}

// Close order details
function closeOrderDetails() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => modal.remove(), 300);
    }
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        const data = await apiFetch(`/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });

        if (data && data.code === 0) {
            await loadOrders(true);
            closeOrderDetails();
        } else {
            throw new Error('Failed to update order status');
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Có lỗi xảy ra khi cập nhật trạng thái đơn hàng: ' + error.message);
    }
}

// Toggle filters
function toggleFilters() {
    const filtersBody = document.getElementById('filtersBody');
    const toggleIcon = document.getElementById('filterToggleIcon');

    if (filtersBody.classList.contains('show')) {
        filtersBody.classList.remove('show');
        toggleIcon.classList.remove('fa-chevron-up');
        toggleIcon.classList.add('fa-chevron-down');
    } else {
        filtersBody.classList.add('show');
        toggleIcon.classList.remove('fa-chevron-down');
        toggleIcon.classList.add('fa-chevron-up');
    }
}

// Apply filters
function applyFilters() {
    currentPage = 0;
    const statusFilter = document.getElementById('statusFilter');
    const tableIdFilter = document.getElementById('tableIdFilter');
    const minPriceFilter = document.getElementById('minPriceFilter');
    const maxPriceFilter = document.getElementById('maxPriceFilter');
    const sortByFilter = document.getElementById('sortByFilter');
    const sortDirectionFilter = document.getElementById('sortDirectionFilter');
    const pageSizeFilter = document.getElementById('pageSizeFilter');

    currentFilters = {
        status: statusFilter ? statusFilter.value : '',
        tableId: tableIdFilter ? tableIdFilter.value : '',
        minPrice: minPriceFilter ? minPriceFilter.value : '',
        maxPrice: maxPriceFilter ? maxPriceFilter.value : '',
        sortBy: sortByFilter ? sortByFilter.value || 'createdAt' : 'createdAt',
        sort: sortDirectionFilter ? sortDirectionFilter.value || 'DESC' : 'DESC',
        size: pageSizeFilter ? parseInt(pageSizeFilter.value) || 10 : 10,
        page: currentPage
    };

    loadOrders();
}

// Clear filters
function clearFilters() {
    const statusFilter = document.getElementById('statusFilter');
    const tableIdFilter = document.getElementById('tableIdFilter');
    const minPriceFilter = document.getElementById('minPriceFilter');
    const maxPriceFilter = document.getElementById('maxPriceFilter');
    const sortByFilter = document.getElementById('sortByFilter');
    const sortDirectionFilter = document.getElementById('sortDirectionFilter');
    const pageSizeFilter = document.getElementById('pageSizeFilter');

    if (statusFilter) statusFilter.value = '';
    if (tableIdFilter) tableIdFilter.value = '';
    if (minPriceFilter) minPriceFilter.value = '';
    if (maxPriceFilter) maxPriceFilter.value = '';
    if (sortByFilter) sortByFilter.value = 'createdAt';
    if (sortDirectionFilter) sortDirectionFilter.value = 'DESC';
    if (pageSizeFilter) pageSizeFilter.value = '10';

    currentPage = 0;
    applyFilters();
}

// Update summary
function updateSummary(orderPage) {
    const paginationInfo = document.getElementById('paginationInfo');
    if (!paginationInfo || !orderPage) return;

    const { number: currentPageNum, size, totalElements, numberOfElements } = orderPage;
    const startItem = currentPageNum * size + 1;
    const endItem = currentPageNum * size + numberOfElements;

    paginationInfo.textContent = totalElements > 0
        ? `Hiển thị ${startItem}-${endItem} trong tổng số ${totalElements} đơn hàng`
        : 'Không có đơn hàng nào';
}

// Update pagination
function updatePagination() {
    const paginationList = document.getElementById('paginationList');
    if (!paginationList || totalPages <= 1) {
        if (paginationList) paginationList.innerHTML = '';
        return;
    }

    paginationList.innerHTML = '';
    const isFirst = currentPage === 0;
    const isLast = currentPage === totalPages - 1;

    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${isFirst ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.setAttribute('aria-label', 'Previous');
    prevLink.innerHTML = '<span aria-hidden="true">«</span>';
    if (!isFirst) prevLink.addEventListener('click', () => changePage(currentPage - 1));
    prevLi.appendChild(prevLink);
    paginationList.appendChild(prevLi);

    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages - 1, currentPage + 2);

    if (startPage > 0) {
        const firstLi = document.createElement('li');
        firstLi.className = 'page-item';
        const firstLink = document.createElement('a');
        firstLink.className = 'page-link';
        firstLink.href = '#';
        firstLink.textContent = '1';
        firstLink.addEventListener('click', () => changePage(0));
        firstLi.appendChild(firstLink);
        paginationList.appendChild(firstLi);

        if (startPage > 1) {
            const dotsLi = document.createElement('li');
            dotsLi.className = 'page-item disabled';
            const dotsSpan = document.createElement('span');
            dotsSpan.className = 'page-link';
            dotsSpan.textContent = '...';
            dotsLi.appendChild(dotsSpan);
            paginationList.appendChild(dotsLi);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.textContent = i + 1;
        pageLink.addEventListener('click', () => changePage(i));
        pageLi.appendChild(pageLink);
        paginationList.appendChild(pageLi);
    }

    if (endPage < totalPages - 1) {
        if (endPage < totalPages - 2) {
            const dotsLi = document.createElement('li');
            dotsLi.className = 'page-item disabled';
            const dotsSpan = document.createElement('span');
            dotsSpan.className = 'page-link';
            dotsSpan.textContent = '...';
            dotsLi.appendChild(dotsSpan);
            paginationList.appendChild(dotsLi);
        }

        const lastLi = document.createElement('li');
        lastLi.className = 'page-item';
        const lastLink = document.createElement('a');
        lastLink.className = 'page-link';
        lastLink.href = '#';
        lastLink.textContent = totalPages;
        lastLink.addEventListener('click', () => changePage(totalPages - 1));
        lastLi.appendChild(lastLink);
        paginationList.appendChild(lastLi);
    }

    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${isLast ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.setAttribute('aria-label', 'Next');
    nextLink.innerHTML = '<span aria-hidden="true">»</span>';
    if (!isLast) nextLink.addEventListener('click', () => changePage(currentPage + 1));
    nextLi.appendChild(nextLink);
    paginationList.appendChild(nextLi);
}

// Change page
function changePage(pageNumber) {
    if (pageNumber < 0 || pageNumber >= totalPages || pageNumber === currentPage) return;
    currentPage = pageNumber;
    loadOrders();
}

// Show error state
function showErrorState(errorMessage) {
    const ordersGrid = document.getElementById('ordersGrid');
    if (ordersGrid) {
        const errorTemplate = document.getElementById('errorStateTemplate').content.cloneNode(true);
        errorTemplate.querySelector('.error-message').textContent = errorMessage;
        ordersGrid.innerHTML = '';
        ordersGrid.appendChild(errorTemplate);
    }
}

// Navigation functions
function showOrders() {
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = 'Quản Lý Đơn Hàng';
    updateActiveNav('orders');
    loadOrders();
}

function showDashboard() {
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = 'Tổng Quan - Ca Làm Việc';
    updateActiveNav('dashboard');
    loadOrders();
}

function updateActiveNav(section) {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const navMap = { 'dashboard': 0, 'orders': 1, 'tables': 2, 'reports': 3 };
    const navLinks = document.querySelectorAll('.nav-link');
    if (navLinks[navMap[section]]) navLinks[navMap[section]].classList.add('active');
}

function getStatusBadgeClass(status) {
    const statusClasses = {
        'PENDING': 'bg-warning',
        'CONFIRMED': 'bg-info',
        'READY': 'bg-success',
        'COMPLETED': 'bg-secondary',
        'CANCELLED': 'bg-danger'
    };
    return statusClasses[status] || 'bg-secondary';
}

function getStatusText(status) {
    const statusTexts = {
        'PENDING': 'Chờ xác nhận',
        'CONFIRMED': 'Đã xác nhận',
        'READY': 'Sẵn sàng phục vụ',
        'COMPLETED': 'Hoàn thành',
        'CANCELLED': 'Đã hủy'
    };
    return statusTexts[status] || status;
}

function getOrderTypeText(orderType) {
    const types = {
        'DINE_IN': 'Tại chỗ',
        'TAKEAWAY': 'Mang về',
        'DELIVERY': 'Giao hàng'
    };
    return types[orderType] || orderType;
}

// Smart refresh
let refreshInterval;
function startSmartRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(async () => {
        if (ordersData.length > 0 && !isReloading) {
            await loadOrders(true);
        }
    }, 30000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Kitchen Dashboard initialized');
    showDashboard();
    startSmartRefresh();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (refreshInterval) clearInterval(refreshInterval);
    } else {
        startSmartRefresh();
    }
});