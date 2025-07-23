
// Danh sách lưu trữ đơn hàng (tạo mảng để theo dõi)
let paymentList = [];


//====================================================================================

// Biến toàn cục cho phân trang
let currentPage = 1;
const itemsPerPage = 10;
//====================================================================================

  // Đối tượng lưu trữ bộ lọc
      let filters = {
          status: 'all',
          priceRange: null,
          sort: null,
          orderBy: 'createdAt' // Mặc định sắp xếp theo createdAt
      };

      
//==================================================================================//==================================================================================
let currentDetailsRow = null;
let currentActiveRow = null;
let currentButton = null;
let isProcessing = false; // Flag để ngăn spam click
//==================================================================================//==================================================================================

async function checkNewOrders() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/payments/list?status=UNPAID&period=today&page=0&size=10`);
        const newOrders = response.result?.content || [];

        if (newOrders.length > 0) {
            newOrders.forEach(order => {
                if (!paymentList.some(p => p.orderId === order.orderId)) {
                    showNotificationAndUpdate(`Đơn mới: ${order.orderId} - ${order.amount ? order.amount.toLocaleString('vi-VN') + ' VND' : 'N/A'}`, order);
                    paymentList.push(order);
                    updateTransactionTable(order);

                    setTimeout(async () => {
                        await reloadSearch();
                        await refreshRevenue();
                        calculateDailySummary(); // Đảm bảo gọi lại sau khi thêm đơn
                    }, 1000);
                }
            });
        }
    } catch (error) {
        console.error('Lỗi khi kiểm tra đơn mới:', error);
    }
}

function updateTransactionTable(order) {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;

    const existingRow = Array.from(tbody.getElementsByTagName('tr')).find(row =>
        row.cells[0].textContent === order.orderId.toString()
    );
    if (existingRow) return;

    const row = document.createElement('tr');
    row.className = 'transaction-row';
    let actionButtons = document.createElement('td');
    actionButtons.className = 'action-buttons';

    const detailBtn = document.createElement('button');
    detailBtn.className = 'details-btn';
    detailBtn.textContent = 'Xem chi tiết';
    detailBtn.setAttribute('onclick', `showOrderDetails(${order.orderId}, this)`);

    let processBtn = null, cancelBtn = null;
    if (order.status === 'UNPAID') { // Chỉ hỗ trợ UNPAID
        processBtn = document.createElement('button');
        processBtn.className = 'action-btn process-btn';
        processBtn.textContent = 'Process';
        processBtn.setAttribute('onclick', `showPaymentMethodPopup(${order.orderId}, this)`);

        cancelBtn = document.createElement('button');
        cancelBtn.className = 'action-btn cancel-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.setAttribute('onclick', `cancelOrRefund(${order.orderId})`);
    }

    actionButtons.appendChild(detailBtn);
    if (processBtn) actionButtons.appendChild(processBtn);
    if (cancelBtn) actionButtons.appendChild(cancelBtn);

    const buttons = [detailBtn, processBtn, cancelBtn].filter(btn => btn);
    buttons.forEach(button => {
        const tooltip = document.createElement('span');
        tooltip.className = 'tooltip';
        tooltip.textContent = button.classList.contains('details-btn') ? 'Xem đơn' :
                            button.classList.contains('process-btn') ? 'Xử lý thanh toán' :
                            'Hủy đơn hàng';
        button.appendChild(tooltip);

        button.addEventListener('mouseover', () => {
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
        });
        button.addEventListener('mouseout', () => {
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
        });
    });

    row.innerHTML = `
        <td>${order.orderId || 'N/A'}</td>
        <td>${(order.amount || 0).toLocaleString('vi-VN')}₫</td>
        <td>${order.paymentMethod || 'N/A'}</td>
        <td><span style="color: ${order.status === 'PAID' ? '#2ed573' : order.status === 'CANCELLED' ? '#ff4757' : '#ff9800'}">${order.status === 'UNPAID' ? 'Chưa thanh toán' : order.status === 'PAID' ? 'Đã thanh toán' : order.status === 'CANCELLED' ? 'Đã hủy' : 'N/A'}</span></td>
        <td>${order.transactionId !== null && order.transactionId !== undefined ? order.transactionId : 'Chưa có'}</td>
        <td>${order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</td>
        <td>${order.updatedAt ? new Date(order.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</td>
    `;
    row.appendChild(actionButtons);
    tbody.prepend(row);

    const transactionCount = document.getElementById('transactionCount');
    if (transactionCount) {
        const currentCount = parseInt(transactionCount.textContent.match(/\d+/)?.[0] || 0) || 0;
        transactionCount.textContent = `Tổng số hóa đơn: ${currentCount + 1} (Trạng thái: ${filters.status === 'all' ? 'Tất cả' : filters.status === 'UNPAID' ? 'Chưa thanh toán' : filters.status}, Phương thức: ${filters.method === 'all' ? 'Tất cả' : filters.method}, Giá: ${filters.priceRange ? `${filters.priceRange[0].toLocaleString('vi-VN')} - ${filters.priceRange[1].toLocaleString('vi-VN')} VNĐ` : 'Tất cả'}, Sắp xếp: ${filters.sort ? (filters.sort === 'asc' ? 'Tăng dần' : 'Giảm dần') : 'Mặc định'})`;
    }

    const table = document.getElementById('transactionsTable');
    if (table) table.style.display = 'table';
    document.getElementById('filterContainer').style.display = 'block';
    document.getElementById('searchContainer').style.display = 'block';
}

// Gọi hàm kiểm tra định kỳ
setInterval(checkNewOrders, 30000);

// Kiểm tra ngay khi tải trang
document.addEventListener('DOMContentLoaded', checkNewOrders);

// Hàm reload đã có của bạn
async function reloadSearch() {
    const searchInput = document.getElementById('searchTransactionInput');
    const tbody = document.getElementById('transactionsBody');
    const transactionCount = document.getElementById('transactionCount');
    const errorElement = document.getElementById('error');
    const table = document.getElementById('transactionsTable');
    const filterContainer = document.getElementById('filterContainer');
    const searchContainer = document.getElementById('searchContainer');

    // Làm trống ô input
    if (searchInput) searchInput.value = '';

    // Ẩn gợi ý nếu đang hiển thị
    const suggestionBox = document.getElementById('suggestionBox');
    if (suggestionBox) suggestionBox.style.display = 'none';

    // Xóa nội dung bảng và thông báo
    clearMessages();
    if (tbody) tbody.innerHTML = '';
    if (transactionCount) transactionCount.textContent = '';
    if (errorElement) errorElement.style.display = 'none';
    if (table) table.style.display = 'none';

    // Tải lại danh sách giao dịch ban đầu
    await refreshTransactions();
}


//====================================================================================


//==================================================================================//==================================================================================
// Hàm làm mới giao dịch với phân trang
async function refreshTransactions(status = null) {
    try {
        const params = new URLSearchParams();
        params.append('period', 'today');
        if (status && status !== 'all') params.append('status', status);
        params.append('paymentMethod', 'CASH'); // Cố định CASH
        if (filters.priceRange) {
            params.append('minPrice', filters.priceRange[0]);
            params.append('maxPrice', filters.priceRange[1]);
        }
        params.append('page', currentPage - 1);
        params.append('size', itemsPerPage);
        params.append('orderBy', filters.orderBy);
        params.append('sort', filters.sort || 'ASC');
        console.log('API request params:', params.toString());

        const data = await apiFetch(`${API_BASE_URL}/payments/list?${params.toString()}`);
        console.log('API response from /payments/list:', data);

        const tbody = document.getElementById("transactionsBody");
        const transactionCount = document.getElementById("transactionCount");
        const paginationDiv = document.getElementById("pagination") || createPaginationDiv();

        if (!tbody) {
            console.error("Element 'transactionsBody' not found in DOM");
            showError("error", "❌ Không tìm thấy bảng giao dịch trong giao diện.");
            return;
        }

        if (data.code === 0 && data.result && data.result.content) {
            const transactions = data.result.content;
            const totalPages = data.result.totalPages;
            const totalItems = data.result.totalElements;

            if (transactions.length > 0) {
                document.getElementById("transactionsTable").style.display = "table";
                document.getElementById("filterContainer").style.display = "block";
                document.getElementById("searchContainer").style.display = "block";

                tbody.innerHTML = "";
                transactions.forEach(tx => {
                    const row = document.createElement("tr");
                    row.className = 'transaction-row';
                    let actionButtons = document.createElement('td');
                    actionButtons.className = 'action-buttons';

                    const detailBtn = document.createElement('button');
                    detailBtn.className = 'details-btn';
                    detailBtn.textContent = 'Xem chi tiết';
                    detailBtn.setAttribute('onclick', `showOrderDetails(${tx.orderId}, this)`);

                    let processBtn = null, cancelBtn = null, invoiceBtn = null;
                    if (tx.status === "UNPAID") {
                        processBtn = document.createElement('button');
                        processBtn.className = 'action-btn process-btn';
                        processBtn.textContent = 'Process';
                        processBtn.setAttribute('onclick', `processPayment(${tx.orderId}, 'CASH', this)`); // Gọi trực tiếp processPayment

                        cancelBtn = document.createElement('button');
                        cancelBtn.className = 'action-btn cancel-btn';
                        cancelBtn.textContent = 'Cancel';
                        cancelBtn.setAttribute('onclick', `cancelOrRefund(${tx.orderId})`);
                    } else if (tx.status === "PAID") {
                        invoiceBtn = document.createElement('button');
                        invoiceBtn.className = 'btn btn-outline-primary';
                        invoiceBtn.textContent = '🖨️ Tải Hóa Đơn';
                        invoiceBtn.setAttribute('onclick', `viewInvoicePdf(${tx.orderId})`);
                    }

                    actionButtons.appendChild(detailBtn);
                    if (processBtn) actionButtons.appendChild(processBtn);
                    if (cancelBtn) actionButtons.appendChild(cancelBtn);
                    if (invoiceBtn) actionButtons.appendChild(invoiceBtn);

                    const buttons = actionButtons.querySelectorAll('button');
                    buttons.forEach(button => {
                        const tooltip = document.createElement('span');
                        tooltip.className = 'tooltip';
                        let tooltipText = '';
                        if (button.classList.contains('details-btn')) tooltipText = 'Xem đơn';
                        else if (button.classList.contains('process-btn')) tooltipText = 'Xử lý thanh toán';
                        else if (button.classList.contains('cancel-btn')) tooltipText = 'Hủy đơn hàng';
                        else if (button.classList.contains('btn-outline-primary')) tooltipText = 'Tải hóa đơn';
                        tooltip.textContent = tooltipText;

                        button.appendChild(tooltip);
                        button.addEventListener('mouseover', () => {
                            tooltip.style.visibility = 'visible';
                            tooltip.style.opacity = '1';
                        });
                        button.addEventListener('mouseout', () => {
                            tooltip.style.visibility = 'hidden';
                            tooltip.style.opacity = '0';
                        });
                    });

                    row.innerHTML = `
                        <td>${tx.orderId || 'N/A'}</td>
                        <td>${(tx.amount || 0).toLocaleString('vi-VN')}₫</td>
                        <td>${tx.status === 'PAID' ? 'CASH' : 'N/A'}</td> <!-- Chỉ hiển thị CASH khi PAID -->
                        <td><span style="color: ${tx.status === 'PAID' ? '#2ed573' : tx.status === 'CANCELLED' ? '#ff4757' : '#ff9800'}">${tx.status === 'UNPAID' ? 'Chưa thanh toán' : tx.status === 'PAID' ? 'Đã thanh toán' : tx.status === 'CANCELLED' ? 'Đã hủy' : 'N/A'}</span></td>
                        <td>${tx.transactionId || tx.transaction_id || 'N/A'}</td>
                        <td>${tx.createdAt ? new Date(tx.createdAt).toISOString().replace('T', ' ').split('.')[0] : 'N/A'}</td>
                        <td>${tx.updatedAt ? new Date(tx.updatedAt).toISOString().replace('T', ' ').split('.')[0] : 'N/A'}</td>
                    `;
                    row.appendChild(actionButtons);
                    tbody.appendChild(row);
                });

                transactionCount.textContent = `Tổng số hóa đơn: ${totalItems} (Trang ${currentPage}/${totalPages}, Trạng thái: ${filters.status === 'all' ? 'Tất cả' : filters.status === 'UNPAID' ? 'Chưa thanh toán' : filters.status}, Phương thức: CASH, Giá: ${filters.priceRange ? `${filters.priceRange[0].toLocaleString('vi-VN')} - ${filters.priceRange[1].toLocaleString('vi-VN')} VNĐ` : 'Tất cả'}, Sắp xếp: ${filters.sort ? (filters.sort === 'asc' ? 'Tăng dần' : 'Giảm dần') : 'Mặc định'})`;
                updatePagination(totalPages);
            } else {
                document.getElementById("transactionsTable").style.display = "none";
                document.getElementById("filterContainer").style.display = "block";
                document.getElementById("searchContainer").style.display = "none";
                transactionCount.textContent = `Không có hóa đơn nào với các bộ lọc: Trạng thái ${filters.status === 'all' ? 'Tất cả' : filters.status === 'UNPAID' ? 'Chưa thanh toán' : filters.status}, Phương thức: CASH, Giá: ${filters.priceRange ? `${filters.priceRange[0].toLocaleString('vi-VN')} - ${filters.priceRange[1].toLocaleString('vi-VN')} VNĐ` : 'Tất cả'}, Sắp xếp: ${filters.sort ? (filters.sort === 'asc' ? 'Tăng dần' : 'Giảm dần') : 'Mặc định'}.`;
                paginationDiv.style.display = 'none';
            }
            document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        } else {
            throw new Error(data.message || "Không thể tải giao dịch.");
        }
    } catch (error) {
        console.error("Error fetching transactions:", error);
        showError("error", `❌ ${error.message || "Không thể tải giao dịch."}`);
        document.getElementById("transactionsTable").style.display = "none";
        if (tbody) tbody.innerHTML = "";
        if (transactionCount) transactionCount.textContent = "";
        if (paginationDiv) paginationDiv.style.display = 'none';
    }
}



// Hàm tạo và cập nhật phần phân trang
function createPaginationDiv() {
    let paginationDiv = document.getElementById("pagination");
    if (!paginationDiv) {
        paginationDiv = document.createElement("div");
        paginationDiv.id = "pagination";
        paginationDiv.style.cssText = `
            margin-top: 10px;
            text-align: center;
            display: flex;
            justify-content: center;
            gap: 10px;
        `;
        document.getElementById("transactionsResult").appendChild(paginationDiv);
    }
    return paginationDiv;
}

function updatePagination(totalPages) {
    const paginationDiv = document.getElementById("pagination");
    paginationDiv.innerHTML = "";

    // Nút Previous
    const prevButton = document.createElement("button");
    prevButton.textContent = "Trước";
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            refreshTransactions();
        }
    };
    prevButton.style.cssText = `
        padding: 5px 10px;
        cursor: pointer;
        background-color: ${prevButton.disabled ? '#ccc' : '#ff9800'};
        color: white;
        border: none;
        border-radius: 5px;
    `;
    paginationDiv.appendChild(prevButton);

    // Nút số trang (tùy chọn hiển thị 5 trang xung quanh trang hiện tại)
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = i;
        pageButton.disabled = i === currentPage;
        pageButton.style.cssText = `
            padding: 5px 10px;
            cursor: pointer;
            background-color: ${i === currentPage ? '#ff5722' : '#ff9800'};
            color: white;
            border: none;
            border-radius: 5px;
        `;
        pageButton.onclick = () => {
            if (i !== currentPage) {
                currentPage = i;
                refreshTransactions();
            }
        };
        paginationDiv.appendChild(pageButton);
    }

    // Nút Next
    const nextButton = document.createElement("button");
    nextButton.textContent = "Sau";
    nextButton.disabled = currentPage >= totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            console.log('Navigating to page:', currentPage);
            refreshTransactions();
        }
    };
    nextButton.style.cssText = `
        padding: 5px 10px;
        cursor: pointer;
        background-color: ${nextButton.disabled ? '#ccc' : '#ff9800'};
        color: white;
        border: none;
        border-radius: 5px;
    `;
    paginationDiv.appendChild(nextButton);

    paginationDiv.style.display = totalPages > 1 ? "flex" : "none";
}

//====================================================================================

//======================lọc lọc==============================================================

// Hiển thị menu lọc
function showFilterMenu(type) {
    console.log(`showFilterMenu called with type: ${type}`);
    const menu = document.getElementById(`${type}FilterMenu`);
    const filterBtnId = type === 'sortPrice' ? 'sortPriceBtn' : `${type}FilterBtn`;
    const filterBtn = document.getElementById(filterBtnId);

    if (!menu || !filterBtn) {
        console.error(`Lỗi: Không tìm thấy menu ${type}FilterMenu hoặc nút ${filterBtnId}`);
        return;
    }

    // Đóng tất cả menu khác
    document.querySelectorAll('.filter-menu').forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });

    // Toggle menu
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';

    if (menu.style.display === 'block') {
        const filterContainer = document.getElementById('filterContainer');
        menu.style.position = 'absolute';
        const rect = filterBtn.getBoundingClientRect();
        const containerRect = filterContainer.getBoundingClientRect();
        let topPos = rect.bottom - containerRect.top + 2;
        let menuHeight = menu.offsetHeight || 200;

        if (topPos + menuHeight > window.innerHeight - containerRect.top) {
            topPos = rect.top - containerRect.top - menuHeight - 2;
            if (topPos < 0) topPos = 0;
        }

        menu.style.left = `${rect.left - containerRect.left}px`;
        menu.style.top = `${topPos}px`;
        menu.style.zIndex = '1002';
        console.log(`Hiện menu ${type}FilterMenu tại left=${menu.style.left}, top=${menu.style.top}, height=${menuHeight}px`);
    }

    // Ngăn lan truyền click và xử lý click ngoài
    filterBtn.addEventListener('click', (e) => e.stopPropagation(), { once: true });
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !filterBtn.contains(e.target)) {
            menu.style.display = 'none';
            console.log(`Đóng menu ${type}FilterMenu do click ngoài`);
        }
    }, { once: true });
}

// Áp dụng sắp xếp
function applySortFilter(type, order) {
    console.log(`applySortFilter called with type: ${type}, order: ${order}`);
    if (type === 'sortPrice') {
        filters.sort = order === null ? null : order;
        filters.orderBy = order === null ? 'createdAt' : 'amount'; // Đặt orderBy thành amount khi lọc giá
        const sortPriceBtn = document.getElementById('sortPriceBtn');
        sortPriceBtn.textContent = order === null ? 'Sắp xếp Theo Giá' : `Sắp xếp Theo Giá: ${order === 'asc' ? 'Tăng dần' : 'Giảm dần'}`;
        document.getElementById('sortPriceFilterMenu').style.display = 'none';
        console.log('Updated filters:', filters);
    }
    refreshTransactions();
}

// Hiển thị và áp dụng filter giá
function showPriceFilter() {
    showFilterMenu('price');
}

function hidePriceFilter() {
    document.getElementById('priceFilterMenu').style.display = 'none';
}

function updatePriceRange() {
    const min = document.getElementById('priceRange').value;
    const max = document.getElementById('priceRangeMax').value;
    document.getElementById('priceRangeValue').textContent = `${min} - ${max}`;
    document.getElementById('priceRangeDisplay').textContent = `${min} - ${max} VNĐ`;
}

function applyPriceFilter(range) {
    if (range === null) {
        filters.priceRange = null;
        console.log('Price filter reset to all');
    } else if (range) {
        const [min, max] = range.split('-').map(Number);
        filters.priceRange = [min || 0, max || 1200000];
        console.log('Price filter applied:', filters.priceRange);
    } else {
        const min = Number(document.getElementById('priceRange').value);
        const max = Number(document.getElementById('priceRangeMax').value);
        filters.priceRange = [min, max];
        console.log('Price filter applied from sliders:', filters.priceRange);
    }
    // Không reset currentPage, giữ nguyên trang hiện tại
    refreshTransactions();
    hidePriceFilter();
}

function applyFilter(type, value) {
    console.log(`applyFilter called with type: ${type}, value: ${value}`);
    if (type === 'status') {
        filters.status = value === null ? 'all' : value;
        currentPage = 1;
        const btn = document.getElementById(`${type}FilterBtn`);
        btn.textContent = value === null ? 'Lọc Theo Trạng Thái' : 
            `Trạng thái: ${
                value === 'UNPAID' ? 'Chưa thanh toán' : 
                value === 'PAID' ? 'Đã thanh toán' : 
                value === 'CANCELLED' ? 'Đã hủy' : 
                'Tất cả'
            }`;
    }
    document.getElementById(`${type}FilterMenu`).style.display = 'none';
    refreshTransactions(filters.status);
}

// Cập nhật khi tải trang hoặc chuyển section cái này cho lọc vs refresh transaction
document.addEventListener("DOMContentLoaded", () => {
    showSection("transactions"); // Mặc định hiển thị Transactions
});

//====================================================================================
//====================================================================================
//====================================================================================


// Tích hợp sự kiện DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');

    // Thiết lập tên nhân viên thu ngân
    const token = getToken();
    const cashierNameElement = document.getElementById('cashier-name');
    console.log('cashierNameElement:', cashierNameElement);

    if (token && cashierNameElement) {
        const payload = parseJwt(token);
        if (payload && (payload.sub || payload.email)) {
            cashierNameElement.innerText = `👤 Cashier: ${payload.sub || payload.email}`;
            console.log('Email set to:', payload.sub || payload.email);
        } else {
            cashierNameElement.innerText = '👤 Cashier: Unknown';
            console.error('No email found in token payload or invalid token');
        }
    } else {
        if (!token) console.error('No token found in localStorage');
        if (!cashierNameElement) console.error('Element with id "cashier-name" not found');
        if (cashierNameElement) cashierNameElement.innerText = '👤 Cashier: Unknown';
    }

    // Gắn sự kiện cho nút clearData
    document.getElementById('clearDataBtn')?.addEventListener('click', clearData);

    // Gắn sự kiện cho tìm kiếm giao dịch
    const searchInput = document.getElementById('searchTransactionInput');
    const searchButton = document.getElementById('searchTransactionBtn');
    const reloadSearchBtn = document.getElementById('reloadSearchBtn');

    console.log('searchInput:', searchInput);
    console.log('searchButton:', searchButton);
    console.log('reloadSearchBtn:', reloadSearchBtn);

    if (searchInput && searchButton && reloadSearchBtn) {
        console.log('Elements found, attaching events');

        // Debounce chỉ cho gợi ý
        const debouncedFetchSuggestions = debounce(fetchSuggestions, 300);

        // Gắn sự kiện input chỉ để hiển thị gợi ý
        searchInput.addEventListener('input', debouncedFetchSuggestions);

        // Sự kiện Enter để tìm kiếm
        searchInput.addEventListener('keypress', async (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                console.log('Enter key pressed, calling searchTransactions');
                await searchTransactions(event);
            }
        });

        // Sự kiện nút tìm kiếm
        searchButton.addEventListener('click', async (event) => {
            event.preventDefault();
            console.log('Search button clicked, calling searchTransactions');
            await searchTransactions(event);
        });

        // Sự kiện reload
        reloadSearchBtn.addEventListener('click', async () => {
            console.log('Reload button clicked, resetting search');
            await reloadSearch();
        });
    } else {
        console.error('Error: One or more elements not found');
        if (!searchInput) console.error('searchTransactionInput not found in DOM');
        if (!searchButton) console.error('searchTransactionBtn not found in DOM');
        if (!reloadSearchBtn) console.error('reloadSearchBtn not found in DOM');
        console.log('Full DOM:', document.body.innerHTML); // Log để debug
    }

    // Ẩn gợi ý khi click ra ngoài
    document.addEventListener('click', function(e) {
        const suggestionBox = document.getElementById('suggestionBox');
        const inputWrapper = document.querySelector('.search-container .input-wrapper');
        if (suggestionBox && inputWrapper && !inputWrapper.contains(e.target)) {
            suggestionBox.style.display = 'none';
        }
    });
});


// ============================================================================

// ============================================================================

// Tìm kiếm gợi ý
async function fetchSuggestions() {
    const searchInput = document.getElementById('searchTransactionInput');
    const suggestionBox = document.getElementById('suggestionBox');
    
    if (!searchInput || !suggestionBox) {
        console.error('Không tìm thấy searchTransactionInput hoặc suggestionBox trong DOM');
        return;
    }

    const query = searchInput.value.trim();
    if (query.length < 1) {
        suggestionBox.style.display = 'none';
        await refreshTransactions();
        return;
    }

    try {
        const params = new URLSearchParams({ period: 'today' });
        params.append('query', encodeURIComponent(query));
        const data = await apiFetch(`${API_BASE_URL}/payments/suggestions?${params.toString()}`);
        
        if (data.code !== 1000) {
            throw new Error(data.message || 'Không thể lấy gợi ý');
        }

        const suggestions = data.result || [];
        suggestionBox.innerHTML = '';
        
        // Lọc thủ công theo ngày hôm nay (20/07/2025)
        const today = new Date('2025-07-20').setHours(0, 0, 0, 0); // Đặt thời gian bắt đầu ngày
        const todayEnd = new Date('2025-07-20').setHours(23, 59, 59, 999); // Đặt thời gian kết thúc ngày
        
        const filteredSuggestions = suggestions.filter(suggestion => {
            const orderId = suggestion.split(' - ')[0];
            // Giả sử cần gọi API để lấy createdAt, hoặc nếu suggestion chứa thông tin ngày
            // Dưới đây là ví dụ giả định, bạn cần điều chỉnh nếu API trả về dữ liệu khác
            return true; // Placeholder, cần tích hợp với API thực tế
        });

        if (filteredSuggestions.length > 0) {
            filteredSuggestions.forEach(suggestion => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = suggestion;
                const orderId = suggestion.split(' - ')[0];
                div.dataset.suggestionValue = orderId;
                div.addEventListener('click', () => {
                    searchInput.value = orderId;
                    suggestionBox.style.display = 'none';
                    searchTransactions({ preventDefault: () => {} });
                });
                suggestionBox.appendChild(div);
            });
            suggestionBox.style.display = 'block';
        } else {
            suggestionBox.style.display = 'none';
        }
    } catch (error) {
        console.error('Lỗi khi lấy gợi ý:', error);
        showError('error', `❌ ${error.message || 'Không thể tải gợi ý, vui lòng thử lại.'}`);
        suggestionBox.style.display = 'none';
    }
}


// =============================phần search===========================================================================================================================

async function searchTransactions(event) {
    if (event) event.preventDefault();

    const searchInput = document.getElementById('searchTransactionInput');
    const tbody = document.getElementById('transactionsBody');
    const transactionCount = document.getElementById('transactionCount');
    const searchButton = document.getElementById('searchTransactionBtn');
    const errorElement = document.getElementById('error');

    if (!searchInput || !tbody) {
        console.error('Không tìm thấy searchTransactionInput hoặc transactionsBody trong DOM');
        return;
    }

    const query = searchInput.value.trim();

    if (!query) {
        await refreshTransactions();
        return;
    }

    if (!/^[a-zA-Z0-9-]+$/.test(query)) {
        showError('error', 'Order ID hoặc Transaction ID không hợp lệ!');
        await refreshTransactions();
        return;
    }

    if (searchButton) {
        searchButton.disabled = true;
        searchButton.innerHTML = 'Đang tìm... <span class="loading"></span>';
    }

    try {
        const params = new URLSearchParams({ period: 'today', query });
        const data = await apiFetch(`${API_BASE_URL}/payments/search-transactions?${params.toString()}`);

        if (data.code !== 1000) {
            throw new Error(data.message || 'Không thể tìm kiếm giao dịch');
        }

        const transactions = data.result || [];
        tbody.innerHTML = '';

        if (transactions.length > 0) {
            const table = document.getElementById('transactionsTable');
            const filterContainer = document.getElementById('filterContainer');
            const searchContainer = document.getElementById('searchContainer');

            if (table) table.style.display = 'table';
            if (filterContainer) filterContainer.style.display = 'block';
            if (searchContainer) searchContainer.style.display = 'block';

            transactions.forEach(tx => {
                const row = document.createElement('tr');
                row.className = 'transaction-row';

                const createdAt = tx.createdAt 
                    ? new Date(new Date(tx.createdAt).getTime() - 7 * 60 * 60 * 1000).toLocaleString('vi-VN', { 
                        timeZone: 'Asia/Ho_Chi_Minh',
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                    }) 
                    : 'N/A';
                const updatedAt = tx.updatedAt 
                    ? new Date(new Date(tx.updatedAt).getTime() - 7 * 60 * 60 * 1000).toLocaleString('vi-VN', { 
                        timeZone: 'Asia/Ho_Chi_Minh',
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                    }) 
                    : 'N/A';

                let actionButtons = `
                    <button class="details-btn" onclick="showOrderDetails(${tx.orderId}, this)">Xem chi tiết</button>
                `;
                if (tx.status === 'UNPAID') {
                    actionButtons += `
                        <button class="action-btn process-btn" onclick="processPayment(${tx.orderId}, 'CASH', this)">Process</button>
                        <button class="action-btn cancel-btn" onclick="cancelOrRefund(${tx.orderId})">Cancel</button>
                    `;
                } else if (tx.status === 'PAID') {
                    actionButtons += `
                        <button class="btn btn-outline-primary" onclick="viewInvoicePdf(${tx.orderId})">🖨️ Xem Hóa Đơn</button>
                    `;
                }

                row.innerHTML = `
                    <td>${tx.orderId || 'N/A'}</td>
                    <td>${(tx.amount || 0).toLocaleString('vi-VN')}₫</td>
                    <td>${tx.status === 'PAID' ? 'CASH' : 'N/A'}</td> <!-- Chỉ hiển thị CASH khi PAID -->
                    <td><span style="color: ${tx.status === 'PAID' ? '#2ed573' : tx.status === 'CANCELLED' ? '#ff4757' : '#ff9800'}">${tx.status === 'UNPAID' ? 'Chưa thanh toán' : tx.status === 'PAID' ? 'Đã thanh toán' : tx.status === 'CANCELLED' ? 'Đã hủy' : 'N/A'}</span></td>
                    <td>${tx.transactionId || 'N/A'}</td>
                    <td>${createdAt}</td>
                    <td>${updatedAt}</td>
                    <td class="action-buttons">${actionButtons}</td>
                `;
                tbody.appendChild(row);

                const buttons = row.querySelectorAll('.action-buttons button');
                buttons.forEach(button => {
                    const tooltip = document.createElement('span');
                    tooltip.className = 'tooltip';
                    let tooltipText = '';
                    if (button.classList.contains('details-btn')) tooltipText = 'Xem đơn';
                    else if (button.classList.contains('process-btn')) tooltipText = 'Xử lý thanh toán';
                    else if (button.classList.contains('cancel-btn')) tooltipText = 'Hủy đơn hàng';
                    else if (button.classList.contains('btn-outline-primary')) tooltipText = 'Tải hóa đơn';
                    tooltip.textContent = tooltipText;

                    button.appendChild(tooltip);
                    button.addEventListener('mouseover', () => {
                        tooltip.style.visibility = 'visible';
                        tooltip.style.opacity = '1';
                    });
                    button.addEventListener('mouseout', () => {
                        tooltip.style.visibility = 'hidden';
                        tooltip.style.opacity = '0';
                    });
                });
            });

            if (transactionCount) {
                transactionCount.textContent = `Tìm thấy ${transactions.length} hóa đơn cho "${query}" trong ngày hôm nay`;
            }
        } else {
            const table = document.getElementById('transactionsTable');
            if (table) table.style.display = 'none';
            if (transactionCount) {
                transactionCount.textContent = `Không tìm thấy hóa đơn nào cho "${query}" trong ngày hôm nay`;
            }
        }
    } catch (error) {
        console.error('Lỗi tìm kiếm:', error);
        showError('error', `❌ ${error.message || 'Lỗi kết nối hệ thống, vui lòng thử lại.'}`);
        tbody.innerHTML = '';
        if (transactionCount) transactionCount.textContent = '';
        const table = document.getElementById('transactionsTable');
        if (table) table.style.display = 'none';
    } finally {
        if (searchButton) {
            searchButton.disabled = false;
            searchButton.innerHTML = 'Tìm Kiếm';
        }
    }
}


// Áp dụng debounce cho input
const debouncedFetchSuggestions = (function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
})(fetchSuggestions, 300);

document.getElementById('searchTransactionInput').addEventListener('input', debouncedFetchSuggestions);

// Ẩn gợi ý khi click ra ngoài
document.addEventListener('click', function(e) {
    const suggestionBox = document.getElementById('suggestionBox');
    const inputWrapper = document.querySelector('.search-container .input-wrapper');
    if (!inputWrapper.contains(e.target)) {
        suggestionBox.style.display = 'none';
    }
});

// =======nút===xem chi tiết đơn==================================================================


async function showOrderDetails(orderId, button) {
  // Ngăn spam click
  if (isProcessing) return;
  
  const row = button.closest('tr');
  const nextRow = row.nextElementSibling;
  
  // Kiểm tra nếu đây là hàng đang active
  if (currentActiveRow === row && nextRow && nextRow.classList.contains('order-details-row')) {
    await closeCurrentDetails();
    return;
  }
  
  // Nếu có hàng khác đang mở, đóng nó trước
  if (currentDetailsRow && currentActiveRow !== row) {
    await closeCurrentDetails();
    // Chờ một chút để animation hoàn tất
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Mở chi tiết mới
  await openOrderDetails(orderId, row, button);
}




async function closeCurrentDetails() {
  if (!currentDetailsRow) return;
  
  isProcessing = true;
  
  // Reset button state
  if (currentButton) {
    currentButton.textContent = 'Xem chi tiết';
    currentButton.classList.remove('close-btn');
  }
  
  // Remove active state from row
  if (currentActiveRow) {
    currentActiveRow.classList.remove('active-row');
  }
  
  // Animate out
  currentDetailsRow.classList.remove('details-open');
  currentDetailsRow.classList.add('details-closing');
  
  // Wait for animation and cleanup
  return new Promise(resolve => {
    setTimeout(() => {
      if (currentDetailsRow && currentDetailsRow.parentNode) {
        currentDetailsRow.remove();
      }
      currentDetailsRow = null;
      currentActiveRow = null;
      currentButton = null;
      isProcessing = false;
      resolve();
    }, 400);
  });
}




async function openOrderDetails(orderId, row, button) {
    if (isProcessing) return;

    isProcessing = true;

    button.textContent = 'Đang tải...';
    button.classList.add('loading-btn');

    try {
        const data = await apiFetch(`${API_BASE_URL}/payments/invoice/${orderId}`);
        console.log('API Response from /payments/invoice:', {
            orderId,
            paymentDate: data.result?.paymentDate,
            formattedPaymentDate: data.result?.formattedPaymentDate
        });
        console.log('Browser TimeZone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

        if (data.result) {
            const detailsRow = document.createElement('tr');
            detailsRow.className = 'order-details-row';

            const totalAmount = data.result.orderItems.reduce((sum, item) =>
                sum + ((item.quantity || 0) * (item.price || 0)), 0);

            const statusText = {
                'PENDING': 'Đang chờ',
                'UNPAID': 'Chưa thanh toán',
                'PAID': 'Đã thanh toán',
                'CANCELLED': 'Đã hủy'
            }[data.result.status] || data.result.status || 'N/A';

            const statusColor = {
                'PENDING': '#ff9800',
                'UNPAID': '#ff9800',
                'PAID': '#2ed573',
                'CANCELLED': '#ff4757'
            }[data.result.status] || '#000000';

            // Xử lý thời gian từ paymentDate
            let displayTime = 'N/A';
            if (data.result.paymentDate) {
                // Parse paymentDate từ chuỗi ISO (UTC)
                const date = new Date(data.result.paymentDate);
                console.log('Parsed paymentDate (UTC):', date);
                // Trừ 7 tiếng để bù lại lỗi lệch 14 tiếng
                const adjustedDate = new Date(date.getTime() - 7 * 60 * 60 * 1000);
                console.log('Adjusted Date (UTC-7):', adjustedDate);
                // Định dạng thủ công thành dd/MM/yyyy HH:mm:ss
                const day = String(adjustedDate.getDate()).padStart(2, '0');
                const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
                const year = adjustedDate.getFullYear();
                const hours = String(adjustedDate.getHours()).padStart(2, '0');
                const minutes = String(adjustedDate.getMinutes()).padStart(2, '0');
                const seconds = String(adjustedDate.getSeconds()).padStart(2, '0');
                displayTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                console.log('Final displayTime:', displayTime);
            } else {
                console.log('No paymentDate available, using N/A');
            }

            detailsRow.innerHTML = `
                <td colspan="8">
                    <div class="order-details-container">
                        <div class="order-header">
                            <h4>Chi tiết đơn hàng #${orderId}</h4>
                            <div class="order-info">
                                <span class="order-time">${displayTime}</span>
                                <span class="order-status" style="color: ${statusColor}">${statusText}</span>
                                <span class="order-total">${totalAmount.toLocaleString('vi-VN')}₫</span>
                            </div>
                        </div>

                        <div class="order-table-wrapper">
                            <table class="order-table">
                                <thead>
                                    <tr>
                                        <th>Tên món</th>
                                        <th>Số lượng</th>
                                        <th>Đơn giá</th>
                                        <th>Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.result.orderItems.map((item, index) => `
                                        <tr class="order-item" style="animation-delay: ${index * 0.1}s">
                                            <td class="item-name">${item.itemName || 'N/A'}</td>
                                            <td class="item-qty">
                                                <span class="qty-badge">${item.quantity || 0}</span>
                                            </td>
                                            <td class="item-price">${(item.price || 0).toLocaleString('vi-VN')}₫</td>
                                            <td class="item-total">${((item.quantity || 0) * (item.price || 0)).toLocaleString('vi-VN')}₫</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div class="order-summary">
                            <div class="summary-left">
                                <span class="item-count">${data.result.orderItems.length} món</span>
                            </div>
                            <div class="summary-right">
                                <span class="final-total">Tổng cộng: <strong>${totalAmount.toLocaleString('vi-VN')}₫</strong></span>
                            </div>
                        </div>
                    </div>
                </td>
            `;

            row.after(detailsRow);
            currentDetailsRow = detailsRow;
            currentActiveRow = row;
            currentButton = button;

            row.classList.add('active-row');
            button.classList.remove('loading-btn');
            button.textContent = '✕ Đóng';
            button.classList.add('close-btn');

            requestAnimationFrame(() => {
                detailsRow.classList.add('details-open');
                isProcessing = false;
            });
        } else {
            throw new Error(data.message || "Không thể tải chi tiết đơn hàng");
        }
    } catch (error) {
        console.error("Error fetching order details:", error);
        showError("error", `❌ ${error.message || "Lỗi kết nối, vui lòng thử lại."}`);
        button.classList.remove('loading-btn');
        button.textContent = 'Xem chi tiết';
        isProcessing = false;
    }
}


//==========================phần liên quan đến popup nút transaction========================================================


     // Hiển thị popup chọn phương thức thanh toán
function showPaymentMethodPopup(orderId, button) {
    const popup = document.createElement('div');
    popup.className = 'payment-popup';
    popup.setAttribute('data-order-id', orderId);
    popup.setAttribute('data-process-button', button);
    popup.innerHTML = `
        <div class="popup-content">
            <h3>Chọn phương thức thanh toán</h3>
            <select id="paymentMethodSelect">
                <option value="CASH">CASH</option>
                <option value="VNPAY">VNPAY</option>
            </select>
            <button onclick="confirmPayment(event, this)">Xác nhận</button>
            <button onclick="closePopup(this)">Hủy</button>
        </div>
    `;
    document.body.appendChild(popup);

    // Ngăn chặn sự kiện click lan truyền từ popup
    popup.addEventListener('click', (e) => e.stopPropagation());

    setTimeout(() => {
        document.addEventListener('click', function handleOutsideClick(e) {
            if (!popup.contains(e.target) && e.target !== button) {
                closePopup();
                document.removeEventListener('click', handleOutsideClick);
            }
        });
    }, 0);
}

// Đóng popup
function closePopup(button) {
    const popup = document.querySelector('.payment-popup');
    if (popup) popup.remove();
}

// Xác nhận thanh toán với phương thức đã chọn
async function confirmPayment(event, button) {
    event.preventDefault(); // Ngăn chặn lan truyền sự kiện
    event.stopPropagation(); // Ngăn chặn sự kiện click lan ra ngoài
    const popup = button.closest('.payment-popup');
    if (!popup) return;

    const orderId = popup.getAttribute('data-order-id');
    const paymentMethod = document.getElementById('paymentMethodSelect').value;
    const processButton = popup.getAttribute('data-process-button');

    closePopup();

    if (orderId && processButton) {
        await processPayment(orderId, paymentMethod, processButton);
    } else {
        console.error('Không tìm thấy orderId hoặc nút Process:', { orderId, processButton });
        showError("error", "❌ Lỗi hệ thống, không thể xử lý thanh toán.");
    }
} 





function updateTransactionRow(orderId, transactionData) {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) {
        console.error('Không tìm thấy transactionsBody trong DOM');
        return;
    }

    const rows = Array.from(tbody.getElementsByTagName('tr'));
    const row = rows.find(r => r.cells[0].textContent === orderId.toString());
    if (!row) {
        console.error(`Không tìm thấy hàng với orderId: ${orderId}`);
        return;
    }

    console.log('updateTransactionRow - Input Data:', {
        orderId,
        paymentDate: transactionData.paymentDate
    });
    console.log('Browser TimeZone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

    let createdAt = row.cells[5]?.textContent || 'N/A';
    if (createdAt === 'N/A') {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        createdAt = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }
    console.log('Existing createdAt:', createdAt);

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    let updatedAt = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    console.log('Client Time for updatedAt:', updatedAt);

    if (transactionData.paymentDate) {
        const date = new Date(transactionData.paymentDate);
        console.log('Parsed paymentDate (UTC):', date);
        const adjustedDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
        console.log('Adjusted paymentDate (UTC+7):', adjustedDate);
    }

    const statusText = {
        'UNPAID': 'Chưa thanh toán',
        'PAID': 'Đã thanh toán',
        'CANCELLED': 'Đã hủy'
    }[transactionData.status] || 'N/A';
    const statusColor = {
        'UNPAID': '#ff9800',
        'PAID': '#2ed573',
        'CANCELLED': '#ff4757'
    }[transactionData.status] || '#000000';

    let actionButtons = `
        <button class="details-btn" onclick="showOrderDetails(${transactionData.orderId}, this)">Xem chi tiết</button>
    `;
    if (transactionData.status === 'PAID') {
        actionButtons += `
            <button class="btn btn-outline-primary" onclick="viewInvoicePdf(${transactionData.orderId})">🖨️ Xem Hóa Đơn</button>
        `;
    } else if (transactionData.status === 'UNPAID') {
        actionButtons += `
            <button class="action-btn process-btn" onclick="processPayment(${transactionData.orderId}, 'CASH', this)">Process</button>
            <button class="action-btn cancel-btn" onclick="cancelOrRefund(${transactionData.orderId})">Cancel</button>
        `;
    }

    row.innerHTML = `
        <td>${transactionData.orderId || 'N/A'}</td>
        <td>${(transactionData.amount || 0).toLocaleString('vi-VN')}₫</td>
        <td>${transactionData.status === 'PAID' ? 'CASH' : 'N/A'}</td> <!-- Chỉ hiển thị CASH khi PAID -->
        <td><span style="color: ${statusColor}">${statusText}</span></td>
        <td>${transactionData.transactionId || 'N/A'}</td>
        <td>${createdAt}</td>
        <td>${updatedAt}</td>
        <td class="action-buttons">${actionButtons}</td>
    `;

    const buttons = row.querySelectorAll('.action-buttons button');
    buttons.forEach(button => {
        const tooltip = document.createElement('span');
        tooltip.className = 'tooltip';
        let tooltipText = '';
        if (button.classList.contains('details-btn')) tooltipText = 'Xem đơn';
        else if (button.classList.contains('process-btn')) tooltipText = 'Xử lý thanh toán';
        else if (button.classList.contains('cancel-btn')) tooltipText = 'Hủy đơn hàng';
        else if (button.classList.contains('btn-outline-primary')) tooltipText = 'Tải hóa đơn';
        tooltip.textContent = tooltipText;

        button.appendChild(tooltip);
        button.addEventListener('mouseover', () => {
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
        });
        button.addEventListener('mouseout', () => {
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
        });
    });
}



//==================================================================================//==================================================================================
async function processPayment(orderId, paymentMethod, button) {
    // Hiển thị thông báo xác nhận
    if (!confirm('Bạn có muốn xử lý đơn hàng này?')) {
        return; // Thoát hàm nếu người dùng nhấn Cancel
    }

    clearMessages();

    const originalText = button.textContent || 'Process';
    button.textContent = originalText + ' <span class="loading"></span>';
    button.disabled = true;

    try {
        const data = await apiFetch(`${API_BASE_URL}/payments/payment2`, {
            method: "POST",
            body: JSON.stringify({ orderId, paymentMethod: 'CASH' }) // Cố định CASH
        });

        console.log('API Response from /payment2:', data);

        if (data.code === 0 && data.result) {
            showSuccessNotification();

            // Cập nhật paymentList để đồng bộ với calculateDailySummary
            const index = paymentList.findIndex(tx => tx.orderId === data.result.orderId);
            if (index !== -1) {
                paymentList[index] = { ...paymentList[index], ...data.result };
            } else {
                paymentList.push(data.result);
            }

            updateTransactionRow(orderId, {
                orderId: data.result.orderId,
                amount: data.result.amount,
                paymentMethod: 'CASH', // Cố định CASH
                status: data.result.status,
                transactionId: data.result.transactionId,
                paymentDate: data.result.updatedAt
            });

            const invoiceData = await apiFetch(`${API_BASE_URL}/payments/invoice/${orderId}`);
            console.log('Invoice Data:', invoiceData);

            if (invoiceData.code === 0 && invoiceData.result) {
                updateTransactionRow(orderId, invoiceData.result);
                displayInvoice(invoiceData.result);

                const invoiceSection = document.getElementById('invoice');
                if (invoiceSection) {
                    invoiceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                if (invoiceData.result.customerEmail) {
                    const emailData = await apiFetch(`${API_BASE_URL}/payments/send-invoice-email`, {
                        method: 'POST',
                        body: JSON.stringify({ customerEmail: invoiceData.result.customerEmail, orderId })
                    });
                }
            }

            // Cập nhật tổng số đơn sau khi xử lý thanh toán
            await calculateDailySummary();
        } else {
            showError("error", `❌ ${data.message || "Thanh toán thất bại."}`);
        }
    } catch (error) {
        console.error("Lỗi:", error);
        showError("error", `❌ ${error.message || "Lỗi kết nối, vui lòng thử lại."}`);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}
//==========================================//==========================================//==========================================


function updateTransactionTable(order) {
                                                                            const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;

                                                                            const existingRow = Array.from(tbody.getElementsByTagName('tr')).find(row =>
            row.cells[0].textContent === order.orderId.toString()
    );
    if (existingRow) return;

                                                                            const row = document.createElement('tr');
    row.className = 'transaction-row';
    let actionButtons = document.createElement('td');
    actionButtons.className = 'action-buttons';

                                                                            const detailBtn = document.createElement('button');
    detailBtn.className = 'details-btn';
    detailBtn.textContent = 'Xem chi tiết';
    detailBtn.setAttribute('onclick', `showOrderDetails(${order.orderId}, this)`);

    let processBtn = null, cancelBtn = null;
    if (order.status === 'UNPAID') {
        processBtn = document.createElement('button');
        processBtn.className = 'action-btn process-btn';
        processBtn.textContent = 'Process';
        processBtn.setAttribute('onclick', `processPayment(${order.orderId}, 'CASH', this)`); // Gọi trực tiếp processPayment

        cancelBtn = document.createElement('button');
        cancelBtn.className = 'action-btn cancel-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.setAttribute('onclick', `cancelOrRefund(${order.orderId})`);
    }

    actionButtons.appendChild(detailBtn);
    if (processBtn) actionButtons.appendChild(processBtn);
    if (cancelBtn) actionButtons.appendChild(cancelBtn);

                                                                            const buttons = [detailBtn, processBtn, cancelBtn].filter(btn => btn);
    buttons.forEach(button => {
                                                                                const tooltip = document.createElement('span');
    tooltip.className = 'tooltip';
    tooltip.textContent = button.classList.contains('details-btn') ? 'Xem đơn' :
            button.classList.contains('process-btn') ? 'Xử lý thanh toán' :
                    'Hủy đơn hàng';
    button.appendChild(tooltip);

    button.addEventListener('mouseover', () => {
            tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';
                                                                                });
    button.addEventListener('mouseout', () => {
            tooltip.style.visibility = 'hidden';
    tooltip.style.opacity = '0';
                                                                                });
                                                                            });

    row.innerHTML = `
                                                                                <td>${order.orderId || 'N/A'}</td>
            <td>${(order.amount || 0).toLocaleString('vi-VN')}₫</td>
            <td>${order.status === 'PAID' ? 'CASH' : 'N/A'}</td> <!-- Chỉ hiển thị CASH khi PAID -->
            <td><span style="color: ${order.status === 'PAID' ? '#2ed573' : order.status === 'CANCELLED' ? '#ff4757' : '#ff9800'}">${order.status === 'UNPAID' ? 'Chưa thanh toán' : order.status === 'PAID' ? 'Đã thanh toán' : order.status === 'CANCELLED' ? 'Đã hủy' : 'N/A'}</span></td>
            <td>${order.transactionId !== null && order.transactionId !== undefined ? order.transactionId : 'Chưa có'}</td>
            <td>${order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</td>
            <td>${order.updatedAt ? new Date(order.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</td>
                                                                            `;
    row.appendChild(actionButtons);
    tbody.prepend(row);

                                                                            const transactionCount = document.getElementById('transactionCount');
    if (transactionCount) {
                                                                                const currentCount = parseInt(transactionCount.textContent.match(/\d+/)?.[0] || 0) || 0;
        transactionCount.textContent = `Tổng số hóa đơn: ${currentCount + 1} (Trạng thái: ${filters.status === 'all' ? 'Tất cả' : filters.status === 'UNPAID' ? 'Chưa thanh toán' : filters.status}, Phương thức: CASH, Giá: ${filters.priceRange ? `${filters.priceRange[0].toLocaleString('vi-VN')} - ${filters.priceRange[1].toLocaleString('vi-VN')} VNĐ` : 'Tất cả'}, Sắp xếp: ${filters.sort ? (filters.sort === 'asc' ? 'Tăng dần' : 'Giảm dần') : 'Mặc định'})`;
    }

                                                                            const table = document.getElementById('transactionsTable');
    if (table) table.style.display = 'table';
    document.getElementById('filterContainer').style.display = 'block';
    document.getElementById('searchContainer').style.display = 'block';
}

//==========================================//==========================================//==========================================
//==================================================================================//==================================================================================
      async function cancelOrRefund(orderId) {

        


    if (!confirm('Bạn có chắc muốn hủy giao dịch này?')) return;

    clearMessages();
    const button = event.target;

    const originalText = button.textContent.replace(/<[^>]+>/g, '').trim() || 'Cancel';
    button.textContent = originalText + ' <span class="loading"></span>';
    button.disabled = true;

    try {
        // Sử dụng apiFetch để gọi API
        const data = await apiFetch(`${API_BASE_URL}/payments/cancel-or-refund/${orderId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        console.log('Cancel/Refund API Response:', data);

        // Kiểm tra trạng thái thành công dựa trên code
        if (data.code === 0) {

showDeleteSuccessNotification();

            await refreshTransactions();
        } else {
            // Xử lý các mã lỗi cụ thể
            switch (data.code) {
                case 1019:
                    showError("error", "❌ Đơn hàng không tồn tại.");
                    break;
                case 1024:
                    showError("error", "❌ Đơn hàng đã bị hủy trước đó.");
                    break;
                case 1021:
                    showError("error", "❌ Đơn hàng đã hoàn thành, không thể hủy.");
                    break;
                case 1025:
                    showError("error", "❌ Thanh toán đã được xử lý, không thể hủy.");
                    break;
                case 9999:
                    showError("error", "❌ Lỗi hệ thống, vui lòng thử lại sau.");
                    break;
                default:
                    showError("error", `❌ ${data.message || "Hủy/hoàn tiền thất bại."}`);
                    break;
            }
        }
    } catch (error) {
        console.error("Cancel/Refund error:", error);
        showError("error", "❌ Lỗi kết nối hệ thống, vui lòng thử lại sau.");
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}


//==========================================

//=====================HÓa đơn=============================================================


function displayInvoice(invoiceData) {
    if (!invoiceData) {
        console.error('No invoice data available');
        showError("error", "❌ Không có dữ liệu hóa đơn.");
        return;
    }

    // Log để debug
    console.log('displayInvoice - Input Data:', {
        orderId: invoiceData.orderId,
        paymentDate: invoiceData.paymentDate,
        formattedPaymentDate: invoiceData.formattedPaymentDate
    });

    // Xử lý thời gian hiển thị
    let displayPaymentDate = invoiceData.formattedPaymentDate || 'N/A';
    if (displayPaymentDate !== 'N/A') {
        const [day, month, year, hour, minute, second] = displayPaymentDate.split(/[/ :]/).map(Number);
        const parsedDate = new Date(year, month - 1, day, hour, minute, second);
        
        const currentTime = new Date();
        const timeDiffHours = (parsedDate.getTime() - currentTime.getTime()) / (1000 * 3600);
        
        if (Math.abs(timeDiffHours - 14) < 1) {
            const adjustedDate = new Date(parsedDate.getTime() - 14 * 60 * 60 * 1000);
            displayPaymentDate = adjustedDate.toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(/,/, '');
        } else if (Math.abs(timeDiffHours + 14) < 1) {
            const adjustedDate = new Date(parsedDate.getTime() + 14 * 60 * 60 * 1000);
            displayPaymentDate = adjustedDate.toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(/,/, '');
        }
    } else {
        const now = new Date();
        displayPaymentDate = now.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/,/, '');
    }

    // Cập nhật thông tin hóa đơn
    document.getElementById('invoiceId').textContent = `#${invoiceData.orderId || 'N/A'}`;
    document.getElementById('paymentDate').textContent = displayPaymentDate;
    document.getElementById('tableNumber').textContent = invoiceData.tableNumber || 'N/A';
    document.getElementById('customerName').textContent = invoiceData.customerName || 'N/A';
    document.getElementById('displayCustomerEmail').textContent = invoiceData.customerEmail || 'N/A';
    document.getElementById('totalAmount').textContent = (invoiceData.amount || 0).toLocaleString('vi-VN') + '₫';
    document.getElementById('paymentMethodDisplay').textContent = invoiceData.paymentMethod || 'N/A';
    document.getElementById('status').textContent = {
        'PENDING': 'Đang chờ',
        'UNPAID': 'Chưa thanh toán',
        'PAID': 'Đã thanh toán',
        'CANCELLED': 'Đã hủy'
    }[invoiceData.status] || invoiceData.status || 'N/A';

    // Cập nhật danh sách món
    const tbody = document.getElementById('invoiceItems');
    tbody.innerHTML = '';
    (invoiceData.orderItems || []).forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.itemName || 'N/A'}</td>
            <td>${item.quantity || 0}</td>
            <td>${(item.price || 0).toLocaleString('vi-VN')}₫</td>
            <td>${((item.quantity || 0) * (item.price || 0)).toLocaleString('vi-VN')}₫</td>
        `;
        tbody.appendChild(row);
    });

    // Lấy invoice section
    const invoiceSection = document.getElementById('invoice');
    
    // Reset và thiết lập style tối ưu cho invoice
    invoiceSection.className = 'invoice invoice-popup-optimized';
    
    // Xóa overlay và nút đóng cũ nếu có
    const existingOverlay = document.querySelector('.invoice-overlay-optimized');
    const existingCloseBtn = invoiceSection.querySelector('.close-invoice-btn-optimized');
    if (existingOverlay) existingOverlay.remove();
    if (existingCloseBtn) existingCloseBtn.remove();

    // Tạo nút đóng mới
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-invoice-btn-optimized';
    closeBtn.innerHTML = '<span class="close-icon">✕</span><span class="close-text">Đóng</span>';
    invoiceSection.appendChild(closeBtn);

    // Tạo và thêm overlay sau khi dữ liệu sẵn sàng
    const overlay = document.createElement('div');
    overlay.className = 'invoice-overlay-optimized';
    document.body.appendChild(overlay);

    // Hàm đóng invoice
    const closeInvoice = () => {
        invoiceSection.style.transform = 'translate(-50%, -50%) scale(0.9)';
        invoiceSection.style.opacity = '0';
        overlay.style.opacity = '0';
        
        setTimeout(() => {
            invoiceSection.style.display = 'none';
            invoiceSection.className = 'invoice';
            overlay.remove();
        }, 300);
    };

    // Event listeners
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeInvoice();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeInvoice();
        }
    });

    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeInvoice();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);

    // Hiển thị invoice ngay lập tức với hiệu ứng
    invoiceSection.style.display = 'block';
    invoiceSection.style.opacity = '0';
    invoiceSection.style.transform = 'translate(-50%, -50%) scale(0.9)';
    overlay.style.opacity = '1'; // Hiển thị overlay cùng lúc với invoice
    
    requestAnimationFrame(() => {
        invoiceSection.style.opacity = '1';
        invoiceSection.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    // Auto close sau 15 giây
    const autoCloseTimeout = setTimeout(() => {
        closeInvoice();
        document.removeEventListener('keydown', handleEsc);
    }, 15000);

    const cancelAutoClose = () => clearTimeout(autoCloseTimeout);
    closeBtn.addEventListener('click', cancelAutoClose);
    overlay.addEventListener('click', cancelAutoClose);
    invoiceSection.addEventListener('mouseenter', cancelAutoClose);
}

// Thêm CSS vào document
function addInvoiceOptimizedStyles() {
    if (!document.querySelector('#invoice-optimized-styles')) {
        const style = document.createElement('style');
        style.id = 'invoice-optimized-styles';
        style.textContent = invoiceOptimizedCSS; // Giả sử invoiceOptimizedCSS là biến chứa CSS
        document.head.appendChild(style);
    }
}

document.addEventListener('DOMContentLoaded', addInvoiceOptimizedStyles);

window.displayInvoice = displayInvoice;

//==========================================//==========================================
async function viewInvoicePdf(orderId) {
    try {
        // Gọi API để nhận link URL cố định
        const data = await apiFetch(`/payments/invoice/${orderId}/pdf`, { method: 'GET' });

        if (!data) {
            showError("error", "❌ Không lấy được link hóa đơn.");
            return;
        }

        // Mở tab mới với URL trả về
        window.open(data, '_blank');
    } catch (error) {
        console.error('Lỗi khi tải hóa đơn:', error);
        showError("error", `❌ ${error.message || 'Không thể tải hóa đơn, vui lòng thử lại.'}`);
    }
}

//==========================================phần tổng kết  só hóa đơn và doanh thu ===================================
async function calculateDailySummary() {
    // Lấy ngày hiện tại theo múi giờ UTC+7
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Đặt về đầu ngày
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999); // Đặt về cuối ngày

    console.log('Current Date Range:', {
        today: today.toISOString(),
        todayEnd: todayEnd.toISOString()
    });

    try {
        // Lấy dữ liệu doanh thu và giao dịch
        await refreshRevenue();
        const response = await fetchAllTransactions();
        const transactions = response.result?.content || [];
        console.log('Transactions from fetchAllTransactions:', transactions);

        // Lọc giao dịch trong ngày hiện tại
        const dailyTransactions = transactions.filter(tx => {
            try {
                const txDate = tx.createdAt ? new Date(tx.createdAt) : null;
                if (!txDate || isNaN(txDate)) {
                    console.warn(`Invalid createdAt for orderId ${tx.orderId}:`, tx.createdAt);
                    return false;
                }
                // Điều chỉnh múi giờ nếu cần (giả sử API trả về UTC)
                const adjustedTxDate = new Date(txDate.getTime() - 7 * 60 * 60 * 1000); // Thêm 7 giờ cho UTC+7
                return adjustedTxDate >= today && adjustedTxDate <= todayEnd;
            } catch (e) {
                console.error('Error parsing date for orderId', tx.orderId, e);
                return false;
            }
        });
        console.log('dailyTransactions:', dailyTransactions);

        // Tính tổng số đơn
        const totalOrders = dailyTransactions.length;
        // Tính tổng doanh thu (sử dụng currentRevenueStats)
        const totalRevenue = currentRevenueStats ? Number(currentRevenueStats.totalRevenue) || 0 : 0;

        // Cập nhật giao diện
        const totalOrdersElement = document.getElementById('totalOrders');
        const totalRevenueElement = document.getElementById('totalRevenue');

        if (totalOrdersElement) {
            totalOrdersElement.innerHTML = `
                <div class="card-title">Tổng Số Đơn</div>
                <div class="card-value">${totalOrders || 0}</div>
                <div class="card-icon"><i class="fas fa-receipt"></i></div>
                <div class="card-subtitle">Hôm nay</div>
            `;
        } else {
            console.error('totalOrders element not found');
        }

        if (totalRevenueElement) {
            totalRevenueElement.innerHTML = `
                <div class="card-title">Tổng Doanh Thu</div>
                <div class="card-value">${totalRevenue.toLocaleString('vi-VN')} VNĐ</div>
                <div class="card-icon"><i class="fas fa-dollar-sign"></i></div>
                <div class="card-subtitle">Hôm nay</div>
            `;
        } else {
            console.error('totalRevenue element not found');
        }
    } catch (error) {
        console.error('Error in calculateDailySummary:', error);
        const totalOrdersElement = document.getElementById('totalOrders');
        const totalRevenueElement = document.getElementById('totalRevenue');

        if (totalOrdersElement) {
            totalOrdersElement.innerHTML = `
                <div class="card-title">Tổng Số Đơn</div>
                <div class="card-value">0</div>
                <div class="card-icon"><i class="fas fa-receipt"></i></div>
                <div class="card-subtitle">Hôm nay</div>
            `;
        }

        if (totalRevenueElement) {
            totalRevenueElement.innerHTML = `
                <div class="card-title">Tổng Doanh Thu</div>
                <div class="card-value">0 VNĐ</div>
                <div class="card-icon"><i class="fas fa-dollar-sign"></i></div>
                <div class="card-subtitle">Hôm nay</div>
            `;
        }
    }
}
// thay đổi để push


document.addEventListener('DOMContentLoaded', async () => {
    showSection('dashboard'); // Mặc định hiển thị Dashboard
    await refreshRevenue(); // Cập nhật doanh thu trước
    await calculateDailySummary(); // Sau đó tính summary
});

// Cập nhật DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (token) {
        const payload = parseJwt(token);
        if (payload && payload.sub) {
            document.getElementById('cashier-name').textContent = `👤 Cashier: ${payload.sub}`;
        }
    }
    
    // Thêm CSS (đã có)
    const style = document.createElement('style');
    style.textContent = `/* CSS của bạn, bao gồm thông báo */`;
    document.head.appendChild(style);
    
    // Kiểm tra lịch và trạng thái check-in
    await loadWorkSchedule(); // Đảm bảo load ca làm việc
    await checkWorkShiftLog(); // Cập nhật currentShiftLog
    showSection('dashboard'); // Mặc định hiển thị Dashboard
});

// Hàm mới để lấy tất cả giao dịch trong ngày mà không lọc theo status
async function fetchAllTransactions() {
    try {
        const params = new URLSearchParams();
        params.append('period', 'today');
        params.append('page', 0);
        params.append('size', 2000); // Lấy tối đa 1000 giao dịch, điều chỉnh nếu cần
        params.append('orderBy', 'createdAt');
        params.append('sort', 'ASC');
        console.log('API request params for fetchAllTransactions:', params.toString());

        const data = await apiFetch(`${API_BASE_URL}/payments/list?${params.toString()}`);
        console.log('API response from fetchAllTransactions:', data);

        return data || { result: { content: [] } }; // Trả về mảng rỗng nếu không có dữ liệu
    } catch (error) {
        console.error('Error in fetchAllTransactions:', error);
        return { result: { content: [] } }; // Trả về mảng rỗng nếu có lỗi
    }
}






