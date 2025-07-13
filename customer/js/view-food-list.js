// viewfoodlist.js - Phiên bản cập nhật với cart manager

// App State
let selectedCategory = 'all';
let searchTerm = '';
let menuItems = [];
let categories = [];
let currentPage = 0;
let totalPages = 0;
let pageSize = 10;

// API Configuration
const API_BASE_URL = `${BACKEND_BASE_URL}/menu-items`;
const CATEGORIES_API_URL = `${BACKEND_BASE_URL}/categories`;
const tableNumber = getUrlParameter('tableNumber');
// Default placeholder for images
const DEFAULT_EMOJI = '🍽️';

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Get placeholder image for items without image
function getPlaceholderImage() {
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="%23f8f9fa"/><text x="50%" y="50%" text-anchor="middle" dy="0.3em" font-size="32">${DEFAULT_EMOJI}</text></svg>`;
}

// Load categories from API
async function loadCategories() {
    try {
        const response = await fetch(CATEGORIES_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const categoryList = Array.isArray(data.result) ? data.result : [];
        if (!Array.isArray(categoryList)) {
            throw new Error('Categories data is not an array');
        }
        categories = categoryList.map(category => ({
            id: category.id,
            name: category.name
        }));
        renderCategories();
    } catch (error) {
        console.error('Error loading categories:', error);
        categories = [];
        renderCategories();
        showError('Không thể tải danh mục. Vui lòng thử lại.');
    }
}

// Load menu data from API
async function loadMenuData(page = 0) {
    try {
        showLoading(true);
        hideError();

        if (categories.length === 0) {
            await loadCategories();
        }

        let url = `${API_BASE_URL}?page=${page}&size=${pageSize}`;
        if (searchTerm) {
            url += `&keyword=${encodeURIComponent(searchTerm)}`;
        }
        if (selectedCategory !== 'all') {
            const category = categories.find(cat => cat.name === selectedCategory);
            if (category) {
                url += `&categoryId=${category.id}`;
            }
        }

        console.log('Fetching menu from:', url);
        const response = await fetch(url);
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Menu data:', data);

        if (data && data.result && data.result.content) {
            menuItems = data.result.content.map(item => ({
                id: item.id,
                name: item.name,
                category: item.categoryNames && item.categoryNames.length > 0 ? Array.from(item.categoryNames)[0] : 'Khác',
                price: item.price,
                image: item.imageUrl || getPlaceholderImage(),
                description: item.description || 'Không có mô tả',
                status: item.status
            }));

            currentPage = data.result.number;
            totalPages = data.result.totalPages;

            renderMenuItems();
            updatePaginationUI();
        } else {
            throw new Error('Invalid API response format');
        }
    } catch (error) {
        console.error('Error loading menu data:', error);
        showError('Không thể tải menu. Vui lòng thử lại.');
    } finally {
        showLoading(false);
    }
}

// Show/hide loading spinner
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    } else {
        console.warn('Loading spinner element not found');
    }
}

// Show/hide error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.querySelector('span').textContent = message || 'Không thể tải dữ liệu. Vui lòng thử lại.';
        errorMessage.classList.remove('d-none');
    }
}

function hideError() {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.classList.add('d-none');
    }
}

// Render categories
function renderCategories() {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;

    container.innerHTML = '';

    const allButton = document.createElement('button');
    allButton.className = `category-btn ${selectedCategory === 'all' ? 'active' : ''}`;
    allButton.setAttribute('data-category', 'all');
    allButton.onclick = () => selectCategory('all', allButton);
    allButton.innerHTML = '🍽️ Tất cả';
    container.appendChild(allButton);

    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = `category-btn ${selectedCategory === category.name ? 'active' : ''}`;
        button.setAttribute('data-category', category.name);
        button.onclick = () => selectCategory(category.name, button);
        button.innerHTML = category.name;
        container.appendChild(button);
    });
}

// Filter items function
function getFilteredItems() {
    return menuItems;
}

// Render menu items
function renderMenuItems() {
    const container = document.getElementById('menuContainer');
    if (!container) return;

    const filteredItems = getFilteredItems();

    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const menuContent = document.createElement('div');
    menuContent.id = 'menuItemsContent';

    if (filteredItems.length === 0) {
        menuContent.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-search text-muted" style="font-size: 3rem;"></i>
                <p class="text-muted mt-2">Không tìm thấy món ăn nào</p>
            </div>
        `;
    } else {
        menuContent.innerHTML = filteredItems.map(item => {
            const cartQuantity = cartManager.getItemQuantity(item.id);
            const showQuantityControls = cartQuantity > 0;

            return `
    <div class="menu-item ${item.status !== 'AVAILABLE' ? 'unavailable' : ''}" data-item-id="${item.id}">
        <div class="d-flex" onclick="viewItemDetail(${item.id})">
            ${item.image && !item.image.startsWith('data:') ?
                    `<img src="${item.image}" alt="${item.name}" onerror="this.outerHTML='<div class=\\'placeholder-image\\'>${DEFAULT_EMOJI}</div>'">` :
                    `<div class="placeholder-image">${DEFAULT_EMOJI}</div>`
                }
            <div class="flex-fill p-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="fw-semibold mb-0">${item.name}</h6>
                    <span class="price-text">${formatPrice(item.price)}</span>
                </div>
                <p class="text-muted small mb-2 line-clamp-2">${item.description}</p>
            </div>
        </div>
        <div class="d-flex justify-content-end align-items-center p-3 pt-0">
            ${item.status === 'AVAILABLE' ? `
                    <div class="quantity-controls" style="display: ${showQuantityControls ? 'flex' : 'none'};" data-item-id="${item.id}">
                        <button class="btn btn-outline-secondary btn-sm quantity-minus" onclick="event.stopPropagation(); changeCartQuantity(${item.id}, -1)">-</button>
                        <span class="quantity-value mx-2" id="quantity-${item.id}">${cartQuantity}</span>
                        <button class="btn btn-outline-secondary btn-sm quantity-plus" onclick="event.stopPropagation(); changeCartQuantity(${item.id}, 1)">+</button>
                    </div>
                    <button class="btn btn-primary btn-sm add-button"
                            data-item-id="${item.id}"
                            style="display: ${showQuantityControls ? 'none' : 'block'};"
                            onclick="event.stopPropagation(); addToCart(${item.id}, 1)">
                        +
                    </button>
                ` : `
                    <button class="btn btn-secondary btn-sm" disabled style="border-radius: 20px;>Hết hàng</button>
                `
                }
        </div>
    </div>
`;
        }).join('');
    }

    container.innerHTML = '';
    container.appendChild(loadingSpinner);
    container.appendChild(errorMessage);
    container.appendChild(menuContent);
}

// Update pagination UI
function updatePaginationUI() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageNumbers = document.getElementById('pageNumbers');

    if (totalPages <= 1) {
        paginationContainer.classList.add('d-none');
        return;
    }

    paginationContainer.classList.remove('d-none');
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 0;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages - 1;

    if (!pageNumbers) return;

    // Generate page number buttons
    pageNumbers.innerHTML = '';
    const maxPagesToShow = 5;
    let startPage = Math.max(0, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(0, endPage - maxPagesToShow + 1);
    }

    // Add first page and ellipsis if needed
    if (startPage > 0) {
        const firstPageBtn = document.createElement('button');
        firstPageBtn.className = 'btn btn-outline-primary pagination-btn';
        firstPageBtn.textContent = '1';
        firstPageBtn.onclick = () => changePageTo(0);
        pageNumbers.appendChild(firstPageBtn);

        if (startPage > 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbers.appendChild(ellipsis);
        }
    }

    // Add page number buttons
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `btn btn-outline-primary pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = (i + 1).toString();
        pageBtn.onclick = () => changePageTo(i);
        pageNumbers.appendChild(pageBtn);
    }

    // Add last page and ellipsis if needed
    if (endPage < totalPages - 1) {
        if (endPage < totalPages - 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbers.appendChild(ellipsis);
        }

        const lastPageBtn = document.createElement('button');
        lastPageBtn.className = 'btn btn-outline-primary pagination-btn';
        lastPageBtn.textContent = totalPages.toString();
        lastPageBtn.onclick = () => changePageTo(totalPages - 1);
        pageNumbers.appendChild(lastPageBtn);
    }
}

// Change to specific page
function changePageTo(page) {
    if (page >= 0 && page < totalPages && page !== currentPage) {
        currentPage = page;
        loadMenuData(currentPage);
    }
}

// Change page by delta (for prev/next)
function changePage(delta) {
    changePageTo(currentPage + delta);
}

// Add to cart function - sử dụng cartManager
function addToCart(itemId, quantity) {
    const item = menuItems.find(item => item.id === itemId);
    if (!item || item.status !== 'AVAILABLE') return;

    let qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) qty = 1;

    cartManager.addItem(item, qty);
    updateMenuItemDisplay(itemId);
}

// Change cart quantity - sử dụng cartManager
function changeCartQuantity(itemId, change) {
    const item = menuItems.find(item => item.id === itemId);
    if (!item || (change > 0 && item.status !== 'AVAILABLE')) return;

    if (cartManager.getItemQuantity(itemId) === 0 && change > 0) {
        cartManager.addItem(item, change);
    } else {
        cartManager.updateItemQuantity(itemId, change);
    }

    updateMenuItemDisplay(itemId);
}

// Update menu item display based on cart quantity
function updateMenuItemDisplay(itemId) {
    const cartQuantity = cartManager.getItemQuantity(itemId);
    const quantityControls = document.querySelector(`.quantity-controls[data-item-id="${itemId}"]`);
    const addButton = document.querySelector(`.add-button[data-item-id="${itemId}"]`);
    const quantityValue = document.getElementById(`quantity-${itemId}`);

    if (quantityControls && addButton && quantityValue) {
        if (cartQuantity > 0) {
            quantityControls.style.display = 'flex';
            addButton.style.display = 'none';
            quantityValue.textContent = cartQuantity;
        } else {
            quantityControls.style.display = 'none';
            addButton.style.display = 'block';
        }
    }
}

// Select category
function selectCategory(category, button) {
    selectedCategory = category;
    currentPage = 0;

    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    loadMenuData(0);
}

// Search functionality
let debounceTimeout;
let lastSearchTerm = '';

function filterItems() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const newSearchTerm = searchInput.value;
    currentPage = 0;
    if (newSearchTerm !== lastSearchTerm) {
        lastSearchTerm = newSearchTerm;
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            searchTerm = newSearchTerm;
            loadMenuData(0);
        }, 300);
    }
}

// View item detail
function viewItemDetail(itemId) {
    window.location.href = `view-food-detail.html?itemId=${itemId}&tableNumber=${new URLSearchParams(window.location.search).get('tableNumber') || 'N/A'}   `;
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = '/menu';
    }
}



function goToHome() {
    const tableNumber = getUrlParameter('tableNumber') ||
        (currentOrderData && currentOrderData.tableNumber);
    if (tableNumber) {
        window.location.href = `home-page.html?tableNumber=${encodeURIComponent(tableNumber)}`;
    } else {
        window.location.href = 'home-page.html';
    }
}

// Đăng ký callback để cập nhật UI khi cart thay đổi
cartManager.addCallback(() => {
    // Cập nhật hiển thị tất cả menu items
    menuItems.forEach(item => {
        updateMenuItemDisplay(item.id);
    });
});

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    const tableNumberElement = document.getElementById('tableNumber');
    if (tableNumberElement) {
        tableNumberElement.textContent = tableNumber;
    }
    loadMenuData(0);

    // Setup search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterItems);
    }

    // Lắng nghe sự kiện cartUIUpdate
    window.addEventListener('cartUIUpdate', function () {
        console.log('Received cartUIUpdate event, updating UI');
        menuItems.forEach(item => {
            updateMenuItemDisplay(item.id);
        });
    });

    // Lắng nghe sự kiện pageshow
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            console.log('Page restored from BFCache, updating UI');
            menuItems.forEach(item => {
                updateMenuItemDisplay(item.id);
            });
        }
    });
});

