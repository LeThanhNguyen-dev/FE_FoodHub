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
        'sortDirectionMenuFilter', 'pageSizeMenuFilter'
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
        const pageSizeMenuFilter = document.getElementById('pageSizeMenuFilter');

        const categoryId = categoryFilter ? categoryFilter.value : '';
        const keyword = keywordFilter ? keywordFilter.value : '';
        const status = menuStatusFilter ? menuStatusFilter.value : '';
        const sortBy = sortByMenuFilter ? sortByMenuFilter.value || 'name' : 'name';
        const sortDirection = sortDirectionMenuFilter ? sortDirectionMenuFilter.value || 'asc' : 'asc';
        const pageSize = pageSizeMenuFilter ? pageSizeMenuFilter.value || '20' : '20';

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

    // Tạo handler function
    window.menuItemClickHandler = function (e) {
        const menuItem = e.target.closest('.menu-item');
        if (menuItem && !e.target.closest('.modal-overlay')) {
            e.preventDefault();
            e.stopPropagation();

            const menuItemId = parseInt(menuItem.dataset.id);
            showAddToCartModal(menuItemId);
        }
    };

    // Add event listener
    document.addEventListener('click', window.menuItemClickHandler);
}

// HÀM MỚI: Hiển thị modal thêm vào giỏ hàng
async function showAddToCartModal(menuItemId) {
    try {
        const menuItem = document.querySelector(`[data-id="${menuItemId}"]`);
        if (!menuItem) return;

        const itemName = menuItem.querySelector('.item-name').textContent;
        const itemPrice = menuItem.querySelector('.item-price').textContent;

        // Đóng modal cũ nếu có
        closeModal();

        // Fetch menu.html để lấy template
        const response = await fetch('menu.html');
        if (!response.ok) {
            throw new Error('Không thể tải menu.html');
        }
        const htmlContent = await response.text();

        // Parse HTML để lấy template
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Lấy template addToCartModalTemplate
        const modalTemplate = doc.getElementById('addToCartModalTemplate').content.cloneNode(true);

        // Cập nhật nội dung
        modalTemplate.getElementById('modalItemName').textContent = itemName;
        modalTemplate.getElementById('modalItemPrice').textContent = `Giá: ${itemPrice}`;
        modalTemplate.getElementById('addToCartBtn').onclick = () => addToCart(menuItemId);

        // Thêm modal vào body
        document.body.appendChild(modalTemplate);

        // Setup events sau khi modal đã được thêm vào DOM
        requestAnimationFrame(() => {
            const modalElement = document.querySelector('.modal-overlay');
            if (modalElement) {
                setupModalCloseEvents(modalElement);

                // Thêm sự kiện đóng modal
                const closeButtons = modalElement.querySelectorAll('.close-btn, .btn-cancel');
                closeButtons.forEach(button => {
                    button.addEventListener('click', () => {
                        const modal = document.querySelector('.modal-overlay');
                        if (modal) modal.remove();
                    });
                });
            }
        });

    } catch (error) {
        console.error('Error showing add to cart modal:', error);
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay" onclick="closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Lỗi</h3>
                        <button class="close-btn" onclick="closeModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-danger">
                            <h4>Không thể hiển thị modal</h4>
                            <p>Lỗi: ${error.message}</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-cancel" onclick="closeModal()">Đóng</button>
                    </div>
                </div>
            </div>
        `);
    }
}




// HÀM MỚI: Đóng modal
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (!modal) return;

    // Remove event listeners cụ thể
    if (modal.escKeyHandler) {
        document.removeEventListener('keydown', modal.escKeyHandler);
        modal.escKeyHandler = null;
    }
    
    if (modal.overlayClickHandler) {
        modal.removeEventListener('click', modal.overlayClickHandler);
        modal.overlayClickHandler = null;
    }

    // Disable pointer events để tránh double click
    modal.style.pointerEvents = 'none';

    // Animation
    modal.style.opacity = '0';
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.transform = 'scale(0.95)';
    }

    // Remove modal sau animation
    setTimeout(() => {
        if (modal && modal.parentNode) {
            modal.remove();
        }
        // Remove CSS nếu không còn modal nào
        if (!document.querySelector('.modal-overlay')) {
            const modalLink = document.querySelector('link[href="css/modal-cart-style.css"]');
            if (modalLink) modalLink.remove();
        }
    }, 200);
}




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
    updateCartDisplay();
    
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


function refreshCartModal() {
    const modal = document.querySelector('.modal-overlay');
    if (!modal) return;

    // Nếu giỏ hàng trống, hiển thị thông báo
    if (cart.length === 0) {
        showEmptyCartInModal();
        return;
    }

    const cartItemsContainer = modal.querySelector('#cartItemsContainer');
    if (!cartItemsContainer) return;

    // Clear existing items
    cartItemsContainer.innerHTML = '';

    // Re-render cart items
    let totalAmount = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        totalAmount += itemTotal;

        // Create cart item element
        const cartItemDiv = document.createElement('div');
        cartItemDiv.className = 'cart-item';
        cartItemDiv.setAttribute('data-index', index);

        cartItemDiv.innerHTML = `
            <div class="item-info">
                <h4 class="cart-item-name">${item.name}</h4>
                <p class="cart-item-price">Giá: đ${formatPrice(item.price)}</p>
                ${item.note ? `<p class="item-note">Ghi chú: ${item.note}</p>` : ''}
            </div>
            <div class="item-controls">
                <button class="qty-btn qty-decrease">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="qty-btn qty-increase">+</button>
                <button class="remove-btn">Xóa</button>
            </div>
            <div class="item-total">đ${formatPrice(itemTotal)}</div>
        `;

        // Setup events cho buttons
        const decreaseBtn = cartItemDiv.querySelector('.qty-decrease');
        const increaseBtn = cartItemDiv.querySelector('.qty-increase');
        const removeBtn = cartItemDiv.querySelector('.remove-btn');

        decreaseBtn.onclick = () => updateCartQuantity(index, -1);
        increaseBtn.onclick = () => updateCartQuantity(index, 1);
        removeBtn.onclick = () => removeFromCart(index);

        cartItemsContainer.appendChild(cartItemDiv);
    });

    // Update total amount
    const totalAmountElement = modal.querySelector('#totalAmount');
    if (totalAmountElement) {
        totalAmountElement.textContent = `Tổng cộng: đ${formatPrice(totalAmount)}`;
    }

    // Update cart count display (số món)
    const cartCountElement = modal.querySelector('.cart-count-display');
    if (cartCountElement) {
        cartCountElement.textContent = `${cart.length} món`;
    }
}



// HÀM MỚI: Thêm món vào giỏ hàng
function addToCart(menuItemId) {
    const quantityInput = document.getElementById('quantity');

    const quantity = parseInt(quantityInput.value) || 1;

    // Tìm thông tin món ăn
    const menuItem = document.querySelector(`[data-id="${menuItemId}"]`);
    const itemName = menuItem.querySelector('.item-name').textContent;
    const itemPriceText = menuItem.querySelector('.item-price').textContent;
    const itemPrice = parseFloat(itemPriceText.replace(/[^\d]/g, ''));

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

    updateCartDisplay();
    closeModal();
    showToast(`Đã thêm ${quantity} ${itemName} vào giỏ hàng`);
}

// HÀM MỚI: Cập nhật hiển thị giỏ hàng
function updateCartDisplay() {
    if (currentOrderForAddItems) {
        updateCartDisplayForAddItems();
        return;
    }
    
    let cartBtn = document.getElementById('cartBtn');
    if (!cartBtn) {
        cartBtn = document.createElement('button');
        cartBtn.id = 'cartBtn';
        cartBtn.className = 'cart-button';
        cartBtn.onclick = showCart;

        const menuControls = document.querySelector('.menu-controls');
        if (menuControls) {
            menuControls.appendChild(cartBtn);
        }
    }

    const totalItems = cart.length;
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    cartBtn.innerHTML = `
        <div class="cart-icon-container">
            <span class="cart-icon">🛒</span>
            <span class="cart-badge" style="display: ${totalItems > 0 ? 'flex' : 'none'}">${totalItems}</span>
        </div>
        <div class="cart-info">
            <span class="cart-label">Giỏ hàng</span>
            <span class="cart-total">đ${formatPrice(totalAmount)}</span>
        </div>
    `;

    cartBtn.style.display = cart.length > 0 ? 'block' : 'none';
}

function updateCartDisplayForAddItems() {
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

    const totalItems = cart.length;
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Thay đổi text nếu đang trong chế độ gọi thêm món
    const cartLabel = currentOrderForAddItems ? 'Món thêm' : 'Giỏ hàng';
    const buttonClass = currentOrderForAddItems ? 'cart-button add-items-mode' : 'cart-button';

    cartBtn.className = buttonClass;
    cartBtn.innerHTML = `
        <div class="cart-icon-container">
            <span class="cart-icon">${currentOrderForAddItems ? '🍽️' : '🛒'}</span>
            <span class="cart-badge" style="display: ${totalItems > 0 ? 'flex' : 'none'}">${totalItems}</span>
        </div>
        <div class="cart-info">
            <span class="cart-label">${cartLabel}</span>
            <span class="cart-total">đ${formatPrice(totalAmount)}</span>
        </div>
    `;

    cartBtn.style.display = cart.length > 0 ? 'block' : 'none';
}

function updateUIForAddItemsMode() {
    // Thêm banner thông báo
    const menuContainer = document.getElementById('dynamicContent');
    if (menuContainer && currentOrderForAddItems) {
        const banner = document.createElement('div');
        banner.id = 'addItemsBanner';
        banner.className = 'add-items-banner';
        banner.innerHTML = `
            <div class="banner-content">
                <span class="banner-icon">🍽️</span>
                <span class="banner-text">Đang gọi thêm món cho đơn hàng #${currentOrderForAddItems.orderId}</span>
                <button class="btn btn-cancel-add-items" onclick="cancelAddItemsMode()">
                    Hủy gọi thêm món
                </button>
            </div>
        `;
        
        menuContainer.insertBefore(banner, menuContainer.firstChild);
    }
    
    // Cập nhật nút giỏ hàng
    updateCartDisplayForAddItems();
}

// HÀM MỚI: Hiển thị giỏ hàng
async function showCart() {
    try {
        if (cart.length === 0) {
            showToast('Giỏ hàng trống');
            return;
        }

        closeModal();
        await new Promise(resolve => setTimeout(resolve, 250));

        const response = await fetch('menu.html');
        if (!response.ok) {
            throw new Error('Không thể tải menu.html');
        }
        const htmlContent = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        const modalTemplate = doc.getElementById('cartModalTemplate').content.cloneNode(true);

        // Cập nhật tiêu đề modal
        const modalTitle = modalTemplate.querySelector('.modal-header h3');
        if (modalTitle && currentOrderForAddItems) {
            modalTitle.textContent = `Thêm món vào đơn hàng #${currentOrderForAddItems.orderId}`;
        }

        const cartItemsContainer = modalTemplate.getElementById('cartItemsContainer');
        let totalAmount = 0;

        cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            totalAmount += itemTotal;

            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'cart-item';
            cartItemDiv.setAttribute('data-index', index);

            cartItemDiv.innerHTML = `
                <div class="item-info">
                    <h4 class="cart-item-name">${item.name}</h4>
                    <p class="cart-item-price">Giá: đ${formatPrice(item.price)}</p>
                    ${item.note ? `<p class="item-note">Ghi chú: ${item.note}</p>` : ''}
                </div>
                <div class="item-controls">
                    <button class="qty-btn qty-decrease">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="qty-btn qty-increase">+</button>
                    <button class="remove-btn">Xóa</button>
                </div>
                <div class="item-total">đ${formatPrice(itemTotal)}</div>
            `;

            const decreaseBtn = cartItemDiv.querySelector('.qty-decrease');
            const increaseBtn = cartItemDiv.querySelector('.qty-increase');
            const removeBtn = cartItemDiv.querySelector('.remove-btn');

            decreaseBtn.onclick = () => updateCartQuantity(index, -1);
            increaseBtn.onclick = () => updateCartQuantity(index, 1);
            removeBtn.onclick = () => removeFromCart(index);

            cartItemsContainer.appendChild(cartItemDiv);
        });

        modalTemplate.getElementById('totalAmount').textContent = `Tổng cộng: đ${formatPrice(totalAmount)}`;

        // Xử lý phần chọn bàn và loại đơn hàng
        if (currentOrderForAddItems) {
            // Ẩn phần chọn loại đơn hàng và bàn vì đang thêm vào đơn hiện tại
            const orderTypeSection = modalTemplate.querySelector('.order-type-section');
            const tableSection = modalTemplate.querySelector('.table-section');
            if (orderTypeSection) orderTypeSection.style.display = 'none';
            if (tableSection) tableSection.style.display = 'none';
        } else {
            // Logic bình thường cho đơn hàng mới
            const tableSelect = modalTemplate.getElementById('tableSelect');
            if (tableSelect) {
                const tables = await generateTableOptions();
                tableSelect.innerHTML = '<option value="">-- Chọn bàn --</option>' + tables;
            }
        }

        document.body.appendChild(modalTemplate);

        requestAnimationFrame(() => {
            const modalElement = document.querySelector('.modal-overlay');
            if (modalElement) {
                setupModalCloseEvents(modalElement);

                const closeButtons = modalElement.querySelectorAll('.close-btn, .btn-cancel, .btn-clear');
                closeButtons.forEach(button => {
                    button.addEventListener('click', closeModal);
                });

                const confirmButton = modalElement.querySelector('.btn-order');
                if (confirmButton) {
                    // Cập nhật text nút xác nhận
                    if (currentOrderForAddItems) {
                        confirmButton.textContent = 'Thêm vào đơn hàng';
                        confirmButton.onclick = confirmAddItemsToOrder;
                    } else {
                        confirmButton.onclick = submitOrder;
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error showing cart modal:', error);
        showErrorModal('Không thể hiển thị giỏ hàng', error.message);
    }
}

// HÀM MỚI: Tạo options cho select bàn
async function generateTableOptions() {
    try {
        // Gọi API /tables để lấy danh sách bàn
        const data = await apiFetch(`/tables?area=${currentWorkSchedule.area}`,{
            method: 'GET'
        });

        // Tạo danh sách tùy chọn từ dữ liệu API
        const options = data.result.map(table => 
            `<option value="${table.id}">Bàn ${table.tableNumber}</option>`
        ).join('');

        return options;
    } catch (error) {
        console.error('Lỗi khi lấy danh sách bàn:', error);
        // Trả về tùy chọn mặc định nếu có lỗi
        return '<option value="">Không có bàn nào</option>';
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
        updateCartDisplay();
        
        // Refresh cart modal if open
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            refreshCartModal();
        }
    }
}


async function confirmAddItemsToOrder() {
    if (!currentOrderForAddItems || cart.length === 0) {
        showToast('Không có món nào để thêm', 'error');
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
            showToast(`Đã thêm ${cart.length} món vào đơn hàng #${currentOrderForAddItems.orderId}`, 'success');

            // Reset state
            cart = [];
            currentOrderForAddItems = null;
            
            // Xóa banner
            const banner = document.getElementById('addItemsBanner');
            if (banner) banner.remove();
            
            updateCartDisplay();
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
        showToast(`Lỗi thêm món: ${error.message}`, 'error');
    } finally {
        const confirmButton = document.querySelector('.btn-confirm');
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Thêm vào đơn hàng';
        }
    }
}


function showEmptyCartInModal() {
    const modal = document.querySelector('.modal-overlay');
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');
    if (!modalContent) return;

    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>Giỏ hàng</h3>
            <button class="close-btn" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="empty-cart-message" style="text-align: center; padding: 40px 20px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 16px;">🛒</div>
                <h4>Giỏ hàng trống</h4>
                <p>Hãy thêm món vào giỏ hàng để tiếp tục đặt hàng</p>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-cancel" onclick="closeModal()">Đóng</button>
        </div>
    `;

    // Setup close event cho nút đóng mới
    const closeBtn = modalContent.querySelector('.close-btn');
    const cancelBtn = modalContent.querySelector('.btn-cancel');
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
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
    const orderTypeSelect = document.getElementById('orderTypeSelect');

    const tableId = parseInt(tableSelect.value);
    const note = orderNote.value.trim();
    const orderType = orderTypeSelect.value;


    if (orderType == 'DINE_IN' && !tableId) {
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

    // THÊM MỚI: Event listener để đóng modal khi click bên ngoài
    setupModalCloseEvents(modal);
}

function setupModalCloseEvents(modal) {
    // Click vào overlay để đóng modal
    const overlayClickHandler = function (e) {
        if (e.target === modal) {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        }
    };

    // Nhấn Esc để đóng modal
    const escKeyHandler = function (e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        }
    };

    // Remove existing listeners trước khi add mới
    if (modal.overlayClickHandler) {
        modal.removeEventListener('click', modal.overlayClickHandler);
    }
    if (modal.escKeyHandler) {
        document.removeEventListener('keydown', modal.escKeyHandler);
    }

    // Add new listeners
    modal.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', escKeyHandler);

    // Lưu references để cleanup
    modal.overlayClickHandler = overlayClickHandler;
    modal.escKeyHandler = escKeyHandler;
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