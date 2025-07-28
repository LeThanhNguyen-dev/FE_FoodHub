// Global variables
let ordersData = [];
let isReloading = false;
let lastUpdateTime = null;


let currentPage = 0;
let totalPages = 0;
let totalElements = 0;
let pageSize = '20';
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
        timeElement.textContent = formatDateTime(order.createdAt);
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

        // Kiểm tra xem ordersGrid có tồn tại không
        const ordersGrid = document.getElementById('ordersGrid');
        if (!ordersGrid) {
            console.error('Orders grid element not found');
            return;
        }

        // Get filter values - với null checks
        const statusFilter = document.getElementById('statusFilter');
        const tableIdFilter = document.getElementById('tableIdFilter');
        const sortByFilter = document.getElementById('sortByFilter');
        const sortDirectionFilter = document.getElementById('sortDirectionFilter');
        console.log('sort by filter: ', sortByFilter.value);
        const status = statusFilter ? statusFilter.value : '';
        const tableId = tableIdFilter ? tableIdFilter.value : '';
        const sortBy = sortByFilter ? sortByFilter.value || 'updatedOrCreatedAt' : 'updatedOrCreatedAt';
        const sortDirection = sortDirectionFilter ? sortDirectionFilter.value || 'DESC' : 'DESC';

        // Chỉ show loading khi không có dữ liệu và không phải auto refresh
        if (!isAutoRefresh && (!ordersData || ordersData.length === 0)) {
            ordersGrid.innerHTML = '<div class="text-center"><div class="loading"></div> Đang tải đơn hàng...</div>';
        }

        // Luôn sử dụng API có pagination và sorting
        const params = new URLSearchParams();

        // Thêm filters nếu có
        if (status) params.append('status', status);
        if (tableId) params.append('tableId', tableId);

        // Luôn thêm pagination và sorting parameters
        params.append('page', (currentPage || 0).toString());
        params.append('size', pageSize);
        params.append('orderBy', sortBy);
        params.append('sort', sortDirection);
        console.log('sort by: ', sortBy);
        if (currentWorkSchedule && currentWorkSchedule.startTime) {
            params.append('startTime', currentWorkSchedule.startTime);
        }
        console.log('Fetching orders with pagination and sorting:', params.toString());
        const data = await apiFetch(`/orders/chef/work-shift-orders/${currentUserInfo.id}?${params.toString()}`, { method: 'GET' });

        console.log('API Response:', data);

        if (data.code === 0 && data.result) {
            // Paginated response
            const orderPage = data.result;
            const orders = orderPage.content || [];

            // Update pagination info
            if (typeof totalPages !== 'undefined') totalPages = orderPage.totalPages || 0;
            if (typeof totalElements !== 'undefined') totalElements = orderPage.totalElements || 0;
            if (typeof currentPage !== 'undefined') currentPage = orderPage.number || 0;

            // Update additional components if functions exist
            if (typeof updateSummary === 'function') updateSummary(orderPage);
            if (typeof updatePagination === 'function') updatePagination();

            // Check if data has changed for auto refresh
            if (isAutoRefresh && typeof hasOrdersChanged === 'function' && !hasOrdersChanged(orders, ordersData)) {
                console.log('No changes detected, skipping render');
                return;
            }

            // Store orders data
            ordersData = orders;

            // Render orders
            renderOrders(orders);

            // Update stats if function exists
            if (typeof updateStats === 'function') updateStats();

            // Update last update time if exists
            if (typeof lastUpdateTime !== 'undefined') lastUpdateTime = new Date();

            console.log('Orders loaded successfully:', orders.length);
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

// Render orders with smooth animations
function renderOrders(orders) {
    const ordersGrid = document.getElementById('ordersGrid');

    if (!ordersGrid) {
        console.error('Orders grid element not found');
        return;
    }

    // Hiển thị tất cả đơn hàng bao gồm cả đơn đã hủy
    const allOrders = orders;

    if (allOrders.length === 0) {
        ordersGrid.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-clipboard-list fa-3x mb-3 opacity-50"></i>
                <div>Không có đơn hàng nào</div>
            </div>
        `;
        return;
    }

    const ordersHTML = allOrders.map(order => {
        // Show all items in the order
        const allItems = order.orderItems || [];

        const itemsHTML = allItems.map(item => `
            <div class="item-row">
                <div class="order-item-info">
                    <span class="item-name">${item.menuItemName || 'Món ăn'}</span>
                </div>
                <div class="item-quantity">
                    <span class="quantity-number">${item.quantity}</span>
                </div>
            </div>
        `).join('');

        // Calculate total items for display
        const totalItems = allItems.length;

        // Determine order type display
        function getOrderTypeDisplay(orderType, tableNumber) {
            switch (orderType) {
                case 'TAKEAWAY':
                    return '<i class="fas fa-shopping-bag"></i> Mang Về';
                case 'DELIVERY':
                    return '<i class="fas fa-motorcycle"></i> Giao Hàng';
                case 'DINE_IN':
                default:
                    return `<i class="fas fa-chair"></i> ${tableNumber || 'Bàn N/A'}`;
            }
        }

        return `
            <div class="order-card ${order.status === 'CANCELLED' ? 'cancelled-order' : ''}" data-order-id="${order.id}">
                <div class="order-header">
                    <div class="order-title-row">
                        <div class="order-number">
                            <span class="order-label">Order #${order.id.toString().padStart(3, '0')}</span>
                        </div>
                        <div class="order-time">
                            <span>${formatDateTime(order.createdAt)}</span>
                        </div>
                    </div>
                    
                    <div class="order-meta">
                        <div class="item-count">
                            <span>${totalItems} món</span>
                        </div>
                        <div class="customer-info">
                            ${getOrderTypeDisplay(order.orderType, order.tableNumber)}
                        </div>
                    </div>
                    
                    <div class="status-row">
                        <span class="status-badge status-${order.status}">
                            ${statusTranslations[order.status] || order.status}
                        </span>
                    </div>
                </div>
                
                <div class="order-items">
                    <div class="items-header">
                        <span class="header-item">TÊN MÓN</span>
                        <span class="header-qty">SL</span>
                    </div>
                    ${itemsHTML}
                </div>
                
                <div class="order-actions">
                    ${order.status === 'CANCELLED' ?
                '<div class="cancelled-notice"><i class="fas fa-ban"></i> Đơn hàng đã bị hủy</div>' :
                `<button class="btn btn-preparing" onclick="updateOrderStatus(${order.id}, 'PREPARING')">
                            <i class="fas fa-fire"></i> Bắt Đầu Nấu
                        </button>
                        <button class="btn btn-ready" onclick="updateOrderStatus(${order.id}, 'READY')">
                            <i class="fas fa-check"></i> Sẵn Sàng
                        </button>`
            }
                    <button class="btn btn-details" onclick="viewOrderDetails(${order.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    ordersGrid.innerHTML = ordersHTML;
}

function calculateAverageTime() {
    console.log("Calculating average cooking time...");

    const readyOrders = ordersData.filter(order => order.status === 'READY');
    console.log("ready orders: ", readyOrders.length);
    if (readyOrders.length === 0) {
        return '0p';
    }

    let totalTime = 0;
    let validOrders = 0;

    readyOrders.forEach(order => {
        if (order.createdAt && order.updatedAt) {
            const createdTime = new Date(order.createdAt);
            const updatedTime = new Date(order.updatedAt);
            const timeDiff = (updatedTime - createdTime) / (1000 * 60);

            if (timeDiff >= 5 && timeDiff <= 60) {
                totalTime += timeDiff;
                validOrders++;
            }
        }
    });

    if (validOrders === 0) {
        return '0p';
    }

    const avgMinutes = Math.round(totalTime / validOrders);
    return `${avgMinutes}p`;
}


// Update statistics with smooth animations
function updateStats() {
    console.log("in updateStats");
    const pendingCount = ordersData.filter(order => order.status === 'PENDING').length;
    const preparingCount = ordersData.filter(order => order.status === 'PREPARING').length;
    const readyCount = ordersData.filter(order => order.status === 'READY').length;
    console.log("pending: ", pendingCount);
    // Calculate average cooking time (mock calculation for now)
    const avgTime = calculateAverageTime();

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
        id, status, orderType, createdAt, updatedAt, note,
        tableNumber, username, totalAmount, orderItems
    } = orderData;

    // Format dữ liệu
    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'Chưa cập nhật';

        // Parse date string trực tiếp mà không để JS tự động chuyển đổi timezone
        const date = new Date(dateStr.replace('Z', ''));

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
    };

    const formattedDateCreation = formatDateTime(createdAt);
    const formattedDateUpdate = formatDateTime(updatedAt);
    const formattedAmount = formatCurrency(totalAmount);

    // Tạo HTML cho danh sách món ăn với ghi chú
    const orderItemsHtml = orderItems.map(item => {
        const itemNoteHtml = (item.note && item.note.trim() !== '')
            ? `<div class="item-note">Ghi chú: ${item.note}</div>`
            : '';

        return `
            <div class="order-item">
                <div class="order-item-info">
                    <strong>${item.menuItemName}</strong>
                    <span class="item-details">SL: ${item.quantity} × ${formatCurrency(item.price)}</span>
                    ${itemNoteHtml}
                </div>
                <div class="item-status">
                    <span class="badge ${getStatusBadgeClass(item.status)}">${getStatusText(item.status)}</span>
                </div>
            </div>
        `;
    }).join('');

    // Tạo nội dung modal với animation
    const modalHtml = `
        <div class="modal-overlay" onclick="closeOrderDetails()">
      <div class="modal-content" onclick="event.stopPropagation()">
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
              <span>Thời gian tạo:</span>
              <span>${formattedDateCreation}</span>
            </div>
            <div class="info-row">
              <span>Thời gian cập nhật:</span>
              <span>${formattedDateUpdate}</span>
            </div>
            <div class="info-row">
              <span>Bàn:</span>
              <span>${tableNumber || 'Mang về'}</span>
            </div>
            <div class="info-row">
              <span>Khách hàng:</span>
              <span>${username}</span>
            </div>
            <div class="info-row">
              <span>Ghi chú:</span>
              <span>${note}</span>
            </div>
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
          <button class="btn btn-primary" onclick="updateOrderItemsStatus(${id})">
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
            z-index: 9999;
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
            background: #f8f9fa;
            transition: all 0.3s ease;
        }
        .order-item:hover {
            background-color: #f0f0f0;
        }
        .order-item .order-item-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .order-item-info strong {
            font-weight: bold;
            color: #333;
            font-size: 14px;
        }
        .item-details {
            color: #666;
            font-size: 13px;
        }
        .item-note {
            color: #888;
            font-size: 0.9em;
            margin-top: 4px;
            border-radius: 3px;
            display: inline-block;
            max-width: fit-content;
        }
        .item-status {
            display: flex;
            align-items: center;
            margin-left: 10px;
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
            color: white;
            border: none;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* Warning Badge - Yellow/Orange */
        .badge.bg-warning {
            background: linear-gradient(135deg, #f59e0b, #d97706);
        }

        /* Primary Badge - Orange */
        .badge.bg-primary {
            background: linear-gradient(135deg, #ea580c, #f97316);
        }

        /* Success Badge - Green */
        .badge.bg-success {
            background: linear-gradient(135deg, #10b981, #059669);
        }

        /* Danger Badge - Red */
        .badge.bg-danger {
            background: linear-gradient(135deg, #ef4444, #dc2626);
        }

        /* Info Badge - Blue */
        .badge.bg-info {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
        }

        /* Secondary Badge - Gray */
        .badge.bg-secondary {
            background: linear-gradient(135deg, #6b7280, #4b5563);
        }

        /* Dark Badge - Dark Gray/Black */
        .badge.bg-dark {
            background: linear-gradient(135deg, #374151, #1f2937);
        }

        /* Light Badge - Light Gray (with dark text) */
        .badge.bg-light {
            background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
            color: #374151;
            text-shadow: none;
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
        // Tạo message xác nhận dựa trên status
        const statusMessages = {
            'PENDING': 'chờ xử lý',
            'CONFIRMED': 'xác nhận',
            'PREPARING': 'đang chuẩn bị',
            'READY': 'sẵn sàng',
            'SERVED': 'đã phục vụ',
            'COMPLETED': 'hoàn thành',
            'CANCELLED': 'hủy'
        };

        const statusText = statusMessages[newStatus] || newStatus;
        const confirmMessage = `Bạn có chắc chắn muốn chuyển đơn hàng #${orderId} sang trạng thái "${statusText}"?`;

        // Hiển thị alert xác nhận
        if (!confirm(confirmMessage)) {
            return; // User cancelled, exit function
        }

        console.log(`Updating order ${orderId} to status: ${newStatus}`);

        // Hiển thị notification đang xử lý
        showNotification(`Đang cập nhật trạng thái đơn hàng #${orderId}...`, 'info');

        const data = await apiFetch(`/orders/status/${orderId}?status=${newStatus}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });

        if (data && data.code === 0) {
            console.log('Order status updated successfully');

            // Hiển thị notification thành công
            showNotification(`Đã cập nhật đơn hàng #${orderId} sang trạng thái "${statusText}" thành công!`, 'success');

            // Reload orders to reflect changes
            await loadOrders(true); // Use auto-refresh mode

            // Close modal if open
            closeOrderDetails();
        } else {
            throw new Error(data?.message || 'Failed to update order status');
        }

    } catch (error) {
        console.error('Error updating order status:', error);

        // Hiển thị notification lỗi
        showNotification(`Có lỗi xảy ra khi cập nhật trạng thái đơn hàng #${orderId}: ${error.message}`, 'error');
    }
}

async function updateOrderItemsStatus(orderId) {
    try {
        // Lấy thông tin đơn hàng hiện tại để hiển thị các order items
        const orderData = await apiFetch(`/orders/${orderId}`, {
            method: 'GET'
        });

        if (orderData && orderData.code === 0 && orderData.result) {
            showOrderItemsStatusModal(orderData.result);
        } else {
            alert('Không thể lấy thông tin đơn hàng!');
        }
    } catch (error) {
        console.error('Error fetching order for status update:', error);
        alert('Có lỗi xảy ra khi lấy thông tin đơn hàng: ' + error.message);
    }
}

function showOrderItemsStatusModal(orderData) {
    const { id, orderItems } = orderData;

    // Tạo HTML cho danh sách order items
    const orderItemsOptions = orderItems.map(item => `
        <div class="order-item-option" data-item-id="${item.id}">
            <div class="order-item-info">
                <input type="checkbox" id="item_${item.id}" value="${item.id}">
                <label for="item_${item.id}">
                    <strong>${item.menuItemName}</strong>
                    <span class="item-details">SL: ${item.quantity} - Trạng thái hiện tại: 
                        <span class="badge ${getStatusBadgeClass(item.status)}">${getStatusText(item.status)}</span>
                    </span>
                </label>
            </div>
        </div>
    `).join('');

    // Tạo options cho status
    const statusOptions = [
        { value: 'PREPARING', text: 'Bắt đầu nấu' },
        { value: 'READY', text: 'Hoàn thành' }
    ];

    const statusOptionsHtml = statusOptions.map(option =>
        `<option value="${option.value}">${option.text}</option>`
    ).join('');

    const modalHtml = `
        <div class="modal-overlay" onclick="closeStatusUpdateModal()">
            <div class="modal-content status-update-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Cập nhật trạng thái đơn hàng #${id}</h3>
                    <button class="btn-close" onclick="closeStatusUpdateModal()">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="form-group">
                        <label><strong>Chọn món ăn cần cập nhật:</strong></label>
                        <div class="order-items-selection">
                            <div class="select-all-option">
                                <input type="checkbox" id="selectAll" onchange="toggleSelectAll()">
                                <label for="selectAll"><strong>Chọn tất cả</strong></label>
                            </div>
                            ${orderItemsOptions}
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="newStatus"><strong>Trạng thái mới:</strong></label>
                        <select id="newStatus" class="form-control">
                            <option value="">-- Chọn trạng thái --</option>
                            ${statusOptionsHtml}
                        </select>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="executeStatusUpdate()">
                        Cập nhật trạng thái
                    </button>
                    <button class="btn btn-secondary" onclick="closeStatusUpdateModal()">
                        Hủy
                    </button>
                </div>
            </div>
        </div>
    `;

    // Thêm CSS cho modal status update
    addStatusUpdateModalStyles();

    // Hiển thị modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const itemCheckboxes = document.querySelectorAll('.order-item-option input[type="checkbox"]');

    itemCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

async function executeStatusUpdate() {
    const selectedItems = Array.from(document.querySelectorAll('.order-item-option input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);

    const newStatus = document.getElementById('newStatus').value;

    if (selectedItems.length === 0) {
        alert('Vui lòng chọn ít nhất một món ăn!');
        return;
    }

    if (!newStatus) {
        alert('Vui lòng chọn trạng thái mới!');
        return;
    }

    try {
        // Hiển thị loading
        const updateBtn = document.querySelector('.status-update-modal .btn-primary');
        const originalText = updateBtn.innerHTML;
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Đang cập nhật...';
        updateBtn.disabled = true;

        // Gọi API để cập nhật từng item
        const updatePromises = selectedItems.map(itemId =>
            apiFetch(`/orders/items/status/${itemId}?status=${newStatus}`, {
                method: 'PUT'
            })
        );

        const results = await Promise.all(updatePromises);

        // Kiểm tra kết quả
        const failedUpdates = results.filter(result => result.code !== 0);

        if (failedUpdates.length === 0) {
            alert(`Cập nhật trạng thái thành công cho ${selectedItems.length} món ăn!`);
            closeStatusUpdateModal();

            // Refresh orders list và close order details modal
            await loadOrders();
            closeOrderDetails();
        } else {
            alert(`Có ${failedUpdates.length} món ăn không thể cập nhật. Vui lòng thử lại!`);
        }

    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Có lỗi xảy ra khi cập nhật trạng thái: ' + error.message);
    } finally {
        // Restore button
        const updateBtn = document.querySelector('.status-update-modal .btn-primary');
        if (updateBtn) {
            updateBtn.innerHTML = 'Cập nhật trạng thái';
            updateBtn.disabled = false;
        }
    }
}

// Hàm mới: Đóng modal cập nhật trạng thái
function closeStatusUpdateModal() {
    const modal = document.querySelector('.modal-overlay:has(.status-update-modal)');
    if (modal) {
        modal.remove();
    }
}

// Hàm mới: Thêm CSS cho modal cập nhật trạng thái
function addStatusUpdateModalStyles() {
    if (document.getElementById('statusUpdateModalStyles')) return;

    const styles = `
        <style id="statusUpdateModalStyles">
        .status-update-modal {
            max-width: 700px;
        }
        .order-items-selection {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
        }
        .select-all-option {
            padding: 10px;
            border-bottom: 2px solid #007bff;
            margin-bottom: 10px;
        }
        .select-all-option label {
            color: #007bff;
        }
        .order-item-option {
            padding: 8px;
            border-bottom: 1px solid #eee;
            margin-bottom: 5px;
        }
        .order-item-option:last-child {
            border-bottom: none;
        }
        .order-item-option label {
            display: block;
            cursor: pointer;
            margin-left: 8px;
        }
        .order-item-option input[type="checkbox"] {
            margin-right: 8px;
        }
        .item-details {
            color: #666;
            font-size: 14px;
            display: block;
            margin-top: 4px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
        }
        .form-control {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        .form-control:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
        }
        </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
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
    sortBy: 'updatedOrCreatedAt',
    sort: 'DESC'
};

// Initialize filters UI
function initializeFilters() {
    const filtersHTML = `
        <div class="filters-section mb-4" id="filtersSection">
            <div class="card">
                <div class="card-body">
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
                                <option value="CANCELLED">Đã Hủy</option>
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

                        <!-- Sort Options -->
                        <div class="col-md-3">
                            <label class="form-label">
                                <i class="fas fa-sort"></i> Sắp xếp theo
                            </label>
                            <select class="form-select" id="sortByFilter" onchange="applyFilters()">
                                <option value="updatedOrCreatedAt" selected>Mặc định</option>
                                <option value="createdAt">Thời gian tạo</option>
                                <option value="totalAmount">Tổng tiền</option>
                                <option value="tableNumber">Số bàn</option>
                                <option value="status">Trạng thái</option>
                            </select>

                        </div>

                        <div class="col-md-3">
                            <label class="form-label">
                                <i class="fas fa-arrows-alt-v"></i> Thứ tự
                            </label>
                            <select class="form-select" id="sortDirectionFilter" onchange="applyFilters()">
                                <option value="DESC">Giảm dần</option>
                                <option value="ASC">Tăng dần</option>
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
                                <button class="btn btn-outline-success" onclick="loadOrders()">
                                    <i class="fas fa-sync-alt"></i> Làm mới
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Insert filters before orders grid trong dynamicContent
    const ordersGrid = document.getElementById('ordersGrid');
    if (ordersGrid && !document.getElementById('filtersSection')) {
        ordersGrid.insertAdjacentHTML('beforebegin', filtersHTML);
    }
}

// Hàm initializePagination được sửa lại
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

    // Insert pagination after orders grid trong dynamicContent
    const ordersGrid = document.getElementById('ordersGrid');
    if (ordersGrid && !document.getElementById('paginationSection')) {
        ordersGrid.insertAdjacentHTML('afterend', paginationHTML);
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

    if (statusFilter) statusFilter.value = '';
    if (tableIdFilter) tableIdFilter.value = '';
    if (minPriceFilter) minPriceFilter.value = '';
    if (maxPriceFilter) maxPriceFilter.value = '';
    if (sortByFilter) sortByFilter.value = 'updatedOrCreatedAt';
    if (sortDirectionFilter) sortDirectionFilter.value = 'DESC';

    // Reset pagination
    currentPage = 0;

    console.log('Filters cleared');
    loadOrders();
}

// Updated showOrders function
async function loadOrdersContent() {
    const dynamicContent = document.getElementById('dynamicContent');

    // Tạo HTML structure cho orders (giữ nguyên class để CSS hoạt động)
    const ordersHTML = `
        <!-- Orders Section -->
        <div class="orders-section">
            <!-- Filters Section sẽ được inject ở đây -->
            
            <div class="orders-grid" id="ordersGrid">
                <div class="text-center">
                    <div class="loading"></div> Đang tải đơn hàng...
                </div>
            </div>

            <!-- Pagination Section sẽ được inject ở đây -->
        </div>
    `;

    // Load HTML vào dynamicContent
    dynamicContent.innerHTML = ordersHTML;

    // Đợi một chút để DOM được render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initialize filters và pagination
    initializeFilters();
    initializePagination();

    // Load orders data
    await loadOrders();
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
        // Kiểm tra nếu không có lịch làm việc
        if (!hasWorkSchedule) {
            ordersGrid.innerHTML = `
                <div class="d-flex justify-content-center align-items-center" style="min-height: 400px;">
                    <div class="text-center">
                        <div class="mb-4">
                            <i class="fas fa-calendar-times fa-4x text-muted mb-3"></i>
                        </div>
                        <h5 class="text-muted mb-3">Hiện tại bạn không đang trong ca làm việc</h5>
                        <p class="text-muted mb-4">
                            Bạn không thể xem đơn hàng khi không có ca làm việc được phân công.
                        </p>
                    </div>
                </div>
            `;
        } else {
            // Hiển thị lỗi bình thường khi có lịch làm việc
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
}

// Check if any filters are active
function hasActiveFilters() {
    return currentFilters.status !== '' ||
        currentFilters.tableId !== '' ||
        currentFilters.minPrice !== '' ||
        currentFilters.maxPrice !== '' ||
        currentFilters.sortBy !== 'updatedOrCreatedAt' ||
        currentFilters.sort !== 'DESC' ||
        currentFilters.size !== 10;
}

// Enhanced showOrders function to initialize filters
async function showOrders() {
    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = 'Quản Lý Đơn Hàng';
    }

    // Show dynamic content and hide others
    document.getElementById('dashboardContent').style.display = 'none';
    document.getElementById('dynamicContent').style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';

    // Update active navigation
    updateActiveNav('orders');

    // Load orders content into dynamicContent
    await loadOrdersContent();
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
document.addEventListener('DOMContentLoaded', function () {
    console.log('Kitchen Dashboard initialized');
    showDashboard();
    startSmartRefresh();
});

// Stop refresh when page is hidden
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        if (refreshInterval) clearInterval(refreshInterval);
    } else {
        startSmartRefresh();
    }
});




// NEW FUNCTION: Lấy icon cho notification
function getNotificationIcon(type) {
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    return icons[type] || 'fa-info-circle';
}