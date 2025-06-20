// cartManager.js - Quản lý giỏ hàng với fallback storage

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
    }
    
    // Thêm món vào giỏ hàng
    addItem(item, quantity = 1, note = '') {
        const existingItemIndex = this.cart.findIndex(cartItem => 
            cartItem.id === item.id && cartItem.note === note
        );
        
        if (existingItemIndex !== -1) {
            this.cart[existingItemIndex].quantity += quantity;
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
        // Close modal khi click outside - SỬA LỖI TẠI ĐÂY
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
                // Thêm header với nút xóa toàn bộ - style theo giao diện hiện tại
                const cartHeader = `
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="text-muted" style="font-size: 14px;">Danh sách món đã chọn</span>
                        <button class="btn p-1" onclick="event.stopPropagation(); cartUIManager.clearAllItems()" 
                                style="background: none; border: 1px solid #dc3545; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: #dc3545;" 
                                title="Xóa toàn bộ giỏ hàng">
                            <i class="fas fa-trash-alt" style="font-size: 12px;"></i>
                        </button>
                    </div>
                `;
                
                const cartItemsHTML = items.map(item => `
                    <div class="d-flex align-items-center py-3" style="border-bottom: 1px solid #f0f0f0;">
                        <div class="flex-shrink-0 me-3">
                            <div style="width: 40px; height: 40px; background: #f8f9fa; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #6c757d;">
                                <i class="fas fa-utensils" style="font-size: 16px;"></i>
                            </div>
                        </div>
                        <div class="flex-fill">
                            <div class="fw-medium mb-1" style="font-size: 15px; color: #333;">${item.name}</div>
                            <div class="text-muted" style="font-size: 13px;">${formatPrice(item.price)}</div>
                            ${item.note ? `<div class="text-muted" style="font-size: 12px;"><i class="fas fa-sticky-note me-1"></i>${item.note}</div>` : ''}
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn p-1" onclick="event.stopPropagation(); cartUIManager.removeItem(${item.id}, '${item.note || ''}')" 
                                    style="background: none; border: 1px solid #dc3545; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: #dc3545;" 
                                    title="Xóa món này">
                                <i class="fas fa-times" style="font-size: 11px;"></i>
                            </button>
                            <div class="d-flex align-items-center">
                                <button class="btn p-1" onclick="event.stopPropagation(); cartUIManager.updateQuantity(${item.id}, -1, '${item.note || ''}')"
                                        style="background: none; border: 1px solid #ddd; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: #666;">
                                    <i class="fas fa-minus" style="font-size: 10px;"></i>
                                </button>
                                <span class="fw-medium mx-3" style="min-width: 20px; text-align: center; font-size: 15px;">${item.quantity}</span>
                                <button class="btn p-1" onclick="event.stopPropagation(); cartUIManager.updateQuantity(${item.id}, 1, '${item.note || ''}')"
                                        style="background: #ff6b35; border: 1px solid #ff6b35; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: white;">
                                    <i class="fas fa-plus" style="font-size: 10px;"></i>
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
    
    async placeOrder() {
        if (this.cartManager.isEmpty()) {
            alert('Giỏ hàng trống!');
            return;
        }
        
        const orderItems = this.cartManager.getItems().map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
            note: item.note || ''
        }));
        
        const orderData = {
            tableNumber: document.getElementById('tableNumber')?.textContent || '1',
            guestCount: parseInt(document.getElementById('guestCount')?.textContent || '1'),
            items: orderItems
        };
        
        try {
            // Simulate API call for demo
            console.log('Order data:', orderData);
            
            // Uncomment và sửa URL khi có API thật
            /*
            const response = await fetch('http://localhost:8080/foodhub/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            */
            
            alert('Đặt món thành công!');
            this.cartManager.clearCart();
            this.toggleCart();
        } catch (error) {
            console.error('Error placing order:', error);
            alert('Có lỗi xảy ra khi đặt món. Vui lòng thử lại.');
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

function placeOrder() {
    cartUIManager.placeOrder();
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