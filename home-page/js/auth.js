// ===================== CẤU HÌNH =====================
const API_BASE_URL = 'http://localhost:8080';

// ===================== HÀM PHỤ =====================

// Phân tích JWT token
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Token không hợp lệ:", e);
        return null;
    }
}

// Kiểm tra trạng thái đăng nhập (ROLE_CUSTOMER)
function isLoggedIn() {
    const token = localStorage.getItem('accessToken');
    if (!token) return false;
    const payload = parseJwt(token);
    return payload && payload.exp * 1000 > Date.now() && payload.scope === 'ROLE_CUSTOMER';
}

// Cập nhật số lượng giỏ hàng
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) cartCountEl.textContent = count;
}

// Thêm món vào giỏ hàng
function addToCart(item) {
    if (!isLoggedIn()) {
        alert('Vui lòng đăng nhập để thêm món vào giỏ hàng!');
        window.location.href = 'login.html';
        return;
    }
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    alert('Đã thêm món vào giỏ hàng!');
}

// Đặt món -> chuyển đến trang thanh toán
function orderItem(item) {
    if (!isLoggedIn()) {
        alert('Vui lòng đăng nhập để đặt món!');
        window.location.href = 'login.html';
        return;
    }
    localStorage.setItem('orderItem', JSON.stringify(item));
    window.location.href = 'checkout.html';
}

// ===================== CẬP NHẬT UI NAVBAR =====================
function updateUI() {
    const token = localStorage.getItem('accessToken');
    const payload = token ? parseJwt(token) : null;

    const authNavItem = document.getElementById('auth-nav-item');
    const userNavItem = document.getElementById('user-nav-item');
    const cartNavItem = document.getElementById('cart-nav-item');
    const usernameDisplay = document.getElementById('username-display');
    const welcomeMessage = document.getElementById('welcome-message'); // optional
    const usernameGreeting = document.getElementById('username-greeting'); // optional
    const navbar = document.getElementById('navbar');

    // Ẩn hết các thành phần liên quan trước
    if (authNavItem) authNavItem.style.display = 'none';
    if (userNavItem) userNavItem.style.display = 'none';
    if (cartNavItem) cartNavItem.style.display = 'none';
    if (welcomeMessage) welcomeMessage.style.display = 'none';

    // Kiểm tra trạng thái đăng nhập
    const isCustomer =
        payload &&
        payload.exp * 1000 > Date.now() &&
        payload.scope === 'ROLE_CUSTOMER';

    if (isCustomer) {
        const email = payload.sub || 'Customer';

        if (userNavItem) userNavItem.style.display = 'block';
        if (cartNavItem) cartNavItem.style.display = 'block';
        if (usernameDisplay) usernameDisplay.textContent = email;
        if (usernameGreeting) usernameGreeting.textContent = email;
        if (welcomeMessage) welcomeMessage.style.display = 'block';

        updateCartCount();
    } else {
        if (authNavItem) authNavItem.style.display = 'block';
    }

    // Sau cùng, hiện navbar để tránh "nháy"
    if (navbar) {
        navbar.classList.remove('invisible', 'opacity-0');
        navbar.classList.add('opacity-100', 'visible');
    }
}

// ===================== ĐĂNG XUẤT =====================
function logout() {
    localStorage.removeItem('accessToken');
    window.location.href = 'login.html';
}

// ===================== CHẠY SAU KHI DOM LOAD =====================
document.addEventListener('DOMContentLoaded', function () {
    updateUI();
});
