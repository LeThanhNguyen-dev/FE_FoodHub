let currentFilters = {
    tableNumber: '',
    status: ''
};

let currentSort = {
    field: 'tableNumber',
    order: 'asc'
};

async function showTables(filters = {}, sort = {}) {
    // Cập nhật filter và sort hiện tại
    currentFilters = { ...currentFilters, ...filters };
    currentSort = { ...currentSort, ...sort };

    // Update page title and toggle visibility
    document.getElementById('pageTitle').textContent = 'Quản lý bàn';
    document.getElementById('dashboardContent').style.display = 'none';
    document.getElementById('dynamicContent').style.display = 'block';

    // Render the tables management HTML với filter/sort controls
    document.getElementById('dynamicContent').innerHTML = `
        <div class="container-fluid p-4">
            <!-- Header Section -->
            <div class="welcome-section">
                <div class="d-flex justify-content-between align-items-center flex-wrap">
                    <div class="header-info">
                        <h2 class="mb-2"><i class="fas fa-chair me-3"></i>Quản lý bàn</h2>
                        <p class="mb-0 opacity-75">Theo dõi và quản lý trạng thái các bàn trong nhà hàng</p>
                    </div>
                    <button class="btn btn-light btn-action refresh-btn" onclick="refreshTables()" 
                            style="background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3);">
                        <i class="fas fa-sync-alt me-2"></i><span class="btn-text">Làm mới</span>
                    </button>
                </div>
            </div>

            <!-- Filter and Sort Section -->
            <div class="filter-sort-section">
                <div class="filter-sort-container">
                    <div class="filter-section">
                        <h5 class="filter-title"><i class="fas fa-filter me-2"></i>Lọc và Sắp xếp</h5>
                        <div class="filter-controls">
                            <div class="filter-group">
                                <label class="filter-label">Số bàn:</label>
                                <input type="text" id="filterTableNumber" class="form-control filter-input" 
                                       placeholder="Nhập số bàn..." value="${currentFilters.tableNumber}"
                                       onchange="applyTableFilters()">
                            </div>
                            
                            <div class="filter-group">
                                <label class="filter-label">Trạng thái:</label>
                                <select id="filterStatus" class="form-select filter-select" onchange="applyTableFilters()">
                                    <option value="">Tất cả trạng thái</option>
                                    <option value="AVAILABLE" ${currentFilters.status === 'AVAILABLE' ? 'selected' : ''}>Trống</option>
                                    <option value="OCCUPIED" ${currentFilters.status === 'OCCUPIED' ? 'selected' : ''}>Có khách</option>
                                    <option value="RESERVED" ${currentFilters.status === 'RESERVED' ? 'selected' : ''}>Đặt trước</option>
                                </select>
                            </div>

                            <div class="filter-group">
                                <label class="filter-label">Sắp xếp:</label>
                                <select id="sortField" class="form-select filter-select" onchange="applySorting()">
                                    <option value="tableNumber" ${currentSort.field === 'tableNumber' ? 'selected' : ''}>Theo số bàn</option>
                                    <option value="status" ${currentSort.field === 'status' ? 'selected' : ''}>Theo trạng thái</option>
                                    <option value="area" ${currentSort.field === 'area' ? 'selected' : ''}>Theo khu vực</option>
                                </select>
                            </div>

                            <div class="filter-group">
                                <label class="filter-label">Thứ tự:</label>
                                <select id="sortOrder" class="form-select filter-select" onchange="applySorting()">
                                    <option value="asc" ${currentSort.order === 'asc' ? 'selected' : ''}>Tăng dần</option>
                                    <option value="desc" ${currentSort.order === 'desc' ? 'selected' : ''}>Giảm dần</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="filter-actions">
                            <button class="btn btn-outline-secondary btn-sm" onclick="clearTableFilters()">
                                <i class="fas fa-times me-1"></i>Xóa bộ lọc
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="refreshTables()">
                                <i class="fas fa-sync-alt me-1"></i>Làm mới
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Table Status Summary Cards -->
            <div class="dashboard-cards">
                <div class="card">
                    <div class="card-header">
                        <h5><i class="fas fa-check-circle me-2"></i>Bàn trống</h5>
                    </div>
                    <div class="card-body text-center">
                        <div class="stats-number text-success" id="availableTables">0</div>
                        <p class="text-muted mb-0">Sẵn sàng phục vụ</p>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h5><i class="fas fa-users me-2"></i>Bàn có khách</h5>
                    </div>
                    <div class="card-body text-center">
                        <div class="stats-number text-primary" id="occupiedTables">0</div>
                        <p class="text-muted mb-0">Đang phục vụ</p>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h5><i class="fas fa-clock me-2"></i>Bàn đặt trước</h5>
                    </div>
                    <div class="card-body text-center">
                        <div class="stats-number text-warning" id="reservedTables">0</div>
                        <p class="text-muted mb-0">Chờ khách đến</p>
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
        // Build query parameters
        const queryParams = new URLSearchParams();

        if (currentFilters.tableNumber && currentFilters.tableNumber.trim()) {
            queryParams.append('tableNumber', currentFilters.tableNumber.trim());
        }

        if (currentFilters.status && currentFilters.status.trim()) {
            queryParams.append('status', currentFilters.status.trim());
        }

        const queryString = queryParams.toString();
        const url = queryString ? `/tables?${queryString}` : '/tables';

        // Fetch tables using fetch API with filters
        const data = await apiFetch(url, {
            method: 'GET'
        });

        let tables = data.result || [];

        // Apply client-side sorting (since backend might not support sorting yet)
        tables = applySortingToTables(tables);

        // Update summary statistics
        updateTableStatistics(tables);

        // Group tables by area
        const tablesByArea = groupTablesByArea(tables);

        // Render tables by area
        renderTablesByArea(tablesByArea);

        // Show filter status if any filters are applied

    } catch (error) {
        console.error('Error fetching tables:', error);
        document.getElementById('tablesContainer').innerHTML = `
            <div class="alert alert-danger" role="alert" style="border-radius: 20px; border: none; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.2);">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Lỗi!</strong> Không thể tải danh sách bàn: ${error.message}
            </div>
        `;
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

function applyTableFilters() {
    const tableNumber = document.getElementById('filterTableNumber').value;
    const status = document.getElementById('filterStatus').value;

    const filters = {
        tableNumber: tableNumber,
        status: status
    };

    showTables(filters, currentSort);
}

// Hàm áp dụng sắp xếp
function applySorting() {
    const sortField = document.getElementById('sortField').value;
    const sortOrder = document.getElementById('sortOrder').value;

    const sort = {
        field: sortField,
        order: sortOrder
    };

    showTables(currentFilters, sort);
}

// Hàm sắp xếp tables phía client
function applySortingToTables(tables) {
    return tables.sort((a, b) => {
        let valueA, valueB;

        switch (currentSort.field) {
            case 'tableNumber':
                // Sort by table number with natural sorting (A1, A2, A10, B1, etc.)
                valueA = a.tableNumber;
                valueB = b.tableNumber;
                return currentSort.order === 'asc'
                    ? valueA.localeCompare(valueB, undefined, { numeric: true, sensitivity: 'base' })
                    : valueB.localeCompare(valueA, undefined, { numeric: true, sensitivity: 'base' });

            case 'status':
                // Sort by status priority: OCCUPIED -> RESERVED -> AVAILABLE
                const statusPriority = { 'OCCUPIED': 3, 'RESERVED': 2, 'AVAILABLE': 1 };
                valueA = statusPriority[a.status] || 0;
                valueB = statusPriority[b.status] || 0;
                return currentSort.order === 'asc' ? valueA - valueB : valueB - valueA;

            case 'area':
                valueA = a.area;
                valueB = b.area;
                return currentSort.order === 'asc'
                    ? valueA.localeCompare(valueB)
                    : valueB.localeCompare(valueA);

            default:
                return 0;
        }
    });
}

// Hàm xóa bộ lọc
function clearTableFilters() {
    currentFilters = {
        tableNumber: '',
        status: ''
    };

    currentSort = {
        field: 'tableNumber',
        order: 'asc'
    };

    // Reset form values
    if (document.getElementById('filterTableNumber')) {
        document.getElementById('filterTableNumber').value = '';
    }
    if (document.getElementById('filterStatus')) {
        document.getElementById('filterStatus').value = '';
    }
    if (document.getElementById('sortField')) {
        document.getElementById('sortField').value = 'tableNumber';
    }
    if (document.getElementById('sortOrder')) {
        document.getElementById('sortOrder').value = 'asc';
    }

    showTables();
}

// Hàm hiển thị trạng thái bộ lọc


// Hàm cập nhật thống kê bàn
function updateTableStatistics(tables) {
    const available = tables.filter(t => t.status === 'AVAILABLE').length;
    const occupied = tables.filter(t => t.status === 'OCCUPIED').length;
    const reserved = tables.filter(t => t.status === 'RESERVED').length;
    const total = tables.length;

    document.getElementById('availableTables').textContent = available;
    document.getElementById('occupiedTables').textContent = occupied;
    document.getElementById('reservedTables').textContent = reserved;
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
    let html = '<h3 class="mb-4 section-title"><i class="fas fa-map-marker-alt me-2 text-primary"></i>Sơ đồ bàn theo khu vực</h3>';

    // Add sorting info
    const sortFieldText = {
        'tableNumber': 'số bàn',
        'status': 'trạng thái',
        'area': 'khu vực'
    };

    const sortOrderText = currentSort.order === 'asc' ? 'tăng dần' : 'giảm dần';

    html += `
        <div class="sort-info mb-3">
            <small class="text-muted">
                <i class="fas fa-sort me-1"></i>
                Đang sắp xếp theo ${sortFieldText[currentSort.field]} (${sortOrderText})
            </small>
        </div>
    `;

    Object.keys(tablesByArea).sort().forEach(area => {
        html += `
            <div class="area-section mb-5">
                <div class="area-header d-flex align-items-center justify-content-between mb-4 p-3" 
                     style="background: linear-gradient(135deg, var(--waiter-blue), #0052a3); 
                            border-radius: 15px; color: white; position: relative; overflow: hidden;">
                    <div class="area-info" style="position: relative; z-index: 2;">
                        <h4 class="mb-1 area-title"><i class="fas fa-map-marker-alt me-2"></i>Khu vực ${area}</h4>
                        <small class="opacity-75 area-count">${tablesByArea[area].length} bàn</small>
                    </div>
                    <div class="area-stats" style="position: relative; z-index: 2;">
                        ${getAreaStats(tablesByArea[area])}
                    </div>
                    <div class="area-header-bg" style="position: absolute; top: -50%; right: -20%; 
                         width: 100px; height: 100px; background: rgba(255,255,255,0.1); 
                         border-radius: 50%; transform: rotate(45deg);"></div>
                </div>
                
                <div class="tables-grid">
        `;

        // Tables are already sorted, no need to sort again here
        tablesByArea[area].forEach(table => {
            const statusClass = getTableStatusClass(table.status);
            const statusText = getTableStatusText(table.status);
            const statusIcon = getTableStatusIcon(table.status);
            const isUrgent = table.status === 'OCCUPIED' && shouldShowUrgent(table);

            html += `
                <div class="table-card-wrapper">
                    <div class="table-card ${statusClass} ${isUrgent ? 'table-urgent' : ''}" 
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
                                <span class="status-badge ${getStatusBadgeClass(table.status)}">
                                    ${statusText}
                                </span>
                                ${isUrgent ? '<span class="urgent-badge ms-1">Khẩn cấp</span>' : ''}
                            </div>
                            
                            <div class="table-info">
                                <small class="text-muted d-block table-qr">
                                    <i class="fas fa-qrcode me-1"></i>QR: ${table.qrCode}
                                </small>
                                ${table.customerCount ? `<small class="text-muted d-block mt-1 table-customers">
                                    <i class="fas fa-users me-1"></i>${table.customerCount} khách
                                </small>` : ''}
                            </div>
                        </div>
                        
                        <div class="table-actions">
                            ${getTableActionButtons(table)}
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

// CSS cho filter và sort section
const filterSortStyle = document.createElement('style');
filterSortStyle.textContent = `
    .filter-sort-section {
        margin: 0 1rem 2rem 1rem;
    }
    
    .filter-sort-container {
        background: white;
        border-radius: 20px;
        padding: 1.5rem;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        border: 2px solid rgba(0, 102, 204, 0.1);
    }
    
    .filter-title {
        color: var(--waiter-blue);
        margin-bottom: 1rem;
        font-weight: 600;
    }
    
    .filter-controls {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    
    .filter-group {
        display: flex;
        flex-direction: column;
    }
    
    .filter-label {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--dark);
        margin-bottom: 0.5rem;
    }
    
    .filter-input,
    .filter-select {
        border-radius: 10px;
        border: 2px solid rgba(0, 102, 204, 0.2);
        padding: 0.5rem 0.75rem;
        transition: all 0.3s ease;
    }
    
    .filter-input:focus,
    .filter-select:focus {
        border-color: var(--waiter-blue);
        box-shadow: 0 0 0 0.2rem rgba(0, 102, 204, 0.25);
        outline: none;
    }
    
    .filter-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
        flex-wrap: wrap;
    }
    
    .filter-actions .btn {
        border-radius: 10px;
        padding: 0.5rem 1rem;
        font-weight: 500;
        transition: all 0.3s ease;
    }
    
    .filter-status-alert {
        border-radius: 15px;
        border: none;
        background: linear-gradient(135deg, rgba(13, 202, 240, 0.1), rgba(13, 202, 240, 0.05));
        border-left: 4px solid var(--info);
        margin-bottom: 1.5rem;
    }
    
    .sort-info {
        text-align: center;
        padding: 0.5rem;
        background: rgba(0, 102, 204, 0.05);
        border-radius: 10px;
        border: 1px solid rgba(0, 102, 204, 0.1);
    }
    
    /* Responsive design for filter section */
    @media (max-width: 768px) {
        .filter-sort-section {
            margin: 0 0.5rem 1.5rem 0.5rem;
        }
        
        .filter-sort-container {
            padding: 1rem;
            border-radius: 15px;
        }
        
        .filter-controls {
            grid-template-columns: 1fr;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }
        
        .filter-actions {
            justify-content: stretch;
        }
        
        .filter-actions .btn {
            flex: 1;
            min-width: 120px;
        }
    }
    
    @media (max-width: 576px) {
        .filter-controls {
            gap: 0.5rem;
        }
        
        .filter-actions {
            flex-direction: column;
        }
        
        .filter-actions .btn {
            width: 100%;
        }
        
        .filter-title {
            font-size: 1.1rem;
            text-align: center;
        }
    }
    
    /* Animation for filter changes */
    .tables-grid {
        animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(filterSortStyle);

// Hàm tạo thống kê cho từng khu vực
function getAreaStats(tables) {
    const available = tables.filter(t => t.status === 'AVAILABLE').length;
    const occupied = tables.filter(t => t.status === 'OCCUPIED').length;
    const reserved = tables.filter(t => t.status === 'RESERVED').length;

    return `
        <div class="d-flex gap-2 flex-wrap area-stats-badges">
            <span class="badge bg-success">${available} trống</span>
            <span class="badge bg-primary">${occupied} có khách</span>
            ${reserved > 0 ? `<span class="badge bg-warning">${reserved} đặt trước</span>` : ''}
        </div>
    `;
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

// Hàm xác định class badge cho trạng thái
function getStatusBadgeClass(status) {
    const classes = {
        'AVAILABLE': 'bg-success',
        'OCCUPIED': 'bg-primary',
        'RESERVED': 'bg-warning'
    };
    return classes[status] || 'bg-secondary';
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
                <button class="btn btn-sm btn-success table-action-btn" 
                        onclick="event.stopPropagation(); assignTable(${table.id})"
                        title="Xếp khách vào bàn">
                    <i class="fas fa-user-plus"></i>
                </button>
            `;
        case 'OCCUPIED':
            return `
                <button class="btn btn-sm btn-info table-action-btn me-1" 
                        onclick="event.stopPropagation(); viewTableOrders(${table.id})"
                        title="Xem đơn hàng">
                    <i class="fas fa-list"></i>
                </button>
                <button class="btn btn-sm btn-warning table-action-btn" 
                        onclick="event.stopPropagation(); checkoutTable(${table.id})"
                        title="Thanh toán">
                    <i class="fas fa-credit-card"></i>
                </button>
            `;
        case 'RESERVED':
            return `
                <button class="btn btn-sm btn-primary table-action-btn" 
                        onclick="event.stopPropagation(); viewReservation(${table.id})"
                        title="Xem chi tiết đặt bàn">
                    <i class="fas fa-info-circle"></i>
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
        const data = await apiFetch(`/orders/table/${tableId}/current`,{
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
        displayTableOrder(order, tableId);

    } catch (error) {
        console.error('Error fetching table orders:', error);
        showNotification('Có lỗi xảy ra khi tải đơn hàng: ' + error.message, 'error');
    }
}

// Hàm hiển thị thông tin đơn hàng (đã được sửa để xử lý một đơn hàng duy nhất)
// Hàm hiển thị thông tin đơn hàng (đã được cập nhật với CSS mới)

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
document.addEventListener('keydown', function(event) {
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

// Hàm tạo container modal nếu chưa có
function createModalContainer() {
    const modal = document.createElement('div');
    modal.id = 'orderModal';
    modal.className = 'modal';
    modal.style.cssText = `
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
        padding: 20px;
        box-sizing: border-box;
    `;
    document.body.appendChild(modal);
    return modal;
}



// Hàm thanh toán bàn
function checkoutTable(tableId) {
    if (confirm('Xác nhận thanh toán và dọn bàn?')) {
        // TODO: Implement checkout table functionality
        showNotification('Chức năng thanh toán sẽ được cập nhật sau!', 'info');
    }
}

// Hàm xem chi tiết đặt bàn
function viewReservation(tableId) {
    // TODO: Implement view reservation functionality
    showNotification('Chức năng xem chi tiết đặt bàn sẽ được cập nhật sau!', 'info');
}

// Hàm hiển thị thông báo
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} notification-toast`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        border-radius: 10px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        animation: slideInRight 0.3s ease;
        max-width: 90vw;
        word-wrap: break-word;
    `;
    notification.innerHTML = `
        <i class="fas fa-info-circle me-2"></i>
        ${message}
    `;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
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

    // Refresh with current filters and sort
    showTables(currentFilters, currentSort);
}

const style = document.createElement('style');
style.textContent = `    
    .tables-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-top: 2rem;
    }
    
    .table-card {
        background: white;
        border-radius: 20px;
        padding: 1.5rem;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        border: 3px solid transparent;
    }
    
    .table-card:hover {
        transform: translateY(-8px);
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
    }
    
    .table-card.status-available {
        border-color: var(--success);
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), white);
    }
    
    .table-card.status-occupied {
        border-color: var(--waiter-blue);
        background: linear-gradient(135deg, rgba(0, 102, 204, 0.05), white);
    }
    
    .table-card.status-reserved {
        border-color: var(--warning);
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.05), white);
    }
    
    .table-card.table-urgent {
        border-color: var(--danger);
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), white);
        animation: urgentPulse 2s infinite;
    }
    
    @keyframes urgentPulse {
        0%, 100% { box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); }
        50% { box-shadow: 0 8px 25px rgba(239, 68, 68, 0.3); }
    }
    
    .table-status-indicator {
        position: absolute;
        top: 1rem;
        right: 1rem;
        font-size: 1.5rem;
    }
    
    .table-status-indicator .fa-check-circle {
        color: var(--success);
    }
    
    .table-status-indicator .fa-users {
        color: var(--waiter-blue);
    }
    
    .table-status-indicator .fa-clock {
        color: var(--warning);
    }
    
    .table-number {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--dark);
        margin-bottom: 1rem;
    }
    
    .table-status {
        margin-bottom: 1rem;
    }
    
    .table-info {
        margin-bottom: 1.5rem;
        min-height: 40px;
    }
    
    .table-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
    }
    
    .table-action-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
    }
    
    .table-action-btn:hover {
        transform: scale(1.1);
    }
    
    .area-section {
        margin-bottom: 3rem;
    }
    
    .area-header {
        position: relative;
        overflow: hidden;
    }
    
    .area-header::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
        animation: float 6s ease-in-out infinite;
    }
    
    
    .table-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1));
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
    }
    
    .table-card:hover .table-overlay {
        opacity: 1;
    }
    
    /* Mobile First Responsive Design */
    @media (max-width: 1200px) {
        .tables-grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1.25rem;
        }
    }
    
    @media (max-width: 992px) {
        .dashboard-cards {
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            padding: 1.5rem;
        }
        
        .tables-grid {
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 1rem;
        }
        
        .area-header {
            flex-direction: column;
            text-align: center;
            gap: 1rem;
            padding: 1.5rem !important;
        }
        
        .area-stats-badges {
            justify-content: center;
        }
    }
    
    @media (max-width: 768px) {
        .welcome-section {
            margin: 1rem;
            padding: 2rem 1.5rem;
        }
        
        .welcome-section .d-flex {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
        }
        
        .header-info h2 {
            font-size: 1.5rem;
        }
        
        .refresh-btn .btn-text {
            display: none;
        }
        
        .refresh-btn {
            padding: 0.75rem;
            border-radius: 50%;
            width: 50px;
            height: 50px;
        }
        
        .dashboard-cards {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            padding: 1rem;
        }
        
        .card-body {
            padding: 1.5rem 1rem;
        }
        
        .stats-number {
            font-size: 2.5rem;
        }
        
        .orders-section {
            margin: 1rem;
            padding: 1.5rem;
        }
        
        .section-title {
            font-size: 1.25rem;
            text-align: center;
        }
        
        .tables-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 1.5rem;
        }
        
        .table-card {
            padding: 1rem;
        }
        
        .table-number {
            font-size: 1.25rem;
            margin-bottom: 0.75rem;
        }
        
        .table-status-indicator {
            font-size: 1.25rem;
            top: 0.75rem;
            right: 0.75rem;
        }
        
        .table-info {
            margin-bottom: 1rem;
            min-height: 35px;
        }
        
        .table-qr, .table-customers {
            font-size: 0.8rem;
        }
        
        .table-action-btn {
            width: 35px;
            height: 35px;
        }
        
        .area-header {
            padding: 1rem !important;
        }
        
        .area-title {
            font-size: 1.1rem;
            margin-bottom: 0.5rem !important;
        }
        
        .area-count {
            font-size: 0.85rem;
        }
        
        .area-stats-badges .badge {
            font-size: 0.7rem;
            padding: 0.25rem 0.5rem;
        }
        
        .notification-toast {
            top: 10px !important;
            right: 10px !important;
            left: 10px !important;
            max-width: none !important;
        }
    }
    
    @media (max-width: 576px) {
        .container-fluid {
            padding: 0.5rem !important;
        }
        
        .welcome-section {
            margin: 0.5rem;
            padding: 1.5rem 1rem;
            border-radius: 15px;
        }
        
        .dashboard-cards {
            grid-template-columns: 1fr;
            gap: 0.75rem;
            padding: 0.5rem;
        }
        
        .card {
            border-radius: 15px;
        }
        
        .card-header {
            padding: 1rem;
        }
        
        .orders-section {
            margin: 0.5rem;
            padding: 1rem;
            border-radius: 15px;
        }
        
        .tables-grid {
            grid-template-columns: 1fr;
            gap: 0.75rem;
        }
        
        .table-card {
            border-radius: 15px;
        }
        
        .area-header {
            border-radius: 10px !important;
        }
        
        .table-actions {
            flex-wrap: wrap;
            gap: 0.25rem;
        }
        
        .urgent-badge {
            font-size: 0.7rem;
            padding: 0.2rem 0.5rem;
        }
    }
    
    /* Touch-friendly interactions for mobile */
    @media (hover: none) and (pointer: coarse) {
        .table-card:hover {
            transform: none;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        
        .table-card:active {
            transform: scale(0.98);
        }
        
        .table-action-btn:hover {
            transform: none;
        }
        
        .table-action-btn:active {
            transform: scale(0.95);
        }
    }
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
        .table-card {
            border-width: 2px;
        }
        
        .status-badge {
            border-width: 2px;
        }
    }
    
    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
        .table-card,
        .table-action-btn,
        .notification-toast,
        .area-header::before {
            animation: none;
            transition: none;
        }
        
        .table-urgent {
            animation: none;
        }
    }
`;
document.head.appendChild(style);



