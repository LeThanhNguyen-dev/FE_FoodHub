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

        // Check if any order item status changed
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

// Update existing order card instead of recreating
function updateOrderCard(order) {
    const existingCard = document.querySelector(`[data-order-id="${order.id}"]`);
    if (!existingCard) return false;

    // Update status badge
    const statusBadge = existingCard.querySelector('.status-badge');
    if (statusBadge) {
        statusBadge.className = `status-badge ${statusClasses[order.status]}`;
        statusBadge.textContent = statusTranslations[order.status] || order.status;
    }

    // Update time
    const timeElement = existingCard.querySelector('.order-time small');
    if (timeElement) {
        timeElement.textContent = timeAgo(order.createdAt);
    }

    // Update order items status
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

    // Add smooth update animation
    existingCard.style.transition = 'all 0.3s ease';
    existingCard.style.transform = 'scale(1.02)';
    setTimeout(() => {
        existingCard.style.transform = 'scale(1)';
    }, 300);

    return true;
}

// Load orders from API with smooth updates
async function loadOrders(isAutoRefresh = false) {
    if (isReloading) return;

    try {
        isReloading = true;

        // Don't show loading for auto refresh
        if (!isAutoRefresh) {
            const ordersGrid = document.getElementById('ordersGrid');
            if (ordersGrid && ordersData.length === 0) {
                ordersGrid.innerHTML = '<div class="text-center"><div class="loading"></div> Đang tải đơn hàng...</div>';
            }
        }

        console.log('Fetching orders from API...');

        const data = await apiFetch('/orders', {
            method: 'GET',
        });

        console.log('API Response:', data);

        if (data.code === 0 && data.result && data.result.content) {
            const newOrders = data.result.content;

            // Check if data has changed
            if (isAutoRefresh && !hasOrdersChanged(newOrders, ordersData)) {
                console.log('No changes detected, skipping render');
                return;
            }

            // Store previous data
            const previousOrders = [...ordersData];
            ordersData = newOrders;

            // Try to update existing cards first
            let needsFullRender = false;

            if (isAutoRefresh && previousOrders.length > 0) {
                // Check if we need full render (new orders added/removed)
                const currentIds = new Set(ordersData.map(o => o.id));
                const previousIds = new Set(previousOrders.map(o => o.id));

                if (currentIds.size !== previousIds.size ||
                    ![...currentIds].every(id => previousIds.has(id))) {
                    needsFullRender = true;
                }
            } else {
                needsFullRender = true;
            }

            if (needsFullRender) {
                renderOrders(ordersData);
            } else {
                // Update existing cards
                ordersData.forEach(order => {
                    updateOrderCard(order);
                });
            }

            updateStats();
            lastUpdateTime = new Date();
            console.log('Orders updated successfully:', ordersData.length);
        } else {
            throw new Error('Invalid response format or no data');
        }
    } catch (error) {
        console.error('Error loading orders:', error);

        // Only show error if it's not an auto refresh or if we have no data
        if (!isAutoRefresh || ordersData.length === 0) {
            const ordersGrid = document.getElementById('ordersGrid');
            if (ordersGrid) {
                ordersGrid.innerHTML = `
                    <div class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle mb-2"></i>
                        <div>Lỗi tải dữ liệu đơn hàng</div>
                        <small>${error.message}</small>
                        <div class="mt-2">
                            <button class="btn btn-outline-primary btn-sm" onclick="loadOrders()">
                                <i class="fas fa-refresh"></i> Thử lại
                            </button>
                        </div>
                    </div>
                `;
            }
        }
    } finally {
        isReloading = false;
    }
}

// Render orders with smooth animations
function renderOrders(orders) {
    const ordersGrid = document.getElementById('ordersGrid');

    if (!ordersGrid) {
        console.error('Orders grid element not found');
        return;
    }

    // Filter out cancelled orders for kitchen display
    const activeOrders = orders.filter(order => order.status !== 'CANCELLED');

    if (activeOrders.length === 0) {
        ordersGrid.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-clipboard-list fa-3x mb-3 opacity-50"></i>
                <div>Không có đơn hàng nào</div>
            </div>
        `;
        return;
    }

    // Store existing cards to preserve scroll position
    const existingCards = {};
    ordersGrid.querySelectorAll('.order-card').forEach(card => {
        const orderId = card.getAttribute('data-order-id');
        if (orderId) {
            existingCards[orderId] = card.cloneNode(true);
        }
    });

    const ordersHTML = activeOrders.map(order => {
        // Show only first 3 items
        const visibleItems = order.orderItems ? order.orderItems.slice(0, 3) : [];
        const hasMoreItems = order.orderItems && order.orderItems.length > 3;
        const remainingCount = hasMoreItems ? order.orderItems.length - 3 : 0;

        const itemsHTML = visibleItems.map(item => `
            <div class="item-row">
                <div class="item-info">
                    <span class="item-name">${item.menuItemName || 'Món ăn'}</span>
                    <span class="item-quantity">x${item.quantity}</span>
                </div>
                <span class="item-status ${statusClasses[item.status] || 'status-pending'}">
                    ${statusTranslations[item.status] || item.status}
                </span>
            </div>
        `).join('');

        const moreItemsHTML = hasMoreItems ? `
            <div class="more-items" onclick="viewOrderDetails(${order.id})">
                <i class="fas fa-plus-circle"></i> +${remainingCount} món khác - Xem chi tiết
            </div>
        ` : '';

        // Calculate total items for display
        const totalItems = order.orderItems ? order.orderItems.length : 0;

        return `
            <div class="order-card" data-order-id="${order.id}" style="animation: slideIn 0.3s ease;">
                <div class="order-header">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="order-number">
                            <strong>Đơn #${order.id.toString().padStart(3, '0')}</strong>
                        </div>
                        <div class="text-end">
                            <div class="table-badge mb-1">
                                <i class="fas fa-chair"></i> ${order.tableNumber || 'Bàn N/A'}
                            </div>
                            <div class="order-time">
                                <i class="fas fa-clock"></i>
                                <small>${timeAgo(order.createdAt)}</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="status-badge ${statusClasses[order.status]}">
                            ${statusTranslations[order.status] || order.status}
                        </span>
                    </div>
                    
                    <div class="order-summary mb-2">
                        <small class="text-muted">
                            <i class="fas fa-utensils"></i> ${totalItems} món | 
                            <i class="fas fa-money-bill-wave"></i> ${formatCurrency(order.totalAmount)}
                        </small>
                    </div>
                    
                    ${order.note ? `
                        <div class="order-note mb-2">
                            <small class="text-info">
                                <i class="fas fa-sticky-note"></i> ${order.note}
                            </small>
                        </div>
                    ` : ''}
                </div>
                
                <div class="order-items">
                    ${itemsHTML}
                    ${moreItemsHTML}
                </div>
                
                <div class="order-actions mt-3">
                    <button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${order.id}, 'PREPARING')">
                        <i class="fas fa-fire"></i> Bắt Đầu Nấu
                    </button>
                    <button class="btn btn-success btn-sm" onclick="updateOrderStatus(${order.id}, 'READY')">
                        <i class="fas fa-check"></i> Hoàn Thành
                    </button>
                    <button class="btn btn-outline-info btn-sm" onclick="viewOrderDetails(${order.id})">
                        <i class="fas fa-eye"></i> Chi Tiết
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Smooth transition
    ordersGrid.style.opacity = '0.7';
    setTimeout(() => {
        ordersGrid.innerHTML = ordersHTML;
        ordersGrid.style.opacity = '1';
    }, 100);
}

// Update statistics with smooth animations
function updateStats() {
    const pendingCount = ordersData.filter(order => order.status === 'PENDING').length;
    const preparingCount = ordersData.filter(order => order.status === 'PREPARING').length;
    const readyCount = ordersData.filter(order => order.status === 'READY').length;

    // Calculate average cooking time (mock calculation for now)
    const avgTime = '15p';

    // Smooth update function
    function updateStatElement(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (element && element.textContent !== newValue.toString()) {
            element.style.transform = 'scale(1.1)';
            element.textContent = newValue;
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 200);
        }
    }

    // Update DOM elements with animation
    updateStatElement('pendingCount', pendingCount);
    updateStatElement('preparingCount', preparingCount);
    updateStatElement('readyCount', readyCount);
    updateStatElement('avgTime', avgTime);
}

// View order details function
async function viewOrderDetails(orderId) {
    try {
        console.log('Fetching order details for ID:', orderId);

        const data = await apiFetch(`/orders/${orderId}`, {
            method: 'GET',
        });

        console.log('Order details API Response:', data);

        if (data && data.code === 0 && data.result) {
            displayOrderDetails(data.result);
        } else {
            console.error('Invalid response:', data);
            alert('Không thể lấy thông tin đơn hàng!');
        }

    } catch (error) {
        console.error('Error fetching order details:', error);
        alert('Có lỗi xảy ra khi lấy thông tin đơn hàng: ' + error.message);
    }
}

// Display order details in a modal or detailed view
function displayOrderDetails(orderData) {
    const {
        id, status, orderType, createdAt, note,
        tableNumber, username, totalAmount, orderItems
    } = orderData;

    // Format dữ liệu
    const formattedDate = new Date(createdAt).toLocaleString('vi-VN');
    const formattedAmount = formatCurrency(totalAmount);

    // Tạo HTML cho danh sách món ăn
    const orderItemsHtml = orderItems.map(item => `
        <div class="order-item">
            <div class="item-info">
                <strong>${item.menuItemName}</strong>
                <span class="item-details">SL: ${item.quantity} × ${formatCurrency(item.price)}</span>
            </div>
            <div class="item-status">
                <span class="badge ${getStatusBadgeClass(item.status)}">${getStatusText(item.status)}</span>
            </div>
        </div>
    `).join('');

    // Tạo nội dung modal với animation
    const modalHtml = `
        <div class="modal-overlay" onclick="closeOrderDetails()" style="animation: fadeIn 0.3s ease;">
            <div class="modal-content" onclick="event.stopPropagation()" style="animation: slideInUp 0.3s ease;">
                <div class="modal-header">
                    <h3>Chi tiết đơn hàng #${id}</h3>
                    <button class="btn-close" onclick="closeOrderDetails()">×</button>
                </div>
                
                <div class="modal-body">
                    <div class="order-summary">
                        <div class="info-row">
                            <span>Trạng thái:</span>
                            <span class="badge ${getStatusBadgeClass(status)}">${getStatusText(status)}</span>
                        </div>
                        <div class="info-row">
                            <span>Loại đơn:</span>
                            <span>${getOrderTypeText(orderType)}</span>
                        </div>
                        <div class="info-row">
                            <span>Thời gian:</span>
                            <span>${formattedDate}</span>
                        </div>
                        <div class="info-row">
                            <span>Bàn:</span>
                            <span>${tableNumber || 'Mang về'}</span>
                        </div>
                        <div class="info-row">
                            <span>Nhân viên:</span>
                            <span>${username}</span>
                        </div>
                        ${note ? `<div class="info-row"><span>Ghi chú:</span><span>${note}</span></div>` : ''}
                    </div>

                    <div class="order-items-section">
                        <h4>Danh sách món ăn:</h4>
                        <div class="order-items-list">
                            ${orderItemsHtml}
                        </div>
                    </div>

                    <div class="order-total">
                        <strong>Tổng tiền: ${formattedAmount}</strong>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="updateOrderStatus(${id})">
                        Cập nhật trạng thái
                    </button>
                    <button class="btn btn-secondary" onclick="closeOrderDetails()">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    `;

    // Thêm CSS inline nếu chưa có
    addModalStyles();

    // Hiển thị modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Thêm CSS cho modal với animations
function addModalStyles() {
    if (document.getElementById('orderModalStyles')) return;

    const styles = `
        <style id="orderModalStyles">
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideInUp {
            from { 
                opacity: 0;
                transform: translateY(50px);
            }
            to { 
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes slideIn {
            from { 
                opacity: 0;
                transform: translateX(-20px);
            }
            to { 
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .modal-content {
            background: white;
            border-radius: 8px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .modal-header {
            padding: 20px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .modal-body {
            padding: 20px;
        }
        .modal-footer {
            padding: 20px;
            border-top: 1px solid #eee;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        .btn-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            transition: color 0.2s;
        }
        .btn-close:hover {
            color: #000;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .order-items-section {
            margin: 20px 0;
        }
        .order-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border: 1px solid #eee;
            border-radius: 4px;
            margin-bottom: 8px;
            transition: background-color 0.2s;
        }
        .order-item:hover {
            background-color: #f8f9fa;
        }
        .item-details {
            color: #666;
            font-size: 14px;
            display: block;
        }
        .order-total {
            text-align: center;
            font-size: 18px;
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #007bff;
            color: white;
        }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .btn:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        
        /* Order card animations */
        .order-card {
            transition: all 0.3s ease;
        }
        
        .order-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        /* Stat counters transition */
        #pendingCount, #preparingCount, #readyCount, #avgTime {
            transition: all 0.2s ease;
        }
        </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
}

// Close order details modal with animation
function closeOrderDetails() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Add fadeOut animation
document.head.insertAdjacentHTML('beforeend', `
    <style>
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    </style>
`);

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        console.log(`Updating order ${orderId} to status: ${newStatus}`);

        const data = await apiFetch(`/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });

        if (data && data.code === 0) {
            console.log('Order status updated successfully');
            // Reload orders to reflect changes
            await loadOrders(true); // Use auto-refresh mode
            // Close modal if open
            closeOrderDetails();
        } else {
            throw new Error('Failed to update order status');
        }

    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Có lỗi xảy ra khi cập nhật trạng thái đơn hàng: ' + error.message);
    }
}

// Show orders section
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

// Initialize filters UI
function initializeFilters() {
    const filtersHTML = `
        <div class="filters-section mb-4" id="filtersSection">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="fas fa-filter"></i> Bộ lọc & Sắp xếp
                    </h6>
                    <button class="btn btn-sm btn-outline-secondary" onclick="toggleFilters()">
                        <i class="fas fa-chevron-down" id="filterToggleIcon"></i>
                    </button>
                </div>
                <div class="card-body collapse" id="filtersBody">
                    <div class="row g-3">
                        <!-- Status Filter -->
                        <div class="col-md-3">
                            <label class="form-label">
                                <i class="fas fa-info-circle"></i> Trạng thái
                            </label>
                            <select class="form-select" id="statusFilter" onchange="applyFilters()">
                                <option value="">Tất cả trạng thái</option>
                                <option value="PENDING">Chờ Xử Lý</option>
                                <option value="CONFIRMED">Đã Xác Nhận</option>
                                <option value="PREPARING">Đang Chế Biến</option>
                                <option value="READY">Sẵn Sàng</option>
                                <option value="COMPLETED">Hoàn Thành</option>
                            </select>
                        </div>

                        <!-- Table Filter -->
                        <div class="col-md-3">
                            <label class="form-label">
                                <i class="fas fa-chair"></i> Bàn số
                            </label>
                            <input type="number" class="form-control" id="tableIdFilter" 
                                   placeholder="Chọn bàn" onchange="applyFilters()" min="1">
                        </div>

                        <!-- Price Range -->
                        <div class="col-md-3">
                            <label class="form-label">
                                <i class="fas fa-money-bill-wave"></i> Giá tối thiểu (VND)
                            </label>
                            <input type="number" class="form-control" id="minPriceFilter" 
                                   placeholder="0" onchange="applyFilters()" min="0" step="1000">
                        </div>

                        <div class="col-md-3">
                            <label class="form-label">
                                <i class="fas fa-credit-card"></i> Giá tối đa (VND)
                            </label>
                            <input type="number" class="form-control" id="maxPriceFilter" 
                                   placeholder="10000000" onchange="applyFilters()" min="0" step="1000">
                        </div>

                        <!-- Sort Options -->
                        <div class="col-md-4">
                            <label class="form-label">
                                <i class="fas fa-sort"></i> Sắp xếp theo
                            </label>
                            <select class="form-select" id="sortByFilter" onchange="applyFilters()">
                                <option value="createdAt">Thời gian tạo</option>
                                <option value="totalAmount">Tổng tiền</option>
                                <option value="tableNumber">Số bàn</option>
                                <option value="status">Trạng thái</option>
                            </select>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                <i class="fas fa-arrows-alt-v"></i> Thứ tự
                            </label>
                            <select class="form-select" id="sortDirectionFilter" onchange="applyFilters()">
                                <option value="DESC">Giảm dần</option>
                                <option value="ASC">Tăng dần</option>
                            </select>
                        </div>

                        <!-- Page Size -->
                        <div class="col-md-4">
                            <label class="form-label">
                                <i class="fas fa-list"></i> Số đơn/trang
                            </label>
                            <select class="form-select" id="pageSizeFilter" onchange="applyFilters()">
                                <option value="5">5 đơn</option>
                                <option value="10" selected>10 đơn</option>
                                <option value="20">20 đơn</option>
                                <option value="50">50 đơn</option>
                            </select>
                        </div>

                        <!-- Action Buttons -->
                        <div class="col-12">
                            <div class="d-flex gap-2">
                                <button class="btn btn-primary" onclick="applyFilters()">
                                    <i class="fas fa-search"></i> Áp dụng
                                </button>
                                <button class="btn btn-outline-secondary" onclick="clearFilters()">
                                    <i class="fas fa-times"></i> Xóa bộ lọc
                                </button>
                                <button class="btn btn-outline-info" onclick="loadOrders()">
                                    <i class="fas fa-sync-alt"></i> Làm mới
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Insert filters before orders grid
    const ordersGrid = document.getElementById('ordersGrid');
    if (ordersGrid && !document.getElementById('filtersSection')) {
        ordersGrid.insertAdjacentHTML('beforebegin', filtersHTML);
    }
}
function initializePagination() {
    const paginationHTML = `
        <!-- Pagination -->
        <div class="pagination-section mt-4" id="paginationSection">
            <div class="row">
                <div class="col-md-6">
                    <div class="text-muted">
                        <small id="paginationInfo">Hiển thị 0 đơn hàng</small>
                    </div>
                </div>
                <div class="col-md-6">
                    <nav aria-label="Orders pagination">
                        <ul class="pagination justify-content-end mb-0" id="paginationList">
                            <!-- Pagination will be generated here -->
                        </ul>
                    </nav>
                </div>
            </div>
        </div>
    `;

    // Insert pagination after orders grid
    const ordersGrid = document.getElementById('ordersGrid');
    if (ordersGrid && !document.getElementById('paginationSection')) {
        ordersGrid.insertAdjacentHTML('afterend', paginationHTML);
    }
}


// Toggle filters visibility
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

// Apply filters and reload orders
function applyFilters() {
    currentPage = 0; // Reset to first page when applying filters
    loadOrders();
}

// Clear all filters
function clearFilters() {
    // Reset filter values
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

    // Reset pagination
    currentPage = 0;

    console.log('Filters cleared');
    loadOrders();
}

// Updated showOrders function
function showOrders() {
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = 'Quản Lý Đơn Hàng';
    }

    updateActiveNav('orders');
    initializeFilters();
    initializePagination(); // Initialize pagination after orders grid
    loadOrders();
}

// Load orders with current filters and pagination
async function loadOrdersWithFilters() {
    if (isReloading) return;

    try {
        isReloading = true;

        // Show loading
        const ordersGrid = document.getElementById('ordersGrid');
        if (ordersGrid) {
            ordersGrid.innerHTML = '<div class="text-center"><div class="loading"></div> Đang tải đơn hàng...</div>';
        }

        // Build query parameters
        const params = new URLSearchParams();

        if (currentFilters.status) params.append('status', currentFilters.status);
        if (currentFilters.tableId) params.append('tableId', currentFilters.tableId);
        if (currentFilters.minPrice) params.append('minPrice', currentFilters.minPrice);
        if (currentFilters.maxPrice) params.append('maxPrice', currentFilters.maxPrice);
        params.append('page', currentFilters.page);
        params.append('size', currentFilters.size);
        params.append('SorderBy', currentFilters.sortBy);
        params.append('sort', currentFilters.sort);

        console.log('Fetching orders with params:', params.toString());

        const data = await apiFetch(`/orders?${params.toString()}`, {
            method: 'GET',
        });

        console.log('Filtered API Response:', data);

        if (data.code === 0 && data.result) {
            const pageData = data.result;
            ordersData = pageData.content || [];

            renderOrders(ordersData);
            renderPagination(pageData);
            updatePaginationInfo(pageData);
            updateStats();

            console.log('Filtered orders loaded successfully:', ordersData.length);
        } else {
            throw new Error('Invalid response format or no data');
        }
    } catch (error) {
        console.error('Error loading filtered orders:', error);

        const ordersGrid = document.getElementById('ordersGrid');
        if (ordersGrid) {
            ordersGrid.innerHTML = `
                <div class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle mb-2"></i>
                    <div>Lỗi tải dữ liệu đơn hàng</div>
                    <small>${error.message}</small>
                    <div class="mt-2">
                        <button class="btn btn-outline-primary btn-sm" onclick="loadOrdersWithFilters()">
                            <i class="fas fa-refresh"></i> Thử lại
                        </button>
                    </div>
                </div>
            `;
        }
    } finally {
        isReloading = false;
    }
}

// Render pagination controls
function renderPagination(pageData) {
    const paginationList = document.getElementById('paginationList');
    if (!paginationList || !pageData) return;

    const { number: currentPage, totalPages, first, last } = pageData;
    let paginationHTML = '';

    // Previous button
    paginationHTML += `
        <li class="page-item ${first ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;

    // Page numbers
    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages - 1, currentPage + 2);

    // First page
    if (startPage > 0) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(0)">1</a>
            </li>
        `;
        if (startPage > 1) {
            paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    // Page range
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i + 1}</a>
            </li>
        `;
    }

    // Last page
    if (endPage < totalPages - 1) {
        if (endPage < totalPages - 2) {
            paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(${totalPages - 1})">${totalPages}</a>
            </li>
        `;
    }

    // Next button
    paginationHTML += `
        <li class="page-item ${last ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;

    paginationList.innerHTML = paginationHTML;
}

// Change page
function changePage(pageNumber) {
    if (pageNumber < 0 || pageNumber >= totalPages || pageNumber === currentPage) {
        return;
    }

    currentPage = pageNumber;
    loadOrders();
}

// Update pagination info
function updatePaginationInfo(pageData) {
    const paginationInfo = document.getElementById('paginationInfo');
    if (!paginationInfo || !pageData) return;

    const { number: currentPage, size, totalElements, numberOfElements } = pageData;
    const startItem = currentPage * size + 1;
    const endItem = currentPage * size + numberOfElements;

    paginationInfo.textContent = `Hiển thị ${startItem}-${endItem} trong tổng số ${totalElements} đơn hàng`;
}

// Enhanced loadOrders function to work with filters
async function loadOrders() {
    try {
        // Get filter values - với null checks
        const statusFilter = document.getElementById('statusFilter');
        const tableIdFilter = document.getElementById('tableIdFilter');
        const minPriceFilter = document.getElementById('minPriceFilter');
        const maxPriceFilter = document.getElementById('maxPriceFilter');
        const sortByFilter = document.getElementById('sortByFilter');
        const sortDirectionFilter = document.getElementById('sortDirectionFilter');
        const pageSizeFilter = document.getElementById('pageSizeFilter');

        const status = statusFilter ? statusFilter.value : '';
        const tableId = tableIdFilter ? tableIdFilter.value : '';
        const minPrice = minPriceFilter ? minPriceFilter.value : '';
        const maxPrice = maxPriceFilter ? maxPriceFilter.value : '';
        const sortBy = sortByFilter ? sortByFilter.value || 'createdAt' : 'createdAt';
        const sortDirection = sortDirectionFilter ? sortDirectionFilter.value || 'DESC' : 'DESC';
        const pageSize = pageSizeFilter ? pageSizeFilter.value || '10' : '10';

        // Show loading
        const ordersGrid = document.getElementById('ordersGrid');
        if (ordersGrid) {
            ordersGrid.innerHTML = '<div class="text-center"><div class="loading"></div> Đang tải đơn hàng...</div>';
        }

        // Build query parameters
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (tableId) params.append('tableId', tableId);
        if (minPrice) params.append('minPrice', minPrice);
        if (maxPrice) params.append('maxPrice', maxPrice);
        params.append('page', currentPage.toString());
        params.append('size', pageSize);
        params.append('SorderBy', sortBy); // Note: backend uses 'SorderBy'
        params.append('sort', sortDirection);

        console.log('Fetching orders with params:', params.toString());

        // Fetch orders with filters
        const data = await apiFetch(`/orders?${params.toString()}`, {
            method: 'GET'
        });

        console.log('API Response:', data);

        if (data.code === 0 && data.result) {
            const orderPage = data.result;
            const orders = orderPage.content || [];

            // Update pagination info
            totalPages = orderPage.totalPages;
            totalElements = orderPage.totalElements;
            currentPage = orderPage.number;

            // Store orders data
            ordersData = orders;

            // Render orders
            renderOrders(orders);
            updateSummary(orderPage);
            updatePagination();
            updateStats();

            console.log('Orders loaded successfully:', orders.length);
        } else {
            throw new Error('Invalid response format or no data');
        }

    } catch (error) {
        console.error('Error fetching orders:', error);
        showErrorState(error.message);
    }
}
function updateSummary(orderPage) {
    const paginationInfo = document.getElementById('paginationInfo');
    if (!paginationInfo || !orderPage) return;

    const { number: currentPageNum, size, totalElements, numberOfElements } = orderPage;
    const startItem = currentPageNum * size + 1;
    const endItem = currentPageNum * size + numberOfElements;

    if (totalElements > 0) {
        paginationInfo.textContent = `Hiển thị ${startItem}-${endItem} trong tổng số ${totalElements} đơn hàng`;
    } else {
        paginationInfo.textContent = 'Không có đơn hàng nào';
    }
}

function updatePagination() {
    const paginationList = document.getElementById('paginationList');
    if (!paginationList || totalPages <= 1) {
        if (paginationList) paginationList.innerHTML = '';
        return;
    }

    const isFirst = currentPage === 0;
    const isLast = currentPage === totalPages - 1;
    let paginationHTML = '';

    // Previous button
    paginationHTML += `
        <li class="page-item ${isFirst ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;

    // Page numbers
    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages - 1, currentPage + 2);

    // First page
    if (startPage > 0) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(0)">1</a>
            </li>
        `;
        if (startPage > 1) {
            paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    // Page range
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i + 1}</a>
            </li>
        `;
    }

    // Last page
    if (endPage < totalPages - 1) {
        if (endPage < totalPages - 2) {
            paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(${totalPages - 1})">${totalPages}</a>
            </li>
        `;
    }

    // Next button
    paginationHTML += `
        <li class="page-item ${isLast ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;

    paginationList.innerHTML = paginationHTML;
}

function showErrorState(errorMessage) {
    const ordersGrid = document.getElementById('ordersGrid');
    if (ordersGrid) {
        ordersGrid.innerHTML = `
            <div class="text-center text-danger">
                <i class="fas fa-exclamation-triangle mb-2"></i>
                <div>Lỗi tải dữ liệu đơn hàng</div>
                <small>${errorMessage}</small>
                <div class="mt-2">
                    <button class="btn btn-outline-primary btn-sm" onclick="loadOrders()">
                        <i class="fas fa-refresh"></i> Thử lại
                    </button>
                </div>
            </div>
        `;
    }
}
// Check if any filters are active
function hasActiveFilters() {
    return currentFilters.status !== '' ||
        currentFilters.tableId !== '' ||
        currentFilters.minPrice !== '' ||
        currentFilters.maxPrice !== '' ||
        currentFilters.sortBy !== 'createdAt' ||
        currentFilters.sort !== 'DESC' ||
        currentFilters.size !== 10;
}

// Enhanced showOrders function to initialize filters
function showOrders() {
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = 'Quản Lý Đơn Hàng';
    }

    updateActiveNav('orders');
    initializeFilters();
    loadOrders();
}

// Enhanced showDashboard function to initialize filters
function showDashboard() {
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = 'Tổng Quan - Ca Làm Việc';
    }

    updateActiveNav('dashboard');
    initializeFilters();
    initializePagination(); // Initialize pagination after orders grid
    loadOrders();
}

// Update active navigation
function updateActiveNav(section) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    const navMap = {
        'dashboard': 0,
        'orders': 1,
        'tables': 2,
        'reports': 3
    };

    const navLinks = document.querySelectorAll('.nav-link');
    if (navLinks[navMap[section]]) {
        navLinks[navMap[section]].classList.add('active');
    }
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

// Smart auto refresh - only refresh when data changes
let refreshInterval;

function startSmartRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);

    refreshInterval = setInterval(async () => {
        if (ordersData.length > 0 && !isReloading) {
            await loadOrders(true); // Auto-refresh mode
        }
    }, 30000); // 30 seconds
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Kitchen Dashboard initialized');
    showDashboard();
    startSmartRefresh();
});

// Stop refresh when page is hidden
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        if (refreshInterval) clearInterval(refreshInterval);
    } else {
        startSmartRefresh();
    }
});