async function showTables() {
    hideCartSidebar();

    // Update page title and toggle visibility
    document.getElementById('pageTitle').textContent = 'Quản lý bàn';
    document.getElementById('dashboardContent').style.display = 'none';
    document.getElementById('dynamicContent').style.display = 'block';

    // Render the tables management HTML
    document.getElementById('dynamicContent').innerHTML = `
        <div class="container-fluid p-4">
            <!-- Table Status Summary Cards -->
            <div class="table-stats-cards">
                <div class="card">
                    <div class="card-header">
                        <h5><i class="fas fa-check-circle me-2"></i>Bàn trống</h5>
                    </div>
                    <div class="card-body text-center">
                        <div class="stats-number" id="availableTables">0</div>
                        <p class="text-muted mb-0">Sẵn sàng phục vụ</p>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h5><i class="fas fa-users me-2"></i>Bàn có khách</h5>
                    </div>
                    <div class="card-body text-center">
                        <div class="stats-number" id="occupiedTables">0</div>
                        <p class="text-muted mb-0">Đang phục vụ</p>
                    </div>
                </div>



                <div class="card">
                    <div class="card-header">
                        <h5><i class="fas fa-chart-bar me-2"></i>Tổng số bàn</h5>
                    </div>
                    <div class="card-body text-center">
                        <div class="stats-number" id="totalTables">0</div>
                        <p class="text-muted mb-0">Tổng cộng</p>
                    </div>
                </div>
            </div>

            <!-- Tables by Area -->
            <div id="tablesContainer" class="orders-section">
                <!-- Tables will be loaded here -->
            </div>
        </div>
        `;

    try {
        const url = `/tables/waiter/${currentUserInfo.id}`;
        // Fetch tables using fetch API
        const data = await apiFetch(url, {
            method: 'GET'
        });

        let tables = data.result || [];

        // Update summary statistics
        updateTableStatistics(tables);

        // Group tables by area
        const tablesByArea = groupTablesByArea(tables);

        // Render tables by area
        renderTablesByArea(tablesByArea);

    } catch (error) {
        console.error('Error fetching tables:', error);
        if (error.code == 1041 || error.code == 1048) {
            document.getElementById('tablesContainer').innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-calendar-times fa-3x text-muted mb-3"></i>
                <h6 class="text-muted">Hiện tại bạn đang không trong ca làm</h6>
                <p class="text-muted small">Đơn hàng sẽ hiển thị khi bạn có ca làm việc</p>
            </div>
        `;
        } else {
            document.getElementById('tablesContainer').innerHTML = `
            <div class="alert alert-danger" role="alert" style="border-radius: 20px; border: none; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.2);">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Lỗi!</strong> Không thể tải danh sách bàn: ${error.message}
            </div>
        `;
        }
    }

    // Update navigation active state
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const tablesLink = document.querySelector('[onclick="showTables()"]');
    if (tablesLink) {
        tablesLink.classList.add('active');
    }
}
// Hàm cập nhật thống kê bàn
function updateTableStatistics(tables) {
    const available = tables.filter(t => t.status === 'AVAILABLE').length;
    const occupied = tables.filter(t => t.status === 'OCCUPIED').length;
    const total = tables.length;

    document.getElementById('availableTables').textContent = available;
    document.getElementById('occupiedTables').textContent = occupied;
    document.getElementById('totalTables').textContent = total;
}

// Hàm nhóm bàn theo khu vực
function groupTablesByArea(tables) {
    const grouped = {};
    tables.forEach(table => {
        if (!grouped[table.area]) {
            grouped[table.area] = [];
        }
        grouped[table.area].push(table);
    });
    return grouped;
}

// Hàm render bàn theo khu vực với layout responsive
function renderTablesByArea(tablesByArea) {
    const container = document.getElementById('tablesContainer');
    let html = `<h3 class="mb-4 section-title"><i class="fas fa-chair" style="color: var(--primary)"></i> Bàn khu vực ${currentWorkSchedule.area}</h3>`;

    Object.keys(tablesByArea).sort().forEach(area => {
        html += `
            <div class="area-section mb-5">
                <div class="tables-grid">
        `;
        tablesByArea[area].forEach(table => {
            const statusClass = getTableStatusClass(table.status);
            const statusText = getTableStatusText(table.status);
            const statusIcon = getTableStatusIcon(table.status);
            // const isUrgent = table.status === 'OCCUPIED' && shouldShowUrgent(table);

            html += `
                <div class="table-card-wrapper">
                    <div class="table-card" 
                         onclick="handleTableClick(${table.id}, '${table.status}')"
                         data-table-id="${table.id}">
                        
                        <div class="table-status-indicator">
                            <i class="${statusIcon}"></i>
                        </div>
                        
                        <div class="table-content">
                            <div class="table-number">
                                Bàn ${table.tableNumber}
                            </div>
                            
                            <div class="table-status">
                                <span class="status-badge ${statusClass}">
                                    ${statusText}
                                </span>
                                
                            </div>
                            
                            <div class="table-info-actions-container">
                                <div class="table-info">
                                    <small class="text-muted d-block table-qr">
                                        <i class="fas fa-qrcode me-1"></i>QR: ${table.qrCode}
                                    </small>
                                    ${table.customerCount ? `<small class="text-muted d-block mt-1 table-customers">
                                        <i class="fas fa-users me-1"></i>${table.customerCount} khách
                                    </small>` : ''}
                                </div>
                                
                                <div class="table-actions">
                                    ${getTableActionButtons(table)}
                                </div>
                            </div>
                        </div>
                        
                        <div class="table-overlay"></div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Hàm xác định class CSS cho trạng thái bàn
function getTableStatusClass(status) {
    const classes = {
        'AVAILABLE': 'status-available',
        'OCCUPIED': 'status-occupied',
        'RESERVED': 'status-reserved'
    };
    return classes[status] || 'status-default';
}

// Hàm chuyển đổi trạng thái bàn sang tiếng Việt
function getTableStatusText(status) {
    const texts = {
        'AVAILABLE': 'Trống',
        'OCCUPIED': 'Có khách',
        'RESERVED': 'Đặt trước'
    };
    return texts[status] || status;
}

// Hàm xác định icon cho trạng thái bàn
function getTableStatusIcon(status) {
    const icons = {
        'AVAILABLE': 'fas fa-check-circle',
        'OCCUPIED': 'fas fa-users',
        'RESERVED': 'fas fa-clock'
    };
    return icons[status] || 'fas fa-chair';
}

// Hàm kiểm tra xem có cần hiển thị cảnh báo khẩn cấp không
function shouldShowUrgent(table) {
    // Logic để xác định bàn khẩn cấp (ví dụ: thời gian phục vụ quá lâu)
    // Có thể dựa vào thời gian đặt bàn, thời gian chờ order, etc.
    return Math.random() > 0.7; // Tạm thời random để demo
}

// Hàm tạo nút hành động cho bàn
function getTableActionButtons(table) {
    switch (table.status) {
        case 'AVAILABLE':
            return `
                <button class="btn btn-outline-success" 
                        onclick="event.stopPropagation(); assignTable(${table.id})"
                        title="Xếp khách vào bàn">
                    <i class="fas fa-user-plus"></i>
                </button>
            `;
        case 'OCCUPIED':
            return `
                <button class="btn btn-outline-info" 
                        onclick="event.stopPropagation(); viewTableOrders(${table.id})"
                        title="Xem đơn hàng">
                    <i class="fas fa-list"></i>
                </button>
                <button class="btn btn-outline-primary" 
                        onclick="event.stopPropagation(); openChatPopup(${table.id})"
                        title="Chat với khách">
                    <i class="fas fa-comments"></i>
                </button>
                <button class="btn btn-outline-warning" 
                        onclick="event.stopPropagation(); checkoutTable(${table.id})"
                        title="Thanh toán">
                    <i class="fas fa-credit-card"></i>
                </button>
            `;
        default:
            return '';
    }
}

// Hàm xử lý khi click vào bàn
function handleTableClick(tableId, status) {
    // Add visual feedback
    const tableCard = document.querySelector(`[data-table-id="${tableId}"]`);
    if (tableCard) {
        tableCard.style.transform = 'scale(0.95)';
        setTimeout(() => {
            tableCard.style.transform = '';
        }, 150);
    }

    switch (status) {
        case 'AVAILABLE':
            assignTable(tableId);
            break;
        case 'OCCUPIED':
            viewTableOrders(tableId);
            break;
        case 'RESERVED':
            viewReservation(tableId);
            break;
    }
}

// Hàm xếp khách vào bàn
async function assignTable(tableId) {
    if (confirm('Xác nhận xếp khách vào bàn này?')) {
        try {
            // Call the API to update the table status to OCCUPIED
            const data = await apiFetch(`/tables/status/${tableId}?status=OCCUPIED`, {
                method: 'PUT'
            });

            // Check if the API call was successful (based on the response structure)
            if (data.code === 0 && data.result && data.result.status === 'OCCUPIED') {
                showNotification(`Bàn ${data.result.tableNumber} đã được xếp khách thành công!`, 'success');
                // Optionally, refresh the table list to reflect the updated status
                showTables(); // Assumes showTables is defined elsewhere to refresh the table view
            } else {
                showNotification('Không thể xếp khách vào bàn. Vui lòng thử lại!', 'danger');
            }
        } catch (error) {
            console.error('Error assigning table:', error);
            showNotification(`Lỗi khi xếp khách: ${error.message}`, 'danger');
        }
    }
}

// Hàm xem đơn hàng của bàn
async function viewTableOrders(tableId) {
    try {
        // Gọi API để lấy đơn hàng hiện tại của bàn
        const data = await apiFetch(`/orders/table/${tableId}/current`, {
            method: 'GET'
        });

        // Kiểm tra response code từ API
        if (data.code !== 0) {
            throw new Error('API returned error code: ' + data.code);
        }

        const order = data.result;

        // Kiểm tra có đơn hàng nào không
        if (!order) {
            showNotification('Bàn này hiện tại không có đơn hàng nào!', 'warning');
            return;
        }

        // Hiển thị thông tin đơn hàng
        displayOrderDetails(order);

    } catch (error) {
        console.error('Error fetching table orders:', error);
        showNotification('Có lỗi xảy ra khi tải đơn hàng: ' + error.message, 'error');
    }
}

// Thêm CSS animation cho fade out
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(fadeOutStyle);

// Đóng modal khi nhấn ESC
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeOrderModal();
    }
});

// Hàm chuyển đổi status thành text tiếng Việt
function getStatusText(status) {
    const statusMap = {
        'PENDING': 'Chờ xử lý',
        'CONFIRMED': 'Đã xác nhận',
        'PREPARING': 'Đang chuẩn bị',
        'READY': 'Sẵn sàng',
        'SERVED': 'Đã phục vụ',
        'COMPLETED': 'Hoàn thành',
        'CANCELLED': 'Đã hủy'
    };
    return statusMap[status] || status;
}

// Hàm format tiền tệ
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// Hàm hiển thị modal (bạn cần implement theo UI framework của mình)
function showOrderModal(html) {
    // Ví dụ: tạo và hiển thị modal
    const modalContainer = document.getElementById('orderModal') || createModalContainer();
    modalContainer.innerHTML = html;
    modalContainer.style.display = 'block';
}

// Hàm xem chi tiết đặt bàn
function viewReservation(tableId) {
    // TODO: Implement view reservation functionality
    showNotification('Chức năng xem chi tiết đặt bàn sẽ được cập nhật sau!', 'info');
}


// Hàm làm mới danh sách bàn
function refreshTables() {
    // Add loading animation
    const refreshBtn = document.querySelector('[onclick="refreshTables()"]');
    if (refreshBtn) {
        const icon = refreshBtn.querySelector('i');
        icon.style.animation = 'spin 1s linear infinite';
        setTimeout(() => {
            icon.style.animation = '';
        }, 1000);
    }

    // Refresh tables
    showTables();
}



