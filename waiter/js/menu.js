// State management
let currentPage = 0;
let currentSize = 20;
let totalPages = 1;
let totalElements = 0;
let currentFilters = {
    categoryId: null,
    keyword: null,
    status: null,
    sortBy: 'name',
    sortDirection: 'asc'
};

let cart = [];
let currentTableId = null;
let currentUserId = 1;

async function showMenu() {
    try {
        // Update page title and toggle visibility
        document.getElementById('pageTitle').textContent = 'Thực đơn';
        document.getElementById('dashboardContent').style.display = 'none';
        document.getElementById('dynamicContent').style.display = 'block';

        // Fetch menu.html
        const response = await fetch('/waiter/menu.html');
        if (!response.ok) {
            throw new Error('Không thể tải menu.html');
        }
        const htmlContent = await response.text();

        // Parse HTML để lấy templates
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Lấy template menuPageTemplate
        const menuTemplate = doc.getElementById('menuPageTemplate')?.content?.cloneNode(true);
        if (!menuTemplate) {
            throw new Error('Không tìm thấy template menuPageTemplate');
        }

        // Thêm các template liên quan vào document (nếu cần)
        const templates = [
            'menuPageTemplate' // Chỉ cần template chính
        ];
        templates.forEach(templateId => {
            const templateElement = doc.getElementById(templateId);
            if (templateElement) {
                document.body.appendChild(templateElement.cloneNode(true));
            }
        });

        // Clear dynamicContent and append the main template
        const dynamicContent = document.getElementById('dynamicContent');
        if (dynamicContent) {
            dynamicContent.innerHTML = '';
            dynamicContent.appendChild(menuTemplate);
        }

        // Nạp CSS menu-style.css động (nếu chưa có)
        if (!document.querySelector('link[href="css/menu-style.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/menu-style.css'; // Đường dẫn tương đối từ root
            document.head.appendChild(link);
        }

        // Load categories first, then menu items
        await loadCategories();
        await loadMenuItems();

        // Setup event listeners after template is loaded
        setupMenuEventListeners();

    } catch (error) {
        console.error('Error loading menu page:', error);
        const dynamicContent = document.getElementById('dynamicContent');
        if (dynamicContent) {
            dynamicContent.innerHTML = `
                <div class="alert alert-danger">
                    <h4>Không thể tải trang thực đơn</h4>
                    <p>Lỗi: ${error.message}</p>
                    <button class="btn btn-primary" onclick="showMenu()">Thử lại</button>
                </div>
            `;
        }
    }
}

// Load categories từ API
async function loadCategories() {
    try {
        const data = await apiFetch('/categories', {
            method: 'GET'
        });

        if (data.code !== 1000) {
            throw new Error(data.message || 'Không thể tải danh sách danh mục');
        }

        const categories = data.result || [];
        const categoryFilter = document.getElementById('categoryFilter');
        
        if (categoryFilter) {
            // Giữ lại option "Tất cả danh mục"
            categoryFilter.innerHTML = '<option value="">Tất cả danh mục</option>';
            
            // Thêm các danh mục
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categoryFilter.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Error loading categories:', error);
        // Nếu không load được categories, vẫn hiển thị option mặc định
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="">Tất cả danh mục</option>';
        }
    }
}

// Setup event listeners
function setupMenuEventListeners() {
    // Các event listeners hiện tại...
    const jumpInput = document.getElementById('jumpToPage');
    if (jumpInput) {
        jumpInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                jumpToPage();
            }
        });
    }

    const keywordInput = document.getElementById('keywordFilter');
    if (keywordInput) {
        keywordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
    }

    const filterElements = [
        'categoryFilter', 'statusFilter', 'sortByFilter', 
        'sortDirectionFilter', 'pageSizeFilter'
    ];

    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', applyFilters);
        }
    });

    // THÊM MỚI: Event listener cho giỏ hàng
    setupCartEventListeners();
}


// Load menu items từ API
async function loadMenuItems() {
    try {
        showLoading();
        
        // Get filter values
        const categoryFilter = document.getElementById('categoryFilter');
        const keywordFilter = document.getElementById('keywordFilter');
        const statusFilter = document.getElementById('statusFilter');
        const sortByFilter = document.getElementById('sortByFilter');
        const sortDirectionFilter = document.getElementById('sortDirectionFilter');
        const pageSizeFilter = document.getElementById('pageSizeFilter');

        const categoryId = categoryFilter ? categoryFilter.value : '';
        const keyword = keywordFilter ? keywordFilter.value : '';
        const status = statusFilter ? statusFilter.value : '';
        const sortBy = sortByFilter ? sortByFilter.value || 'name' : 'name';
        const sortDirection = sortDirectionFilter ? sortDirectionFilter.value || 'asc' : 'asc';
        const pageSize = pageSizeFilter ? pageSizeFilter.value || '20' : '20';

        // Build query parameters
        const params = new URLSearchParams();
        if (categoryId) params.append('categoryId', categoryId);
        if (keyword) params.append('keyword', keyword);
        if (status) params.append('status', status);
        params.append('sortBy', sortBy);
        params.append('sortDirection', sortDirection);
        params.append('page', currentPage.toString());
        params.append('size', pageSize);

        // API call
        const data = await apiFetch(`/menu-items?${params.toString()}`, {
            method: 'GET'
        });

        if (data.code !== 1000) {
            throw new Error(data.message || 'API returned error');
        }

        const menuPage = data.result;
        const menuItems = menuPage.content || [];

        // Update pagination info
        totalPages = menuPage.totalPages;
        totalElements = menuPage.totalElements;
        currentPage = menuPage.number;
        currentSize = parseInt(pageSize);

        // Render menu items
        renderMenuItems(menuItems);
        updateMenuSummary(menuPage);
        updateMenuPagination();

    } catch (error) {
        console.error('Error fetching menu items:', error);
        showError(error.message || 'Không thể tải dữ liệu món ăn');
    }
}

// Utility functions
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price);
}

function showLoading() {
    const menuGrid = document.getElementById('menuGrid');
    if (menuGrid) {
        menuGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #666;">Đang tải dữ liệu...</div>';
    }
}

function showError(message) {
    const menuGrid = document.getElementById('menuGrid');
    if (menuGrid) {
        menuGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #e74c3c;">Lỗi: ${message}</div>`;
    }
}

// Render menu items
function renderMenuItems(items) {
    const menuGrid = document.getElementById('menuGrid');
    
    if (!items || items.length === 0) {
        menuGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #666;">Không có món ăn nào</div>';
        return;
    }

    menuGrid.innerHTML = '';
    
    items.forEach(item => {
        const imageUrl = item.imageUrl 
            ? item.imageUrl 
            : `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='8' fill='%23999' text-anchor='middle' dy='0.3em'%3E${encodeURIComponent(item.name)}%3C/text%3E%3C/svg%3E`;
        
        const menuItemHTML = `
            <div class="menu-item" data-id="${item.id}">
                <div class="item-image">
                    <img src="${imageUrl}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\' viewBox=\\'0 0 100 100\\'%3E%3Crect width=\\'100\\' height=\\'100\\' fill=\\'%23f0f0f0\\'/%3E%3Ctext x=\\'50\\' y=\\'50\\' font-family=\\'Arial\\' font-size=\\'8\\' fill=\\'%23999\\' text-anchor=\\'middle\\' dy=\\'0.3em\\'%3E${encodeURIComponent(item.name)}%3C/text%3E%3C/svg%3E';">
                    <div class="golden-line"></div>
                </div>
                <div class="item-content">
                    <h3 class="item-name">${item.name}</h3>
                    <p class="item-description">${item.description}</p>
                    <div class="item-price">đ${formatPrice(item.price)}</div>
                </div>
            </div>
        `;
        menuGrid.innerHTML += menuItemHTML;
    });
}

// Update summary
function updateMenuSummary(menuPage) {
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        const start = menuPage.number * menuPage.size + 1;
        const end = Math.min((menuPage.number + 1) * menuPage.size, menuPage.totalElements);
        paginationInfo.textContent = `Hiển thị ${start} - ${end} của ${menuPage.totalElements} món ăn`;
    }
}

// Update pagination
function updateMenuPagination() {
    // Update button states
    const firstBtn = document.getElementById('firstPageBtn');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const lastBtn = document.getElementById('lastPageBtn');

    if (firstBtn) firstBtn.disabled = currentPage === 0;
    if (prevBtn) prevBtn.disabled = currentPage === 0;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;
    if (lastBtn) lastBtn.disabled = currentPage >= totalPages - 1;

    // Update page numbers
    const pageNumbers = document.getElementById('pageNumbers');
    if (pageNumbers) {
        let pagesHtml = '';
        const startPage = Math.max(0, currentPage - 2);
        const endPage = Math.min(totalPages - 1, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === currentPage ? 'active' : '';
            pagesHtml += `<button class="page-btn ${isActive}" onclick="goToPage(${i})">${i + 1}</button>`;
        }
        pageNumbers.innerHTML = pagesHtml;
    }
}

// Navigation functions
function goToPage(page) {
    if (page >= 0 && page < totalPages) {
        currentPage = page;
        loadMenuItems();
    }
}

function jumpToPage() {
    const jumpInput = document.getElementById('jumpToPage');
    if (jumpInput) {
        const page = parseInt(jumpInput.value) - 1; // Convert to 0-based
        if (page >= 0 && page < totalPages) {
            goToPage(page);
            jumpInput.value = '';
        }
    }
}

function applyFilters() {
    currentPage = 0; // Reset to first page
    loadMenuItems();
}

function resetFilters() {
    // Reset all filter elements
    const filterElements = [
        'categoryFilter', 'keywordFilter', 'statusFilter', 
        'sortByFilter', 'sortDirectionFilter', 'pageSizeFilter'
    ];

    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'text') {
                element.value = '';
            } else {
                element.selectedIndex = 0;
            }
        }
    });

    // Reset state and reload
    currentPage = 0;
    currentFilters = {
        categoryId: null,
        keyword: null,
        status: null,
        sortBy: 'name',
        sortDirection: 'asc'
    };
    
    loadMenuItems();
}

function setupCartEventListeners() {
    // Click vào menu item để thêm vào giỏ
    document.addEventListener('click', function(e) {
        if (e.target.closest('.menu-item')) {
            const menuItem = e.target.closest('.menu-item');
            const menuItemId = parseInt(menuItem.dataset.id);
            showAddToCartModal(menuItemId);
        }
    });
}

// HÀM MỚI: Hiển thị modal thêm vào giỏ hàng
function showAddToCartModal(menuItemId) {
    injectModalStyles(); // Inject styles before creating modal
    const menuItem = document.querySelector(`[data-id="${menuItemId}"]`);
    if (!menuItem) return;

    const itemName = menuItem.querySelector('.item-name').textContent;
    const itemPrice = menuItem.querySelector('.item-price').textContent;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Thêm món vào giỏ hàng</h3>
                <button class="close-btn" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <h4>${itemName}</h4>
                <p>Giá: ${itemPrice}</p>
                <div class="quantity-selector">
                    <label for="quantity">Số lượng:</label>
                    <input type="number" id="quantity" min="1" value="1">
                </div>
                <div class="note-section">
                    <label for="itemNote">Ghi chú (tùy chọn):</label>
                    <textarea id="itemNote" placeholder="Ví dụ: Ít cay, không hành..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="closeModal()">Hủy</button>
                <button class="btn-add" onclick="addToCart(${menuItemId})">Thêm vào giỏ</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// HÀM MỚI: Đóng modal
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// HÀM MỚI: Thêm món vào giỏ hàng
function addToCart(menuItemId) {
    const quantityInput = document.getElementById('quantity');
    const noteInput = document.getElementById('itemNote');
    
    const quantity = parseInt(quantityInput.value) || 1;
    const note = noteInput.value.trim();

    // Tìm thông tin món ăn
    const menuItem = document.querySelector(`[data-id="${menuItemId}"]`);
    const itemName = menuItem.querySelector('.item-name').textContent;
    const itemPriceText = menuItem.querySelector('.item-price').textContent;
    const itemPrice = parseFloat(itemPriceText.replace(/[^\d]/g, ''));

    // Kiểm tra xem món đã có trong giỏ chưa
    const existingItem = cart.find(item => item.menuItemId === menuItemId);
    
    if (existingItem) {
        existingItem.quantity += quantity;
        if (note) {
            existingItem.note = existingItem.note ? `${existingItem.note}; ${note}` : note;
        }
    } else {
        cart.push({
            menuItemId,
            name: itemName,
            price: itemPrice,
            quantity,
            note
        });
    }

    updateCartDisplay();
    closeModal();
    showToast(`Đã thêm ${quantity} ${itemName} vào giỏ hàng`);
}

// HÀM MỚI: Cập nhật hiển thị giỏ hàng
function updateCartDisplay() {
    let cartBtn = document.getElementById('cartBtn');
    if (!cartBtn) {
        // Tạo nút giỏ hàng nếu chưa có
        cartBtn = document.createElement('button');
        cartBtn.id = 'cartBtn';
        cartBtn.className = 'cart-button';
        cartBtn.onclick = showCart;
        
        const menuControls = document.querySelector('.menu-controls');
        if (menuControls) {
            menuControls.appendChild(cartBtn);
        }
    }

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    cartBtn.innerHTML = `
        <span class="cart-icon">🛒</span>
        <span class="cart-info">
            <span class="cart-count">${totalItems}</span>
            <span class="cart-total">đ${formatPrice(totalAmount)}</span>
        </span>
    `;
    
    cartBtn.style.display = cart.length > 0 ? 'block' : 'none';
}

// HÀM MỚI: Hiển thị giỏ hàng
function showCart() {
    injectModalStyles(); // Inject styles before creating modal
    if (cart.length === 0) {
        showToast('Giỏ hàng trống');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    let cartItemsHtml = '';
    let totalAmount = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        totalAmount += itemTotal;
        
        cartItemsHtml += `
            <div class="cart-item" data-index="${index}">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <p>Giá: đ${formatPrice(item.price)}</p>
                    ${item.note ? `<p class="item-note">Ghi chú: ${item.note}</p>` : ''}
                </div>
                <div class="item-controls">
                    <button onclick="updateCartQuantity(${index}, -1)" class="qty-btn">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button onclick="updateCartQuantity(${index}, 1)" class="qty-btn">+</button>
                    <button onclick="removeFromCart(${index})" class="remove-btn">Xóa</button>
                </div>
                <div class="item-total">đ${formatPrice(itemTotal)}</div>
            </div>
        `;
    });

    modal.innerHTML = `
        <div class="modal-content cart-modal">
            <div class="modal-header">
                <h3>Giỏ hàng</h3>
                <button class="close-btn" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="cart-items">
                    ${cartItemsHtml}
                </div>
                <div class="cart-summary">
                    <div class="total-amount">
                        <strong>Tổng cộng: đ${formatPrice(totalAmount)}</strong>
                    </div>
                </div>
                <div class="order-info">
                    <div class="table-selection">
                        <label for="tableSelect">Chọn bàn:</label>
                        <select id="tableSelect">
                            <option value="">-- Chọn bàn --</option>
                            ${generateTableOptions()}
                        </select>
                    </div>
                    <div class="order-note">
                        <label for="orderNote">Ghi chú đơn hàng:</label>
                        <textarea id="orderNote" placeholder="Ghi chú cho toàn bộ đơn hàng..."></textarea>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="closeModal()">Hủy</button>
                <button class="btn-clear" onclick="clearCart()">Xóa hết</button>
                <button class="btn-order" onclick="submitOrder()">Đặt món</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function injectModalStyles() {
    // Check if styles are already injected to avoid duplicates
    if (document.getElementById('modal-styles')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'modal-styles';
    styleElement.textContent = `
        /* Styles cho giỏ hàng và modal */
        .cart-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 50px;
            padding: 15px 20px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: bold;
            transition: all 0.3s ease;
        }

        .cart-button:hover {
            background: #219a52;
            transform: translateY(-2px);
        }

        .cart-icon {
            font-size: 18px;
        }

        .cart-info {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            font-size: 12px;
        }

        .cart-count {
            background: #e74c3c;
            color: white;
            border-radius: 10px;
            padding: 2px 6px;
            font-size: 10px;
            font-weight: bold;
        }

        .cart-total {
            font-size: 11px;
            opacity: 0.9;
        }

        /* Modal styles */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
        }

        .modal-content {
            background: white;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .cart-modal {
            max-width: 600px;
        }

        .order-details-modal {
            max-width: 500px;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #eee;
        }

        .modal-header h3 {
            margin: 0;
            color: #333;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .close-btn:hover {
            color: #e74c3c;
        }

        .modal-body {
            padding: 20px;
        }

        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 20px;
            border-top: 1px solid #eee;
        }

        /* Form styles trong modal */
        .quantity-selector {
            margin: 15px 0;
        }

        .quantity-selector label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .quantity-selector input {
            width: 80px;
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        .note-section {
            margin: 15px 0;
        }

        .note-section label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .note-section textarea {
            width: 100%;
            height: 60px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            resize: vertical;
            font-family: inherit;
        }

        /* Cart items styles */
        .cart-items {
            max-height: 300px;
            overflow-y: auto;
            margin-bottom: 20px;
        }

        .cart-item {
            display: flex;
            align-items: center;
            padding: 15px;
            border: 1px solid #eee;
            border-radius: 8px;
            margin-bottom: 10px;
            gap: 15px;
        }

        .cart-item .item-info {
            flex: 1;
        }

        .cart-item .item-info h4 {
            margin: 0 0 5px 0;
            color: #333;
        }

        .cart-item .item-info p {
            margin: 0;
            color: #666;
            font-size: 14px;
        }

        .cart-item .item-note {
            font-style: italic;
            color: #888;
        }

        .cart-item .item-controls {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .qty-btn {
            width: 30px;
            height: 30px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }

        .qty-btn:hover {
            background: #f0f0f0;
        }

        .quantity {
            min-width: 30px;
            text-align: center;
            font-weight: bold;
        }

        .remove-btn {
            background: #e74c3c;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }

        .remove-btn:hover {
            background: #c0392b;
        }

        .cart-item .item-total {
            font-weight: bold;
            color: #27ae60;
            min-width: 80px;
            text-align: right;
        }

        .cart-summary {
            border-top: 2px solid #eee;
            padding-top: 15px;
            margin-bottom: 20px;
        }

        .total-amount {
            text-align: right;
            font-size: 18px;
            color: #27ae60;
        }

        /* Order info styles */
        .order-info {
            margin: 20px 0;
        }

        .table-selection {
            margin-bottom: 15px;
        }

        .table-selection label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .table-selection select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        .order-note {
            margin-bottom: 15px;
        }

        .order-note label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .order-note textarea {
            width: 100%;
            height: 60px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            resize: vertical;
            font-family: inherit;
        }

        /* Button styles */
        .btn-cancel {
            background: #95a5a6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
        }

        .btn-cancel:hover {
            background: #7f8c8d;
        }

        .btn-add, .btn-order, .btn-primary {
            background: #27ae60;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
        }

        .btn-add:hover, .btn-order:hover, .btn-primary:hover {
            background: #219a52;
        }

        .btn-clear {
            background: #e74c3c;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
        }

        .btn-clear:hover {
            background: #c0392b;
        }

        /* Order details styles */
        .order-info p {
            margin: 8px 0;
        }

        .order-items {
            margin: 20px 0;
        }

        .order-items h4 {
            margin-bottom: 10px;
            color: #333;
        }

        .order-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }

        .order-item:last-child {
            border-bottom: none;
        }

        .order-item .item-name {
            flex: 1;
        }

        .order-item .item-quantity {
            margin: 0 15px;
            color: #666;
        }

        .order-item .item-price {
            font-weight: bold;
            color: #27ae60;
        }

        .order-total {
            text-align: right;
            padding-top: 15px;
            border-top: 2px solid #eee;
            font-size: 18px;
            color: #27ae60;
        }

        /* Toast notification */
        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 3000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        }

        .toast.show {
            transform: translateX(0);
        }

        .toast-info {
            background: #3498db;
        }

        .toast-success {
            background: #27ae60;
        }

        .toast-error {
            background: #e74c3c;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .modal-content {
                width: 95%;
                max-height: 95vh;
            }
            
            .cart-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }
            
            .cart-item .item-controls {
                align-self: flex-end;
            }
            
            .cart-button {
                bottom: 10px;
                right: 10px;
                padding: 12px 15px;
            }
            
            .cart-info {
                font-size: 11px;
            }
        }
    `;
    document.head.appendChild(styleElement);
}


// HÀM MỚI: Tạo options cho select bàn
function generateTableOptions() {
    let options = '';
    // Tạo danh sách bàn mẫu (có thể lấy từ API)
    for (let i = 1; i <= 20; i++) {
        options += `<option value="${i}">Bàn ${i}</option>`;
    }
    return options;
}

// HÀM MỚI: Cập nhật số lượng trong giỏ hàng
function updateCartQuantity(index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        updateCartDisplay();
        // Refresh cart modal if open
        const modal = document.querySelector('.cart-modal');
        if (modal) {
            closeModal();
            showCart();
        }
    }
}

// HÀM MỚI: Xóa món khỏi giỏ hàng
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();
    // Refresh cart modal if open
    const modal = document.querySelector('.cart-modal');
    if (modal) {
        closeModal();
        if (cart.length > 0) {
            showCart();
        }
    }
}

// HÀM MỚI: Xóa hết giỏ hàng
function clearCart() {
    cart = [];
    updateCartDisplay();
    closeModal();
    showToast('Đã xóa hết món trong giỏ hàng');
}

// HÀM MỚI: Gửi đơn hàng
async function submitOrder() {
    const tableSelect = document.getElementById('tableSelect');
    const orderNote = document.getElementById('orderNote');
    
    const tableId = parseInt(tableSelect.value);
    const note = orderNote.value.trim();
    
    if (!tableId) {
        showToast('Vui lòng chọn bàn', 'error');
        return;
    }
    
    if (cart.length === 0) {
        showToast('Giỏ hàng trống', 'error');
        return;
    }

    // Chuẩn bị dữ liệu đơn hàng
    const orderData = {
        tableId: tableId,
        userId: currentUserId,
        note: note || null,
        orderType: "DINE_IN",
        status: "PENDING",
        orderItems: cart.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            status: "PENDING"
        }))
    };

    try {
        // Hiển thị loading
        const submitBtn = document.querySelector('.btn-order');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Đang đặt món...';
        }

        // Gửi API
        const response = await apiFetch('/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (response.code === 0) {
            // Thành công
            const order = response.result;
            showToast(`Đặt món thành công! Mã đơn hàng: ${order.id}`, 'success');
            
            // Reset giỏ hàng
            cart = [];
            updateCartDisplay();
            closeModal();
            
            // Có thể hiển thị chi tiết đơn hàng
            showOrderDetails(order);
        } else {
            throw new Error(response.message || 'Đặt món thất bại');
        }

    } catch (error) {
        console.error('Error submitting order:', error);
        showToast(`Lỗi đặt món: ${error.message}`, 'error');
    } finally {
        // Reset button
        const submitBtn = document.querySelector('.btn-order');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đặt món';
        }
    }
}

// HÀM MỚI: Hiển thị chi tiết đơn hàng
function showOrderDetails(order) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    let orderItemsHtml = '';
    order.orderItems.forEach(item => {
        orderItemsHtml += `
            <div class="order-item">
                <span class="item-name">${item.menuItemName}</span>
                <span class="item-quantity">x${item.quantity}</span>
                <span class="item-price">đ${formatPrice(item.price)}</span>
            </div>
        `;
    });

    modal.innerHTML = `
        <div class="modal-content order-details-modal">
            <div class="modal-header">
                <h3>Chi tiết đơn hàng #${order.id}</h3>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="order-info">
                    <p><strong>Bàn:</strong> ${order.tableNumber}</p>
                    <p><strong>Trạng thái:</strong> ${order.status}</p>
                    <p><strong>Thời gian:</strong> ${new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                    ${order.note ? `<p><strong>Ghi chú:</strong> ${order.note}</p>` : ''}
                </div>
                <div class="order-items">
                    <h4>Món đã đặt:</h4>
                    ${orderItemsHtml}
                </div>
                <div class="order-total">
                    <strong>Tổng cộng: đ${formatPrice(order.totalAmount)}</strong>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="closeModal()">Đóng</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// HÀM MỚI: Hiển thị thông báo toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Hiển thị toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Ẩn toast sau 3 giây
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
