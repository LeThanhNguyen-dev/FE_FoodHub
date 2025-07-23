
//====================================================================================
// Hàm hiển thị thông báo chung
// Trong notification.js
// notification.js
function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.error('Notification container not found!');
        return;
    }

    console.log(`Showing notification: ${message}, type: ${type}`); // Log để debug

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    requestAnimationFrame(() => {
        console.log('Adding show-from-right class');
        notification.classList.add('show-from-right');
    });

    setTimeout(() => {
        console.log('Removing show-from-right, adding hide-to-left');
        notification.classList.remove('show-from-right');
        notification.classList.add('hide-to-left');
        setTimeout(() => {
            console.log('Removing notification element');
            notification.remove();
        }, 400);
    }, duration);
}

// function showNoScheduleNotification() {
//     showNotification('Bạn không có lịch làm việc hôm nay. Vui lòng liên hệ quản lý.', 'no-schedule');
// }

function showCheckInRequiredNotification() {
    showNotification('Vui lòng check-in trước!', 'check-in-required');
}

function showSuccessNotification() {
    showNotification('✅ Thanh toán đơn hàng thành công!', 'success');
}

function showDeleteSuccessNotification() {
    showNotification('✅ Hủy đơn thành công!', 'success');
}

function showCheckinNotification() {
    showNotification('✅ Check-in thành công!', 'success');
}

function showCheckoutNotification() {
    showNotification('✅ Check-out thành công!', 'success');
}

// function showNoScheduleNotification() {
//     showNotification('Bạn không có lịch làm việc hôm nay. Vui lòng liên hệ quản lý.', 'no-schedule');
// }

function showCheckInRequiredNotification() {
    showNotification('Vui lòng check-in trước!', 'check-in-required');
}


//====================================================================================

// Hàm hiển thị thông báo thành công thanh toán
function showSuccessNotification() {
    showNotification('✅ Thanh toán đơn hàng thành công!');
}
//====================================================================================

// Hàm hiển thị thông báo hủy đơn thành công
function showDeleteSuccessNotification() {
    showNotification('✅ Hủy đơn thành công!');
}



// Hàm hiển thị thông báo thành công thanh toán
function showCheckinNotification() {
    showNotification('✅ Check - in thành công!');
}



// Hàm hiển thị thông báo thành công thanh toán
function showCheckoutNotification() {
    showNotification('✅ Check - out thành công!');
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
//====================================================================================
// Hàm hiển thị thông báo khi không có lịch làm việc
// function showNoScheduleNotification() {
//     const container = document.getElementById('notification-container');
//     if (!container) {
//         console.error('Notification container not found!');
//         return;
//     }

//     const notification = document.createElement('div');
//     notification.className = 'notification info';
//     notification.textContent = 'Bạn không có lịch làm việc hôm nay. Vui lòng liên hệ quản lý.';
//     container.appendChild(notification);

//     requestAnimationFrame(() => {
//         notification.classList.add('show-from-right');
//     });

//     setTimeout(() => {
//         notification.classList.remove('show-from-right');
//         notification.classList.add('hide-to-left');
//         setTimeout(() => notification.remove(), 400);
//     }, 5000); // Hiển thị trong 5 giây
// }

// Hàm hiển thị thông báo khi chưa check-in
function showCheckInRequiredNotification() {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.error('Notification container not found!');
        return;
    }

    const notification = document.createElement('div');
    notification.className = 'notification check-in-required';
    notification.textContent = 'Vui lòng check-in trước!';
    container.appendChild(notification);

    requestAnimationFrame(() => {
        notification.classList.add('show-from-right');
    });

    setTimeout(() => {
        notification.classList.remove('show-from-right');
        notification.classList.add('hide-to-left');
        setTimeout(() => notification.remove(), 400);
    }, 5000); // Hiển thị trong 5 giây
}

// Thêm biến toàn cục để kiểm soát thời gian thông báo
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 3000; // 3 giây để ngăn lặp thông báo

// Hàm kiểm tra trạng thái check-in, chỉ hiển thị thông báo khi được yêu cầu
function checkAndNotifyIfNotCheckedIn(showNotification = false) {
    console.log('Checking check-in status. currentShiftLog:', currentShiftLog);
    if (hasWorkSchedule && (!currentShiftLog || !currentShiftLog.checkInTime)) {
        if (showNotification) {
            const now = Date.now();
            if (now - lastNotificationTime >= NOTIFICATION_COOLDOWN) {
                showCheckInRequiredNotification();
                lastNotificationTime = now;
            }
        }
        return true; // Ngăn hành động tiếp theo
    }
    return false;
}
