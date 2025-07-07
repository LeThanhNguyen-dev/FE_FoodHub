
//====================================================================================
// Hàm hiển thị thông báo chung
function showNotification(elementId, message, duration = 3000) {
    const notification = document.getElementById(elementId);
    if (!notification) return;

    // Đặt nội dung (nếu có)
    if (message) {
        notification.textContent = message;
    }

    // Hiển thị và thêm class show
    notification.style.display = 'block';
    notification.classList.remove('hide');
    notification.classList.add('show');

    // Ẩn sau thời gian chỉ định
    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hide');
        setTimeout(() => {
            notification.style.display = 'none';
            notification.classList.remove('hide'); // Xóa class hide để chuẩn bị cho lần hiển thị sau
        }, 400); // Thời gian chờ để hoàn thành hiệu ứng trượt ra
    }, duration);
}
//====================================================================================

// Hàm hiển thị thông báo thành công thanh toán
function showSuccessNotification() {
    showNotification('successNotification', '✅ Thanh toán đơn hàng thành công!');
}
//====================================================================================

// Hàm hiển thị thông báo hủy đơn thành công
function showDeleteSuccessNotification() {
    showNotification('deleteSuccessNotification', '✅ Hủy đơn thành công!');
}


//====================================================================================


// cho transaction
// Hàm hiển thị thông báo và cập nhật giao diện
function showNotificationAndUpdate(message, order) {
    const notificationContainer = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notificationContainer.appendChild(notification);

    // Hiệu ứng trượt
    setTimeout(() => notification.classList.add('show'), 10); // Đợi DOM cập nhật
    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 400); // Xóa sau khi trượt ra
    }, 5000); // Ẩn sau 5 giây

    // Cập nhật bảng giao dịch
    updateTransactionTable(order);
}
//====================================================================================
