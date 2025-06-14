// App State
let currentFood = null;
let selectedQuantity = 1;
let isFavorite = false;
let customerNote = '';
let relatedFoods = [];

// API Configuration
const API_BASE_URL = 'http://localhost:8080/menu-items';

// Default placeholder for images
const DEFAULT_EMOJI = '🍽️';

// Get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Get food item ID from URL
const itemId = getUrlParameter('itemId');

// Show/hide loading spinner
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    const content = document.getElementById('foodDetailContent');
    const actionBar = document.getElementById('bottomActionBar');

    if (show) {
        spinner.classList.remove('d-none');
        content.classList.add('d-none');
        actionBar.classList.add('d-none');
    } else {
        spinner.classList.add('d-none');
        content.classList.remove('d-none');
        actionBar.classList.remove('d-none');
    }
}

// Show/hide error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const content = document.getElementById('foodDetailContent');
    const actionBar = document.getElementById('bottomActionBar');

    errorMessage.querySelector('span').textContent = message || 'Không thể tải thông tin món ăn. Vui lòng thử lại.';
    errorMessage.classList.remove('d-none');
    content.classList.add('d-none');
    actionBar.classList.add('d-none');
}

function hideError() {
    document.getElementById('errorMessage').classList.add('d-none');
}

// Load food detail from API
async function loadFoodDetail() {
    if (!itemId) {
        showError('Không tìm thấy thông tin món ăn.');
        return;
    }

    try {
        showLoading(true);
        hideError();

        const response = await fetch(`${API_BASE_URL}/${itemId}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.result) {
            currentFood = {
                id: data.result.id,
                name: data.result.name,
                category: data.result.categoryNames && data.result.categoryNames.length > 0
                    ? Array.from(data.result.categoryNames)[0]
                    : 'Khác',
                price: data.result.price,
                image: data.result.imageUrl,
                description: data.result.description || 'Không có mô tả',
                status: data.result.status
            };

            renderFoodDetail();
            updateQuantityDisplay();
            loadRelatedFoods();
        } else {
            throw new Error('Invalid API response format');
        }
    } catch (error) {
        console.error('Error loading food detail:', error);
        showError('Không thể tải thông tin món ăn. Vui lòng thử lại.');
    } finally {
        showLoading(false);
    }
}

async function loadRelatedFoods() {
    try {
        // First, we need to get the categoryId of current food
        // Assuming currentFood has categoryId or we need to extract it
        
        let categoryId = null;
        
        // Method 1: If currentFood already has categoryId
        if (currentFood.categoryId) {
            categoryId = currentFood.categoryId;
        } 
        // Method 2: If we need to get categoryId from the current food detail
        else {
            // Get current food detail to extract categoryId
            const currentFoodResponse = await fetch(`${API_BASE_URL}/${currentFood.id}`);
            if (currentFoodResponse.ok) {
                const currentFoodData = await currentFoodResponse.json();
                if (currentFoodData && currentFoodData.result && currentFoodData.result.categoryIds) {
                    // Take the first categoryId if multiple categories
                    categoryId = currentFoodData.result.categoryIds[0];
                }
            }
        }

        if (!categoryId) {
            console.warn('Cannot determine categoryId for current food');
            relatedFoods = [];
            renderRelatedFoods();
            return;
        }

        // Get items from same category using the filtered endpoint
        const response = await fetch(`${API_BASE_URL}?size=6&categoryId=${categoryId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data && data.result && data.result.content) {
            // Filter out current food and only get available items
            const sameCategoryItems = data.result.content.filter(item => 
                item.id !== currentFood.id && 
                item.status === 'AVAILABLE'
            );

            // Sort by price similarity (items with similar price first)
            sameCategoryItems.sort((a, b) => {
                const priceDiffA = Math.abs(a.price - currentFood.price);
                const priceDiffB = Math.abs(b.price - currentFood.price);
                return priceDiffA - priceDiffB;
            });
            
            // Map to our format
            relatedFoods = sameCategoryItems.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                image: item.imageUrl,
                category: item.categoryNames && item.categoryNames.length > 0 
                    ? Array.from(item.categoryNames)[0] 
                    : 'Khác'
            }));

            renderRelatedFoods();
        }
    } catch (error) {
        console.error('Error loading related foods:', error);
        renderRelatedFoodsError();
    }
}

// Alternative version if currentFood already has categoryId
// async function loadRelatedFoodsSimple() {
//     try {
//         // This assumes currentFood.categoryId is available
//         if (!currentFood.categoryId) {
//             console.warn('Current food does not have categoryId');
//             relatedFoods = [];
//             renderRelatedFoods();
//             return;
//         }

//         // Get items from same category
//         const response = await fetch(`${API_BASE_URL}?size=7&categoryId=${currentFood.categoryId}`);
        
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         const data = await response.json();
        
//         if (data && data.result && data.result.content) {
//             // Filter out current food and get up to 6 items
//             relatedFoods = data.result.content
//                 .filter(item => 
//                     item.id !== currentFood.id && 
//                     item.status === 'AVAILABLE'
//                 )
//                 .slice(0, 6)
//                 .map(item => ({
//                     id: item.id,
//                     name: item.name,
//                     price: item.price,
//                     image: item.imageUrl,
//                     category: item.categoryNames && item.categoryNames.length > 0 
//                         ? Array.from(item.categoryNames)[0] 
//                         : 'Khác'
//                 }));

//             renderRelatedFoods();
//         }
//     } catch (error) {
//         console.error('Error loading related foods:', error);
//         renderRelatedFoodsError();
//     }
// }

// Render related foods
function renderRelatedFoods() {
    const container = document.getElementById('relatedFoodsContainer');
    
    if (relatedFoods.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fas fa-utensils mb-2" style="font-size: 2rem;"></i>
                <p class="mb-0">Không có món ăn liên quan</p>
            </div>
        `;
        return;
    }

    const foodsHTML = relatedFoods.map(food => `
        <div class="related-food-item" onclick="viewFoodDetail(${food.id})">
            <div class="related-food-image">
                ${food.image && !food.image.startsWith('data:') ? 
                    `<img src="${food.image}" alt="${food.name}" onerror="this.outerHTML='<div class=\\'placeholder-image-small\\'><i class=\\'fas fa-utensils\\'></i></div>'">` :
                    `<div class="placeholder-image-small"><i class="fas fa-utensils"></i></div>`
                }
            </div>
            <div class="related-food-info">
                <h6 class="related-food-name">${food.name}</h6>
                <div class="related-food-category">${food.category}</div>
                <div class="related-food-price">${formatPrice(food.price)}</div>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="d-flex gap-3" style="overflow-x: auto; padding-bottom: 10px;">
            ${foodsHTML}
        </div>
    `;
}

// Render related foods error
function renderRelatedFoodsError() {
    const container = document.getElementById('relatedFoodsContainer');
    container.innerHTML = `
        <div class="text-center py-4 text-muted">
            <i class="fas fa-exclamation-triangle mb-2" style="font-size: 1.5rem;"></i>
            <p class="mb-0 small">Không thể tải món ăn liên quan</p>
        </div>
    `;
}

// View food detail
function viewFoodDetail(foodId) {
    // Navigate to food detail page with new ID
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('itemId', foodId);
    window.location.href = currentUrl.toString();
}

// Render food detail
function renderFoodDetail() {
    if (!currentFood) return;

    // Update food image
    const foodImageContainer = document.getElementById('foodImage');
    if (currentFood.image && !currentFood.image.startsWith('data:')) {
        foodImageContainer.innerHTML = `<img src="${currentFood.image}" alt="${currentFood.name}" onerror="this.outerHTML='<div class=\\'placeholder-image\\'><i class=\\'fas fa-utensils\\'></i></div>'">`;
    } else {
        foodImageContainer.innerHTML = `<div class="placeholder-image"><i class="fas fa-utensils"></i></div>`;
    }

    // Update food info
    document.getElementById('foodName').textContent = currentFood.name;
    document.getElementById('foodCategory').textContent = currentFood.category;
    document.getElementById('foodPrice').textContent = formatPrice(currentFood.price);
    document.getElementById('foodDescription').textContent = currentFood.description;

    // Update status badge
    const statusBadge = document.getElementById('statusBadge');
    const addToCartBtn = document.getElementById('addToCartBtn');

    if (currentFood.status === 'AVAILABLE') {
        statusBadge.innerHTML = '<span class="badge bg-success">Còn hàng</span>';
        addToCartBtn.disabled = false;
        addToCartBtn.innerHTML = '<i class="fas fa-plus me-2"></i>Thêm vào giỏ hàng';
    } else {
        statusBadge.innerHTML = '<span class="badge bg-danger">Hết hàng</span>';
        addToCartBtn.disabled = true;
        addToCartBtn.innerHTML = '<i class="fas fa-ban me-2"></i>Hết hàng';
    }

    // Add fade-in animation
    document.getElementById('foodDetailContent').classList.add('fade-in');
}

// Customer Note Functions
function updateNoteCounter() {
    const noteInput = document.getElementById('customerNote');
    const counter = document.getElementById('noteCounter');
    const currentLength = noteInput.value.length;
    counter.textContent = currentLength;

    // Update customer note variable
    customerNote = noteInput.value;

    // Change color if near limit
    if (currentLength > 180) {
        counter.style.color = '#dc3545';
    } else if (currentLength > 150) {
        counter.style.color = '#fd7e14';
    } else {
        counter.style.color = '#6c757d';
    }
}

function addQuickNote(note) {
    const noteInput = document.getElementById('customerNote');
    let currentNote = noteInput.value.trim();

    // Check if note already exists
    if (currentNote.includes(note)) {
        return;
    }

    // Add note with separator if needed
    if (currentNote) {
        currentNote += ', ' + note;
    } else {
        currentNote = note;
    }

    // Check character limit
    if (currentNote.length <= 200) {
        noteInput.value = currentNote;
        updateNoteCounter();
    }
}

// Favorite Functions
function toggleFavorite() {
    isFavorite = !isFavorite;
    const favoriteIcon = document.getElementById('favoriteIcon');
    const favoriteBtn = favoriteIcon.closest('.favorite-btn');

    if (isFavorite) {
        favoriteIcon.className = 'fas fa-heart';
        favoriteBtn.classList.add('active');
        showToast('Đã thêm vào yêu thích');
    } else {
        favoriteIcon.className = 'far fa-heart';
        favoriteBtn.classList.remove('active');
        showToast('Đã bỏ khỏi yêu thích');
    }
}

// Quantity Functions
function changeQuantity(delta) {
    const newQuantity = Math.max(1, Math.min(30, selectedQuantity + delta));

    if (newQuantity !== selectedQuantity) {
        selectedQuantity = newQuantity;
        updateQuantityDisplay();
    }
}

function updateQuantityDisplay() {
    document.getElementById('selectedQuantity').textContent = selectedQuantity;

    // Update button states
    const decreaseBtn = document.getElementById('decreaseQty');
    const increaseBtn = document.getElementById('increaseQty');

    decreaseBtn.disabled = selectedQuantity <= 1;
    increaseBtn.disabled = selectedQuantity >= 30;
}

// Cart Functions - Updated to use CartManager
function addToCart() {
    if (!currentFood || currentFood.status !== 'AVAILABLE') {
        showToast('Món ăn này hiện không có sẵn', 'error');
        return;
    }

    // Check if cartManager is available
    if (typeof cartManager === 'undefined') {
        console.error('CartManager not found');
        showToast('Lỗi hệ thống. Vui lòng tải lại trang.', 'error');
        return;
    }

    try {
        // Create item object for cartManager
        const item = {
            id: currentFood.id,
            name: currentFood.name,
            price: currentFood.price,
            image: currentFood.image,
            category: currentFood.category
        };

        // Add item to cart using cartManager
        cartManager.addItem(item, selectedQuantity);

        // Store customer note separately if needed (since cartManager doesn't support notes)
        if (customerNote.trim()) {
            // You could extend cartManager to support notes, or handle notes separately
            // For now, we'll show the note in the toast
            showToast(`Đã thêm ${selectedQuantity} ${currentFood.name} vào giỏ hàng${customerNote ? ` (Ghi chú: ${customerNote})` : ''}`);
        } else {
            showToast(`Đã thêm ${selectedQuantity} ${currentFood.name} vào giỏ hàng`);
        }

        // Reset quantity and note
        selectedQuantity = 1;
        customerNote = '';
        document.getElementById('customerNote').value = '';
        updateQuantityDisplay();
        updateNoteCounter();

    } catch (error) {
        console.error('Error adding to cart:', error);
        showToast('Có lỗi xảy ra khi thêm vào giỏ hàng', 'error');
    }
}

// Utility Functions
function showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} 
                       position-fixed start-50 translate-middle-x`;
    toast.style.cssText = `
        top: 100px;
        z-index: 9999;
        min-width: 300px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        animation: slideDown 0.3s ease-out;
    `;

    const icon = type === 'success' ? 'check-circle' :
        type === 'error' ? 'exclamation-triangle' : 'info-circle';

    toast.innerHTML = `
        <i class="fas fa-${icon} me-2"></i>
        ${message}
    `;

    document.body.appendChild(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = '/menu';
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    // Wait for cartManager to be available
    const checkCartManager = () => {
        if (typeof cartManager !== 'undefined' && typeof formatPrice !== 'undefined') {
            // Load food detail after cartManager is ready
            loadFoodDetail();
            
            // Initialize quantity display
            updateQuantityDisplay();
            
            console.log('Food Detail App initialized with CartManager');
        } else {
            // Retry after a short delay
            setTimeout(checkCartManager, 100);
        }
    };
    
    checkCartManager();

    // Handle escape key to close modal (if cart modal exists)
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const cartModal = document.getElementById('cartModal');
            if (cartModal && cartModal.classList.contains('show')) {
                // Use the global toggleCart function from cartManager
                if (typeof toggleCart === 'function') {
                    toggleCart();
                }
            }
        }
    });

    // Prevent form submission on enter in note input
    const customerNoteInput = document.getElementById('customerNote');
    if (customerNoteInput) {
        customerNoteInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
            }
        });
    }
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
    
    @keyframes slideUp {
        from {
            transform: translate(-50%, 0);
            opacity: 1;
        }
        to {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
    }
    
    .cart-modal {
        animation: fadeIn 0.3s ease;
    }
    
    .cart-content {
        animation: slideUpModal 0.3s ease;
    }
    
    @keyframes slideUpModal {
        from {
            transform: translateY(100%);
        }
        to {
            transform: translateY(0);
        }
    }
    
    .cart-item {
        transition: all 0.3s ease;
    }
    
    .cart-item:hover {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 16px 12px;
        margin: 0 -12px;
    }
    
    .quantity-btn {
        transition: all 0.2s ease;
    }
    
    .quantity-btn:hover:not(:disabled) {
        transform: scale(1.1);
    }
    
    .floating-cart:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 25px rgba(255, 107, 53, 0.4);
    }
    
    .favorite-btn {
        transition: all 0.3s ease;
    }
    
    
    
    .favorite-btn:hover {
        transform: scale(1.1);
    }
    
    .favorite-btn.active {
        animation: heartBeat 0.6s ease;
    }
    
    @keyframes heartBeat {
        0%, 100% { transform: scale(1); }
        25% { transform: scale(1.2); }
        50% { transform: scale(1.1); }
        75% { transform: scale(1.15); }
    }
    
    .fade-in {
        animation: fadeIn 0.5s ease-in;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);