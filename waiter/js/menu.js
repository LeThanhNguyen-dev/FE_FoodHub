let currentMenuPage = 0;
let currentMenuSize = 20;
let totalMenuPages = 1;
let totalMenuElements = 0;
let currentMenuFilters = {
    categoryId: null,
    keyword: null,
    status: null,
    sortBy: 'name',
    sortDirection: 'asc'
};

let cart = [];
let isCartSidebarOpen = false;
let selectedOrderType = null;
let selectedTable = null;
async function showMenu() {
    try {
        // Khôi phục trạng thái cart trước
        restoreCartState();

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
        const templates = ['menuPageTemplate'];
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
            link.href = 'css/menu-style.css';
            document.head.appendChild(link);
        }

        // Load categories first, then menu items
        await loadCategories();
        await loadMenuItems();

        // Setup event listeners after template is loaded
        setupMenuEventListeners();

        // **THAY ĐỔI CHÍNH: Luôn hiển thị giỏ hàng khi vào trang menu**
        await showCartSidebar();

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
    const jumpInput = document.getElementById('jumpToMenuPage');
    if (jumpInput) {
        jumpInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                jumpToMenuPage();
            }
        });
    }

    const keywordInput = document.getElementById('keywordFilter');
    if (keywordInput) {
        keywordInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                applyMenuFilters();
            }
        });
    }

    const filterElements = [
        'categoryFilter', 'menuStatusFilter', 'sortByMenuFilter',
        'sortDirectionMenuFilter'
    ];

    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', applyMenuFilters);
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
        const menuStatusFilter = document.getElementById('menuStatusFilter');
        const sortByMenuFilter = document.getElementById('sortByMenuFilter');
        const sortDirectionMenuFilter = document.getElementById('sortDirectionMenuFilter');

        const categoryId = categoryFilter ? categoryFilter.value : '';
        const keyword = keywordFilter ? keywordFilter.value : '';
        const status = menuStatusFilter ? menuStatusFilter.value : '';
        const sortBy = sortByMenuFilter ? sortByMenuFilter.value || 'name' : 'name';
        const sortDirection = sortDirectionMenuFilter ? sortDirectionMenuFilter.value || 'asc' : 'asc';
        const pageSize = '20';

        // Build query parameters
        const params = new URLSearchParams();
        if (categoryId) params.append('categoryId', categoryId);
        if (keyword) params.append('keyword', keyword);
        if (status) params.append('status', status);
        params.append('sortBy', sortBy);
        params.append('sortDirection', sortDirection);
        params.append('page', currentMenuPage.toString());
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
        totalMenuPages = menuPage.totalPages;
        totalMenuElements = menuPage.totalElements;
        currentMenuPage = menuPage.number;
        currentMenuSize = parseInt(pageSize);

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

    if (firstBtn) firstBtn.disabled = currentMenuPage === 0;
    if (prevBtn) prevBtn.disabled = currentMenuPage === 0;
    if (nextBtn) nextBtn.disabled = currentMenuPage >= totalMenuPages - 1;
    if (lastBtn) lastBtn.disabled = currentMenuPage >= totalMenuPages - 1;

    // Update page numbers
    const pageNumbers = document.getElementById('pageNumbers');
    if (pageNumbers) {
        let pagesHtml = '';
        const startPage = Math.max(0, currentMenuPage - 2);
        const endPage = Math.min(totalMenuPages - 1, currentMenuPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === currentMenuPage ? 'active' : '';
            pagesHtml += `<button class="page-btn ${isActive}" onclick="goToMenuPage(${i})">${i + 1}</button>`;
        }
        pageNumbers.innerHTML = pagesHtml;
    }
}

// Navigation functions
function goToMenuPage(page) {
    if (page >= 0 && page < totalMenuPages) {
        currentMenuPage = page;
        loadMenuItems();
    }
}

function jumpToMenuPage() {
    const jumpInput = document.getElementById('jumpToMenuPage');
    if (jumpInput) {
        const page = parseInt(jumpInput.value) - 1; // Convert to 0-based
        if (page >= 0 && page < totalMenuPages) {
            goToMenuPage(page);
            jumpInput.value = '';
        }
    }
}

function applyMenuFilters() {
    currentMenuPage = 0; // Reset to first page
    loadMenuItems();
}

function resetFilters() {
    // Reset all filter elements
    const filterElements = [
        'categoryFilter', 'keywordFilter', 'menuStatusFilter',
        'sortByMenuFilter', 'sortDirectionMenuFilter', 'pageSizeMenuFilter'
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
    currentMenuPage = 0;
    currentMenuFilters = {
        categoryId: null,
        keyword: null,
        status: null,
        sortBy: 'name',
        sortDirection: 'asc'
    };

    loadMenuItems();
}

function setupCartEventListeners() {
    // Remove existing listener nếu có
    if (window.menuItemClickHandler) {
        document.removeEventListener('click', window.menuItemClickHandler);
    }

    // Tạo handler function - **THAY ĐỔI: Không gọi showCartSidebar() nữa**
    window.menuItemClickHandler = function (e) {
        const menuItem = e.target.closest('.menu-item');
        if (menuItem && !e.target.closest('.modal-overlay') && !e.target.closest('.cart-sidebar')) {
            e.preventDefault();
            e.stopPropagation();

            const menuItemId = parseInt(menuItem.dataset.id);
            // Chỉ thêm vào giỏ hàng, không hiển thị sidebar
            addToCart(menuItemId);
        }
    };

    // Add event listener
    document.addEventListener('click', window.menuItemClickHandler);
}

function hideCartSidebar() {
    const cartSidebar = document.querySelector('.cart-sidebar');
    const cartOverlay = document.querySelector('.cart-overlay');
    
    if (cartSidebar) cartSidebar.remove();
    if (cartOverlay) cartOverlay.remove();
    
    document.body.classList.remove('cart-open');
    
    // Xóa CSS cart khi đóng
    const cartLink = document.querySelector('link[href="css/cart-style.css"]');
    if (cartLink) cartLink.remove();
}

function addToCart(menuItemId) {
    // Tìm thông tin món ăn
    const menuItem = document.querySelector(`[data-id="${menuItemId}"]`);
    if (!menuItem) return;

    const itemName = menuItem.querySelector('.item-name').textContent;
    const itemPriceText = menuItem.querySelector('.item-price').textContent;
    const itemPrice = parseFloat(itemPriceText.replace(/[^\d]/g, ''));
    const quantity = 1;

    // Kiểm tra xem món đã có trong giỏ chưa
    const existingItem = cart.find(item => item.menuItemId === menuItemId);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            menuItemId,
            name: itemName,
            price: itemPrice,
            quantity,
        });
    }

    updateCartSidebarContent();
    showNotification(`Đã thêm ${quantity} ${itemName} vào giỏ hàng`, 'success');
    
    // Lưu trạng thái cart
    saveCartState();
}




// Hàm chọn order type
function selectOrderType(orderType, element) {
    // Bỏ chọn tất cả các option khác
    const allOptions = document.querySelectorAll('.order-type-option');
    allOptions.forEach(option => {
        option.classList.remove('selected');
        const checkbox = option.querySelector('.order-type-checkbox');
        checkbox.classList.remove('checked');
    });

    // Chọn option hiện tại
    element.classList.add('selected');
    const checkbox = element.querySelector('.order-type-checkbox');
    checkbox.classList.add('checked');

    // Lưu order type được chọn
    selectedOrderType = orderType;

    // Hiển thị/ẩn phần chọn bàn
    const tableSelection = document.getElementById('tableSelection');
    if (tableSelection) {
        if (orderType === 'DINE_IN') {
            tableSelection.style.display = 'block';
            // Load danh sách bàn khi hiển thị
            loadTableOptions();
        } else {
            tableSelection.style.display = 'none';
            // Reset table selection khi không phải ăn tại chỗ
            selectedTable = null;
            const selectedTableSpan = document.querySelector('.selected-table');
            if (selectedTableSpan) {
                selectedTableSpan.textContent = 'Chọn bàn';
            }
        }
    }
}

async function loadTableOptions() {
    try {
        const tableDropdownMenu = document.getElementById('tableDropdownMenu');
        if (!tableDropdownMenu) return;

        // Hiển thị loading
        tableDropdownMenu.innerHTML = '<div class="table-option loading">Đang tải...</div>';

        // Gọi API để lấy danh sách bàn
        const data = await apiFetch('/tables', {
            method: 'GET'
        });

        // Xóa nội dung loading
        tableDropdownMenu.innerHTML = '';

        // Tạo các option từ dữ liệu API
        if (data.result && data.result.length > 0) {
            data.result.forEach(table => {
                const tableOption = document.createElement('div');
                tableOption.className = 'table-option';

                // Thêm class để phân biệt trạng thái bàn
                if (table.status === 'OCCUPIED') {
                    tableOption.classList.add('occupied');
                } else if (table.status === 'AVAILABLE') {
                    tableOption.classList.add('available');
                }

                // Hiển thị thông tin bàn
                tableOption.innerHTML = `
                    <span class="table-name">Bàn ${table.tableNumber}</span>
                    <span class="table-status ${table.status.toLowerCase()}">${getStatusText(table.status)}</span>
                `;

                // Thêm sự kiện click
                tableOption.onclick = () => selectTable(table, tableOption);

                tableDropdownMenu.appendChild(tableOption);
            });
        } else {
            tableDropdownMenu.innerHTML = '<div class="table-option no-tables">Không có bàn nào</div>';
        }

    } catch (error) {
        console.error('Lỗi khi tải danh sách bàn:', error);
        const tableDropdownMenu = document.getElementById('tableDropdownMenu');
        if (tableDropdownMenu) {
            tableDropdownMenu.innerHTML = '<div class="table-option error">Lỗi tải danh sách bàn</div>';
        }
        showNotification('Không thể tải danh sách bàn: ' + error.message, 'warning');
    }
}

function getStatusText(status) {
    switch (status) {
        case 'AVAILABLE':
            return 'Trống';
        case 'OCCUPIED':
            return 'Đã có khách';
        default:
            return status;
    }
}

// Hàm toggle dropdown table
function toggleTableDropdown() {
    const dropdown = document.getElementById('tableDropdownMenu');
    if (dropdown) {
        dropdown.classList.toggle('show');

        // Nếu dropdown đang mở và chưa có dữ liệu, load dữ liệu
        if (dropdown.classList.contains('show') && dropdown.children.length === 0) {
            loadTableOptions();
        }
    }
}

// Hàm chọn bàn
function selectTable(table, element) {
    // Kiểm tra trạng thái bàn
    if (table.status === 'OCCUPIED') {
        showNotification('Bàn này đã có khách, vui lòng chọn bàn khác', 'warning');
        return;
    }

    // Bỏ chọn tất cả các table khác
    const allTableOptions = document.querySelectorAll('.table-option');
    allTableOptions.forEach(option => {
        option.classList.remove('selected');
    });

    // Chọn table hiện tại
    element.classList.add('selected');

    // Cập nhật hiển thị table đã chọn
    const selectedTableSpan = document.querySelector('.selected-table');
    if (selectedTableSpan) {
        selectedTableSpan.textContent = `Bàn ${table.tableNumber}`;
        selectedTableSpan.classList.remove('placeholder');
    }

    // Lưu thông tin table được chọn (lưu cả object để có thể sử dụng id)
    selectedTable = {
        id: table.id,
        tableNumber: table.tableNumber,
        area: table.area
    };

    // Đóng dropdown
    const dropdown = document.getElementById('tableDropdownMenu');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}


// Đóng dropdown khi click bên ngoài
document.addEventListener('click', function (event) {
    const tableDropdown = document.querySelector('.table-dropdown');
    const dropdown = document.getElementById('tableDropdownMenu');

    if (dropdown && tableDropdown && !tableDropdown.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Hàm showCartSidebar đã xóa phần check isCartOpen
async function showCartSidebar() {
    try {
        // **THAY ĐỔI: Xóa kiểm tra sidebar đã mở - luôn hiển thị**
        // Đóng sidebar cũ nếu có
        const existingSidebar = document.querySelector('.cart-sidebar');
        const existingOverlay = document.querySelector('.cart-overlay');
        if (existingSidebar) existingSidebar.remove();
        if (existingOverlay) existingOverlay.remove();

        // Fetch menu.html
        const response = await fetch('/waiter/menu.html');
        if (!response.ok) {
            throw new Error('Không thể tải menu.html');
        }
        const htmlContent = await response.text();

        // Parse HTML để lấy templates
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Lấy template cartSidebarTemplate
        const templateElement = doc.getElementById('cartSidebarTemplate');
        if (!templateElement) {
            throw new Error('Không tìm thấy cartSidebarTemplate trong menu.html');
        }

        // Kiểm tra xem có phải là template element không
        let sidebarTemplate;
        if (templateElement.content) {
            sidebarTemplate = templateElement.content.cloneNode(true);
        } else {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = templateElement.innerHTML;
            sidebarTemplate = tempDiv;
        }

        // Xử lý phần chọn bàn và loại đơn hàng
        if (currentOrderForAddItems) {
            const orderTypeSection = sidebarTemplate.querySelector('.order-type-section');
            const tableSelection = sidebarTemplate.querySelector('.table-selection');
            if (orderTypeSection) orderTypeSection.style.display = 'none';
            if (tableSelection) tableSelection.style.display = 'none';

            const submitBtn = sidebarTemplate.querySelector('.checkout-btn');
            if (submitBtn) {
                submitBtn.textContent = 'Thêm vào đơn hàng';
                submitBtn.onclick = confirmAddItemsToOrder;
            }
        } else {
            // Khôi phục trạng thái đã chọn từ biến global
            const orderTypeOptions = sidebarTemplate.querySelectorAll('.order-type-option');
            orderTypeOptions.forEach(option => {
                const orderType = option.dataset.orderType || option.getAttribute('onclick')?.match(/selectOrderType\('([^']+)'/)?.[1];
                if (orderType === selectedOrderType) {
                    option.classList.add('selected');
                    const checkbox = option.querySelector('.order-type-checkbox');
                    if (checkbox) checkbox.classList.add('checked');
                }
            });

            // Hiển thị phần chọn bàn nếu là DINE_IN
            const tableSelection = sidebarTemplate.querySelector('#tableSelection');
            if (selectedOrderType === 'DINE_IN' && tableSelection) {
                tableSelection.style.display = 'block';
                // Load lại danh sách bàn nếu cần
                setTimeout(() => loadTableOptions(), 100);
            }

            // Khôi phục thông tin bàn đã chọn
            if (selectedTable) {
                const selectedTableSpan = sidebarTemplate.querySelector('.selected-table');
                if (selectedTableSpan) {
                    selectedTableSpan.textContent = `Bàn ${selectedTable.tableNumber}`;
                }
            }
        }

        // Thêm cart sidebar vào body
        document.body.appendChild(sidebarTemplate);

        // Thêm class để đẩy nội dung chính sang trái
        document.body.classList.add('cart-open');

        // Đánh dấu cart sidebar đã mở
        isCartSidebarOpen = true;
        saveCartState();

        // Nạp CSS cart động từ thư mục css
        if (!document.querySelector('link[href="css/cart-style.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/cart-style.css';
            document.head.appendChild(link);
        }

        // Thêm sự kiện đóng cart
        const closeButtons = document.querySelectorAll('.cart-close-btn, .cart-overlay');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                closeCartSidebar();
            });
        });

        // Cập nhật nội dung cart
        updateCartSidebarContent();

    } catch (error) {
        console.error('Error showing cart sidebar:', error);
        showNotification('Không thể hiển thị giỏ hàng: ' + error.message, 'warning');
    }
}



function validateOrderInfo() {
    if (!selectedOrderType) {
        showNotification('Vui lòng chọn loại đơn hàng', 'warning');
        return false;
    }

    if (selectedOrderType === 'DINE_IN' && !selectedTable) {
        showNotification('Vui lòng chọn bàn cho đơn ăn tại chỗ', 'warning');
        return false;
    }

    return true;
}


function updateCartSidebarContent() {
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const totalAmountElement = document.getElementById('totalAmount');

    if (!cartItemsContainer || !totalAmountElement) return;

    // Xóa nội dung cũ
    cartItemsContainer.innerHTML = '';

    if (cart.length === 0) {
        // Hiển thị empty cart
        const emptyTemplate = document.getElementById('emptyCartTemplate');
        if (emptyTemplate) {
            const emptyContent = emptyTemplate.content.cloneNode(true);
            cartItemsContainer.appendChild(emptyContent);
        }
        totalAmountElement.textContent = 'Tổng cộng: ₫0';
        return;
    }

    let totalAmount = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        totalAmount += itemTotal;

        // Debug: Kiểm tra cartItemTemplate
        const cartItemTemplate = document.getElementById('cartItemTemplate');
        console.log('cartItemTemplate found:', !!cartItemTemplate);

        if (!cartItemTemplate) {
            console.error('Không tìm thấy cartItemTemplate, fallback về HTML trực tiếp');

            // Fallback: Tạo HTML trực tiếp nếu không tìm thấy template
            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'cart-item';
            cartItemDiv.setAttribute('data-index', index);
            cartItemDiv.setAttribute('data-item-id', item.id || index);

            cartItemDiv.innerHTML = `
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">${formatPrice(item.price)}₫</div>
                    ${item.note ? `<div class="item-note">Ghi chú: ${item.note}</div>` : '<div class="item-note" style="display: none;"></div>'}
                </div>
                <div class="item-controls">
                    <button class="remove-item-btn">×</button>
                    <div class="quantity-controls">
                        <button class="quantity-btn decrease">-</button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="quantity-btn increase">+</button>
                    </div>
                </div>
            `;

            // Setup event listeners
            const decreaseBtn = cartItemDiv.querySelector('.decrease');
            const increaseBtn = cartItemDiv.querySelector('.increase');
            const removeBtn = cartItemDiv.querySelector('.remove-item-btn');

            if (decreaseBtn) {
                decreaseBtn.onclick = (e) => {
                    e.preventDefault();
                    updateCartQuantity(index, -1);
                    updateCartSidebarContent();
                };
            }

            if (increaseBtn) {
                increaseBtn.onclick = (e) => {
                    e.preventDefault();
                    updateCartQuantity(index, 1);
                    updateCartSidebarContent();
                };
            }

            if (removeBtn) {
                removeBtn.onclick = (e) => {
                    e.preventDefault();
                    removeFromCart(index);
                    updateCartSidebarContent();
                };
            }

            cartItemsContainer.appendChild(cartItemDiv);
            return;
        }

        // Sử dụng template nếu tìm thấy
        const cartItemElement = cartItemTemplate.content.cloneNode(true);
        const cartItemDiv = cartItemElement.querySelector('.cart-item');

        // Cập nhật các placeholder
        cartItemDiv.setAttribute('data-item-id', item.id || index);
        cartItemDiv.setAttribute('data-index', index);

        // Cập nhật tên món
        const nameElement = cartItemDiv.querySelector('.item-name');
        if (nameElement) {
            nameElement.textContent = item.name;
        }

        // Cập nhật giá
        const priceElement = cartItemDiv.querySelector('.item-price');
        if (priceElement) {
            priceElement.textContent = `${formatPrice(item.price)}₫`;
        }

        // Cập nhật ghi chú
        const noteElement = cartItemDiv.querySelector('.item-note');
        if (noteElement && item.note) {
            noteElement.textContent = `Ghi chú: ${item.note}`;
            noteElement.style.display = 'block';
        }

        // Cập nhật số lượng
        const quantityElement = cartItemDiv.querySelector('.quantity-display');
        if (quantityElement) {
            quantityElement.textContent = item.quantity;
        }

        // Setup event listeners cho các nút
        const decreaseBtn = cartItemDiv.querySelector('.decrease');
        const increaseBtn = cartItemDiv.querySelector('.increase');
        const removeBtn = cartItemDiv.querySelector('.remove-item-btn');

        if (decreaseBtn) {
            decreaseBtn.onclick = (e) => {
                e.preventDefault();
                updateCartQuantity(index, -1);
                updateCartSidebarContent();
            };
        }

        if (increaseBtn) {
            increaseBtn.onclick = (e) => {
                e.preventDefault();
                updateCartQuantity(index, 1);
                updateCartSidebarContent();
            };
        }

        if (removeBtn) {
            removeBtn.onclick = (e) => {
                e.preventDefault();
                removeFromCart(index);
                updateCartSidebarContent();
            };
        }

        cartItemsContainer.appendChild(cartItemElement);
    });

    totalAmountElement.textContent = `Tổng cộng: ₫${formatPrice(totalAmount)}`;
}




// Hàm mới để xóa hết cart
function clearCart() {
    if (confirm('Bạn có chắc chắn muốn xóa hết món trong giỏ hàng?')) {
        cart.length = 0;
        updateCartSidebarContent();
        
        // **THÊM MỚI: Lưu trạng thái cart sau khi xóa**
        saveCartState();
        
        showNotification('Đã xóa hết món trong giỏ hàng', 'info');
        
        // **THÊM MỚI: Cập nhật nút reopen cart nếu có**
        const reopenButton = document.getElementById('reopenCartBtn');
        if (reopenButton) {
            reopenButton.querySelector('span').textContent = `Giỏ hàng (0)`;
        }
    }
}

function updateCartQuantity(index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        // Refresh cart modal if open
        const modal = document.querySelector('.cart-modal');
        if (modal) {
            closeModal();
            // Đợi modal đóng xong rồi mở lại
            setTimeout(() => {
                if (cart.length > 0) {
                    showCart();
                }
            }, 250);
        }
    }
}

// HÀM MỚI: Cải thiện function removeFromCart để tự động setup lại events
function removeFromCart(index) {
    cart.splice(index, 1);
    // SỬA ĐỔI: Chỉ refresh modal nếu còn món, không đóng modal
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        if (cart.length > 0) {
            refreshCartModal();
        } else {
            // Nếu giỏ hàng trống, hiển thị thông báo trong modal
            showEmptyCartInModal();
        }
    }
}







// HÀM MỚI: Cập nhật số lượng trong giỏ hàng
function updateCartQuantity(index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) {
            // Xóa món khi số lượng = 0
            removeFromCart(index);
            return; // Kết thúc hàm vì removeFromCart đã xử lý việc refresh
        }
        // Refresh cart modal if open
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            refreshCartModal();
        }
    }
}


async function confirmAddItemsToOrder() {
    if (!currentOrderForAddItems || cart.length === 0) {
        showNotification('Không có món nào để thêm', 'warning');
        return;
    }

    const orderNote = document.getElementById('orderNote')?.value || null;

    const orderData = {
        orderType: 'DINE_IN', // Giữ nguyên loại đơn
        note: orderNote,
        orderItems: cart.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity
        }))
    };

    try {
        const confirmButton = document.querySelector('.btn-confirm');
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.textContent = 'Đang thêm món...';
        }

        const response = await apiFetch(`/orders/${currentOrderForAddItems.orderId}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (response.code === 0) {
            const updatedOrder = response.result;
            showNotification(`Đã thêm ${cart.length} món vào đơn hàng #${currentOrderForAddItems.orderId}`, 'success');

            // Reset state
            cart = [];
            currentOrderForAddItems = null;

            // Xóa banner
            const banner = document.getElementById('addItemsBanner');
            if (banner) banner.remove();

            closeModal();

            // Hiển thị chi tiết đơn hàng đã cập nhật
            setTimeout(() => {
                showOrderDetails(updatedOrder);
            }, 500);

        } else {
            throw new Error(response.message || 'Thêm món thất bại');
        }

    } catch (error) {
        console.error('Error adding items to order:', error);
        showNotification(`Lỗi thêm món: ${error.message}`, 'warning');
    } finally {
        const confirmButton = document.querySelector('.btn-confirm');
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Thêm vào đơn hàng';
        }
    }
}




// HÀM MỚI: Xóa món khỏi giỏ hàng
function removeFromCart(index) {
    cart.splice(index, 1);
    // Refresh cart modal if open
    const modal = document.querySelector('.cart-modal');
    if (modal) {
        closeModal();
        if (cart.length > 0) {
            showCart();
        }
    }
}


// HÀM MỚI: Gửi đơn hàng
async function submitOrder() {
    try {
        // Validate order info trước khi submit
        if (!validateOrderInfo()) {
            return;
        }

        if (cart.length === 0) {
            showNotification('Giỏ hàng trống', 'warning');
            return;
        }

        // Lấy note từ input (nếu có)
        const orderNoteInput = document.getElementById('orderNote');
        const note = orderNoteInput ? orderNoteInput.value.trim() : '';

        // Chuẩn bị dữ liệu đơn hàng
        const orderData = {
            note: note || null,
            orderType: selectedOrderType,
            status: "PENDING",
            orderItems: cart.map(item => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                status: "PENDING"
            }))
        };

        // Nếu là đơn ăn tại chỗ, thêm tableId
        if (selectedOrderType === 'DINE_IN' && selectedTable) {
            orderData.tableId = selectedTable.id;
        }

        // Hiển thị loading
        const submitBtn = document.querySelector('.checkout-btn');
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
            let orderTypeText = selectedOrderType === 'DINE_IN' ? 'Ăn tại chỗ' : 
                              selectedOrderType === 'TAKEAWAY' ? 'Mang về' : 'Giao hàng';
            
            let successMessage = `Đặt món thành công! Mã đơn hàng: ${order.id}`;
            if (selectedOrderType === 'DINE_IN' && selectedTable) {
                successMessage += ` - ${orderTypeText} - Bàn ${selectedTable.tableNumber}`;
            } else {
                successMessage += ` - ${orderTypeText}`;
            }
            
            showNotification(successMessage, 'success');

            // Reset giỏ hàng và các biến global để chuẩn bị cho đơn hàng mới
            cart = [];
            selectedOrderType = null;
            selectedTable = null;
            currentOrderForAddItems = null;
            
            // Reset form inputs
            if (orderNoteInput) {
                orderNoteInput.value = '';
            }

            // Reset order type selection trong sidebar
            const orderTypeOptions = document.querySelectorAll('.order-type-option');
            orderTypeOptions.forEach(option => {
                option.classList.remove('selected');
                const checkbox = option.querySelector('.order-type-checkbox');
                if (checkbox) {
                    checkbox.classList.remove('checked');
                }
            });

            // Ẩn table selection section
            const tableSelection = document.querySelector('.table-selection');
            if (tableSelection) {
                tableSelection.style.display = 'none';
            }

            // Reset checkout button text
            if (submitBtn) {
                submitBtn.textContent = 'Đặt món';
            }
            
            // Cập nhật display giỏ hàng để hiển thị trạng thái trống

            
            // Cập nhật nội dung cart sidebar để hiển thị trạng thái reset
            if (typeof updateCartSidebarContent === 'function') {
                updateCartSidebarContent();
            }

            // Có thể hiển thị chi tiết đơn hàng
            if (typeof showOrderDetails === 'function') {
                showOrderDetails(order);
            }
            
        } else {
            throw new Error(response.message || 'Đặt món thất bại');
        }

    } catch (error) {
        console.error('Error submitting order:', error);
        showNotification(`Lỗi đặt món: ${error.message}`, 'warning');
    } finally {
        // Reset button
        const submitBtn = document.querySelector('.checkout-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đặt món';
        }
    }
}

function saveCartState() {
    try {
        const cartState = {
            cart: cart,
            selectedOrderType: selectedOrderType,
            selectedTable: selectedTable,
            currentOrderForAddItems: currentOrderForAddItems,
            isCartSidebarOpen: isCartSidebarOpen
        };
        sessionStorage.setItem('cartState', JSON.stringify(cartState));
    } catch (error) {
        console.error('Error saving cart state:', error);
    }
}

// Hàm khôi phục trạng thái cart từ sessionStorage
function restoreCartState() {
    try {
        const savedState = sessionStorage.getItem('cartState');
        if (savedState) {
            const cartState = JSON.parse(savedState);
            cart = cartState.cart || [];
            selectedOrderType = cartState.selectedOrderType || null;
            selectedTable = cartState.selectedTable || null;
            currentOrderForAddItems = cartState.currentOrderForAddItems || null;
            isCartSidebarOpen = cartState.isCartSidebarOpen || false;
            
            // Cập nhật hiển thị giỏ hàng
        }
    } catch (error) {
        console.error('Error restoring cart state:', error);
    }
}

function closeCartSidebar() {
    const cartSidebar = document.querySelector('.cart-sidebar');
    const cartOverlay = document.querySelector('.cart-overlay');
    if (cartSidebar) cartSidebar.remove();
    if (cartOverlay) cartOverlay.remove();
    document.body.classList.remove('cart-open');

    // Xóa CSS cart khi đóng
    const cartLink = document.querySelector('link[href="css/cart-style.css"]');
    if (cartLink) cartLink.remove();

    // Cập nhật trạng thái
    isCartSidebarOpen = false;
    saveCartState();
}


function onPageChange() {
    // Lưu trạng thái cart khi chuyển trang
    saveCartState();
    
    // Đóng cart sidebar nếu đang mở (tuỳ chọn)
    // closeCartSidebar();
}

// Thành function để khôi phục cart khi load trang
function initializeCartOnPageLoad() {
    restoreCartState();
}