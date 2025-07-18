// Function to show reports section
async function showReports() {

    document.getElementById('pageTitle').textContent = 'Báo Cáo Ca Làm';
    document.getElementById('dashboardContent').style.display = 'none';
    document.getElementById('dynamicContent').style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';

    updateActiveNav('reports');

    // Load shift report content
    await loadShiftReport();
}

// Function to load shift report data
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

        const data = await apiFetch(`/orders/chef/work-shift-orders/${currentUserInfo.id}?&size=100`, {
            method: 'GET',
        });

        if (data.code === 0 && data.result) {
            displayShiftReport(data.result);
        } else {
            throw new Error(data.message || 'Không thể tải báo cáo ca làm việc');
        }
    } catch (error) {
        console.error('Error loading shift report:', error);
        if (error.code == 1041 || error.code == 1048) {
            dynamicContent.innerHTML = `
            <div class="alert text-center">
                <i class="fas fa-calendar-times fa-3x text-muted mb-3"></i>
                <h6 class="text-muted">Hiện tại bạn đang không trong ca làm</h6>
                <p class="text-muted small">Đơn hàng sẽ hiển thị khi bạn có ca làm việc</p>
            </div>
        `;
        } else {
            dynamicContent.innerHTML = `
            <div class="alert alert-danger text-center">
                <i class="fas fa-exclamation-triangle mb-2" style="font-size: 2rem;"></i>
                <h5>Không thể tải báo cáo</h5>
                <p>${error.message}</p>
                <button class="btn-report btn-primary" onclick="loadShiftReport()">
                    <i class="fas fa-refresh me-2"></i>Thử lại
                </button>
            </div>
        `;
        }
    }
}

// Function to display shift report
function displayShiftReport(orderData) {
    const orders = orderData.content || [];
    const stats = calculateShiftStats(orders);
    const scheduleDate = new Date(currentWorkSchedule.date);
    const formattedDate = scheduleDate.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const formattedStartTime = formatTimeFromISOString(currentWorkSchedule.startTime);
    const formattedEndTime = formatTimeFromISOString(currentWorkSchedule.endTime);

    const dynamicContent = document.getElementById('dynamicContent');
    dynamicContent.innerHTML = `
        <div class="shift-report-container">
            <!-- Report Header -->
            <div class="report-header">
                <div class="header-content">
                    <div class="header-info">
                        <h2 class="report-title">
                            <i class="fas fa-chart-line"></i>
                            Báo Cáo Ca Làm
                        </h2>
                        <div class="shift-details">
                            <span class="detail-item">
                                <i class="fas fa-calendar-alt"></i>
                                ${formattedDate}
                            </span>
                            <span class="detail-item">
                                <i class="fas fa-clock"></i>
                                ${formattedStartTime} - ${formattedEndTime}
                            </span>
                        </div>
                    </div>
                    <div class="header-actions">
                        <button class="btn-report btn-secondary" onclick="exportReport()">
                            <i class="fas fa-download"></i>
                            Xuất báo cáo
                        </button>
                        <button class="btn-report btn-primary" onclick="loadShiftReport()">
                            <i class="fas fa-sync-alt"></i>
                            Làm mới
                        </button>
                    </div>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="stats-grid">
                <div class="shift-stat-card stat-primary">
                    <div class="shift-stat-icon">
                        <i class="fas fa-shopping-cart"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-number">${stats.totalOrders}</div>
                        <div class="stat-label">Tổng đơn hàng</div>
                    </div>
                </div>
                
                <div class="shift-stat-card stat-success">
                    <div class="shift-stat-icon">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-number">${formatCurrency(stats.totalRevenue)}</div>
                        <div class="stat-label">Tổng doanh thu</div>
                    </div>
                </div>
            
                
                <div class="shift-stat-card stat-warning">
                    <div class="shift-stat-icon">
                        <i class="fas fa-calculator"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-number">${formatCurrency(stats.avgOrderValue)}</div>
                        <div class="stat-label">Trung bình/đơn</div>
                    </div>
                </div>
            </div>

            <!-- Charts Section -->
            <div class="charts-grid">
                <div class="chart-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-chart-pie"></i>
                            Phân bố trạng thái đơn hàng
                        </h3>
                    </div>
                    <div class="card-content">
                        ${generateStatusChart(stats.statusCounts)}
                    </div>
                </div>
                
                <div class="chart-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-chart-bar"></i>
                            Top món ăn bán chạy
                        </h3>
                    </div>
                    <div class="card-content">
                        ${generateTopItemsChart(stats.topItems)}
                    </div>
                </div>
            </div>

            <!-- Orders Table -->
            <div class="table-card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-list"></i>
                        Chi tiết đơn hàng (${orders.length})
                    </h3>
                    <div class="filter-section">
                        <select id="statusFilter" class="filter-select" onchange="filterOrders()">
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
                <div class="table-wrapper">
                    <table class="orders-table" id="ordersTable">
                        <thead>
                            <tr>
                                <th>Mã đơn</th>
                                <th>Bàn</th>
                                <th>Thời gian</th>
                                <th>Món ăn</th>
                                <th>Trạng thái</th>
                                <th>Tổng tiền</th>
                            </tr>
                        </thead>
                        <tbody id="ordersTableBody">
                            ${generateOrderRows(orders)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <style>
        :root {
            --primary: #FEA116;
            --light: #F1F8FF;
            --dark: #0F172B;
            --success: #10B981;
            --warning: #F59E0B;
            --danger: #EF4444;
            --info: #3B82F6;
            --white: #FFFFFF;
            --gray-50: #F9FAFB;
            --gray-100: #F3F4F6;
            --gray-200: #E5E7EB;
            --gray-300: #D1D5DB;
            --gray-400: #9CA3AF;
            --gray-500: #6B7280;
            --gray-600: #4B5563;
            --gray-700: #374151;
            --gray-800: #1F2937;
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            --radius: 12px;
            --radius-sm: 8px;
        }

        .shift-report-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 24px;
            background-color: var(--gray-50);
            min-height: 100vh;
        }

        /* Header Styles */
        .report-header {
            background: linear-gradient(135deg, var(--primary) 0%, #FFB84D 100%);
            border-radius: var(--radius);
            padding: 24px;
            margin-bottom: 24px;
            color: var(--white);
            box-shadow: var(--shadow-lg);
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
        }

        .report-title {
            font-size: 28px;
            font-weight: 700;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .report-title i {
            font-size: 24px;
        }

        .shift-details {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            opacity: 0.9;
        }

        .detail-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 500;
        }

        .header-actions {
            display: flex;
            gap: 12px;
            flex-shrink: 0;
        }

        /* Button Styles */
        .btn-report {
            padding: 10px 20px;
            border-radius: var(--radius-sm);
            border: none;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            text-decoration: none;
        }

        .btn-primary {
            background-color: var(--white);
            color: var(--primary);
        }

        .btn-primary:hover {
            background-color: var(--gray-100);
            transform: translateY(-1px);
        }

        .btn-secondary {
            background-color: rgba(255, 255, 255, 0.2);
            color: var(--white);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .btn-secondary:hover {
            background-color: rgba(255, 255, 255, 0.3);
            transform: translateY(-1px);
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 24px;
        }

        .shift-stat-card {
            background: var(--white);
            border-radius: var(--radius);
            padding: 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            border: 2px solid #e5e7eb;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            transition: transform 0.2s ease;
            position: relative;
        }

        .shift-stat-card:hover {
            transform: translateY(-2px);
        }

        /* Specific styling for shift report stat icons to avoid conflicts */
        .shift-stat-card .shift-stat-icon {
            width: 60px !important;
            height: 60px !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 24px !important;
            color: var(--white) !important;
            flex-shrink: 0 !important;
            position: static !important;
            top: auto !important;
            right: auto !important;
            transition: none !important;
        }

        .stat-primary .shift-stat-icon { background-color: var(--primary) !important; }
        .stat-success .shift-stat-icon { background-color: var(--success) !important; }
        .stat-info .shift-stat-icon { background-color: var(--info) !important; }
        .stat-warning .shift-stat-icon { background-color: var(--warning) !important; }

        .stat-content {
            flex: 1;
        }

        .stat-content .stat-number {
            font-size: 32px;
            font-weight: 700;
            color: var(--dark);
            margin-bottom: 4px;
            line-height: 1;
            animation: countUp 0.6s ease-out;
            font-size: 24px;
        }

        .stat-content .stat-label {
            font-size: 14px;
            color: var(--gray-600);
            font-weight: 500;
        }

        /* Charts Grid */
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 24px;
        }

        /* Card Styles */
        .chart-card, .table-card {
            background: var(--white);
            border-radius: var(--radius);
            border: 2px solid #e5e7eb;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }

        .card-header {
            padding: 20px 24px;
            background: var(--gray-50);
            border-bottom: 1px solid var(--gray-200);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .card-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--dark);
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .card-title i {
            color: var(--primary);
        }

        .card-content {
            padding: 24px;
        }

        /* Filter Styles */
        .filter-section {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .filter-select {
            padding: 8px 12px;
            border: 1px solid var(--gray-300);
            border-radius: var(--radius-sm);
            background: var(--white);
            color: var(--dark);
            font-size: 14px;
            min-width: 160px;
        }

        .filter-select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(254, 161, 22, 0.1);
        }

        /* Table Styles */
        .table-wrapper {
            overflow-x: auto;
        }

        .orders-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        .orders-table th {
            background: var(--gray-50);
            padding: 12px 16px;
            text-align: left;
            font-weight: 600;
            color: var(--dark);
            border-bottom: 2px solid var(--gray-200);
            white-space: nowrap;
        }

        .orders-table td {
            padding: 12px 16px;
            border-bottom: 1px solid var(--gray-200);
            color: var(--gray-700);
            vertical-align: top;
        }

        .orders-table tbody tr:hover {
            background-color: var(--gray-50);
        }

        /* Status Badges */
        .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-block;
            min-width: 80px;
            text-align: center;
        }

        .status-pending { background-color: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .status-preparing { background-color: rgba(59, 130, 246, 0.1); color: var(--info); }
        .status-ready { background-color: rgba(16, 185, 129, 0.1); color: var(--success); }
        .status-served { background-color: rgba(59, 130, 246, 0.1); color: var(--info); }
        .status-completed { background-color: rgba(16, 185, 129, 0.1); color: var(--success); }
        .status-cancelled { background-color: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .status-confirmed { background-color: rgba(59, 130, 246, 0.1); color: var(--info); }

        /* Chart Items */
        .status-item, .top-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid var(--gray-200);
        }

        .status-item:last-child, .top-item:last-child {
            border-bottom: none;
        }

        .item-quantity {
            background: linear-gradient(135deg, var(--primary) 0%, #FFB84D 100%);
            color: var(--white);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            min-width: 30px;
            text-align: center;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .shift-report-container {
                padding: 16px;
            }

            .header-content {
                flex-direction: column;
                align-items: stretch;
                gap: 8px;
            }

            .header-actions {
                justify-content: flex-end;
                margin-top: 16px;
            }

            .shift-details {
                flex-direction: column;
                gap: 8px;
            }

            .stats-grid {
                grid-template-columns: 1fr;
                gap: 16px;
            }

            .charts-grid {
                grid-template-columns: 1fr;
                gap: 16px;
            }

            .shift-stat-card .shift-stat-icon {
                width: 50px !important;
                height: 50px !important;
                font-size: 20px !important;
            }

            .report-title {
                font-size: 24px;
            }
            
            .header-actions {
                justify-content: center;
                margin-top: 16px;
                flex-wrap: wrap;
            }
        }

        @media (max-width: 480px) {
            .card-header {
                flex-direction: column;
                align-items: stretch;
                gap: 12px;
            }

            .filter-section {
                justify-content: flex-end;
            }

            .orders-table {
                font-size: 12px;
            }

            .orders-table th,
            .orders-table td {
                padding: 8px 12px;
            }
        }
        </style>
    `;
}


// Function to calculate shift statistics
function calculateShiftStats(orders) {
    const stats = {
        totalOrders: orders.length,
        totalRevenue: 0,
        statusCounts: {},
        topItems: {},
        avgOrderValue: 0
    };

    orders.forEach(order => {
        // Calculate total revenue
        stats.totalRevenue += parseFloat(order.totalAmount || 0);

        // Count status distribution
        const status = order.status || 'UNKNOWN';
        stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1;

        // Count top items
        if (order.orderItems) {
            order.orderItems.forEach(item => {
                const itemName = item.menuItemName;
                if (!stats.topItems[itemName]) {
                    stats.topItems[itemName] = 0;
                }
                stats.topItems[itemName] += item.quantity;
            });
        }
    });

    stats.avgOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;

    return stats;
}

// Function to generate status chart
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

// Function to generate top items chart
function generateTopItemsChart(topItems) {
    // Sort items by quantity and take top 5
    const sortedItems = Object.entries(topItems)
        .sort(([, a], [, b]) => b - a)
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

// Function to generate order rows
function generateOrderRows(orders) {
    if (!orders || orders.length === 0) {
        return '<tr><td colspan="7" class="text-center text-muted py-4">Không có đơn hàng nào trong ca làm việc này</td></tr>';
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

        return `
            <tr data-status="${order.status}">
                <td><strong>#${order.id}</strong></td>
                <td><span class="badge" style="background-color: var(--primary)">${order.tableNumber || 'N/A'}</span></td>
                <td>${orderTime}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${items}">
                    ${items}
                </td>
                <td><span class="status-badge ${statusClass}">${statusLabels[order.status] || order.status}</span></td>
                <td><strong>${formatCurrency(order.totalAmount)}</strong></td>
            </tr>
        `;
    }).join('');
}

// Function to filter orders by status
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

// Function to format currency
function formatCurrency(amount) {
    if (!amount) return '₫0';
    return '₫' + parseFloat(amount).toLocaleString('vi-VN');
}

// Function to export report (placeholder)
function exportReport() {
    alert('Chức năng xuất báo cáo sẽ được phát triển trong phiên bản tiếp theo.\n\nBáo cáo sẽ được xuất dưới dạng PDF hoặc Excel.');
}