// cartManager.js - Quản lý giỏ hàng với fallback storage
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'css/cart.css'; // Đường dẫn đến file CSS
document.head.appendChild(link);
class StorageManager {
    constructor() {
        this.isLocalStorageAvailable = this.checkLocalStorage();
        this.memoryStorage = {};
    }

    checkLocalStorage() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            console.warn('localStorage not available, using memory storage');
            return false;
        }
    }

    setItem(key, value) {
        try {
            if (this.isLocalStorageAvailable) {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                this.memoryStorage[key] = JSON.stringify(value);
                // Lưu vào window object để chia sẻ giữa các script
                window[`storage_${key}`] = JSON.stringify(value);
            }
        } catch (error) {
            console.error('Error saving to storage:', error);
            // Fallback to memory storage
            this.memoryStorage[key] = JSON.stringify(value);
            window[`storage_${key}`] = JSON.stringify(value);
        }
    }

    getItem(key) {
        try {
            let value = null;

            if (this.isLocalStorageAvailable) {
                value = localStorage.getItem(key);
            } else {
                // Thử lấy từ memory storage hoặc window object
                value = this.memoryStorage[key] || window[`storage_${key}`] || null;
            }

            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Error loading from storage:', error);
            return null;
        }
    }

    removeItem(key) {
        try {
            if (this.isLocalStorageAvailable) {
                localStorage.removeItem(key);
            } else {
                delete this.memoryStorage[key];
                delete window[`storage_${key}`];
            }
        } catch (error) {
            console.error('Error removing from storage:', error);
        }
    }
}

class CartManager {
    constructor() {
        this.storage = new StorageManager();
        this.cart = this.loadCart();
        this.callbacks = [];
        this.onCartChange = null; // Callback function cho food detail view

        // Lắng nghe thay đổi từ localStorage (nếu có)
        if (this.storage.isLocalStorageAvailable) {
            window.addEventListener('storage', (e) => {
                if (e.key === 'cart_data') {
                    this.cart = this.loadCart();
                    this.notifyCallbacks();
                }
            });
        }

        // Lắng nghe custom events cho memory storage
        window.addEventListener('cartUpdated', (e) => {
            if (e.detail && e.detail.source !== this) {
                this.cart = this.loadCart();
                this.notifyCallbacks();
            }
        });

        // Định kỳ sync dữ liệu (cho trường hợp memory storage)
        if (!this.storage.isLocalStorageAvailable) {
            setInterval(() => {
                this.syncCart();
            }, 1000);
        }
    }

    // Tải giỏ hàng từ storage
    loadCart() {
        try {
            const cartData = this.storage.getItem('cart_data');
            return cartData || [];
        } catch (error) {
            console.error('Error loading cart:', error);
            return [];
        }
    }

    // Lưu giỏ hàng vào storage
    saveCart() {
        try {
            this.storage.setItem('cart_data', this.cart);

            // Dispatch event để thông báo cho các component khác
            window.dispatchEvent(new CustomEvent('cartUpdated', {
                detail: { source: this, cart: this.cart }
            }));
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    }

    // Sync giỏ hàng (cho memory storage)
    syncCart() {
        try {
            const currentCart = this.storage.getItem('cart_data');
            if (currentCart && JSON.stringify(currentCart) !== JSON.stringify(this.cart)) {
                this.cart = currentCart;
                this.notifyCallbacks();
            }
        } catch (error) {
            // Ignore sync errors
        }
    }

    // Thêm callback để lắng nghe thay đổi
    addCallback(callback) {
        this.callbacks.push(callback);
    }

    // Thông báo cho tất cả callbacks
    notifyCallbacks() {
        this.callbacks.forEach(callback => {
            try {
                callback(this.cart);
            } catch (error) {
                console.error('Error in callback:', error);
            }
        });

        // Gọi onCartChange callback nếu có (cho food detail view)
        if (typeof this.onCartChange === 'function') {
            try {
                this.onCartChange();
            } catch (error) {
                console.error('Error in onCartChange callback:', error);
            }
        }
    }

    // Thêm món vào giỏ hàng
    addItem(item, quantity = 1, note = '') {
        const existingItemIndex = this.cart.findIndex(cartItem =>
            cartItem.id === item.id
        );

        if (existingItemIndex !== -1) {
            this.cart[existingItemIndex].quantity += quantity;

            // Cập nhật note thành note mới nhất (nếu có)
            if (note && note.trim() !== '') {
                this.cart[existingItemIndex].note = note;
            }

        } else {
            this.cart.push({
                id: item.id,
                name: item.name,
                price: item.price,
                image: item.image,
                category: item.category,
                quantity: quantity,
                note: note || '',
                addedAt: new Date().getTime() // Thêm timestamp để track
            });
        }

        this.saveCart();
        this.notifyCallbacks();
    }

    // Cập nhật món trong giỏ hàng (cho food detail view)
    updateItem(itemId, quantity, note = '') {
        const existingItemIndex = this.cart.findIndex(cartItem => cartItem.id === itemId);

        if (existingItemIndex !== -1) {
            if (quantity <= 0) {
                // Xóa item nếu quantity <= 0
                this.cart.splice(existingItemIndex, 1);
            } else {
                // Cập nhật quantity và note
                this.cart[existingItemIndex].quantity = quantity;
                this.cart[existingItemIndex].note = note || '';
            }

            this.saveCart();
            this.notifyCallbacks();
            return true;
        }
        return false;
    }

    // Lấy thông tin một món trong giỏ hàng (cho food detail view)
    getItem(itemId) {
        return this.cart.find(cartItem => cartItem.id === itemId) || null;
    }

    // Cập nhật số lượng món trong giỏ hàng
    updateItemQuantity(itemId, change, note = '') {
        const itemIndex = this.cart.findIndex(cartItem =>
            cartItem.id === itemId && (note === '' || cartItem.note === note)
        );

        if (itemIndex !== -1) {
            this.cart[itemIndex].quantity += change;

            if (this.cart[itemIndex].quantity <= 0) {
                this.cart.splice(itemIndex, 1);
            }

            this.saveCart();
            this.notifyCallbacks();
        }
    }

    // Xóa món khỏi giỏ hàng
    removeItem(itemId, note = '') {
        const itemIndex = this.cart.findIndex(cartItem =>
            cartItem.id === itemId && (note === '' || cartItem.note === note)
        );

        if (itemIndex !== -1) {
            this.cart.splice(itemIndex, 1);
            this.saveCart();
            this.notifyCallbacks();
        }
    }

    // Lấy số lượng của một món trong giỏ hàng
    getItemQuantity(itemId, note = '') {
        const item = this.cart.find(cartItem =>
            cartItem.id === itemId && (note === '' || cartItem.note === note)
        );
        return item ? item.quantity : 0;
    }

    // Lấy tổng số món trong giỏ hàng
    getTotalItems() {
        return this.cart.reduce((total, item) => total + item.quantity, 0);
    }

    // Lấy tổng số loại món trong giỏ hàng
    getTotalUniqueItems() {
        return this.cart.length;
    }

    // Lấy tổng giá trị giỏ hàng
    getTotalPrice() {
        return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    // Lấy tất cả món trong giỏ hàng
    getItems() {
        return [...this.cart];
    }

    // Xóa toàn bộ giỏ hàng
    clearCart() {
        this.cart = [];
        this.saveCart();
        this.notifyCallbacks();
    }

    // Kiểm tra giỏ hàng có trống không
    isEmpty() {
        return this.cart.length === 0;
    }

    // Export cart data (để backup/restore)
    exportCart() {
        return {
            data: this.cart,
            timestamp: new Date().getTime(),
            storageType: this.storage.isLocalStorageAvailable ? 'localStorage' : 'memory'
        };
    }

    // Import cart data
    importCart(cartData) {
        if (cartData && Array.isArray(cartData.data)) {
            this.cart = cartData.data;
            this.saveCart();
            this.notifyCallbacks();
            return true;
        }
        return false;
    }
}

// Tạo instance global
const cartManager = new CartManager();

// Format price function
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
}

// Cart UI Manager - Quản lý giao diện giỏ hàng
class CartUIManager {
    constructor(cartManager) {
        this.cartManager = cartManager;
        this.isModalOpen = false;

        // Đăng ký callback để cập nhật UI khi cart thay đổi
        this.cartManager.addCallback(() => {
            this.updateUI();
        });

        // Khởi tạo UI sau khi DOM loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.init();
            });
        } else {
            this.init();
        }
    }

    init() {
        this.updateUI();
        this.setupEventListeners();
        this.showStorageStatus();
    }

    showStorageStatus() {
        console.log('Cart Storage Status:',
            this.cartManager.storage.isLocalStorageAvailable ?
                'Using localStorage' : 'Using memory storage'
        );
    }

    setupEventListeners() {
        // Close modal khi click outside
        document.addEventListener('click', (event) => {
            const cartModal = document.getElementById('cartModal');
            if (!cartModal) return;

            const cartContent = cartModal.querySelector('.cart-content');

            // Kiểm tra xem click có phải từ các element trong cart không
            const isCartButton = event.target.closest('.quantity-btn') ||
                event.target.closest('.cart-item') ||
                event.target.closest('.floating-cart') ||
                event.target.closest('[onclick*="toggleCart"]') ||
                event.target.closest('[onclick*="placeOrder"]') ||
                event.target.closest('[onclick*="clearAllItems"]') ||
                event.target.closest('[onclick*="removeItem"]') ||
                event.target.closest('.btn-primary') ||
                event.target.closest('.btn-outline-secondary') ||
                event.target.closest('.btn-outline-danger');

            if (this.isModalOpen &&
                cartModal.classList.contains('show') &&
                !cartContent?.contains(event.target) &&
                !isCartButton) {
                this.toggleCart();
            }
        });

        // Close modal khi nhấn Escape
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isModalOpen) {
                this.toggleCart();
            }
        });
    }

    updateUI() {
        this.updateCartBadge();
        this.updateFloatingCart();
        this.updateCartModal();
    }

    updateCartBadge() {
        const cartBadge = document.getElementById('cartBadge');
        const totalItems = this.cartManager.getTotalUniqueItems();

        if (cartBadge) {
            if (totalItems > 0) {
                cartBadge.textContent = totalItems;
                cartBadge.classList.remove('d-none');
            } else {
                cartBadge.classList.add('d-none');
            }
        }
    }

    updateFloatingCart() {
        const floatingCart = document.getElementById('floatingCart');
        const floatingTotal = document.getElementById('floatingTotal');
        const floatingCount = document.getElementById('floatingCount');

        if (floatingCart && floatingTotal && floatingCount) {
            const totalItems = this.cartManager.getTotalUniqueItems();
            const totalPrice = this.cartManager.getTotalPrice();

            if (totalItems > 0) {
                floatingCart.classList.remove('d-none');
                floatingTotal.textContent = formatPrice(totalPrice);
                floatingCount.textContent = totalItems;
            } else {
                floatingCart.classList.add('d-none');
            }
        }
    }

    updateCartModal() {
        const cartItemCount = document.getElementById('cartItemCount');
        const emptyCart = document.getElementById('emptyCart');
        const cartItems = document.getElementById('cartItems');
        const cartFooter = document.getElementById('cartFooter');
        const totalPrice = document.getElementById('totalPrice');

        if (!cartItemCount) return;

        const items = this.cartManager.getItems();
        const totalItems = this.cartManager.getTotalUniqueItems();
        const totalPriceValue = this.cartManager.getTotalPrice();

        cartItemCount.textContent = totalItems;

        if (items.length === 0) {
            emptyCart?.classList.remove('d-none');
            if (cartItems) cartItems.innerHTML = '';
            cartFooter?.classList.add('d-none');
        } else {
            emptyCart?.classList.add('d-none');
            cartFooter?.classList.remove('d-none');

            if (totalPrice) {
                totalPrice.textContent = formatPrice(totalPriceValue);
            }

            if (cartItems) {
                const cartHeader = `
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="text-muted" style="font-size: 14px;">Danh sách món đã chọn</span>
                        <button class="btn p-1" onclick="event.stopPropagation(); cartUIManager.clearAllItems()"
                            style="background: none; border-radius: 20px; padding: 4px 10px; color: #dc3545; font-size: 12px;"
                            title="Xóa toàn bộ giỏ hàng">
                            Xoá toàn bộ giỏ hàng
                        </button>
                    </div>
                `;

                const cartItemsHTML = items.map(item => `
                    <div class="d-flex align-items-center py-3 border-bottom cart-item">
    <div class="flex-shrink-0 me-3">
        <div class="item-icon">
            <i class="fas fa-utensils"></i>
        </div>
    </div>
    <div class="flex-fill">
        <div class="food-name">${item.name}</div>
        <div class="food-price">${formatPrice(item.price)}</div>
        ${item.note ? `<div class="food-note"><i class="fas fa-sticky-note me-1"></i>${item.note}</div>` : ''}
        <a href="view-food-detail.html?itemId=${item.id}" class="food-edit-link">Chỉnh sửa</a>
    </div>
    <div class="d-flex align-items-center gap-2">
        <button class="btn cart-btn cart-remove-btn"
                onclick="event.stopPropagation(); cartUIManager.removeItem(${item.id}, '${item.note || ''}')" 
                title="Xóa món này">
            <i class="fas fa-times"></i>
        </button>
        <div class="d-flex align-items-center">
            <button class="btn cart-btn cart-minus-btn"
                    onclick="event.stopPropagation(); cartUIManager.updateQuantity(${item.id}, -1, '${item.note || ''}')">
                <i class="fas fa-minus"></i>
            </button>
            <span class="item-quantity">${item.quantity}</span>
            <button class="btn cart-btn cart-plus-btn"
                    onclick="event.stopPropagation(); cartUIManager.updateQuantity(${item.id}, 1, '${item.note || ''}')">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    </div>
</div>
                `).join('');

                cartItems.innerHTML = cartHeader + cartItemsHTML;
            }
        }
    }

    toggleCart() {
        const cartModal = document.getElementById('cartModal');
        if (!cartModal) {
            console.error('Cart modal not found');
            return;
        }

        if (cartModal.classList.contains('show')) {
            // Đóng modal
            cartModal.classList.remove('show');
            document.body.style.overflow = '';
            this.isModalOpen = false;
        } else {
            // Mở modal
            cartModal.classList.add('show');
            document.body.style.overflow = 'hidden';
            this.isModalOpen = true;
        }
    }

    updateQuantity(itemId, change, note = '') {
        // Ngăn chặn event bubbling
        event?.stopPropagation();
        this.cartManager.updateItemQuantity(itemId, change, note);
    }

    removeItem(itemId, note = '') {
        // Ngăn chặn event bubbling
        event?.stopPropagation();

        const item = this.cartManager.getItems().find(item =>
            item.id === itemId && (note === '' || item.note === note)
        );

        if (item && confirm(`Bạn có chắc muốn xóa "${item.name}" khỏi giỏ hàng?`)) {
            this.cartManager.removeItem(itemId, note);
        }
    }

    clearAllItems() {
        // Ngăn chặn event bubbling
        event?.stopPropagation();

        if (this.cartManager.isEmpty()) {
            alert('Giỏ hàng đã trống!');
            return;
        }

        const totalItems = this.cartManager.getTotalUniqueItems();
        const totalPrice = this.cartManager.getTotalPrice();

        const confirmMessage = `Bạn có chắc muốn xóa toàn bộ giỏ hàng?\n\n` +
            `• ${totalItems} món\n` +
            `• Tổng tiền: ${formatPrice(totalPrice)}`;

        if (confirm(confirmMessage)) {
            this.cartManager.clearCart();
        }
    }

    async placeOrder(event) {
    // Lấy tableNumber từ URL parameters
    const getUrlParameter = (name) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    };

    const tableNumber = getUrlParameter('tableNumber');
    const BACKEND_BASE_URL = "http://localhost:8080";

    if (this.cartManager.isEmpty()) {
        alert('Giỏ hàng trống!');
        return;
    }

    if (!tableNumber) {
        alert('Không tìm thấy thông tin bàn!');
        return;
    }

    try {
        // Hiển thị loading state
        const originalText = event?.target?.textContent;
        if (event?.target) {
            event.target.textContent = 'Đang đặt món...';
            event.target.disabled = true;
        }

        // Bước 1: Tìm table info dựa trên tableNumber
        console.log('Finding table info for table number:', tableNumber);

        const tableResponse = await fetch(`${BACKEND_BASE_URL}/tables?tableNumber=${encodeURIComponent(tableNumber)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!tableResponse.ok) {
            throw new Error('Lỗi khi tìm thông tin bàn');
        }

        const tableData = await tableResponse.json();
        const table = tableData.result[0]; // Vì tableNumber unique nên chỉ có 1 kết quả
        const tableId = table.id;

        console.log('Found table:', { id: tableId, number: table.tableNumber, status: table.status });

        // Bước 2: Kiểm tra xem bàn đã có đơn hàng active chưa
        let existingOrder = null;
        let isNewOrder = true;

        try {
            const currentOrderResponse = await fetch(`${BACKEND_BASE_URL}/orders/table/${tableId}/current`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (currentOrderResponse.ok) {
                const currentOrderData = await currentOrderResponse.json();
                existingOrder = currentOrderData.result;
                
                // Kiểm tra status của đơn hàng hiện tại
                const activeStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'];
                if (existingOrder && activeStatuses.includes(existingOrder.status)) {
                    isNewOrder = false;
                    console.log('Found existing active order:', existingOrder.id);
                }
            }
        } catch (error) {
            console.log('No existing order found, will create new order');
        }

        // Bước 3: Chuẩn bị dữ liệu order items
        const orderItems = this.cartManager.getItems().map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
            note: item.note || '',
        }));

        let orderResponse;
        let orderResult;

        if (isNewOrder) {
            // Tạo đơn hàng mới
            console.log('Creating new order...');
            
            const orderData = {
                tableId: tableId,
                userId: null,
                orderType: 'DINE_IN',
                orderItems: orderItems,
            };

            console.log('Sending new order data:', orderData);

            orderResponse = await fetch(`${BACKEND_BASE_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
        } else {
            // Thêm món vào đơn hàng hiện tại
            console.log('Adding items to existing order:', existingOrder.id);
            
            const addItemsData = {
                orderItems: orderItems,
            };

            console.log('Sending add items data:', addItemsData);

            orderResponse = await fetch(`${BACKEND_BASE_URL}/orders/${existingOrder.id}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(addItemsData)
            });
        }

        if (!orderResponse.ok) {
            // Xử lý response lỗi từ server
            let errorMessage = 'Có lỗi xảy ra khi đặt món';

            try {
                const errorResponse = await orderResponse.json();
                console.error('Server error response:', errorResponse);

                if (errorResponse.message) {
                    errorMessage = errorResponse.message;
                } else if (errorResponse.code) {
                    switch (errorResponse.code) {
                        case 'TABLE_NOT_EXISTED':
                            errorMessage = 'Bàn không tồn tại';
                            break;
                        case 'TABLE_NOT_AVAILABLE':
                            errorMessage = 'Bàn đang được sử dụng';
                            break;
                        case 'MENU_ITEM_NOT_EXISTED':
                            errorMessage = 'Món ăn không tồn tại';
                            break;
                        case 'MENU_ITEM_NOT_AVAILABLE':
                            errorMessage = 'Món ăn hiện không có sẵn';
                            break;
                        case 'USER_NOT_EXISTED':
                            errorMessage = 'Người dùng không tồn tại';
                            break;
                        case 'ORDER_NOT_EXISTED':
                            errorMessage = 'Đơn hàng không tồn tại';
                            break;
                        default:
                            errorMessage = `Lỗi: ${errorResponse.code}`;
                    }
                }
            } catch (parseError) {
                console.error('Cannot parse error response:', parseError);
                switch (orderResponse.status) {
                    case 400:
                        errorMessage = 'Dữ liệu đơn hàng không hợp lệ';
                        break;
                    case 404:
                        errorMessage = 'Không tìm thấy thông tin cần thiết';
                        break;
                    case 500:
                        errorMessage = 'Lỗi server nội bộ';
                        break;
                    default:
                        errorMessage = `Lỗi HTTP: ${orderResponse.status}`;
                }
            }

            throw new Error(errorMessage);
        }

        const apiResponse = await orderResponse.json();
        console.log('Order operation completed successfully:', apiResponse);

        if (apiResponse.result) {
            orderResult = apiResponse.result;

            // Lưu order ID vào storage nếu có thể
            try {
                if (this.cartManager.storage.isLocalStorageAvailable) {
                    localStorage.setItem('currentOrderId', orderResult.id);

                    // Lưu thông tin đơn hàng chi tiết để hiển thị trên trang xác nhận
                    const orderDetails = {
                        ...orderResult,
                        tableNumber: tableNumber,
                        items: this.cartManager.getItems().map(item => ({
                            name: item.name,
                            quantity: item.quantity,
                            price: item.price,
                            note: item.note || ''
                        })),
                        isNewOrder: isNewOrder
                    };
                    localStorage.setItem('orderConfirmationData', JSON.stringify(orderDetails));
                }
            } catch (error) {
                console.warn('Cannot save order details:', error);
            }

            // Clear cart
            this.cartManager.clearCart();
            this.toggleCart();

            // Hiển thị thông báo thành công
            const successMessage = isNewOrder ? 
                'Đặt món thành công!' : 
                'Thêm món vào đơn hàng thành công!';
            
            // Có thể thay alert bằng toast notification đẹp hơn
            // alert(successMessage);

            // Chuyển hướng đến trang xác nhận đơn hàng
            const confirmationUrl = `order-confirmation.html?orderId=${orderResult.id}&tableNumber=${encodeURIComponent(tableNumber)}`;
            window.location.href = confirmationUrl;

        } else {
            console.warn('Unexpected API response format:', apiResponse);
            // Fallback: vẫn chuyển đến trang xác nhận với thông tin cơ bản
            this.cartManager.clearCart();
            this.toggleCart();

            const confirmationUrl = `order-confirmation.html?tableNumber=${encodeURIComponent(tableNumber)}`;
            window.location.href = confirmationUrl;
        }

    } catch (error) {
        console.error('Error placing order:', error);

        let userMessage;
        if (error.message.includes('Failed to fetch')) {
            userMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
        } else if (error.message.includes('NetworkError')) {
            userMessage = 'Lỗi mạng. Vui lòng thử lại sau.';
        } else if (error.message.includes('CORS')) {
            userMessage = 'Lỗi kết nối. Vui lòng liên hệ quản trị viên.';
        } else {
            userMessage = error.message;
        }

        alert(userMessage);
    } finally {
        // Reset button state
        if (event?.target) {
            event.target.textContent = originalText || 'Đặt món';
            event.target.disabled = false;
        }
    }
}

    // Debug functions
    exportCartData() {
        const data = this.cartManager.exportCart();
        console.log('Cart Export:', data);
        return data;
    }

    importCartData(data) {
        return this.cartManager.importCart(data);
    }
}

// Tạo instance global cho UI manager
const cartUIManager = new CartUIManager(cartManager);

// Global functions để sử dụng trong HTML
function toggleCart() {
    cartUIManager.toggleCart();
}

function placeOrder(event) {
    cartUIManager.placeOrder(event);
}

// Thêm hàm để test giỏ hàng với dữ liệu mẫu
function addSampleItem() {
    const sampleItem = {
        id: Date.now(), // Sử dụng timestamp để tránh trùng ID
        name: 'Phở Bò',
        price: 65000,
        image: '',
        category: 'Món chính'
    };
    cartManager.addItem(sampleItem, 1, 'Ít cay');
}

// Debug functions (có thể xóa trong production)
function debugCart() {
    console.log('Current cart:', cartManager.getItems());
    console.log('Storage type:', cartManager.storage.isLocalStorageAvailable ? 'localStorage' : 'memory');
}

function clearDebugCart() {
    cartManager.clearCart();
    console.log('Cart cleared');
}

