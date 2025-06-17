// API base URL (thay đổi để khớp với backend của bạn)
const API_BASE_URL = 'http://localhost:8080';

// Hàm phân tích JWT token
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Token không hợp lệ:", e);
        return null;
    }
}

// Hàm kiểm tra trạng thái đăng nhập với ROLE_CUSTOMER
function isLoggedIn() {
    const token = localStorage.getItem('accessToken');
    if (!token) return false;
    const payload = parseJwt(token);
    return payload && payload.exp && payload.exp * 1000 > Date.now() && payload.scope === 'ROLE_CUSTOMER';
}

// Hàm cập nhật số lượng giỏ hàng
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartCount = cart.reduce((total, item) => total + (item.quantity || 1), 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = cartCount;
    }
}

// Hàm thêm món vào giỏ hàng
function addToCart(item) {
    if (!isLoggedIn()) {
        alert('Vui lòng đăng nhập để thêm món vào giỏ hàng!');
        window.location.href = 'login.html';
        return;
    }
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    alert('Đã thêm món vào giỏ hàng!');
}

// Hàm đặt món (chuyển hướng đến thanh toán)
function orderItem(item) {
    if (!isLoggedIn()) {
        alert('Vui lòng đăng nhập để đặt món!');
        window.location.href = 'login.html';
        return;
    }
    localStorage.setItem('orderItem', JSON.stringify(item));
    window.location.href = 'checkout.html';
}

// Hàm cập nhật giao diện dựa trên trạng thái đăng nhập
function updateUI() {
    const token = localStorage.getItem('accessToken');
    const authNavItem = document.getElementById('auth-nav-item');
    const userNavItem = document.getElementById('user-nav-item');
    const cartNavItem = document.getElementById('cart-nav-item');
    const usernameDisplay = document.getElementById('username-display');
    const welcomeMessage = document.getElementById('welcome-message');
    const usernameGreeting = document.getElementById('username-greeting');

    if (!authNavItem || !userNavItem || !cartNavItem) return;

    // Đặt opacity ban đầu để tránh nhấp nháy
    authNavItem.style.opacity = '0';
    userNavItem.style.opacity = '0';
    cartNavItem.style.opacity = '0';
    if (welcomeMessage) welcomeMessage.style.opacity = '0';

    if (!token) {
        authNavItem.style.opacity = '1';
        authNavItem.classList.remove('d-none');
        userNavItem.classList.add('d-none');
        cartNavItem.classList.add('d-none');
        if (welcomeMessage) welcomeMessage.classList.add('d-none');
    } else {
        const payload = parseJwt(token);
        if (!payload || !payload.exp || payload.exp * 1000 < Date.now() || payload.scope !== 'ROLE_CUSTOMER') {
            localStorage.removeItem('accessToken');
            authNavItem.style.opacity = '1';
            authNavItem.classList.remove('d-none');
            userNavItem.classList.add('d-none');
            cartNavItem.classList.add('d-none');
            if (welcomeMessage) welcomeMessage.classList.add('d-none');
        } else {
            const email = payload.sub || 'Customer';
            authNavItem.classList.add('d-none');
            userNavItem.style.opacity = '1';
            userNavItem.classList.remove('d-none');
            cartNavItem.style.opacity = '1';
            cartNavItem.classList.remove('d-none');
            if (welcomeMessage) {
                welcomeMessage.style.opacity = '1';
                welcomeMessage.classList.remove('d-none');
            }
            if (usernameDisplay) usernameDisplay.textContent = email;
            if (usernameGreeting) usernameGreeting.textContent = email;
            updateCartCount();
        }
    }
}

// Hàm đăng xuất
function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('cart');
    window.location.href = 'login.html';
}

// Chạy updateUI ngay lập tức
updateUI();