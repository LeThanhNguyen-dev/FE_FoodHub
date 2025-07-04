
// Khởi tạo
const messageElement = document.getElementById('message');
const orderSection = document.getElementById('order-section');
const tableInfo = document.getElementById('table-info');

// Hiển thị thông báo
function showMessage(message) {
    messageElement.textContent = message;
}

// Xử lý quét QR từ URL
function handleQRCodeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const qrCode = params.get('code');
    if (qrCode) {
        scanQRCode(qrCode);
    } else {
        showMessage('Không tìm thấy mã QR trong URL. Vui lòng quét lại mã QR.');
    }
}

// Gọi API quét QR
async function scanQRCode(qrCode) {
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/qr/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qrCode })
        });
        const { result, error } = await response.json();
        if (error) {
            showMessage(error.message || 'Không thể quét mã QR, vui lòng thử lại.');
            return;
        }
        if (result) {
            localStorage.setItem('tableToken', result.token);
            localStorage.setItem('tokenExpiry', result.expiryTime);
            localStorage.setItem('tableNumber', result.tableNumber);
            if (result.orderId) {
                localStorage.setItem('orderId', result.orderId.toString());
            }
            tableInfo.textContent = `Bàn: ${result.tableNumber}` + (result.orderId ? `, Đơn hàng: #${result.orderId}` : '');
            orderSection.style.display = 'block';
            // Kiểm tra orderId để xác định bàn RESERVED
            if (!result.orderId) {
                showMessage('Vui lòng đặt món trong 10 phút để giữ bàn.');
                setTimeout(async () => {
                    const orderId = localStorage.getItem('orderId');
                    if (!orderId) {
                        await finishSession();
                        showMessage('Bàn đã được giải phóng do không đặt món.');
                    }
                }, 10 * 60 * 1000); // 10 phút
            }
        }
    } catch (err) {
        showMessage('Không thể quét mã QR: ' + err.message);
    }
}

// Kiểm tra token hợp lệ
async function validateToken() {
    const token = localStorage.getItem('tableToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    if (!token || new Date(tokenExpiry) < new Date()) {
        showMessage('Token hết hạn, vui lòng quét lại mã QR.');
        return false;
    }
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/qr/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const { result, error } = await response.json();
        if (error || !result.isValid) {
            showMessage(error?.message || 'Token không hợp lệ, vui lòng quét lại mã QR.');
            return false;
        }
        return true;
    } catch (err) {
        showMessage('Không thể kiểm tra token: ' + err.message);
        return false;
    }
}

// Đặt món hoặc thêm món
async function placeOrder() {
    if (!(await validateToken())) return;

    const token = localStorage.getItem('tableToken');
    const tableNumber = localStorage.getItem('tableNumber');
    const orderId = localStorage.getItem('orderId');
    const itemName = document.getElementById('item-name').value;
    const itemQuantity = parseInt(document.getElementById('item-quantity').value);

    if (!itemName || !itemQuantity) {
        showMessage('Vui lòng nhập tên món và số lượng.');
        return;
    }

    const url = orderId ? `${BACKEND_BASE_URL}/order/${orderId}/items` : `${BACKEND_BASE_URL}/order`;
    const body = orderId
        ? { tokenId: token, orderItems: [{ menuItemId: 1, quantity: itemQuantity }] } // Giả định menuItemId
        : { tokenId: token, tableId: parseInt(tableNumber), orderItems: [{ menuItemId: 1, quantity: itemQuantity }], orderType: 'DINE_IN' };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const { result, error } = await response.json();
        if (error) {
            showMessage(error.message || 'Không thể đặt món, vui lòng thử lại.');
            return;
        }
        if (!orderId) {
            localStorage.setItem('orderId', result.orderId.toString());
            tableInfo.textContent = `Bàn: ${tableNumber}, Đơn hàng: #${result.orderId}`;
        }
        showMessage(orderId ? 'Đã thêm món!' : 'Đơn hàng đã được tạo!');
    } catch (err) {
        showMessage('Không thể đặt món: ' + err.message);
    }
}

// Kết thúc phiên
async function finishSession() {
    const token = localStorage.getItem('tableToken');
    if (!token) {
        showMessage('Không tìm thấy token.');
        return;
    }
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/qr/finish-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const { error } = await response.json();
        if (error) {
            showMessage(error.message || 'Không thể kết thúc phiên.');
            return;
        }
        localStorage.removeItem('tableToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('tableNumber');
        localStorage.removeItem('orderId');
        showMessage('Đã kết thúc phiên.');
        orderSection.style.display = 'none';
    } catch (err) {
        showMessage('Không thể kết thúc phiên: ' + err.message);
    }
}

// Gia hạn token
function startTokenRefresh() {
    setInterval(async () => {
        const token = localStorage.getItem('tableToken');
        const tokenExpiry = localStorage.getItem('tokenExpiry');
        if (token && tokenExpiry) {
            const timeLeft = new Date(tokenExpiry) - new Date();
            if (timeLeft < 5 * 60 * 1000) { // Còn dưới 5 phút
                try {
                    const response = await fetch(`${BACKEND_BASE_URL}/qr/refresh-token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token })
                    });
                    const { result, error } = await response.json();
                    if (error) {
                        showMessage('Không thể gia hạn token: ' + error.message);
                        return;
                    }
                    localStorage.setItem('tableToken', result.token);
                    localStorage.setItem('tokenExpiry', result.expiryTime);
                    showMessage('Token đã được gia hạn.');
                } catch (err) {
                    showMessage('Không thể gia hạn token: ' + err.message);
                }
            }
        }
    }, 60 * 1000); // Kiểm tra mỗi phút
}

// Khởi động: Xử lý QR từ URL
handleQRCodeFromURL();
startTokenRefresh();
