// Function to show reports section for Chef Dashboard
async function showReports() {
    if (!hasWorkSchedule) {
        showNoWorkScheduleMessage();
        return;
    }

    // Update page title
    document.getElementById('pageTitle').textContent = 'Báo cáo ca làm việc';
    
    // Show dynamic content (for reports) and hide others
    document.getElementById('dashboardContent').style.display = 'none';
    document.getElementById('dynamicContent').style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('noWorkScheduleMessage').style.display = 'none';

    // Update active navigation
    updateActiveNav('reports');

    // Load shift report content
    await loadShiftReport();
}


// Function to load shift report data for Chef
async function loadShiftReport() {
    const dynamicContent = document.getElementById('dynamicContent');
    
    // Show loading state
    dynamicContent.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Đang tải...</span>
            </div>
            <p>Đang tải báo cáo ca làm việc...</p>
        </div>
    `;

    try {
        // Get work shift orders using only startTime from currentWorkSchedule (no area for chef)
        const startTime = currentWorkSchedule.startTime;
        
        const data = await apiFetch(`/orders/work-shift-orders?startTime=${encodeURIComponent(startTime)}&size=100`, {
            method: 'GET',
        });

        if (data.code === 0 && data.result) {
            displayShiftReport(data.result);
        } else {
            throw new Error(data.message || 'Không thể tải báo cáo ca làm việc');
        }
    } catch (error) {
        console.error('Error loading shift report:', error);
        dynamicContent.innerHTML = `
            <div class="alert alert-danger text-center">
                <i class="fas fa-exclamation-triangle mb-2" style="font-size: 2rem;"></i>
                <h5>Không thể tải báo cáo</h5>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="loadShiftReport()">
                    <i class="fas fa-refresh me-2"></i>Thử lại
                </button>
            </div>
        `;
    }
}

// Function to display shift report for Chef
function displayShiftReport(orderData) {
    const orders = orderData.content || [];
    const stats = calculateShiftStats(orders);
    
    const dynamicContent = document.getElementById('dynamicContent');
    dynamicContent.innerHTML = `
        <div class="shift-report-container">
            <!-- Report Header -->
            <div class="report-header mb-4">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h4><i class="fas fa-chart-line me-2 text-primary"></i>Báo cáo ca làm việc - Bếp</h4>
                        <p class="text-muted mb-0">
                            <i class="fas fa-calendar me-2"></i>${currentWorkSchedule.date} | 
                            <i class="fas fa-clock me-2"></i>${currentWorkSchedule.startTime} - ${currentWorkSchedule.endTime} | 
                            <i class="fas fa-chef-hat me-2"></i>Tổng quan toàn bộ nhà hàng
                        </p>
                    </div>
                    <div class="col-md-4 text-end">
                        <button class="btn btn-outline-primary btn-sm me-2" onclick="exportReport()">
                            <i class="fas fa-download me-1"></i>Xuất báo cáo
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="loadShiftReport()">
                            <i class="fas fa-sync-alt me-1"></i>Làm mới
                        </button>
                    </div>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card stat-card stat-primary">
                        <div class="card-body text-center">
                            <i class="fas fa-clipboard-list stat-icon"></i>
                            <div class="stat-number">${stats.totalOrders}</div>
                            <div class="stat-label">Tổng đơn hàng</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stat-card stat-success">
                        <div class="card-body text-center">
                            <i class="fas fa-utensils stat-icon"></i>
                            <div class="stat-number">${stats.totalDishes}</div>
                            <div class="stat-label">Tổng món đã nấu</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stat-card stat-info">
                        <div class="card-body text-center">
                            <i class="fas fa-fire stat-icon"></i>
                            <div class="stat-number">${stats.completedOrders}</div>
                            <div class="stat-label">Đơn hoàn thành</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stat-card stat-warning">
                        <div class="card-body text-center">
                            <i class="fas fa-clock stat-icon"></i>
                            <div class="stat-number">${stats.avgPrepTime}</div>
                            <div class="stat-label">Thời gian TB</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Kitchen Performance -->
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6><i class="fas fa-chart-pie me-2"></i>Trạng thái đơn hàng</h6>
                        </div>
                        <div class="card-body">
                            ${generateStatusChart(stats.statusCounts)}
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6><i class="fas fa-chart-bar me-2"></i>Món ăn được nấu nhiều nhất</h6>
                        </div>
                        <div class="card-body">
                            ${generateTopItemsChart(stats.topItems)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Area Performance (if available) -->
            ${stats.areaStats ? `
            <div class="row mb-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h6><i class="fas fa-map-marker-alt me-2"></i>Hiệu suất theo khu vực</h6>
                        </div>
                        <div class="card-body">
                            ${generateAreaChart(stats.areaStats)}
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Detailed Orders Table -->
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6><i class="fas fa-list me-2"></i>Chi tiết đơn hàng (${orders.length})</h6>
                    <div class="filter-controls">
                        <select id="statusFilter" class="form-select form-select-sm" style="width: auto; display: inline-block;" onchange="filterOrders()">
                            <option value="">Tất cả trạng thái</option>
                            <option value="PENDING">Chờ xử lý</option>
                            <option value="PREPARING">Đang chuẩn bị</option>
                            <option value="READY">Sẵn sàng</option>
                            <option value="SERVED">Đã phục vụ</option>
                            <option value="COMPLETED">Hoàn thành</option>
                            <option value="CANCELLED">Đã hủy</option>
                            <option value="CONFIRMED">Đã xác nhận</option>
                        </select>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0" id="ordersTable">
                            <thead class="table-light">
                                <tr>
                                    <th>Mã đơn</th>
                                    <th>Bàn</th>
                                    <th>Khu vực</th>
                                    <th>Thời gian</th>
                                    <th>Món ăn</th>
                                    <th>Trạng thái</th>
                                    <th>Tổng tiền</th>
                                    <th>Ghi chú bếp</th>
                                </tr>
                            </thead>
                            <tbody id="ordersTableBody">
                                ${generateOrderRows(orders)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <style>
        .shift-report-container {
            padding: 20px;
        }

        .stat-card {
            transition: transform 0.2s ease;
            border: none;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .stat-card:hover {
            transform: translateY(-2px);
        }

        .stat-card.stat-primary { border-left: 4px solid #007bff; }
        .stat-card.stat-success { border-left: 4px solid #28a745; }
        .stat-card.stat-info { border-left: 4px solid #17a2b8; }
        .stat-card.stat-warning { border-left: 4px solid #ffc107; }

        .stat-icon {
            font-size: 2rem;
            margin-bottom: 10px;
            opacity: 0.8;
        }

        .stat-number {
            font-size: 1.8rem;
            font-weight: bold;
            color: #333;
        }

        .stat-label {
            color: #666;
            font-size: 0.9rem;
        }

        .status-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }

        .status-item:last-child {
            border-bottom: none;
        }

        .status-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
            min-width: 80px;
            text-align: center;
        }

        .status-pending { background-color: #fff3cd; color: #856404; }
        .status-preparing { background-color: #cfe2ff; color: #084298; }
        .status-ready { background-color: #d4edda; color: #155724; }
        .status-served { background-color: #d1ecf1; color: #0c5460; }
        .status-completed { background-color: #d4edda; color: #155724; }
        .status-cancelled { background-color: #f8d7da; color: #721c24; }
        .status-confirmed { background-color: #cfe2ff; color: #084298; }

        .top-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }

        .top-item:last-child {
            border-bottom: none;
        }

        .item-quantity {
            background-color: #007bff;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.8rem;
            font-weight: bold;
        }

        .area-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }

        .area-item:last-child {
            border-bottom: none;
        }

        .area-name {
            font-weight: 500;
        }

        .area-orders {
            background-color: #28a745;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.8rem;
            font-weight: bold;
        }

        .filter-controls select {
            margin-left: 10px;
        }

        @media (max-width: 768px) {
            .stat-number { font-size: 1.4rem; }
            .stat-icon { font-size: 1.5rem; }
            .shift-report-container { padding: 10px; }
        }
        </style>
    `;
}

// Function to calculate shift statistics for Chef
function calculateShiftStats(orders) {
    const stats = {
        totalOrders: orders.length,
        totalDishes: 0,
        completedOrders: 0,
        statusCounts: {},
        topItems: {},
        areaStats: {},
        avgPrepTime: '15p' // This would need actual calculation based on timestamps
    };

    orders.forEach(order => {
        // Count completed orders
        if (['COMPLETED', 'SERVED'].includes(order.status)) {
            stats.completedOrders++;
        }
        
        // Count status distribution
        const status = order.status || 'UNKNOWN';
        stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1;
        
        // Count total dishes and top items
        if (order.orderItems) {
            order.orderItems.forEach(item => {
                stats.totalDishes += item.quantity;
                
                const itemName = item.menuItemName;
                if (!stats.topItems[itemName]) {
                    stats.topItems[itemName] = 0;
                }
                stats.topItems[itemName] += item.quantity;
            });
        }

        // Count orders by area (if area information is available)
        if (order.area) {
            if (!stats.areaStats[order.area]) {
                stats.areaStats[order.area] = 0;
            }
            stats.areaStats[order.area]++;
        }
    });

    // Check if we have area data
    if (Object.keys(stats.areaStats).length === 0) {
        stats.areaStats = null;
    }

    return stats;
}

// Function to generate status chart (same as waiter)
function generateStatusChart(statusCounts) {
    const statusLabels = {
        'PENDING': 'Chờ xử lý',
        'PREPARING': 'Đang chuẩn bị', 
        'READY': 'Sẵn sàng',
        'SERVED': 'Đã phục vụ',
        'COMPLETED': 'Hoàn thành',
        'CANCELLED': 'Đã hủy',
        'CONFIRMED': 'Đã xác nhận'
    };

    let html = '';
    for (const [status, count] of Object.entries(statusCounts)) {
        const label = statusLabels[status] || status;
        const cssClass = `status-${status.toLowerCase()}`;
        html += `
            <div class="status-item">
                <div>
                    <span class="status-badge ${cssClass}">${label}</span>
                </div>
                <div class="fw-bold">${count}</div>
            </div>
        `;
    }
    
    return html || '<p class="text-muted">Không có dữ liệu</p>';
}

// Function to generate top items chart (same as waiter)
function generateTopItemsChart(topItems) {
    // Sort items by quantity and take top 5
    const sortedItems = Object.entries(topItems)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

    let html = '';
    sortedItems.forEach(([itemName, quantity]) => {
        html += `
            <div class="top-item">
                <div class="item-name">${itemName}</div>
                <div class="item-quantity">${quantity}</div>
            </div>
        `;
    });
    
    return html || '<p class="text-muted">Không có dữ liệu</p>';
}

// Function to generate area chart for Chef
function generateAreaChart(areaStats) {
    const sortedAreas = Object.entries(areaStats)
        .sort(([,a], [,b]) => b - a);

    let html = '';
    sortedAreas.forEach(([areaName, orderCount]) => {
        html += `
            <div class="area-item">
                <div class="area-name">${areaName}</div>
                <div class="area-orders">${orderCount} đơn</div>
            </div>
        `;
    });
    
    return html || '<p class="text-muted">Không có dữ liệu khu vực</p>';
}

// Function to generate order rows for Chef (updated with area column)
function generateOrderRows(orders) {
    if (!orders || orders.length === 0) {
        return '<tr><td colspan="8" class="text-center text-muted py-4">Không có đơn hàng nào trong ca làm việc này</td></tr>';
    }

    return orders.map(order => {
        const orderTime = new Date(order.createdAt).toLocaleString('vi-VN');
        const statusClass = `status-${order.status.toLowerCase()}`;
        const statusLabels = {
            'PENDING': 'Chờ xử lý',
            'PREPARING': 'Đang chuẩn bị',
            'READY': 'Sẵn sàng', 
            'SERVED': 'Đã phục vụ',
            'COMPLETED': 'Hoàn thành',
            'CANCELLED': 'Đã hủy',
            'CONFIRMED': 'Đã xác nhận'
        };
        
        const items = order.orderItems ? order.orderItems.map(item => 
            `${item.quantity}x ${item.menuItemName}`
        ).join(', ') : 'Không có món';

        // Extract kitchen notes from order items
        const kitchenNotes = order.orderItems ? order.orderItems
            .filter(item => item.note)
            .map(item => `${item.menuItemName}: ${item.note}`)
            .join('; ') : '';

        return `
            <tr data-status="${order.status}">
                <td><strong>#${order.id}</strong></td>
                <td><span class="badge bg-secondary">${order.tableNumber || 'N/A'}</span></td>
                <td><span class="badge bg-info">${order.area || 'N/A'}</span></td>
                <td>${orderTime}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${items}">
                    ${items}
                </td>
                <td><span class="status-badge ${statusClass}">${statusLabels[order.status] || order.status}</span></td>
                <td><strong>${formatCurrency(order.totalAmount)}</strong></td>
                <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${kitchenNotes || order.note || ''}">
                    ${kitchenNotes || order.note || '<em class="text-muted">Không có ghi chú</em>'}
                </td>
            </tr>
        `;
    }).join('');
}

// Function to filter orders by status (same as waiter)
function filterOrders() {
    const selectedStatus = document.getElementById('statusFilter').value;
    const rows = document.querySelectorAll('#ordersTableBody tr');
    
    rows.forEach(row => {
        const rowStatus = row.getAttribute('data-status');
        if (!selectedStatus || rowStatus === selectedStatus) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Function to format currency (same as waiter)
function formatCurrency(amount) {
    if (!amount) return '₫0';
    return '₫' + parseFloat(amount).toLocaleString('vi-VN');
}

// Function to export report (placeholder)
function exportReport() {
    alert('Chức năng xuất báo cáo sẽ được phát triển trong phiên bản tiếp theo.\n\nBáo cáo sẽ được xuất dưới dạng PDF hoặc Excel.\n\nBáo cáo bếp sẽ bao gồm:\n- Thống kê món ăn đã nấu\n- Hiệu suất theo ca làm việc\n- Phân tích thời gian chuẩn bị');
}