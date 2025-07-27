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
        await loadOrders(20);

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
        jumpInput.addEventListener('keypress', function (e) {
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
async function loadOrders(pageSize = 20) {
    try {
        // Get filter values
        const orderStatusFilter = document.getElementById('orderStatusFilter');
        const tableNumberFilter = document.getElementById('tableNumberFilter');
        const sortByOrderFilter = document.getElementById('sortByOrderFilter');
        const sortDirectionOrderFilter = document.getElementById('sortDirectionOrderFilter');

        const status = orderStatusFilter ? orderStatusFilter.value : '';
        const tableNumber = tableNumberFilter ? tableNumberFilter.value : '';
        const sortBy = sortByOrderFilter ? sortByOrderFilter.value || 'updatedOrCreatedAt' : 'updatedOrCreatedAt';
        const sortDirection = sortDirectionOrderFilter ? sortDirectionOrderFilter.value || 'DESC' : 'DESC';

        // Build query parameters
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (tableNumber) params.append('tableNumber', tableNumber);
        params.append('page', currentOrderPage.toString());
        params.append('size', pageSize);
        params.append('orderBy', sortBy);
        params.append('sort', sortDirection);
        console.log('params: ', params.toString());
        
        // Fetch orders with filters
        const data = await apiFetch(`/orders/waiter/work-shift-orders/${currentUserInfo.id}?${params.toString()}`, {
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
        updateOrderPagination();

    } catch (error) {
        console.error('Error fetching orders:', error);
        showErrorState(error.code, error.message);
    }
}

async function generateTableOptions() {
    try {
        if (!hasWorkSchedule) {
            return;
        }

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
        const data = await apiFetch(`/tables/waiter/${currentUserInfo.id}`, {
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
            return `<option value="${table.tableNumber}">Bàn ${table.tableNumber}</option>`;
        }).join('');


        // Cập nhật trực tiếp vào dropdown filter
        const finalOptions = '<option value="">Tất cả bàn</option>' + options;
        tableFilter.innerHTML = finalOptions;

        // Khôi phục giá trị đã chọn trước đó (nếu có)
        if (currentValue) {
            tableFilter.value = currentValue;
            console.log('Đã khôi phục giá trị:', currentValue);
        }

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
        { id: 'sortByOrderFilter', value: 'updatedOrCreatedAt' },
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
                <div class="table-number-badge">
                    <i class="fas fa-chair me-1"></i>
                    ${order.tableNumber ? `Bàn ${order.tableNumber}` : 'Mang về'}
                </div>
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
                <span class="status-badge status-${order.status.toLowerCase()}">
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
                    <button class="action-btn btn-details" 
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
            <button class="action-btn btn-confirmed" 
                    onclick="event.stopPropagation(); confirmOrder(${order.id})"
                    title="Xác nhận đơn hàng">
                <i class="fas fa-check"></i>
            </button>
        `;
    }

    // Nút hoàn thành cho đơn hàng READY
    if (order.status === 'READY') {
        buttons += `
            <button class="action-btn btn-checkout" 
                    data-order='${JSON.stringify(order)}'
                    onclick="event.stopPropagation(); handleCheckoutClick(this)"
                    title="Thanh toán đơn hàng">
                <i class="fas fa-money-bill"></i>
            </button>
        `;
    }

    // Nút thanh toán cho đơn hàng COMPLETED - Sử dụng data attributes
    // if (order.status === 'COMPLETED') {
    //     buttons += `
    //         <button class="action-btn btn-checkout" 
    //                 data-order='${JSON.stringify(order)}'
    //                 onclick="event.stopPropagation(); handleCheckoutClick(this)"
    //                 title="Thanh toán đơn hàng">
    //             <i class="fas fa-money-bill"></i>
    //         </button>
    //     `;
    // }

    // Nút hủy đơn hàng - hiển thị cho các trạng thái có thể hủy
    if (['PENDING', 'CONFIRMED'].includes(order.status)) {
        buttons += `
            <button class="action-btn btn-cancel" 
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

            const data = await apiFetch('/payments/payment', {
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



// Helper function để hiển thị modal với thông tin đơn hàng và chọn phương thức thanh toán
function showOrderDetailsAndPaymentModal(order) {
    return new Promise((resolve) => {
        // Tạo HTML cho danh sách món ăn
        const orderItemsHtml = order.orderItems.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
                <div style="flex: 1;">
                    <div style="font-weight: 500; color: #333; margin-bottom: 2px;">${item.menuItemName}</div>
                    <div style="color: #666; font-size: 14px;">x${item.quantity}</div>
                </div>
                <div style="font-weight: 600; color: #333; font-size: 14px;">
                    ${item.price.toLocaleString('vi-VN')}đ
                </div>
            </div>
        `).join('');

        const modal = document.createElement('div');
        modal.innerHTML = `
            <div id="modal-backdrop" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; padding: 20px;">
                <div id="modal-content" style="background: white; border-radius: 12px; max-width: 480px; width: 100%; max-height: 90vh; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); position: relative;">
                    
                    <!-- Header -->
                    <div style="padding: 20px 24px; border-bottom: 1px solid #f0f0f0; position: relative;">
                        <h3 style="margin: 0; color: #333; font-size: 18px; font-weight: 600;">Xác nhận đặt món</h3>
                        <button onclick="closeModal()" style="position: absolute; top: 20px; right: 24px; width: 24px; height: 24px; background: none; border: none; cursor: pointer; font-size: 20px; color: #999; padding: 0; display: flex; align-items: center; justify-content: center;"
                            onmouseover="this.style.color='#333';" 
                            onmouseout="this.style.color='#999';">
                            ×
                        </button>
                    </div>
                    
                    <div style="padding: 24px; overflow-y: auto; max-height: calc(90vh - 200px);">
                        <!-- Confirmation text -->
                        <div style="margin-bottom: 24px; color: #666; font-size: 14px;">
                            Bạn có chắc chắn muốn đặt món với loại đơn hàng: <strong style="color: #333;">Mang về?</strong>
                        </div>

                        <!-- Order details title -->
                        <div style="margin-bottom: 16px;">
                            <h4 style="margin: 0; color: #333; font-size: 16px; font-weight: 600;">Chi tiết đơn hàng:</h4>
                        </div>

                        <!-- Order items -->
                        <div style="margin-bottom: 24px;">
                            ${orderItemsHtml}
                        </div>

                        <!-- Total -->
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-top: 1px solid #f0f0f0; margin-bottom: 24px;">
                            <div style="font-weight: 600; color: #333; font-size: 16px;">Tổng cộng:</div>
                            <div style="font-weight: 700; color: #e74c3c; font-size: 18px;">
                                ${order.totalAmount.toLocaleString('vi-VN')}đ
                            </div>
                        </div>

                        <!-- Payment method selection -->
                        <div style="margin-bottom: 24px;">
                            <h4 style="margin: 0 0 16px 0; color: #333; font-size: 16px; font-weight: 600;">Chọn phương thức thanh toán:</h4>
                            
                            <div style="margin-bottom: 12px;">
                                <label style="display: flex; align-items: center; padding: 12px 16px; border: 2px solid #FEA116; border-radius: 8px; cursor: pointer; background: #fff8f0;">
                                    <input type="radio" name="paymentMethod" value="CASH" checked style="margin-right: 12px; accent-color: #FEA116;">
                                    <span style="font-size: 16px; margin-right: 8px;">💵</span>
                                    <span style="color: #333; font-weight: 500;">Tiền mặt</span>
                                </label>
                            </div>
                            
                            <div>
                                <label style="display: flex; align-items: center; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; background: white;">
                                    <input type="radio" name="paymentMethod" value="BANKING" style="margin-right: 12px; accent-color: #FEA116;">
                                    <span style="font-size: 16px; margin-right: 8px;">🏛️</span>
                                    <span style="color: #333; font-weight: 500;">Chuyển khoản</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Footer buttons -->
                    <div style="padding: 16px 24px; border-top: 1px solid #f0f0f0; display: flex; gap: 12px; justify-content: flex-end;">
                        <button onclick="closeModal()" 
                            style="padding: 10px 20px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; cursor: pointer; font-weight: 500; color: #6c757d;"
                            onmouseover="this.style.background='#e9ecef';" 
                            onmouseout="this.style.background='#f8f9fa';">
                            Hủy
                        </button>
                        <button onclick="confirmOrder()" 
                            style="padding: 10px 20px; background: #FEA116; border: 1px solid #FEA116; border-radius: 6px; cursor: pointer; font-weight: 500; color: white;"
                            onmouseover="this.style.background='#e8910f';" 
                            onmouseout="this.style.background='#FEA116';">
                            Đặt món
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners for radio buttons
        const radioButtons = modal.querySelectorAll('input[name="paymentMethod"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', function() {
                // Remove active styling from all labels
                radioButtons.forEach(r => {
                    const label = r.closest('label');
                    if (r.value === 'CASH') {
                        label.style.border = '2px solid ' + (r.checked ? '#FEA116' : '#e0e0e0');
                        label.style.background = r.checked ? '#fff8f0' : 'white';
                    } else {
                        label.style.border = '2px solid ' + (r.checked ? '#FEA116' : '#e0e0e0');
                        label.style.background = r.checked ? '#fff8f0' : 'white';
                    }
                });
            });
        });

        // Xử lý click vào backdrop để đóng modal
        const backdrop = modal.querySelector('#modal-backdrop');
        const modalContent = modal.querySelector('#modal-content');
        
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeModal();
            }
        });

        // Ngăn chặn sự kiện click trên modal content lan ra backdrop
        modalContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        window.confirmOrder = () => {
            const selectedPayment = modal.querySelector('input[name="paymentMethod"]:checked');
            const paymentMethod = selectedPayment ? selectedPayment.value : 'CASH';
            
            document.body.removeChild(modal);
            delete window.confirmOrder;
            delete window.closeModal;
            resolve(paymentMethod);
        };

        window.closeModal = () => {
            document.body.removeChild(modal);
            delete window.confirmOrder;
            delete window.closeModal;
            resolve(null);
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
function updateOrderPagination() {
    // Update pagination info text
    updateOrderPaginationInfo();
    
    // Generate pagination buttons
    generateOrderPaginationButtons();

    // Show/hide quick jump feature for large page counts
    const jumpContainer = document.getElementById('orderPaginationJump');
    const jumpInput = document.getElementById('jumpToOrderPage');

    if (jumpContainer && jumpInput && totalOrderPages > 10) {
        jumpContainer.style.display = 'block';
        jumpInput.max = totalOrderPages;
        jumpInput.placeholder = `1-${totalOrderPages}`;
    } else if (jumpContainer) {
        jumpContainer.style.display = 'none';
    }
}

// Update pagination info text
function updateOrderPaginationInfo() {
    const paginationInfo = document.querySelector('.order-pagination-info');
    if (!paginationInfo) return;

    const itemsPerPage = 20; // or get from pageSize parameter
    const startItem = currentOrderPage * itemsPerPage + 1;
    const endItem = Math.min((currentOrderPage + 1) * itemsPerPage, totalOrderElements);
    
    paginationInfo.textContent = `Hiển thị ${startItem} - ${endItem} của ${totalOrderElements} đơn hàng`;
}

// Generate smart pagination buttons (max 10 visible pages)
function generateOrderPaginationButtons() {
    const paginationList = document.getElementById('orderPaginationList');
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
    const prevBtn = createOrderPaginationButton('‹', currentOrderPage - 1, currentOrderPage <= 0, 'Trang trước');
    paginationList.appendChild(prevBtn);

    // First page + ellipsis (if needed)
    if (startPage > 1) {
        paginationList.appendChild(createOrderPaginationButton('1', 0));
        if (startPage > 2) {
            paginationList.appendChild(createOrderPaginationEllipsis('start'));
        }
    }

    // Page number buttons
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = createOrderPaginationButton(
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
            paginationList.appendChild(createOrderPaginationEllipsis('end'));
        }
        paginationList.appendChild(createOrderPaginationButton(totalOrderPages.toString(), totalOrderPages - 1));
    }

    // Next button
    const nextBtn = createOrderPaginationButton('›', currentOrderPage + 1, currentOrderPage >= totalOrderPages - 1, 'Trang sau');
    paginationList.appendChild(nextBtn);
}

// Create pagination button element
function createOrderPaginationButton(text, pageIndex, disabled = false, title = '', active = false) {
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
function createOrderPaginationEllipsis(position) {
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
function showErrorState(code, message) {
    const orderTableBody = document.getElementById('orderTableBody');
    if (!orderTableBody) {
        console.error('orderTableBody element not found for error state');
        return;
    }
    if (code == 1041 || code == 1048) {
        orderTableBody.innerHTML = `
        <tr>
            <td colspan="7">
                <div class="empty-orders-state">
                    <i class="fas fa-calendar-times fa-3x text-muted mb-3"></i>
                    <h6 class="text-muted">Hiện tại bạn đang không trong ca làm</h6>
                    <p class="text-muted small">Đơn hàng sẽ hiển thị khi bạn có ca làm việc</p>
                </div>
            </td>
        </tr>
    `;
    } else {
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

    // Remove 'Z' suffix if present and treat as local time
    const cleanDateString = dateString.replace('Z', '');
    const date = new Date(cleanDateString);
    const now = new Date();

    // Calculate difference in milliseconds
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Format time part
    const timeStr = date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Handle future dates (when date is in the future)
    if (diffMs < 0) {
        const absDiffMins = Math.abs(diffMins);
        const absDiffHours = Math.abs(diffHours);
        const absDiffDays = Math.abs(diffDays);

        if (absDiffMins < 60) {
            return `Trong ${absDiffMins} phút`;
        } else if (absDiffHours < 24) {
            return `Trong ${absDiffHours} giờ (${timeStr})`;
        } else {
            return `Trong ${absDiffDays} ngày (${timeStr})`;
        }
    }

    // Handle past dates (normal case)
    if (diffMins < 1) {
        return 'Vừa xong';
    } else if (diffMins < 60) {
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

        // Format dữ liệu - parse trực tiếp mà không chuyển đổi múi giờ
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

            // Thêm ghi chú cho item nếu có
            const itemNoteElement = itemNode.querySelector('.item-note');
            if (item.note && item.note.trim() !== '') {
                itemNoteElement.textContent = `Ghi chú: ${item.note}`;
                itemNoteElement.style.display = 'block';
            } else {
                itemNoteElement.style.display = 'none';
            }

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
        if (!isReloading) {
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



