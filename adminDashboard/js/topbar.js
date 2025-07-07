async function loadTopbar() {
    try {
        const response = await fetch('/adminDashboard/components/topbar.html');
        if (!response.ok) throw new Error('Không thể tải topbar');
        const topbarHtml = await response.text();
        document.getElementById('topbar-container').innerHTML = topbarHtml;
        setTopbarTitle();
        
        // Lấy thông tin user sau khi load topbar
        await loadUserInfo();
        
        // Khởi tạo dropdown sau khi topbar được tải
        const dropdownElement = document.getElementById('adminDropdown');
        if (dropdownElement && typeof bootstrap !== 'undefined') {
            new bootstrap.Dropdown(dropdownElement);
        }
    } catch (error) {
        console.error('Lỗi khi tải topbar:', error);
        showNotification('Lỗi tải topbar!', 'error');
        document.getElementById('topbar-container').innerHTML = '<p>Lỗi khi tải topbar!</p>';
    }
}

// Hàm mới để lấy thông tin user
async function loadUserInfo() {
    try {
        // Sử dụng apiFetch thay vì fetch trực tiếp
        const response = await apiFetch('/users/my-info', {
            method: 'GET'
        });

        console.log('Response data:', response);

        // Kiểm tra role của user
        if (response.result && response.result.roleName && response.result.roleName.name) {
            const roleName = response.result.roleName.name.toUpperCase();
            
            // Nếu role không phải ADMIN, chuyển hướng về trang thông báo lỗi
            if (roleName !== 'ADMIN') {
                console.log('Access denied: User is not admin, role:', roleName);
                setTimeout(() => window.location.href = '/adminDashboard/components/access-denied.html', 1000);
                return;
            }
        } else {
            // Nếu không có thông tin role, cũng chuyển về trang thông báo lỗi
            console.log('Access denied: No role information found');
            setTimeout(() => window.location.href = '/adminDashboard/components/access-denied.html', 1000);
            return;
        }

        // Nếu là admin, hiển thị thông tin user
        const userNameElement = document.getElementById('user-name');
        if (userNameElement && response.result) {
            const displayName = response.result.username || response.result.email || 'Admin';
            userNameElement.textContent = displayName;
        }
        
    } catch (error) {
        console.error('Lỗi khi lấy thông tin user:', error);
        
        // Chuyển hướng đến trang access-denied chỉ khi lỗi không được xử lý bởi apiFetch
        console.log('Access denied: Error occurred during authentication');
        setTimeout(() => window.location.href = '/adminDashboard/components/access-denied.html', 1000);
    }
}

// Hàm bổ sung để kiểm tra quyền truy cập cho các trang khác
function checkAdminAccess() {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!token) {
        window.location.href = '/adminDashboard/components/access-denied.html';
        return false;
    }   
    return true;
}

// Hàm để kiểm tra quyền truy cập với API
async function validateAdminAccess() {
    try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        if (!token) {
            window.location.href = '/adminDashboard/components/access-denied.html';
            return false;
        }

        const response = await fetch('http://localhost:8080/users/my-info', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Token validation failed');
        }

        const data = await response.json();
        
        if (data.result && data.result.roleName && data.result.roleName.name) {
            const roleName = data.result.roleName.name.toUpperCase();
            if (roleName !== 'ADMIN') {
                window.location.href = '/adminDashboard/components/access-denied.html';
                return false;
            }
            return true;
        } else {
            window.location.href = '/adminDashboard/components/access-denied.html';
            return false;
        }
    } catch (error) {
        console.error('Error validating admin access:', error);
        window.location.href = '/adminDashboard/components/access-denied.html';
        return false;
    }
}

// Các hàm khác giữ nguyên...
function setTopbarTitle() {
    const currentPath = window.location.pathname.toLowerCase();
    let title = 'FoodHub Admin';
    
    if (currentPath.includes('staff-manager/stafflist.html')) {
        title = 'Danh sách nhân viên';
    } else if (currentPath.includes('customer-manager/customerlist.html')) {
        title = 'Danh sách khách hàng';
    } else if (currentPath.includes('menu-manager/menu.html')) {
        title = 'Quản lý món ăn';
    } else if (currentPath.includes('revenue-report/revenue-report.html')) {
        title = 'Quản lý tài chính';
    } else if (currentPath.includes('revenue-report/order.html')) {
        title = 'Đơn hàng';
    } else if (currentPath.includes('revenue-report/transaction.html')) {
        title = 'Giao dịch';
    } else if (currentPath.includes('schedule/lichlam.html')) {
        title = 'Lịch làm việc';
    } else if (currentPath.includes('admindashboard/admindashboard.html')) {
        title = 'Bảng điều khiển';
    }
    
    const titleElement = document.getElementById('topbar-title');
    if (titleElement) {
        titleElement.textContent = title;
    }
}

async function viewProfile() {
    try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        if (!token) {
            showNotification('Vui lòng đăng nhập để xem hồ sơ!', 'error');
            return;
        }

        const response = await fetch('http://localhost:8080/users/my-info', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Không thể tải thông tin hồ sơ');
        }

        const data = await response.json();
        
        if (data.code === 0 && data.result) {
            showProfileModal(data.result);
        } else {
            throw new Error('Không thể lấy thông tin hồ sơ');
        }
    } catch (error) {
        console.error('Lỗi khi xem hồ sơ:', error);
        showNotification('Có lỗi xảy ra khi tải thông tin hồ sơ!', 'error');
    }
}

function showProfileModal(userInfo) {
    const modalHtml = `
        <div class="modal fade" id="profileModal" tabindex="-1" aria-labelledby="profileModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content" style="background-color: #F1F8FF;">
                    <div class="modal-header" style="background-color: #FEA116; color: white;">
                        <h5 class="modal-title" id="profileModalLabel">
                            <i class="fas fa-user-circle me-2"></i>Thông tin hồ sơ
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-4 text-center mb-4">
                                <div class="profile-avatar">
                                    <i class="fas fa-user-circle" style="color: #FEA116; font-size: 120px;"></i>
                                </div>
                                <h5 class="mt-3" style="color: #FEA116;">${userInfo.username}</h5>
                                <span class="badge bg-success">${userInfo.roleName.name}</span>
                            </div>
                            <div class="col-md-8">
                                <div class="row mb-3">
                                    <div class="col-sm-4 fw-bold">Tên đăng nhập:</div>
                                    <div class="col-sm-8">${userInfo.username}</div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-sm-4 fw-bold">Email:</div>
                                    <div class="col-sm-8">${userInfo.email}</div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-sm-4 fw-bold">Số điện thoại:</div>
                                    <div class="col-sm-8">${userInfo.phone || 'Chưa cập nhật'}</div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-sm-4 fw-bold">Địa chỉ:</div>
                                    <div class="col-sm-8">${userInfo.address || 'Chưa cập nhật'}</div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-sm-4 fw-bold">Vai trò:</div>
                                    <div class="col-sm-8">
                                        <span class="badge bg-success">${userInfo.roleName.name}</span>
                                        <small class="text-muted d-block">${userInfo.roleName.description}</small>
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-sm-4 fw-bold">Trạng thái:</div>
                                    <div class="col-sm-8">
                                        <span class="badge ${userInfo.status === 'ACTIVE' ? 'bg-success' : 'bg-danger'}">
                                            ${userInfo.status === 'ACTIVE' ? 'Hoạt động' : 'Không hoạt động'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times me-2"></i>Đóng
                        </button>
                        <button type="button" class="btn" style="background-color: #FEA116; color: white;" onclick="editProfile()">
                            <i class="fas fa-edit me-2"></i>Chỉnh sửa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('profileModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('profileModal'));
    modal.show();

    document.getElementById('profileModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}




async function editProfile() {
    try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        if (!token) {
            showNotification('Vui lòng đăng nhập để chỉnh sửa hồ sơ!', 'error');
            return;
        }

        // Lấy thông tin user hiện tại để có ID
        const response = await fetch('http://localhost:8080/users/my-info', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Không thể lấy thông tin user');
        }

        const data = await response.json();
        
        if (data.code === 0 && data.result && data.result.id) {
            // Đóng modal hiện tại
            const modal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
            if (modal) {
                modal.hide();
            }
            
            // Chuyển hướng đến trang chỉnh sửa profile với ID
            window.location.href = `/adminDashboard/components/edit-profile.html?id=${data.result.id}`;
        } else {
            throw new Error('Không tìm thấy ID người dùng');
        }
    } catch (error) {
        console.error('Lỗi khi chỉnh sửa hồ sơ:', error);
        showNotification('Có lỗi xảy ra khi chuyển đến trang chỉnh sửa!', 'error');
    }
}

function handleLogout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        localStorage.removeItem('accessToken');
        sessionStorage.removeItem('accessToken');
        
        window.location.href = '/home-page/html/login.html';
    }
}

// Thêm hàm để kiểm tra quyền truy cập khi tải trang
document.addEventListener('DOMContentLoaded', function() {
    // Kiểm tra quyền truy cập ngay khi trang được tải
    if (window.location.pathname.includes('adminDashboard') || 
        window.location.pathname.includes('admin')) {
        checkAdminAccess();
    }
});