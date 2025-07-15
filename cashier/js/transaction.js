
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
          method: 'all',
          sort: null
      };

      
//==================================================================================//==================================================================================
let currentDetailsRow = null;
let currentActiveRow = null;
let currentButton = null;
let isProcessing = false; // Flag để ngăn spam click
//==================================================================================//==================================================================================


// Hàm kiểm tra đơn hàng mới
async function checkNewOrders() {
    try {
        const response = await apiFetch(`${API_BASE_URL}/payments/check-new-orders`);
        const newOrders = response.result || [];

        if (newOrders.length > 0) {
            newOrders.forEach(order => {
                if (!paymentList.some(p => p.orderId === order.orderId)) { // Tránh lặp
                    showNotificationAndUpdate(`Đơn mới: ${order.orderId} - ${order.amount ? order.amount.toLocaleString('vi-VN') + ' VND' : 'N/A'}`, order);
                    paymentList.push(order);
                    // Cập nhật bảng transactions ngay lập tức
                    updateTransactionTable(order);
                    
                    // Reload trang sau khi phát hiện đơn mới

                    // Reload cả giao dịch và doanh thu
                    setTimeout(async () => {
                        await reloadSearch(); // Reload giao dịch
                        await refreshRevenue(); // Reload doanh thu
                    }, 1000); // Đợi 1 giây để thông báo hiển thị trước khi reload
                }
            });
        }
    } catch (error) {
        console.error('Lỗi khi kiểm tra đơn mới:', error);
    }
}



// Hàm cập nhật bảng giao dịch với đơn mới
function updateTransactionTable(order) {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;

    // Kiểm tra xem đơn đã tồn tại trong bảng chưa
    const existingRow = Array.from(tbody.getElementsByTagName('tr')).find(row =>
        row.cells[0].textContent === order.orderId.toString()
    );
    if (existingRow) return; // Bỏ qua nếu đã có

    // Tạo hàng mới cho bảng
    const row = document.createElement('tr');
    row.className = 'transaction-row';
    let actionButtons = document.createElement('td');
    actionButtons.className = 'action-buttons';

    const detailBtn = document.createElement('button');
    detailBtn.className = 'details-btn';
    detailBtn.textContent = 'Xem chi tiết';
    detailBtn.setAttribute('onclick', `showOrderDetails(${order.orderId}, this)`);

    let processBtn = null, cancelBtn = null;
    if (order.status === 'PENDING') {
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

    // Thêm tooltip cho từng nút
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
        <td><span style="color: ${order.status === 'PAID' ? '#2ed573' : order.status === 'CANCELLED' ? '#ff4757' : '#ff9800'}">${order.status || 'N/A'}</span></td>
        <td>${order.transactionId !== null && order.transactionId !== undefined ? order.transactionId : 'Chưa có'}</td>
        <td>${order.createdAt ? new Date(order.createdAt).toISOString().replace('T', ' ').split('.')[0] : 'N/A'}</td>
        <td>${order.updatedAt ? new Date(order.updatedAt).toISOString().replace('T', ' ').split('.')[0] : 'N/A'}</td>
    `;
    row.appendChild(actionButtons);
    tbody.prepend(row); // Thêm vào đầu bảng

    // Cập nhật số lượng giao dịch
    const transactionCount = document.getElementById('transactionCount');
    if (transactionCount) {
        const currentCount = parseInt(transactionCount.textContent.match(/\d+/)?.[0] || 0) || 0;
        transactionCount.textContent = `Tổng số hóa đơn: ${currentCount + 1} (Trạng thái: ${filters.status}, Phương thức: ${filters.method}, Giá: ${filters.priceRange ? `${filters.priceRange[0]} - ${filters.priceRange[1]} VNĐ` : 'Tất cả'}, Sắp xếp: ${filters.sort ? `${filters.sort}` : 'Mặc định'})`;
    }

    // Hiển thị bảng nếu chưa hiển thị
    const table = document.getElementById('transactionsTable');
    if (table) table.style.display = 'table';
    document.getElementById('filterContainer').style.display = 'block';
    document.getElementById('searchContainer').style.display = 'block';
}


// Gọi hàm kiểm tra định kỳ
setInterval(checkNewOrders, 5000);

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
// Hàm làm mới giao dịch với phân trang
async function refreshTransactions(status = null) {
    try {
        const params = new URLSearchParams();
        if (status && status !== 'all') params.append('status', status);
        const data = await apiFetch(`${API_BASE_URL}/payments/todays-transactions?${params.toString()}`);

        let transactions = data.result || [];
        console.log('Raw transactions from API:', transactions);

        // Áp dụng bộ lọc
        if (filters.status !== 'all') {
            transactions = transactions.filter(tx => tx.status === filters.status);
        }
        if (filters.method !== 'all') {
            transactions = transactions.filter(tx => tx.paymentMethod === filters.method);
        }
        if (filters.priceRange) {
            const [min, max] = filters.priceRange;
            transactions = transactions.filter(tx => (tx.amount || 0) >= min && (tx.amount || 0) <= max);
        }
        if (filters.sort === 'asc') {
            transactions.sort((a, b) => (a.amount || 0) - (b.amount || 0));
        } else if (filters.sort === 'desc') {
            transactions.sort((a, b) => (b.amount || 0) - (a.amount || 0));
        }

        // Phân trang
        const totalItems = transactions.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        console.log('Total items:', totalItems, 'Total pages:', totalPages, 'Current page:', currentPage);

        // Điều chỉnh currentPage nếu vượt quá tổng số trang
        if (currentPage > totalPages) {
            currentPage = totalPages > 0 ? totalPages : 1;
            console.log('Adjusted currentPage to:', currentPage);
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        const paginatedTransactions = transactions.slice(startIndex, endIndex);
        console.log('Paginated transactions:', paginatedTransactions);

        const tbody = document.getElementById("transactionsBody");
        tbody.innerHTML = "";
        const transactionCount = document.getElementById("transactionCount");
        const paginationDiv = document.getElementById("pagination") || createPaginationDiv();

        if (paginatedTransactions.length > 0) {
            document.getElementById("transactionsTable").style.display = "table";
            document.getElementById("filterContainer").style.display = "block";
            document.getElementById("searchContainer").style.display = "block";

            paginatedTransactions.forEach(tx => {
                const row = document.createElement("tr");
                row.className = 'transaction-row';
                let actionButtons = document.createElement('td');
                actionButtons.className = 'action-buttons';

                const detailBtn = document.createElement('button');
                detailBtn.className = 'details-btn';
                detailBtn.textContent = 'Xem chi tiết';
                detailBtn.setAttribute('onclick', `showOrderDetails(${tx.orderId}, this)`);

                let processBtn = null, cancelBtn = null, invoiceBtn = null;
                if (tx.status === "PENDING") {
                    processBtn = document.createElement('button');
                    processBtn.className = 'action-btn process-btn';
                    processBtn.textContent = 'Process';
                    processBtn.setAttribute('onclick', `showPaymentMethodPopup(${tx.orderId}, this)`);

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

                // Thêm tooltip
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
                    <td>${tx.paymentMethod || 'N/A'}</td>
                    <td><span style="color: ${tx.status === 'PAID' ? '#2ed573' : tx.status === 'CANCELLED' ? '#ff4757' : '#ff9800'}">${tx.status || 'N/A'}</span></td>
                    <td>${tx.transactionId || tx.transaction_id || 'N/A'}</td>
                    <td>${tx.createdAt ? new Date(tx.createdAt).toISOString().replace('T', ' ').split('.')[0] : 'N/A'}</td>
                    <td>${tx.updatedAt ? new Date(tx.updatedAt).toISOString().replace('T', ' ').split('.')[0] : 'N/A'}</td>
                `;
                row.appendChild(actionButtons);
                tbody.appendChild(row);
            });

            transactionCount.textContent = `Tổng số hóa đơn: ${totalItems} (Trang ${currentPage}/${totalPages}, Trạng thái: ${filters.status}, Phương thức: ${filters.method}, Giá: ${filters.priceRange ? `${filters.priceRange[0]} - ${filters.priceRange[1]} VNĐ` : 'Tất cả'}, Sắp xếp: ${filters.sort ? `${filters.sort}` : 'Mặc định'})`;
            updatePagination(totalPages);
        } else {
            document.getElementById("transactionsTable").style.display = "none";
            document.getElementById("filterContainer").style.display = "block";
            document.getElementById("searchContainer").style.display = "none";
            transactionCount.textContent = `Không có hóa đơn nào với các bộ lọc: Trạng thái ${filters.status}, Phương thức ${filters.method}, Giá: ${filters.priceRange ? `${filters.priceRange[0]} - ${filters.priceRange[1]} VNĐ` : 'Tất cả'}, Sắp xếp: ${filters.sort ? `${filters.sort}` : 'Mặc định'}.`;
            paginationDiv.style.display = 'none';
        }
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    } catch (error) {
        console.error("Error fetching transactions:", error);
        showError("error", `❌ ${error.message || "Không thể tải giao dịch."}`);
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
    filters.sort = order === null ? null : order;
    // Không reset currentPage, giữ nguyên trang hiện tại
    const sortPriceBtn = document.getElementById('sortPriceBtn');
    sortPriceBtn.textContent = order === null ? 'Sắp xếp Theo Giá' : `Sắp xếp Theo Giá: ${order === 'asc' ? 'Tăng dần' : 'Giảm dần'}`;
    document.getElementById('sortPriceFilterMenu').style.display = 'none';
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

// Áp dụng filter trạng thái hoặc phương thức
function applyFilter(type, value) {
    console.log(`applyFilter called with type: ${type}, value: ${value}`);
    if (type === 'status' || type === 'method') {
        filters[type] = value === null ? 'all' : value;
        // Không reset currentPage, giữ nguyên trang hiện tại
        const btn = document.getElementById(`${type}FilterBtn`);
        btn.textContent = value === null ? `Lọc Theo ${type === 'status' ? 'Trạng Thái' : 'Phương Thức'}` : `${type === 'status' ? 'Trạng thái' : 'Phương thức'}: ${value || 'Tất cả'}`;
    }
    document.getElementById(`${type}FilterMenu`).style.display = 'none';
    refreshTransactions();
}



// Cập nhật khi tải trang hoặc chuyển section cái này cho lọc vs refresh transaction
document.addEventListener("DOMContentLoaded", () => {
    showSection("transactions"); // Mặc định hiển thị Transactions
});

//====================================================================================
//====================================================================================
//====================================================================================

// Hàm tìm kiếm giao dịch
async function searchTransactions(event) {
    if (event) event.preventDefault();
    console.log('searchTransactions called');

    const searchInput = document.getElementById('searchTransactionInput');
    const query = searchInput?.value.trim();
    const tbody = document.getElementById('transactionsBody');
    const transactionCount = document.getElementById('transactionCount');
    const searchButton = document.getElementById('searchTransactionBtn');
    const errorElement = document.getElementById('error');

    console.log('Query input:', query);

    // Nếu query rỗng, chỉ tải lại danh sách giao dịch mà không hiển thị lỗi
    if (!query) {
        await refreshTransactions();
        return;
    }

    // Kiểm tra định dạng query
    if (!/^[a-zA-Z0-9-]+$/.test(query)) {
        if (errorElement) {
            errorElement.textContent = 'Order ID hoặc Transaction ID không hợp lệ!';
            errorElement.style.display = 'block';
            setTimeout(() => errorElement.style.display = 'none', 5000);
        }
        await refreshTransactions();
        return;
    }

    if (searchButton) {
        searchButton.disabled = true;
        searchButton.innerHTML = 'Đang tìm... <span class="loading"></span>';
    }

    try {
        const params = new URLSearchParams({ query });
        console.log('API URL:', `${API_BASE_URL}/payments/search-transactions?${params.toString()}`);
        const data = await apiFetch(`${API_BASE_URL}/payments/search-transactions?${params.toString()}`);

        console.log('Search API response data:', data);

        if (data.code === 1000) {
            const transactions = data.result || [];
            console.log('Transactions found:', transactions);

            if (tbody) tbody.innerHTML = '';

            if (transactions.length > 0) {
                if (searchInput) {
                    searchInput.value = query; // Giữ nguyên query ban đầu
                }

                let filteredTransactions = transactions;
                if (query && !isNaN(query)) {
                    filteredTransactions = transactions.filter(tx => tx.orderId === parseInt(query));
                    if (filteredTransactions.length === 0) {
                        if (errorElement) {
                            errorElement.textContent = `Không tìm thấy hóa đơn với Order ID ${query}.`;
                            errorElement.style.display = 'block';
                            setTimeout(() => errorElement.style.display = 'none', 5000);
                        }
                        return;
                    }
                }

                const table = document.getElementById('transactionsTable');
                const filterContainer = document.getElementById('filterContainer');
                const searchContainer = document.getElementById('searchContainer');

                if (table) table.style.display = 'table';
                if (filterContainer) filterContainer.style.display = 'block';
                if (searchContainer) searchContainer.style.display = 'block';

                filteredTransactions.forEach(tx => {
                    const row = document.createElement('tr');
                    row.className = 'transaction-row';
                    let actionButtons = `
                        <button class="details-btn" onclick="showOrderDetails(${tx.orderId}, this)">Xem chi tiết</button>
                    `;
                    if (tx.status === 'PENDING') {
                        actionButtons += `
                            <button class="action-btn process-btn" onclick="showPaymentMethodPopup(${tx.orderId}, this)">Process</button>
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
                        <td>${tx.paymentMethod || 'N/A'}</td>
                        <td><span style="color: ${tx.status === 'PAID' ? '#2ed573' : tx.status === 'CANCELLED' ? '#ff4757' : '#ff9800'}">${tx.status || 'N/A'}</span></td>
                        <td>${tx.transaction_id || 'N/A'}</td>
                        <td>${tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</td>
                        <td>${tx.updatedAt ? new Date(tx.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</td>
                        <td class="action-buttons">${actionButtons}</td>
                    `;
                    if (tbody) tbody.appendChild(row);
                });

                if (transactionCount) {
                    transactionCount.textContent = `Tìm thấy ${filteredTransactions.length} hóa đơn cho "${query}"`;
                }
            } else {
                const table = document.getElementById('transactionsTable');
                if (table) table.style.display = 'none';
                if (transactionCount) {
                    transactionCount.textContent = `Không tìm thấy hóa đơn nào cho "${query}".`;
                }
            }
        } else {
            if (errorElement) {
                errorElement.textContent = `❌ ${data.message || 'Không thể tìm kiếm giao dịch.'}`;
                errorElement.style.display = 'block';
                setTimeout(() => errorElement.style.display = 'none', 5000);
            }
            if (tbody) tbody.innerHTML = '';
            if (transactionCount) transactionCount.textContent = '';
            const table = document.getElementById('transactionsTable');
            if (table) table.style.display = 'none';
        }
    } catch (error) {
        console.error('Search error:', error);
        if (errorElement) {
            errorElement.textContent = `❌ ${error.message || 'Lỗi kết nối hệ thống, vui lòng thử lại sau.'}`;
            errorElement.style.display = 'block';
            setTimeout(() => errorElement.style.display = 'none', 5000);
        }
        if (tbody) tbody.innerHTML = '';
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

// Tìm kiếm gợi ý
async function fetchSuggestions() {
    const query = document.getElementById('searchTransactionInput')?.value.trim() || '';
    const suggestionBox = document.getElementById('suggestionBox');

    if (!suggestionBox) {
        console.error('suggestionBox not found in DOM');
        return;
    }

    if (query.length < 1) {
        suggestionBox.style.display = 'none';
        await refreshTransactions();
        return;
    }

    try {
        console.log(`Fetching suggestions for query: ${query}`);
        const data = await apiFetch(`${API_BASE_URL}/payments/suggestions?query=${encodeURIComponent(query)}`);

        console.log('API Response Details:', data);
        console.log('Suggestions Array:', data.result);

        const suggestions = data.result || [];
        suggestionBox.innerHTML = '';
        if (suggestions.length > 0) {
            suggestions.forEach(suggestion => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = suggestion; 
                // Lấy orderId từ đầu chuỗi (phần số)
                const orderId = suggestion.match(/^\d+/)[0]; // Trích xuất số đầu tiên (ví dụ: "2")
                div.dataset.suggestionValue = orderId; // Lưu chỉ orderId (ví dụ: "2")
                div.addEventListener('click', () => {
                    const searchInput = document.getElementById('searchTransactionInput');
                    if (searchInput) {
                        // Cập nhật ô input với chỉ orderId
                        searchInput.value = div.dataset.suggestionValue; // Sử dụng "2" thay vì toàn bộ chuỗi
                    }
                    suggestionBox.style.display = 'none';
                    searchTransactions({ preventDefault: () => {} }); // Tìm kiếm với orderId
                });
                suggestionBox.appendChild(div);
            });
            suggestionBox.style.display = 'block';
        } else {
            suggestionBox.style.display = 'none';
        }
    } catch (error) {
        console.error('Lỗi khi lấy gợi ý:', error);
        showError('error', `❌ ${error.message || 'Lỗi khi tải gợi ý, vui lòng thử lại.'}`);
        suggestionBox.style.display = 'none';
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

    // Set loading state
    button.textContent = 'Đang tải...';
    button.classList.add('loading-btn');

    try {
        const data = await apiFetch(`${API_BASE_URL}/payments/invoice/${orderId}`);

        if (data.result) {
            // Tạo hàng chi tiết với styling đẹp
            const detailsRow = document.createElement('tr');
            detailsRow.className = 'order-details-row';

            const totalAmount = data.result.orderItems.reduce((sum, item) =>
                sum + ((item.quantity || 0) * (item.price || 0)), 0);

            // Dịch trạng thái sang tiếng Việt
            const statusText = {
                'PENDING': 'Đang chờ',
                'PAID': 'Đã thanh toán',
                'CANCELLED': 'Đã hủy'
            }[data.result.status] || data.result.status || 'N/A';

            // Màu sắc cho trạng thái
            const statusColor = {
                'PAID': '#2ed573',
                'CANCELLED': '#ff4757',
                'PENDING': '#ff9800'
            }[data.result.status] || '#000000';

            detailsRow.innerHTML = `
                <td colspan="8">
                    <div class="order-details-container">
                        <div class="order-header">
                            <h4>Chi tiết đơn hàng #${orderId}</h4>
                            <div class="order-info">
                                <span class="order-time">${data.result.formattedPaymentDate || (data.result.paymentDate ? new Date(data.result.paymentDate).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A')}</span>
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

            // Chèn hàng chi tiết
            row.after(detailsRow);

            // Update states
            currentDetailsRow = detailsRow;
            currentActiveRow = row;
            currentButton = button;

            // Set active states
            row.classList.add('active-row');
            button.classList.remove('loading-btn');
            button.textContent = '✕ Đóng';
            button.classList.add('close-btn');

            // Trigger animation
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

        // Reset states on error
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
//==================================================================================//==================================================================================

   // Xử lý thanh toán đơn hàng
   async function processPayment(orderId, paymentMethod, button) {
    clearMessages();
    const originalText = button.textContent || 'Thanh toán';
    button.textContent = originalText + ' <span class="loading"></span>';
    button.disabled = true;

    try {
        const data = await apiFetch(`${API_BASE_URL}/payments/payment2`, {
            method: "POST",
            body: JSON.stringify({ orderId, paymentMethod })
        });

        console.log('API Response:', data);

        if (data.code === 0) {
            document.getElementById('message').textContent = "🎉 Thanh toán thành công!";
            document.getElementById('message').style.display = 'block';
            setTimeout(() => document.getElementById('message').style.display = 'none', 3000);

            showSuccessNotification();

            const invoiceData = await apiFetch(`${API_BASE_URL}/payments/invoice/${orderId}`);
            if (invoiceData.code === 0 && invoiceData.result) {
                displayInvoice(invoiceData);

                const invoiceSection = document.getElementById('invoice');
if (invoiceSection) {
  invoiceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

                if (invoiceData.result.customerEmail) {
                    const emailData = await apiFetch(`${API_BASE_URL}/payments/send-invoice-email`, {
                        method: 'POST',
                        body: JSON.stringify({ customerEmail: invoiceData.result.customerEmail, orderId })
                    });
                    if (emailData.code === 0) {
                        document.getElementById('message').textContent += " Hóa đơn đã được gửi qua email!";
                    } else {
                        showError("error", `❌ Lỗi gửi email: ${emailData.message || 'Không thể gửi email'}`);
                    }
                }
            } else {
                showError("error", `❌ Lỗi lấy hóa đơn: ${invoiceData.message || 'Dữ liệu hóa đơn không hợp lệ.'}`);
            }

            await refreshTransactions();
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
            document.getElementById('message').textContent = "✅ Đơn hàng đã được hủy thành công!";
            document.getElementById('message').style.display = 'block';
            setTimeout(() => document.getElementById('message').style.display = 'none', 3000);

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


//=====================HÓa đơn=============================================================



      // Hiển thị chi tiết hóa đơn từ dữ liệu API
      function displayInvoice(invoiceData) {
          const data = invoiceData.result || invoiceData;
          if (!data) {
              console.error('No invoice data available');
              return;
          }

          document.getElementById('invoiceId').textContent = `#${data.orderId || 'N/A'}`;
          const paymentTime = data.formattedPaymentDate ||
              (data.paymentDate
                  ? new Date(data.paymentDate).toLocaleString('vi-VN', {
                      timeZone: 'Asia/Ho_Chi_Minh',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                  })
                  : 'N/A');
          document.getElementById('paymentDate').textContent = paymentTime;
          document.getElementById('tableNumber').textContent = data.tableNumber || 'N/A';
          document.getElementById('customerName').textContent = data.customerName || 'N/A';
          document.getElementById('displayCustomerEmail').textContent = data.customerEmail || 'N/A';
          document.getElementById('totalAmount').textContent = (data.amount || 0).toLocaleString('vi-VN') + '₫';
          document.getElementById('paymentMethodDisplay').textContent = data.paymentMethod || 'N/A';
          document.getElementById('status').textContent = data.status || 'N/A';
          document.getElementById('transactionId').textContent = data.transactionId || data.transaction_id || 'N/A';

          const tbody = document.getElementById('invoiceItems');
          tbody.innerHTML = '';
          (data.orderItems || []).forEach(item => {
              const row = document.createElement('tr');
              row.innerHTML = `
                  <td>${item.itemName || 'N/A'}</td>
                  <td>${item.quantity || 0}</td>
                  <td>${(item.price || 0).toLocaleString('vi-VN')}₫</td>
                  <td>${((item.quantity || 0) * (item.price || 0)).toLocaleString('vi-VN')}₫</td>
              `;
              tbody.appendChild(row);
          });

          document.getElementById('invoice').style.display = 'block';
          setTimeout(() => {
              document.getElementById('invoice').style.display = 'none';
          }, 5000);
      }



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


//==================================================================================
