async function showOrders() {
    hideCartSidebar();
    try {
        // Update page title and toggle visibility
        document.getElementById('pageTitle').textContent = 'Quản lý đơn hàng';
        document.getElementById('dashboardContent').style.display = 'none';
        document.getElementById('dynamicContent').style.display = 'block';

        // Fetch order.html
        const response = await fetch('/waiter/order.html');
        if (!response.ok) {
            throw new Error('Không thể tải order.html');
        }
        const htmlContent = await response.text();

        // Create a temporary container to parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Get the orders page template
        const template = doc.getElementById('ordersPageTemplate').content.cloneNode(true);

        // Append all related templates to the main document
        const templates = [
            'ordersPageTemplate',
            'loadingTemplate',
            'emptyStateTemplate',
            'errorStateTemplate',
            'orderRowTemplate',
            'orderDetailsModalTemplate',
            'orderItemTemplate'
        ];
        templates.forEach(templateId => {
            const templateElement = doc.getElementById(templateId);
            if (templateElement) {
                document.body.appendChild(templateElement.cloneNode(true));
            }
        });

        // Clear dynamicContent and append the main template
        document.getElementById('dynamicContent').innerHTML = '';
        document.getElementById('dynamicContent').appendChild(template);

        // Extract and render the template
        renderOrdersTemplate();

        // Initialize and load orders after template is loaded
        await loadOrders();

        // Update navigation active state
        updateActiveNavigation('showOrders()');

        // Setup event listeners after template is loaded
        setupEventListeners();

        // Start auto refresh when entering orders page
        startAutoRefresh();

    } catch (error) {
        console.error('Error loading orders page:', error);
        document.getElementById('dynamicContent').innerHTML = `
            <div class="alert alert-danger">
                <h4>Không thể tải trang quản lý đơn hàng</h4>
                <p>Lỗi: ${error.message}</p>
                <button class="btn btn-primary" onclick="showOrders()">Thử lại</button>
            </div>
        `;
    }
}
// Render the orders template from HTML template
function renderOrdersTemplate() {
    const template = document.getElementById('ordersPageTemplate');
    if (template) {
        const dynamicContent = document.getElementById('dynamicContent');
        if (dynamicContent) {
            dynamicContent.innerHTML = template.innerHTML;
        }
    }
}

// Setup event listeners after HTML is loaded
async function setupEventListeners() {
    console.log('=== setupEventListeners() được gọi ===');
    
    // Setup jump to page input event listener
    const jumpInput = document.getElementById('jumpToOrderPage');
    if (jumpInput) {
        jumpInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                jumpToOrderPage();
            }
        });
    }

    // Setup filter change listeners
    const filterElements = [
        'orderStatusFilter', 'tableNumberFilter',
        'sortByOrderFilter', 'sortDirectionOrderFilter'
    ];

    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', applyOrderFilters);
            console.log(`Đã setup listener cho ${id}`);
        } else {
            console.warn(`Không tìm thấy element ${id}`);
        }
    });

    // Gọi generateTableOptions trực tiếp để load danh sách bàn
    try {
        await generateTableOptions();
    } catch (error) {
        console.error('=== Lỗi khi load danh sách bàn ===', error);
    }
}





// Global variables for pagination
let currentOrderPage = 0; // Backend uses 0-based pagination
let totalOrderPages = 1;
let totalOrderElements = 0;
let currentOrderForAddItems = null;

// Load orders from API with filters and pagination
async function loadOrders() {
    try {
        // Get filter values
        const orderStatusFilter = document.getElementById('orderStatusFilter');
        const tableNumberFilter = document.getElementById('tableNumberFilter');
        const sortByOrderFilter = document.getElementById('sortByOrderFilter');
        const sortDirectionOrderFilter = document.getElementById('sortDirectionOrderFilter');

        const status = orderStatusFilter ? orderStatusFilter.value : '';
        const tableNumber = tableNumberFilter ? tableNumberFilter.value : ''; // Đã là tableNumber
        const sortBy = sortByOrderFilter ? sortByOrderFilter.value || 'createdAt' : 'createdAt';
        const sortDirection = sortDirectionOrderFilter ? sortDirectionOrderFilter.value || 'DESC' : 'DESC';
        const pageSize = '20';

        // Build query parameters
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (tableNumber) params.append('tableNumber', tableNumber); // Gửi tableNumber
        params.append('page', currentOrderPage.toString());
        params.append('size', pageSize);
        params.append('orderBy', sortBy);
        params.append('sort', sortDirection);

        // Add area and startTime from currentWorkSchedule
        if (currentWorkSchedule && currentWorkSchedule.area) {
            params.append('area', currentWorkSchedule.area);
        }
        if (currentWorkSchedule && currentWorkSchedule.startTime) {
            params.append('startTime', currentWorkSchedule.startTime);
        }

        // Fetch orders with filters
        const data = await apiFetch(`/orders?${params.toString()}`, {
            method: 'GET'
        });

        const orderPage = data.result;
        const orders = orderPage.content || [];

        // Update pagination info
        totalOrderPages = orderPage.totalPages;
        totalOrderElements = orderPage.totalElements;
        currentOrderPage = orderPage.number;

        // Render orders
        renderOrders(orders);
        updateSummary(orderPage);
        updatePagination();

    } catch (error) {
        console.error('Error fetching orders:', error);
        showErrorState(error.message);
    }
}



async function generateTableOptions() {
    try {
        
        // Lấy element filter trước khi gọi API
        const tableFilter = document.getElementById('tableNumberFilter');
        if (!tableFilter) {
            console.warn('Không tìm thấy element tableNumberFilter');
            return '<option value="">Element không tồn tại</option>';
        }

        // Lưu giá trị hiện tại
        const currentValue = tableFilter.value;
        
        // Hiển thị loading
        tableFilter.innerHTML = '<option value="">Đang tải danh sách bàn...</option>';
        
        // Gọi API /tables để lấy danh sách bàn
        const data = await apiFetch('/tables', {
            method: 'GET'
        });
        
        
        // Kiểm tra dữ liệu trả về
        if (!data || !data.result || !Array.isArray(data.result)) {
            console.error('Dữ liệu bàn không hợp lệ:', data);
            tableFilter.innerHTML = '<option value="">Không có dữ liệu bàn</option>';
            return '<option value="">Không có dữ liệu bàn</option>';
        }
        
        // Tạo danh sách tùy chọn từ dữ liệu API - sử dụng tableNumber làm value
        const options = data.result.map(table => {
            console.log('Xử lý bàn:', table); // Debug log
            return `<option value="${table.tableNumber}">Bàn ${table.tableNumber}</option>`;
        }).join('');
        
        console.log('Options được tạo:', options); // Debug log
        
        // Cập nhật trực tiếp vào dropdown filter
        const finalOptions = '<option value="">Tất cả bàn</option>' + options;
        tableFilter.innerHTML = finalOptions;
        
        // Khôi phục giá trị đã chọn trước đó (nếu có)
        if (currentValue) {
            tableFilter.value = currentValue;
            console.log('Đã khôi phục giá trị:', currentValue);
        }
        
        console.log('Đã cập nhật dropdown filter thành công');
        
        // Trả về options cho các mục đích khác (như showCart)
        return options;
        
    } catch (error) {
        console.error('Lỗi khi lấy danh sách bàn:', error);
        
        // Cập nhật UI hiển thị lỗi
        const tableFilter = document.getElementById('tableNumberFilter');
        if (tableFilter) {
            tableFilter.innerHTML = '<option value="">Lỗi tải danh sách bàn</option>';
        }
        
        // Trả về option lỗi
        return '<option value="">Lỗi tải danh sách bàn</option>';
    }
}



async function loadTableOptions() {
    try {
        const tableFilter = document.getElementById('tableNumberFilter');
        if (!tableFilter) {
            console.warn('Không tìm thấy element tableNumberFilter');
            return;
        }

        const currentValue = tableFilter.value; // Lưu giá trị hiện tại
        console.log('Giá trị hiện tại của filter:', currentValue);
        
        // Thêm loading indicator
        tableFilter.innerHTML = '<option value="">Đang tải danh sách bàn...</option>';
        
        // Lấy danh sách bàn - await đúng cách như trong showCart()
        const tableOptions = await generateTableOptions();
        console.log('Table options nhận được:', tableOptions);
        
        // Cập nhật dropdown với danh sách bàn
        const finalOptions = '<option value="">Tất cả bàn</option>' + tableOptions;
        tableFilter.innerHTML = finalOptions;
        
        // Khôi phục giá trị đã chọn trước đó (nếu có)
        if (currentValue) {
            tableFilter.value = currentValue;
            console.log('Đã khôi phục giá trị:', currentValue);
        }
        
        console.log('Load table options thành công');
        
    } catch (error) {
        console.error('Lỗi khi load danh sách bàn:', error);
        const tableFilter = document.getElementById('tableNumberFilter');
        if (tableFilter) {
            tableFilter.innerHTML = '<option value="">Lỗi tải danh sách bàn</option>';
        }
    }
}




// Apply filters and reload data
function applyOrderFilters() {
    currentOrderPage = 0; // Reset to first page when applying filters
    loadOrders();
    // Tạm dừng auto refresh khi người dùng thao tác filter
    pauseAutoRefreshTemporarily();
}


// Clear all filters
function clearFilters() {
    // Removed price filter elements and pageSizeOrderFilter from the array
    const filterElements = [
        { id: 'orderStatusFilter', value: '' },
        { id: 'tableNumberFilter', value: '' },
        { id: 'sortByOrderFilter', value: 'createdAt' },
        { id: 'sortDirectionOrderFilter', value: 'DESC' }
    ];

    filterElements.forEach(filter => {
        const element = document.getElementById(filter.id);
        if (element) {
            element.value = filter.value;
        }
    });

    applyOrderFilters();
}



// Render orders table
function renderOrders(orders) {
    const orderTableBody = document.getElementById('orderTableBody');

    if (!orderTableBody) {
        console.error('orderTableBody element not found');
        return;
    }

    if (orders.length === 0) {
        // Show empty state
        orderTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-orders-state">
                        <i class="fas fa-clipboard-list"></i>
                        <h4>Không tìm thấy đơn hàng nào</h4>
                        <p>Thử thay đổi bộ lọc để xem thêm kết quả.</p>
                        <button class="btn-orders-action btn-outline-secondary" onclick="clearFilters()">
                            <i class="fas fa-times me-2"></i>Xóa bộ lọc
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Clear table body
    orderTableBody.innerHTML = '';

    // Populate orders
    orders.forEach(order => {
        const row = document.createElement('tr');
        row.onclick = () => viewOrderDetails(order.id);
        row.className = 'order-row';

        // Tạo action buttons dựa trên trạng thái
        const actionButtons = createOrderActionButtons(order);

        row.innerHTML = `
            <td>
                <strong>#${order.id}</strong>
            </td>
            <td>
                <span class="table-number-badge">
                    <i class="fas fa-chair me-1"></i>
                    ${order.tableNumber ? `Bàn ${order.tableNumber}` : 'Mang về'}
                </span>
            </td>
            <td>
                <div class="order-time">
                    <i class="fas fa-clock"></i>
                    ${formatDateTime(order.createdAt)}
                </div>
            </td>
            <td>
                <div class="order-amount">
                    <i class="fas fa-money-bill"></i>
                    ${formatCurrency(order.totalAmount)}
                </div>
            </td>
            <td>
                <span class="status-badge-enhanced ${getStatusBadgeClass(order.status)}">
                    ${getStatusIcon(order.status)}
                    ${getStatusText(order.status)}
                </span>
            </td>
            <td>
                <span class="order-type-badge ${getOrderTypeBadgeClass(order.orderType)}">
                    ${getOrderTypeIcon(order.orderType)}
                    ${getOrderTypeText(order.orderType)}
                </span>
            </td>
            <td>
                <div class="action-btn-group">
                    <button class="action-btn btn-info" 
                            onclick="event.stopPropagation(); viewOrderDetails(${order.id})"
                            title="Xem chi tiết">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${actionButtons}
                </div>
            </td>
        `;
        orderTableBody.appendChild(row);
    });
}


function createOrderActionButtons(order) {
    let buttons = '';

    // Nút xác nhận cho đơn hàng PENDING
    if (order.status === 'PENDING') {
        buttons += `
            <button class="action-btn btn-success" 
                    onclick="event.stopPropagation(); confirmOrder(${order.id})"
                    title="Xác nhận đơn hàng">
                <i class="fas fa-check"></i>
            </button>
        `;
    }

    // Nút hoàn thành cho đơn hàng READY
    if (order.status === 'READY') {
        buttons += `
            <button class="action-btn btn-primary" 
                    onclick="event.stopPropagation(); completeOrder(${order.id})"
                    title="Hoàn thành đơn hàng">
                <i class="fas fa-check-double"></i>
            </button>
        `;
    }

    // Nút thanh toán cho đơn hàng COMPLETED - Sử dụng data attributes
    if (order.status === 'COMPLETED') {
        buttons += `
            <button class="action-btn btn-info checkout-btn" 
                    data-order='${JSON.stringify(order)}'
                    onclick="event.stopPropagation(); handleCheckoutClick(this)"
                    title="Thanh toán đơn hàng">
                <i class="fas fa-money-bill"></i>
            </button>
        `;
    }

    // Nút hủy đơn hàng - hiển thị cho các trạng thái có thể hủy
    if (['PENDING', 'CONFIRMED'].includes(order.status)) {
        buttons += `
            <button class="action-btn btn-danger" 
                    onclick="event.stopPropagation(); cancelOrder(${order.id})"
                    title="Hủy đơn hàng">
                <i class="fas fa-times"></i>
            </button>
        `;
    }

    return buttons;
}

// Hàm helper để xử lý click checkout
function handleCheckoutClick(buttonElement) {
    try {
        const orderData = JSON.parse(buttonElement.getAttribute('data-order'));
        checkoutOrder(orderData);
    } catch (error) {
        console.error('Error parsing order data:', error);
        alert('Có lỗi xảy ra khi xử lý dữ liệu đơn hàng');
    }
}


async function checkoutOrder(order) {
    console.log('checkoutOrder called with:', order);
    try {
        const paymentMethod = await showOrderDetailsAndPaymentModal(order);

        if (paymentMethod && confirm(`Xác nhận thanh toán bằng ${paymentMethod} và hoàn thành đơn hàng?`)) {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.style.display = 'block';
            }

            const paymentRequest = {
                orderId: order.id,
                paymentMethod: paymentMethod
            };

            const data = await apiFetch('/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentRequest)
            });

            if (data.code === 0) {
                const paymentResult = data.result;

                if (paymentResult.paymentMethod === 'BANKING' && paymentResult.status === 'PENDING') {
                    // Lưu orderId vào sessionStorage trước khi redirect
                    sessionStorage.setItem('pendingOrderId', order.id);
                    // Redirect đến PayOS
                    if (paymentResult.paymentUrl) {
                        window.location.href = paymentResult.paymentUrl;
                    } else {
                        alert('Đang chuyển hướng đến cổng thanh toán PayOS...');
                    }
                } else {
                    alert(`Thanh toán thành công!\nSố tiền: ${paymentResult.amount.toLocaleString('vi-VN')} VND`);
                    await loadOrders();
                }
            } else {
                throw new Error(data.message || 'Có lỗi xảy ra khi xử lý thanh toán');
            }
        }
    } catch (error) {
        console.error('Error during checkout:', error);
        alert('Có lỗi xảy ra khi thanh toán: ' + error.message);
    } finally {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}
async function handlePaymentCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const status = urlParams.get('status');
    const pendingOrderId = sessionStorage.getItem('pendingOrderId');

    // Kiểm tra xem có phải redirect từ PayOS không
    if (orderId && pendingOrderId && orderId === pendingOrderId) {
        try {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.style.display = 'block';
            }

            // Gọi API /payments/callback với query string
            const response = await apiFetch(`/payments/callback?${urlParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.code === 0) {
                const paymentResult = response.result;
                if (paymentResult.status === 'PAID') {
                    alert(`Thanh toán thành công!\nSố tiền: ${paymentResult.amount.toLocaleString('vi-VN')} VND\nMã giao dịch: ${paymentResult.transactionId}`);
                } else if (paymentResult.status === 'CANCELLED') {
                    alert('Thanh toán đã bị hủy.');
                } else {
                    alert(`Trạng thái thanh toán: ${paymentResult.status}`);
                }
                await loadOrders();
            } else {
                throw new Error(response.message || 'Lỗi khi xử lý kết quả thanh toán');
            }
        } catch (error) {
            console.error('Error handling callback:', error);
            alert('Có lỗi khi xử lý kết quả thanh toán: ' + error.message);
        } finally {
            sessionStorage.removeItem('pendingOrderId');
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }
    }
}


// Helper function để hiển thị modal với thông tin đơn hàng và chọn phương thức thanh toán
function showOrderDetailsAndPaymentModal(order) {
    return new Promise((resolve) => {
        // Tạo HTML cho danh sách món ăn
        const orderItemsHtml = order.orderItems.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f8ff;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${item.menuItemName}</div>
                    <div style="color: #6b7280; font-size: 13px;">
                        <span style="margin-right: 12px;">SL: ${item.quantity}</span>
                        <span>Đơn giá: ${item.price.toLocaleString('vi-VN')} VND</span>
                    </div>
                </div>
                <div style="font-weight: 700; color: #FEA116; font-size: 15px;">
                    ${(item.quantity * item.price).toLocaleString('vi-VN')} VND
                </div>
            </div>
        `).join('');

        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px;">
                <div style="background: white; border-radius: 16px; max-width: 520px; width: 100%; max-height: 90vh; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #FEA116 0%, #f59e0b 100%); padding: 24px; text-align: center;">
                        <h3 style="margin: 0; color: white; font-size: 22px; font-weight: 700;">Thông tin thanh toán</h3>
                        <div style="width: 40px; height: 3px; background: rgba(255,255,255,0.3); margin: 8px auto 0; border-radius: 2px;"></div>
                    </div>
                    
                    <div style="padding: 24px; overflow-y: auto; max-height: calc(90vh - 120px);">
                        <!-- Thông tin đơn hàng -->
                        <div style="background: #F1F8FF; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div>
                                    <div style="color: #6b7280; font-size: 13px; font-weight: 500; margin-bottom: 4px;">MÃ ĐƠN HÀNG</div>
                                    <div style="color: #1f2937; font-weight: 600;">#${order.id}</div>
                                </div>
                                <div>
                                    <div style="color: #6b7280; font-size: 13px; font-weight: 500; margin-bottom: 4px;">BÀN SỐ</div>
                                    <div style="color: #1f2937; font-weight: 600;">${order.tableNumber}</div>
                                </div>
                                <div style="grid-column: 1 / -1;">
                                    <div style="color: #6b7280; font-size: 13px; font-weight: 500; margin-bottom: 4px;">NHÂN VIÊN</div>
                                    <div style="color: #1f2937; font-weight: 600;">${order.username}</div>
                                </div>
                                ${order.note ? `
                                <div style="grid-column: 1 / -1; margin-top: 8px;">
                                    <div style="color: #6b7280; font-size: 13px; font-weight: 500; margin-bottom: 4px;">GHI CHÚ</div>
                                    <div style="color: #6b7280; font-style: italic; background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #FEA116;">${order.note}</div>
                                </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Danh sách món ăn -->
                        <div style="margin-bottom: 24px;">
                            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                                <div style="width: 24px; height: 24px; background: #FEA116; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                                    <span style="color: white; font-size: 12px; font-weight: bold;">📋</span>
                                </div>
                                <h4 style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 600;">Chi tiết đơn hàng</h4>
                            </div>
                            <div style="background: white; border: 1px solid #f1f8ff; border-radius: 12px; max-height: 200px; overflow-y: auto;">
                                <div style="padding: 16px;">
                                    ${orderItemsHtml}
                                </div>
                            </div>
                        </div>

                        <!-- Tổng tiền -->
                        <div style="background: linear-gradient(135deg, #FEA116 0%, #f59e0b 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
                            <div style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500; margin-bottom: 4px;">TỔNG THANH TOÁN</div>
                            <div style="color: white; font-size: 24px; font-weight: 800;">
                                ${order.totalAmount.toLocaleString('vi-VN')} VND
                            </div>
                        </div>

                        <!-- Chọn phương thức thanh toán -->
                        <div style="margin-bottom: 24px;">
                            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                                <div style="width: 24px; height: 24px; background: #FEA116; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                                    <span style="color: white; font-size: 12px; font-weight: bold;">💳</span>
                                </div>
                                <h4 style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 600;">Phương thức thanh toán</h4>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <button onclick="selectPaymentMethod('CASH')" 
                                    style="padding: 16px; background: white; border: 2px solid #FEA116; border-radius: 12px; cursor: pointer; font-weight: 600; color: #FEA116; display: flex; align-items: center; justify-content: center; gap: 8px;"
                                    onmouseover="this.style.background='#FEA116'; this.style.color='white';" 
                                    onmouseout="this.style.background='white'; this.style.color='#FEA116';">
                                    <span style="font-size: 18px;">💵</span>
                                    <span>Tiền mặt</span>
                                </button>
                                <button onclick="selectPaymentMethod('BANKING')" 
                                    style="padding: 16px; background: white; border: 2px solid #3b82f6; border-radius: 12px; cursor: pointer; font-weight: 600; color: #3b82f6; display: flex; align-items: center; justify-content: center; gap: 8px;"
                                    onmouseover="this.style.background='#3b82f6'; this.style.color='white';" 
                                    onmouseout="this.style.background='white'; this.style.color='#3b82f6';">
                                    <span style="font-size: 18px;">💳</span>
                                    <span>BANKING</span>
                                </button>
                            </div>
                        </div>

                        <!-- Nút hủy -->
                        <div style="text-align: center;">
                            <button onclick="selectPaymentMethod(null)" 
                                style="padding: 12px 32px; background: white; border: 2px solid #EF4444; color: #EF4444; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;"
                                onmouseover="this.style.background='#EF4444'; this.style.color='white';" 
                                onmouseout="this.style.background='white'; this.style.color='#EF4444';">
                                ❌ Hủy bỏ
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        window.selectPaymentMethod = (method) => {
            document.body.removeChild(modal);
            delete window.selectPaymentMethod;
            resolve(method);
        };
    });
}

async function cancelOrder(orderId) {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn hàng này?\nLưu ý: Đơn hàng sau khi hủy không thể khôi phục!')) {
        return;
    }

    try {
        // Hiển thị loading state
        const cancelBtn = document.querySelector(`[onclick*="cancelOrder(${orderId})"]`);
        if (cancelBtn) {
            const originalHTML = cancelBtn.innerHTML;
            cancelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            cancelBtn.disabled = true;

            // Restore button sau khi hoàn thành
            setTimeout(() => {
                if (cancelBtn) {
                    cancelBtn.innerHTML = originalHTML;
                    cancelBtn.disabled = false;
                }
            }, 3000);
        }

        const response = await apiFetch(`/orders/status/${orderId}?status=CANCELLED`, {
            method: 'PUT'
        });

        if (response && response.code === 0) {
            // Hiển thị thông báo thành công
            showNotification('Đơn hàng đã được hủy thành công!', 'success');

            // Refresh danh sách đơn hàng
            await loadOrders();
        } else {
            throw new Error(response?.message || 'Không thể hủy đơn hàng');
        }

    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification('Có lỗi xảy ra khi hủy đơn hàng: ' + error.message, 'error');
    }
}


// NEW FUNCTION: Xác nhận đơn hàng
async function confirmOrder(orderId) {
    if (!confirm('Bạn có chắc chắn muốn xác nhận đơn hàng này?')) {
        return;
    }

    try {
        // Hiển thị loading state
        const confirmBtn = document.querySelector(`[onclick*="confirmOrder(${orderId})"]`);
        if (confirmBtn) {
            const originalHTML = confirmBtn.innerHTML;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            confirmBtn.disabled = true;

            // Restore button sau khi hoàn thành
            setTimeout(() => {
                if (confirmBtn) {
                    confirmBtn.innerHTML = originalHTML;
                    confirmBtn.disabled = false;
                }
            }, 3000);
        }

        const response = await apiFetch(`/orders/status/${orderId}?status=CONFIRMED`, {
            method: 'PUT'
        });

        if (response && response.code === 0) {
            // Hiển thị thông báo thành công
            showNotification('Đơn hàng đã được xác nhận thành công!', 'success');

            // Refresh danh sách đơn hàng
            await loadOrders();
        } else {
            throw new Error(response?.message || 'Không thể xác nhận đơn hàng');
        }

    } catch (error) {
        console.error('Error confirming order:', error);
        showNotification('Có lỗi xảy ra khi xác nhận đơn hàng: ' + error.message, 'error');
    }
}

// NEW FUNCTION: Hoàn thành đơn hàng
async function completeOrder(orderId) {
    if (!confirm('Bạn có chắc chắn muốn hoàn thành đơn hàng này?')) {
        return;
    }

    try {
        // Hiển thị loading state
        const completeBtn = document.querySelector(`[onclick*="completeOrder(${orderId})"]`);
        if (completeBtn) {
            const originalHTML = completeBtn.innerHTML;
            completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            completeBtn.disabled = true;

            // Restore button sau khi hoàn thành
            setTimeout(() => {
                if (completeBtn) {
                    completeBtn.innerHTML = originalHTML;
                    completeBtn.disabled = false;
                }
            }, 3000);
        }

        const response = await apiFetch(`/orders/status/${orderId}?status=COMPLETED`, {
            method: 'PUT'
        });

        if (response && response.code === 0) {
            // Hiển thị thông báo thành công
            showNotification('Đơn hàng đã được hoàn thành!', 'success');

            // Refresh danh sách đơn hàng
            await loadOrders();
        } else {
            throw new Error(response?.message || 'Không thể hoàn thành đơn hàng');
        }

    } catch (error) {
        console.error('Error completing order:', error);
        showNotification('Có lỗi xảy ra khi hoàn thành đơn hàng: ' + error.message, 'error');
    }
}

// NEW FUNCTION: Hiển thị thông báo
function showNotification(message, type = 'info') {
    // Tạo notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;

    // Thêm vào body
    document.body.appendChild(notification);

    // Hiện notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Tự động ẩn sau 3 giây
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

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

// NEW FUNCTION: Thêm CSS cho notification
function addNotificationStyles() {
    if (document.getElementById('notificationStyles')) return;

    const styles = `
        <style id="notificationStyles">
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 300px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease-in-out;
            z-index: 1050;
        }
        .notification.show {
            transform: translateX(0);
        }
        .notification-success {
            background: linear-gradient(135deg, #28a745, #20c997);
        }
        .notification-error {
            background: linear-gradient(135deg, #dc3545, #e74c3c);
        }
        .notification-warning {
            background: linear-gradient(135deg, #ffc107, #f39c12);
            color: #333;
        }
        .notification-info {
            background: linear-gradient(135deg, #17a2b8, #3498db);
        }
        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .notification-content i {
            font-size: 18px;
        }
        .action-btn-group {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        .action-btn {
            padding: 6px 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
            min-width: 32px;
            height: 32px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .action-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .action-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn-success:hover:not(:disabled) {
            background: #218838;
        }
        .btn-primary {
            background: #007bff;
            color: white;
        }
        .btn-primary:hover:not(:disabled) {
            background: #0056b3;
        }
        .btn-info {
            background: #17a2b8;
            color: white;
        }
        .btn-info:hover:not(:disabled) {
            background: #138496;
        }
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        .btn-danger:hover:not(:disabled) {
            background: #c82333;
        }
        </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
}



// Update summary information
function updateSummary(orderPage) {
    const summaryElement = document.getElementById('ordersSummary');
    if (!summaryElement) return;

    const pageSize = orderPage.size;
    const currentPageNum = orderPage.number + 1; // Display 1-based page number
    const startItem = orderPage.number * pageSize + 1;
    const endItem = Math.min((orderPage.number + 1) * pageSize, totalOrderElements);

    summaryElement.innerHTML = `
        <strong>Tìm thấy ${totalOrderElements} đơn hàng</strong> 
        - Hiển thị ${startItem} - ${endItem} 
        (Trang ${currentPageNum}/${totalOrderPages})
    `;
}

// Update pagination controls with smart pagination
function updatePagination() {
    // Generate pagination buttons
    generatePaginationButtons();

    // Show/hide quick jump feature for large page counts
    const jumpContainer = document.getElementById('paginationJump');
    const jumpInput = document.getElementById('jumpToOrderPage');

    if (jumpContainer && jumpInput && totalOrderPages > 10) {
        jumpContainer.style.display = 'block';
        jumpInput.max = totalOrderPages;
        jumpInput.placeholder = `1-${totalOrderPages}`;
    } else if (jumpContainer) {
        jumpContainer.style.display = 'none';
    }
}

// Generate smart pagination buttons (max 10 visible pages)
function generatePaginationButtons() {
    const paginationList = document.getElementById('paginationList');
    if (!paginationList) return;

    paginationList.innerHTML = '';

    if (totalOrderPages <= 1) return;

    const currentPageDisplay = currentOrderPage + 1; // Convert to 1-based for display
    const maxVisiblePages = 10;

    // Calculate page range to display
    let startPage, endPage;

    if (totalOrderPages <= maxVisiblePages) {
        // Show all pages if total is <= 10
        startPage = 1;
        endPage = totalOrderPages;
    } else {
        // Smart pagination logic
        const halfVisible = Math.floor(maxVisiblePages / 2);

        if (currentPageDisplay <= halfVisible + 1) {
            // Near the beginning
            startPage = 1;
            endPage = maxVisiblePages;
        } else if (currentPageDisplay >= totalOrderPages - halfVisible) {
            // Near the end
            startPage = totalOrderPages - maxVisiblePages + 1;
            endPage = totalOrderPages;
        } else {
            // In the middle
            startPage = currentPageDisplay - halfVisible;
            endPage = currentPageDisplay + halfVisible;
        }
    }

    // Previous button
    const prevBtn = createPaginationButton('‹', currentOrderPage - 1, currentOrderPage <= 0, 'Trang trước');
    paginationList.appendChild(prevBtn);

    // First page + ellipsis (if needed)
    if (startPage > 1) {
        paginationList.appendChild(createPaginationButton('1', 0));
        if (startPage > 2) {
            paginationList.appendChild(createPaginationEllipsis('start'));
        }
    }

    // Page number buttons
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = createPaginationButton(
            i.toString(),
            i - 1, // Convert to 0-based for backend
            false,
            `Trang ${i}`,
            i === currentPageDisplay
        );
        paginationList.appendChild(pageBtn);
    }

    // Last page + ellipsis (if needed)
    if (endPage < totalOrderPages) {
        if (endPage < totalOrderPages - 1) {
            paginationList.appendChild(createPaginationEllipsis('end'));
        }
        paginationList.appendChild(createPaginationButton(totalOrderPages.toString(), totalOrderPages - 1));
    }

    // Next button
    const nextBtn = createPaginationButton('›', currentOrderPage + 1, currentOrderPage >= totalOrderPages - 1, 'Trang sau');
    paginationList.appendChild(nextBtn);
}

// Create pagination button element
function createPaginationButton(text, pageIndex, disabled = false, title = '', active = false) {
    const li = document.createElement('li');
    li.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;

    const button = document.createElement('button');
    button.className = 'page-link';
    button.innerHTML = text;
    button.title = title;
    button.disabled = disabled;

    if (!disabled) {
        button.onclick = () => goToOrderPage(pageIndex);
    }

    li.appendChild(button);
    return li;
}

// Create ellipsis element for pagination
function createPaginationEllipsis(position) {
    const li = document.createElement('li');
    li.className = 'page-item disabled';

    const span = document.createElement('span');
    span.className = 'page-link';
    span.innerHTML = '...';
    span.title = position === 'start' ? 'Các trang trước' : 'Các trang sau';

    li.appendChild(span);
    return li;
}

// Go to specific page
function goToOrderPage(pageIndex) {
    if (pageIndex >= 0 && pageIndex < totalOrderPages && pageIndex !== currentOrderPage) {
        currentOrderPage = pageIndex;
        loadOrders();
    }
}

// Jump to page functionality
function jumpToOrderPage() {
    const jumpInput = document.getElementById('jumpToOrderPage');
    if (!jumpInput) return;

    const pageNumber = parseInt(jumpInput.value);

    if (pageNumber && pageNumber >= 1 && pageNumber <= totalOrderPages) {
        goToOrderPage(pageNumber - 1); // Convert to 0-based
        jumpInput.value = ''; // Clear input
    } else {
        // Show error feedback
        jumpInput.classList.add('is-invalid');
        setTimeout(() => {
            jumpInput.classList.remove('is-invalid');
        }, 2000);
    }
}


// Refresh orders
async function refreshOrders() {
    const refreshBtn = document.querySelector('[onclick="refreshOrders()"]');
    if (refreshBtn) {
        const originalHTML = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Đang tải...';
        refreshBtn.disabled = true;

        try {
            await loadOrders();
        } finally {
            refreshBtn.innerHTML = originalHTML;
            refreshBtn.disabled = false;
        }
    } else {
        await loadOrders();
    }
}

// Show error state
function showErrorState(message) {
    const orderTableBody = document.getElementById('orderTableBody');
    if (!orderTableBody) {
        console.error('orderTableBody element not found for error state');
        return;
    }

    orderTableBody.innerHTML = `
        <tr>
            <td colspan="7">
                <div class="empty-orders-state">
                    <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                    <h4 style="color: var(--danger);">Không thể tải danh sách đơn hàng</h4>
                    <p>${message}</p>
                    <button class="btn-orders-action btn-outline-primary" onclick="refreshOrders()">
                        <i class="fas fa-sync-alt me-2"></i>Thử lại
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Helper functions for order type
function getOrderTypeText(orderType) {
    const types = {
        'DINE_IN': 'Tại chỗ',
        'TAKEAWAY': 'Mang về',
        'DELIVERY': 'Giao hàng'
    };
    return types[orderType] || orderType;
}

function getOrderTypeIcon(orderType) {
    const icons = {
        'DINE_IN': '<i class="fas fa-utensils"></i>',
        'TAKEAWAY': '<i class="fas fa-shopping-bag"></i>',
        'DELIVERY': '<i class="fas fa-truck"></i>'
    };
    return icons[orderType] || '<i class="fas fa-question"></i>';
}

function getOrderTypeBadgeClass(orderType) {
    const classes = {
        'DINE_IN': 'order-type-dine-in',
        'TAKEAWAY': 'order-type-takeaway',
        'DELIVERY': 'order-type-delivery'
    };
    return classes[orderType] || 'order-type-default';
}

// Format currency helper
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// Helper function to get status icons
function getStatusIcon(status) {
    const iconMap = {
        'PENDING': '<i class="fas fa-hourglass-start me-1"></i>',
        'CONFIRMED': '<i class="fas fa-check-circle me-1"></i>',
        'PREPARING': '<i class="fas fa-utensils me-1"></i>',
        'READY': '<i class="fas fa-bell me-1"></i>',
        'COMPLETED': '<i class="fas fa-check-double me-1"></i>',
        'CANCELLED': '<i class="fas fa-times-circle me-1"></i>' // Thêm icon cho CANCELLED
    };
    return iconMap[status] || '<i class="fas fa-clock me-1"></i>';
}

// Helper function to update navigation active state
function updateActiveNavigation(currentFunction) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.querySelector(`[onclick="${currentFunction}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Hàm định dạng thời gian
function formatDateTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Format time part
    const timeStr = date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });

    if (diffMins < 60) {
        return `${diffMins} phút trước`;
    } else if (diffHours < 24) {
        return `${diffHours} giờ trước (${timeStr})`;
    } else if (diffDays < 7) {
        return `${diffDays} ngày trước (${timeStr})`;
    } else {
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }) + ` ${timeStr}`;
    }
}

// Hàm xác định class cho badge trạng thái
function getStatusBadgeClass(status) {
    const statusClasses = {
        'PENDING': 'bg-warning',
        'CONFIRMED': 'bg-info',
        'PREPARING': 'bg-info', // Thêm trạng thái PREPARING
        'READY': 'bg-success',
        'COMPLETED': 'bg-secondary',
        'CANCELLED': 'bg-danger'
    };
    return statusClasses[status] || 'bg-secondary';
}


// Hàm chuyển đổi trạng thái sang tiếng Việt
function getStatusText(status) {
    const statusTexts = {
        'PENDING': 'Chờ xác nhận',
        'CONFIRMED': 'Đã xác nhận',
        'PREPARING': 'Đang chuẩn bị', // Thêm trạng thái PREPARING
        'READY': 'Sẵn sàng phục vụ',
        'COMPLETED': 'Hoàn thành',
        'CANCELLED': 'Đã hủy'
    };
    return statusTexts[status] || status;
}

async function viewTableOrders(tableId) {
    try {
        console.log('Fetching table orders for table ID:', tableId);

        const data = await apiFetch(`/orders/table/${tableId}/current`, {
            method: 'GET'
        });

        console.log('API Response:', data);

        if (data && data.code === 0 && data.result) {
            displayOrderDetails(data.result);
        } else {
            console.error('Invalid response:', data);
            alert('Bàn này hiện tại không có đơn hàng nào!');
        }

    } catch (error) {
        console.error('Error fetching table orders:', error);
        alert('Có lỗi xảy ra khi tải đơn hàng: ' + error.message);
    }
}

async function viewOrderDetails(orderId) {
    try {
        console.log('Fetching order details for ID:', orderId);

        const data = await apiFetch(`/orders/${orderId}`, {
            method: 'GET',
        });

        console.log('API Response:', data);

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

// Hàm hiển thị chi tiết đơn hàng
async function displayOrderDetails(orderData) {
    try {
        const {
            id, status, orderType, createdAt, updatedAt, note,
            tableNumber, username, totalAmount, orderItems
        } = orderData;

        // Format dữ liệu
        const formattedDateCreation = new Date(createdAt).toLocaleString('vi-VN');
        const formattedDateUpdate = updatedAt ? new Date(updatedAt).toLocaleString('vi-VN') : 'Chưa cập nhật';
        const formattedAmount = formatCurrency(totalAmount);

        // Fetch order.html
        const response = await fetch('/waiter/order.html');
        if (!response.ok) {
            throw new Error('Không thể tải order.html');
        }
        const htmlContent = await response.text();

        // Parse HTML để lấy templates
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Lấy template orderDetailsModalTemplate
        const modalTemplate = doc.getElementById('orderDetailsModalTemplate').content.cloneNode(true);
        const modalContent = modalTemplate.querySelector('.modal-content');

        // Lấy template orderItemTemplate để render danh sách món ăn
        const orderItemTemplate = doc.getElementById('orderItemTemplate').content;

        // Tạo HTML cho danh sách món ăn
        const orderItemsHtml = orderItems.map(item => {
            const itemNode = orderItemTemplate.cloneNode(true);
            itemNode.querySelector('.item-info strong').textContent = item.menuItemName;
            itemNode.querySelector('.item-details').textContent = `SL: ${item.quantity} × ${formatCurrency(item.price)}`;
            itemNode.querySelector('.item-status .badge').className = `badge ${getStatusBadgeClass(item.status)}`;
            itemNode.querySelector('.item-status .badge').textContent = getStatusText(item.status);
            return itemNode.querySelector('.order-item').outerHTML;
        }).join('');

        // Cập nhật nội dung modal - SỬA LẠI THỨ TỰ
        modalContent.querySelector('h3').textContent = `Chi tiết đơn hàng #${id}`;
        modalContent.querySelector('.badge').className = `badge ${getStatusBadgeClass(status)}`;
        modalContent.querySelector('.badge').textContent = getStatusText(status);

        // Cập nhật từng info-row theo đúng thứ tự
        const infoRows = modalContent.querySelectorAll('.info-row');

        // info-row[1]: Loại đơn (index 1)
        infoRows[1].querySelector('span:nth-child(2)').textContent = getOrderTypeText(orderType);

        // info-row[2]: Thời gian tạo (index 2)
        infoRows[2].querySelector('span:nth-child(2)').textContent = formattedDateCreation;

        // info-row[3]: Thời gian cập nhật (index 3)
        infoRows[3].querySelector('span:nth-child(2)').textContent = formattedDateUpdate;

        // info-row[4]: Bàn (index 4)
        infoRows[4].querySelector('span:nth-child(2)').textContent = tableNumber || 'Mang về';

        // info-row[5]: Khách hàng (index 5)
        infoRows[5].querySelector('span:nth-child(2)').textContent = username || 'Guest';

        // info-row[6]: Ghi chú (index 6)
        infoRows[6].querySelector('span:nth-child(2)').textContent = note || 'Không có ghi chú';

        modalContent.querySelector('.order-items-list').innerHTML = orderItemsHtml;
        modalContent.querySelector('.order-total strong').textContent = `Tổng tiền: ${formattedAmount}`;
        modalContent.querySelector('.btn-primary').setAttribute('onclick', `updateOrderStatus(${id})`);
        modalContent.querySelector('.btn-success').setAttribute('onclick', `startAddItemsToOrder(${id})`);

        // Thêm modal vào body
        document.body.appendChild(modalTemplate);

        // Nạp CSS modal động từ thư mục css
        if (!document.querySelector('link[href="css/modal-style.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/modal-style.css';
            document.head.appendChild(link);
        }

        // Thêm sự kiện đóng modal để xóa CSS khi không cần
        const closeButtons = modalTemplate.querySelectorAll('.btn-close, .btn-secondary');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modal = document.querySelector('.modal-overlay');
                if (modal) modal.remove();
                const modalLink = document.querySelector('link[href="css/modal-style.css"]');
                if (modalLink) modalLink.remove();
            });
        });

    } catch (error) {
        console.error('Error displaying order details:', error);
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay" onclick="closeOrderDetails()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Lỗi</h3>
                        <button class="btn-close" onclick="closeOrderDetails()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-danger">
                            <h4>Không thể hiển thị chi tiết đơn hàng</h4>
                            <p>Lỗi: ${error.message}</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeOrderDetails()">Đóng</button>
                    </div>
                </div>
            </div>
        `);
    }
}


function startAddItemsToOrder(orderId) {
    // Lưu thông tin đơn hàng để sử dụng sau
    currentOrderForAddItems = {
        orderId: orderId,
        isAddingItems: true
    };

    // Đóng modal chi tiết đơn hàng
    closeModal();

    // Reset cart trước khi chuyển sang chế độ thêm món
    cart = [];

    // Chuyển đến trang menu
    showMenu();

    // Hiển thị thông báo
    showNotification('Chế độ gọi thêm món được kích hoạt. Chọn món muốn thêm vào đơn hàng.', 'info');
}

function closeModal() {
    try {
        // Tìm và xóa modal overlay
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }

        // Xóa CSS modal để tránh conflict
        const modalLink = document.querySelector('link[href="css/modal-style.css"]');
        if (modalLink) {
            modalLink.remove();
        }

        console.log('Modal đã được đóng thành công');
    } catch (error) {
        console.error('Lỗi khi đóng modal:', error);
    }
}

// Đóng modal
function closeOrderDetails() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Hàm updateOrderStatus đơn giản
async function updateOrderStatus(orderId) {
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

async function showOrderItemsStatusModal(orderData) {
    try {
        const { id, orderItems } = orderData;

        // Fetch order.html để lấy templates
        const response = await fetch('/waiter/order.html');
        if (!response.ok) {
            throw new Error('Không thể tải order.html');
        }
        const htmlContent = await response.text();

        // Parse HTML để lấy templates
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Lấy template statusUpdateModalTemplate
        const modalTemplate = doc.getElementById('statusUpdateModalTemplate')?.content?.cloneNode(true);
        if (!modalTemplate) {
            throw new Error('Không tìm thấy template statusUpdateModalTemplate');
        }
        const modalContent = modalTemplate.querySelector('.modal-content');

        // Lấy template orderItemOptionTemplate
        const orderItemOptionTemplate = doc.getElementById('orderItemOptionTemplate')?.content;
        if (!orderItemOptionTemplate) {
            throw new Error('Không tìm thấy template orderItemOptionTemplate');
        }

        // Tạo HTML cho danh sách order items
        const orderItemsOptions = orderItems.map(item => {
            const itemNode = orderItemOptionTemplate.cloneNode(true);
            const itemId = item.id;
            itemNode.querySelector('.order-item-option').dataset.itemId = itemId;
            const checkbox = itemNode.querySelector('input');
            checkbox.id = `item_${itemId}`;
            checkbox.value = itemId;
            itemNode.querySelector('label strong').textContent = item.menuItemName;
            const itemDetails = itemNode.querySelector('.item-details');
            itemDetails.textContent = `SL: ${item.quantity} - Trạng thái hiện tại: `;
            const badge = itemNode.querySelector('.badge');
            if (badge) {
                badge.className = `badge ${getStatusBadgeClass(item.status)}`;
                badge.textContent = getStatusText(item.status);
            } else {
                console.warn(`Không tìm thấy .badge cho item ${itemId}, bỏ qua cập nhật className`);
                itemDetails.insertAdjacentHTML('beforeend', `<span class="badge ${getStatusBadgeClass(item.status)}">${getStatusText(item.status)}</span>`);
            }
            return itemNode.querySelector('.order-item-option').outerHTML;
        }).join('');

        // Cập nhật nội dung modal
        modalContent.querySelector('h3').textContent = `Cập nhật trạng thái đơn hàng #${id}`;
        modalContent.querySelector('#orderItemsOptions').innerHTML = orderItemsOptions;

        // Thêm modal vào body
        document.body.appendChild(modalTemplate);

        // Nạp CSS modal động từ thư mục css với đường dẫn tương đối
        if (!document.querySelector('link[href="css/modal-style.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/modal-style.css'; // Đường dẫn tương đối từ js/ tới css/
            document.head.appendChild(link);
        }

        // Thêm sự kiện đóng modal để xóa CSS khi không cần
        const closeButtons = modalTemplate.querySelectorAll('.btn-close, .btn-secondary');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modal = document.querySelector('.modal-overlay');
                if (modal) modal.remove();
                const modalLink = document.querySelector('link[href="css/modal-style.css"]');
                if (modalLink) modalLink.remove();
            });
        });

    } catch (error) {
        console.error('Error displaying status update modal:', error);
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay" onclick="closeStatusUpdateModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Lỗi</h3>
                        <button class="btn-close" onclick="closeStatusUpdateModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-danger">
                            <h4>Không thể hiển thị modal cập nhật trạng thái</h4>
                            <p>Lỗi: ${error.message}</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeStatusUpdateModal()">Đóng</button>
                    </div>
                </div>
            </div>
        `);
    }
}

// Hàm hỗ trợ (giả định đã tồn tại)
function getStatusBadgeClass(status) {
    switch (status) {
        case 'PENDING': return 'badge-pending';
        case 'CONFIRMED': return 'badge-confirmed';
        case 'COMPLETED': return 'badge-completed';
        case 'CANCELLED': return 'badge-cancelled';
        default: return '';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'PENDING': return 'Chờ xác nhận';
        case 'CONFIRMED': return 'Đã xác nhận';
        case 'COMPLETED': return 'Hoàn thành';
        case 'CANCELLED': return 'Đã hủy';
        default: return status;
    }
}

// Hàm giả định để đóng modal
function closeStatusUpdateModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    const modalLink = document.querySelector('link[href="../css/modal-style.css"]');
    if (modalLink) modalLink.remove();
}

// Hàm giả định để chọn tất cả
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('#orderItemsOptions input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = selectAll.checked);
}

// Hàm giả định để thực thi cập nhật
function executeStatusUpdate() {
    const selectedItems = document.querySelectorAll('#orderItemsOptions input[type="checkbox"]:checked');
    const newStatus = document.getElementById('newStatus').value;
    if (newStatus && selectedItems.length > 0) {
        const itemIds = Array.from(selectedItems).map(item => item.value);
        console.log(`Cập nhật trạng thái ${newStatus} cho các món:`, itemIds);
        // Gọi API hoặc logic cập nhật ở đây
        closeStatusUpdateModal();
    } else {
        alert('Vui lòng chọn ít nhất một món ăn và trạng thái!');
    }
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
    // Chỉ gọi dashboard nếu không phải trang payment-result
    if (!window.location.pathname.includes('/payment-result')) {
        showDashboard();
        startSmartRefresh();
    }
});

// Stop refresh when page is hidden
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        if (refreshInterval) clearInterval(refreshInterval);
    } else {
        startSmartRefresh();
    }
});

let autoRefreshInterval;
let isAutoRefreshEnabled = false;

function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    isAutoRefreshEnabled = true;
    autoRefreshInterval = setInterval(async () => {
        if (isAutoRefreshEnabled && document.getElementById('orderTableBody')) {
            try {
                await loadOrders();
                console.log('Auto refresh completed at:', new Date().toLocaleTimeString());
            } catch (error) {
                console.error('Auto refresh error:', error);
            }
        }
    }, 30000); // 30 giây

    console.log('Auto refresh started - will refresh every 30 seconds');
}
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
    isAutoRefreshEnabled = false;
    console.log('Auto refresh stopped');
}

function pauseAutoRefreshTemporarily() {
    if (isAutoRefreshEnabled) {
        stopAutoRefresh();
        // Khởi động lại sau 2 phút
        setTimeout(() => {
            if (document.getElementById('orderTableBody')) {
                startAutoRefresh();
            }
        }, 120000); // 2 phút
    }
}

window.addEventListener('beforeunload', function () {
    stopAutoRefresh();
});

// Thêm event listener để dừng/khởi động auto refresh khi tab ẩn/hiện
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        // Chỉ khởi động lại nếu đang ở trang orders
        if (document.getElementById('orderTableBody')) {
            startAutoRefresh();
        }
    }
});




