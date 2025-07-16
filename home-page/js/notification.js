let stompClient = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let orders = [];

// Hàm hiển thị thông báo dưới dạng popup
function showNotification(message) {
    const modal = new bootstrap.Modal(document.getElementById('notificationModal'));
    const modalBody = document.getElementById('notificationModalBody');
    modalBody.innerHTML = message;

    modal.show();

    // Tự động đóng sau 5 giây
    setTimeout(() => {
        modal.hide();
    }, 5000);
}

// Hàm lấy danh sách đơn hàng
async function fetchUserOrders() {
    if (!isLoggedIn()) {
        console.log("Chưa đăng nhập, bỏ qua fetchUserOrders");
        return;
    }

    try {
        const token = localStorage.getItem('accessToken');
        const payload = parseJwt(token);
        const userId = payload.id;
        if (!userId) throw new Error("Không tìm thấy userId trong JWT payload");

        console.log('Đang lấy đơn hàng cho user ID:', userId);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(`${API_BASE_URL}/orders/user/${userId}?page=0&size=10&orderBy=createdAt`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMessage = 'Lỗi khi lấy đơn hàng';
            try {
                const error = await response.json();
                errorMessage = error.message || errorMessage;
            } catch (e) {}
            console.error(`Lỗi API: ${response.status} - ${errorMessage}`);
            if (response.status === 401) {
                console.error('Phiên hết hạn. Vui lòng đăng nhập lại.');
                showNotification('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
                logout();
            }
            return;
        }

        const data = await response.json();
        orders = data.result.content || [];
        console.log("Đã lấy được", orders.length, "đơn hàng:", orders);
    } catch (error) {
        console.error('Lỗi khi lấy đơn hàng:', error.message);
        if (error.name === 'AbortError') {
            showNotification('Không thể lấy dữ liệu đơn hàng: Máy chủ không phản hồi trong thời gian quy định.');
        } else if (error.message.includes('Failed to fetch')) {
            showNotification('Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối mạng.');
        }
    }
}

// Hàm polling dự phòng
function startPolling() {
    const pollingInterval = setInterval(async () => {
        if (!isLoggedIn()) {
            clearInterval(pollingInterval);
            return;
        }
        try {
            const token = localStorage.getItem('accessToken');
            const payload = parseJwt(token);
            const userId = payload.id;
            const response = await fetch(`${API_BASE_URL}/orders/user/${userId}?page=0&size=10&orderBy=createdAt`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                console.error('Lỗi khi polling:', await response.text());
                return;
            }
            const data = await response.json();
            const newOrders = data.result.content || [];
            console.log('Danh sách đơn hàng mới từ polling:', newOrders);
            newOrders.forEach(newOrder => {
                const existingOrder = orders.find(o => o.id === newOrder.id);
                if (!existingOrder || existingOrder.status !== newOrder.status) {
                    orders = orders.map(o => o.id === newOrder.id ? newOrder : o);
                    showNotification(`Đơn hàng #${newOrder.id} đã được cập nhật: ${newOrder.status} <a href="ordertrack.html?orderId=${newOrder.id}" class="text-primary ms-2">Xem</a>`);
                }
            });
        } catch (error) {
            console.error('Lỗi khi polling:', error);
        }
    }, 15000);
}

// Hàm khởi tạo WebSocket
function initializeWebSocket() {
    if (!isLoggedIn()) {
        console.log("Chưa đăng nhập, bỏ qua khởi tạo WebSocket");
        return;
    }

    const token = localStorage.getItem('accessToken');
    const payload = parseJwt(token);
    const userId = payload.id;
    if (!userId) {
        console.error('Phiên người dùng không hợp lệ.');
        showNotification('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
        logout();
        return;
    }

    const socket = new SockJS(`${API_BASE_URL}/ws`);
    stompClient = Stomp.over(socket);

    stompClient.connect(
        { Authorization: `Bearer ${token}` },
        () => {
            console.log('WebSocket đã kết nối, đang đăng ký với /topic/orders/' + userId);
            stompClient.subscribe(`/topic/orders/${userId}`, (message) => {
                console.log('Nhận được thông điệp WebSocket:', message.body);
                try {
                    const data = JSON.parse(message.body);
                    console.log('Dữ liệu phân tích:', data);
                    if (data.id && data.status) {
                        showNotification(`Đơn hàng #${data.id} đã được cập nhật: ${data.status} <a href="ordertrack.html?orderId=${data.id}" class="text-primary ms-2">Xem</a>`);
                    } else {
                        console.warn('Thiếu id hoặc status trong thông điệp:', data);
                    }
                } catch (error) {
                    console.error('Lỗi khi xử lý thông điệp WebSocket:', error);
                }
            });
        },
        (error) => {
            console.error('Lỗi WebSocket:', error);
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`Đang thử kết nối lại WebSocket, lần ${reconnectAttempts}/${maxReconnectAttempts}`);
                setTimeout(initializeWebSocket, 5000);
            } else {
                console.error('Không thể kết nối WebSocket sau nhiều lần thử');
                showNotification('Không thể kết nối với cập nhật thời gian thực. Đang sử dụng phương pháp dự phòng.');
                startPolling();
            }
        }
    );
}