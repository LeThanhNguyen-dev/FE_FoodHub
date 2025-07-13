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
            }, 500);
        }
        window.addEventListener('pageshow', () => {
            this.syncCart();
            this.notifyCallbacks();
        });
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

    <button class="btn p-1 d-flex align-items-center"
        onclick="event.stopPropagation(); cartUIManager.clearAllItems()"
        style="background: none; border: 1px solid #dc3545; border-radius: 20px; padding: 4px 10px; color: #dc3545; font-size: 12px;"
        title="Xóa toàn bộ giỏ hàng">
        
        <!-- Icon thùng rác -->
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            style="margin-right: 4px;">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>

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
        <span class="food-edit-link" onclick="viewFoodDetail(${item.id})">Chỉnh sửa</span>
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

    clearAllItems(e) {
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

        // Validation cơ bản
        if (this.cartManager.isEmpty()) {
            this.showNotification('Giỏ hàng trống!', 'warning');
            return;
        }

        if (!tableNumber) {
            this.showNotification('Không tìm thấy thông tin bàn!', 'error');
            return;
        }

        // Lưu trạng thái button
        const originalText = event?.target?.textContent;
        const button = event?.target;

        try {
            this.setButtonLoading(button, 'Đang đặt món...');

            // Kiểm tra token trong TokenManager
            const sessionData = window.tokenManager.getSessionData();
            const token = sessionData.token;

            if (!window.tokenManager.isTokenValid()) {
                throw new Error('TOKEN_EXPIRED');
            }

            // Validate với server 1 lần nữa
            const isValid = await window.tokenManager.validateTokenWithServer(token);
            if (!isValid) {
                throw new Error('INVALID_QR_TOKEN');
            }

            // Lấy thông tin bàn
            const tableInfo = await this.getTableInfo(tableNumber, token);

            // Kiểm tra đơn hàng hiện tại
            const orderContext = await this.getOrderContext(tableInfo.id, token);

            // Chuẩn bị dữ liệu order items
            const orderItems = this.prepareOrderItems();

            // Thực hiện đặt món
            const orderResult = await this.executeOrder(orderContext, orderItems, tableInfo, token);

            // Xử lý kết quả thành công
            await this.handleOrderSuccess(orderResult, tableNumber, orderContext.isNewOrder);

        } catch (error) {
            console.error('Error placing order:', error);
            this.handleOrderError(error);
        } finally {
            this.resetButtonState(button, originalText);
        }
    }

    // // validateAndRefreshToken không cần nữa nên bỏ


    // // Hàm kiểm tra và refresh token - CẦN SỬA ĐỔI
    // async validateAndRefreshToken() {
    //     let sessionData = {};
    //     let token = null;

    //     if (window.tokenManager) {
    //         // Lấy session data ban đầu
    //         sessionData = window.tokenManager.getSessionData();
    //         token = sessionData.token;
    //         console.log("Session Data từ TokenManager:", sessionData);

    //         // Kiểm tra và refresh token nếu cần
    //         const tokenCheck = await window.tokenManager.checkAndRefreshToken();
    //         if (tokenCheck.needNewSession) {
    //             throw new Error('TOKEN_EXPIRED');
    //         }

    //         // *** QUAN TRỌNG: Lấy lại session data SAU KHI refresh ***
    //         // Vì có thể token đã được refresh trong checkAndRefreshToken()
    //         sessionData = window.tokenManager.getSessionData();
    //         token = sessionData.token;

    //         console.log("Updated Session Data after refresh:", sessionData);
    //     }

    //     return { token: token, sessionData };
    // }

    // Hàm lấy thông tin bàn
    async getTableInfo(tableNumber, token) {
        console.log('Finding table info for table number:', tableNumber);
        console.log('Đang gọi /tables với token:', token);
        // token = localStorage.getItem('s') || token;
        const response = await fetch(`${BACKEND_BASE_URL}/tables?tableNumber=${encodeURIComponent(tableNumber)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        });

        if (!response.ok) {
            throw new Error('TABLE_FETCH_ERROR');
        }

        const data = await response.json();

        if (!data.result || data.result.length === 0) {
            throw new Error('TABLE_NOT_FOUND');
        }

        const table = data.result[0];
        console.log('Found table:', { id: table.id, number: table.tableNumber, status: table.status });

        return table;
    }

    // Hàm kiểm tra đơn hàng hiện tại
    async getOrderContext(tableId, token) {
        let existingOrder = null;
        let isNewOrder = true;

        try {
            const response = await fetch(`${BACKEND_BASE_URL}/orders/table/${tableId}/current`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                }
            });

            if (response.ok) {
                const data = await response.json();
                existingOrder = data.result;

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

        return { existingOrder, isNewOrder };
    }

    // Hàm chuẩn bị order items
    prepareOrderItems() {
        return this.cartManager.getItems().map(item => {
            // Validate item data
            if (!item.id || !item.quantity || item.quantity <= 0) {
                throw new Error(`Invalid item data: ${item.name}`);
            }

            return {
                menuItemId: item.id,
                quantity: item.quantity,
                note: item.note || '',
                status: 'PENDING'
            };
        });
    }

    // Hàm thực hiện đặt món
    async executeOrder(orderContext, orderItems, tableInfo, token) {
        const { existingOrder, isNewOrder } = orderContext;

        let response;
        let requestData;

        if (isNewOrder) {
            console.log('Creating new order...');

            requestData = {
                tableId: tableInfo.id,
                userId: null,
                orderType: 'DINE_IN',
                status: 'PENDING',
                note: '',
                orderItems: orderItems,
                ...(token && { token: token })
            };
            console.log("Dữ liệu gửi lên tạo order:", requestData);

            response = await fetch(`${BACKEND_BASE_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify(requestData)
            });
        } else {
            console.log('Adding items to existing order:', existingOrder.id);

            requestData = {
                orderItems: orderItems,
                ...(token && { token: token })
            };

            response = await fetch(`${BACKEND_BASE_URL}/orders/${existingOrder.id}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify(requestData)
            });
        }

        if (!response.ok) {
            const errorData = await this.parseErrorResponse(response);
            throw new Error(errorData.code || 'ORDER_FAILED');
        }

        const result = await response.json();
        console.log('Order operation completed successfully:', result);

        return { ...result.result, isNewOrder };
    }

    // Hàm parse error response
    async parseErrorResponse(response) {
        try {
            const errorData = await response.json();
            return {
                code: errorData.code || 'UNKNOWN_ERROR',
                message: errorData.message || 'Có lỗi xảy ra khi đặt món'
            };
        } catch (parseError) {
            return {
                code: `HTTP_${response.status}`,
                message: this.getHttpErrorMessage(response.status)
            };
        }
    }

    // Hàm xử lý thành công
    async handleOrderSuccess(orderResult, tableNumber, isNewOrder) {
        // Cập nhật session với orderId
        if (window.tokenManager && orderResult.id) {
            const sessionData = window.tokenManager.getSessionData();
            const updatedSessionData = {
                ...sessionData,
                orderId: orderResult.id,
                isReservationToken: false
            };
            window.tokenManager.saveSessionData(updatedSessionData);
        }

        // Lưu thông tin order
        this.saveOrderDetails(orderResult, tableNumber, isNewOrder);

        // Clear cart
        this.cartManager.clearCart();

        // Đóng cart modal nếu có
        if (typeof this.toggleCart === 'function') {
            this.toggleCart();
        }

        // Hiển thị thông báo thành công
        this.showNotification(
            isNewOrder ? 'Đặt món thành công!' : 'Thêm món thành công!',
            'success'
        );

        // Delay nhỏ để user thấy thông báo
        setTimeout(() => {
            const confirmationUrl = `order-confirmation.html?orderId=${orderResult.id}&tableNumber=${encodeURIComponent(tableNumber)}`;
            window.location.href = confirmationUrl;
        }, 1000);
    }

    // Hàm lưu chi tiết order
    saveOrderDetails(orderResult, tableNumber, isNewOrder) {
        try {
            if (this.cartManager.storage.isLocalStorageAvailable) {
                // localStorage.setItem('currentOrderId', orderResult.id);

                const orderDetails = {
                    ...orderResult,
                    tableNumber: tableNumber,
                    items: this.cartManager.getItems().map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                        note: item.note || ''
                    })),
                    isNewOrder: isNewOrder,
                    timestamp: new Date().toISOString()
                };

                localStorage.setItem('orderConfirmationData', JSON.stringify(orderDetails));
            }
        } catch (error) {
            console.warn('Cannot save order details:', error);
        }
    }

    // Hàm xử lý lỗi
    handleOrderError(error) {
        let userMessage = 'Có lỗi xảy ra khi đặt món';
        let shouldRedirect = false;

        // Mapping các loại lỗi
        switch (error.message) {
            case 'TOKEN_EXPIRED':
                userMessage = 'Phiên làm việc đã hết hạn. Vui lòng quét lại mã QR.';
                shouldRedirect = true;
                break;
            case 'TABLE_FETCH_ERROR':
                userMessage = 'Không thể lấy thông tin bàn. Vui lòng thử lại.';
                break;
            case 'TABLE_NOT_FOUND':
                userMessage = 'Không tìm thấy thông tin bàn.';
                break;
            case 'TABLE_NOT_EXISTED':
                userMessage = 'Bàn không tồn tại.';
                break;
            case 'TABLE_NOT_AVAILABLE':
                userMessage = 'Bàn đang được sử dụng bởi khách khác.';
                break;
            case 'MENU_ITEM_NOT_EXISTED':
                userMessage = 'Một số món ăn không tồn tại.';
                break;
            case 'MENU_ITEM_NOT_AVAILABLE':
                userMessage = 'Một số món ăn hiện không có sẵn.';
                break;
            case 'ORDER_NOT_MODIFIABLE':
                userMessage = 'Đơn hàng không thể chỉnh sửa.';
                break;
            case 'INVALID_QR_TOKEN':
                userMessage = 'Mã QR không hợp lệ hoặc đã hết hạn.';
                shouldRedirect = true;
                break;
            case 'HTTP_400':
                userMessage = 'Dữ liệu đơn hàng không hợp lệ.';
                break;
            case 'HTTP_401':
                userMessage = 'Phiên làm việc đã hết hạn.';
                shouldRedirect = true;
                break;
            case 'HTTP_403':
                userMessage = 'Không có quyền thực hiện thao tác này.';
                break;
            case 'HTTP_404':
                userMessage = 'Không tìm thấy thông tin cần thiết.';
                break;
            case 'HTTP_500':
                userMessage = 'Lỗi server nội bộ.';
                break;
            default:
                // Xử lý lỗi network
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    userMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
                } else if (error.message.includes('CORS')) {
                    userMessage = 'Lỗi kết nối. Vui lòng liên hệ quản trị viên.';
                } else if (error.message.startsWith('Invalid item data:')) {
                    userMessage = error.message;
                }
        }

        this.showNotification(userMessage, 'error');

        // if (shouldRedirect) {
        //     setTimeout(() => {
        //         window.location.href = 'index.html';
        //     }, 2000);
        // }
    }

    // Hàm utility
    getHttpErrorMessage(status) {
        const errorMessages = {
            400: 'Dữ liệu không hợp lệ',
            401: 'Phiên làm việc đã hết hạn',
            403: 'Không có quyền truy cập',
            404: 'Không tìm thấy thông tin',
            500: 'Lỗi server nội bộ',
            502: 'Lỗi kết nối server',
            503: 'Dịch vụ tạm thời không khả dụng'
        };

        return errorMessages[status] || `Lỗi HTTP: ${status}`;
    }

    // Hàm set button loading
    setButtonLoading(button, text) {
        if (button) {
            button.textContent = text;
            button.disabled = true;
            button.classList.add('loading');
        }
    }

    // Hàm reset button state
    resetButtonState(button, originalText) {
        if (button) {
            button.textContent = originalText || 'Đặt món';
            button.disabled = false;
            button.classList.remove('loading');
        }
    }

    // Hàm hiển thị thông báo
    showNotification(message, type = 'info') {
        // Nếu có notification system
        if (typeof this.showToast === 'function') {
            this.showToast(message, type);
        } else if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            // Nếu không có hệ thống thông báo, sử dụng alert
            alert(message);
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

function viewFoodDetail(foodId) {
    const tableNumber = getUrlParameter('tableNumber') || '';
    const url = `view-food-detail.html?itemId=${foodId}&tableNumber=${encodeURIComponent(tableNumber)}`;
    window.location.replace(url); // Thay thế mục lịch sử hiện tại
}

// Global functions để sử dụng trong HTML
function toggleCart() {
    cartUIManager.toggleCart();
}

function placeOrder(event) {
    cartUIManager.placeOrder(event);
}

// Thêm hàm để test giỏ hàng với dữ liệu mẫu
// function addSampleItem() {
//     const sampleItem = {
//         id: Date.now(), // Sử dụng timestamp để tránh trùng ID
//         name: 'Phở Bò',
//         price: 65000,
//         image: '',
//         category: 'Món chính'
//     };
//     cartManager.addItem(sampleItem, 1, 'Ít cay');
// }

// Debug functions (có thể xóa trong production)
function debugCart() {
    console.log('Current cart:', cartManager.getItems());
    console.log('Storage type:', cartManager.storage.isLocalStorageAvailable ? 'localStorage' : 'memory');
}

function clearDebugCart() {
    cartManager.clearCart();
    console.log('Cart cleared');
}

