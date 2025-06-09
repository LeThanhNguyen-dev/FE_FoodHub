const apiMenuUrl = '/foodhub/menu-items';
const apiCategoryUrl = '/foodhub/categories';
let currentPage = 0;
const pageSize = 10;

// Hiển thị loading
function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('menuTableBody').innerHTML = '';
}

// Ẩn loading
function showError() {
    document.getElementById('menuTableBody').innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-4">
                <i class="fas fa-exclamation-triangle text-warning fa-2x mb-2"></i>
                <div>Có lỗi xảy ra khi tải dữ liệu</div>
            </td>
        </tr>
    `;
}

// Hiển thị thông báo
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show notification`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Ẩn loading
function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

// Tải danh mục
function fetchCategories() {
    axios.get(apiCategoryUrl)
        .then(response => {
            if (response.data.code === 1000) {
                const select = document.getElementById('categoryId');
                const categories = response.data.result || [];
                select.innerHTML = '<option value="">Tất cả</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name;
                    select.appendChild(option);
                });
            } else {
                showNotification(response.data.message || 'Không thể tải danh mục!', 'error');
            }
        })
        .catch(error => {
            console.error('Lỗi khi tải danh mục:', error);
            const errorMessage = error.response?.data?.message || 'Không thể tải danh mục do lỗi kết nối hoặc cấu hình!';
            showNotification(errorMessage, 'error');
        });
}

// Tải danh sách món ăn
function fetchMenuItems() {
    showLoading();

    const categoryId = document.getElementById('categoryId').value;
    const sortValue = document.getElementById('sortBy').value;
    const keyword = document.getElementById('keyword').value.trim();

    let sortBy = null;
    let sortDirection = 'asc';
    if (sortValue) {
        const parts = sortValue.split('_');
        sortBy = parts[0];
        sortDirection = parts[1] || 'asc';
    }

    const params = {
        page: currentPage,
        size: pageSize
    };

    if (categoryId) {
        params.categoryId = categoryId;
    }

    if (sortBy) {
        params.sortBy = sortBy;
        params.sortDirection = sortDirection;
    }

    if (keyword) {
        params.keyword = keyword;
    }

    axios.get(apiMenuUrl, { params })
        .then(response => {
            hideLoading();
            if (response.data.code === 1000) {
                renderMenuTable(response.data.result.content);
                renderPagination(response.data.result.totalPages, response.data.result.number);
            } else {
                showNotification(response.data.message, 'error');
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Lỗi khi tải dữ liệu:', error);
            const errorMessage = error.response?.data?.message || 'Có lỗi xảy ra khi tải dữ liệu!';
            showNotification(errorMessage, 'error');
            showError();
        });
}

// Hiển thị bảng món ăn
function renderMenuTable(items) {
    const tbody = document.getElementById('menuTableBody');

    if (items.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        tbody.innerHTML = '';
        return;
    }

    document.getElementById('emptyState').style.display = 'none';
    tbody.innerHTML = '';

    items.forEach(item => {
        const isAvailable = item.status === 'AVAILABLE';
        const statusClass = isAvailable ? 'status-available' : 'status-unavailable';
        const statusText = isAvailable ? 'Available' : 'Unavailable';
        const actionButton = isAvailable
            ? `<button class="btn btn-outline-danger btn-sm" onclick="deleteItem(${item.id})" title="Xóa">
                 <i class="fas fa-trash"></i>
               </button>`
            : `<button class="btn btn-outline-success btn-sm" onclick="restoreItem(${item.id})" title="Khôi phục">
                 <i class="fas fa-undo"></i>
               </button>`;

        const row = `
            <tr>
                 <td>
                        ${item.imageUrl
            ? `<img src="${item.imageUrl}" class="menu-image" alt="${item.name}" onerror="this.outerHTML='<div class=&quot;menu-image bg-light d-flex align-items-center justify-content-center&quot;><i class=&quot;fas fa-image text-muted&quot;></i></div>';">`
            : `<div class="menu-image bg-light d-flex align-items-center justify-content-center">
                                 <i class="fas fa-image text-muted"></i>
                               </div>`
        }
                    </td>
                
                <td>
                    <div class="fw-bold">${item.name}</div>
                </td>
                <td>
                    <div class="text-muted" style="max-width: 200px;">
                        ${item.description || 'Không có mô tả'}
                    </div>
                </td>
                <td>
                    <span class="price-text">${Number(item.price).toLocaleString()} VND</span>
                </td>
                <td>
                    <div style="max-width: 150px;">
                        ${item.categoryNames ? item.categoryNames.join(', ') : 'Chưa phân loại'}
                    </div>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="editItem(${item.id})" title="Chỉnh sửa">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${actionButton}
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Phân trang
function renderPagination(totalPages, currentPageIndex) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    const prevDisabled = currentPageIndex === 0 ? 'disabled' : '';
    pagination.innerHTML += `
        <li class="page-item ${prevDisabled}">
            <a class="page-link" href="#" onclick="changePage(${currentPage  - 1})">
                <i class="fas fa-chevron-left"></i>
            </a>
        </li>`;

    const startPage = Math.max(0, currentPageIndex - 2);
    const endPage = Math.min(totalPages - 1, currentPageIndex + 2);

    if (startPage > 0) {
        pagination.innerHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(0)">1</a>
            </li>`;
        if (startPage > 1) {
            pagination.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const active = currentPageIndex === i ? 'active' : '';
        pagination.innerHTML += `
            <li class="page-item ${active}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i + 1}</a>
            </li>`;
    }

    if (endPage < totalPages - 1) {
        if (endPage < totalPages - 2) {
            pagination.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
        pagination.innerHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(${totalPages - 1})">${totalPages}</a>
            </li>`;
    }

    const nextDisabled = currentPageIndex === totalPages - 1 ? 'disabled' : '';
    pagination.innerHTML += `
        <li class="page-item ${nextDisabled}">
            <a class="page-link" href="#" onclick="changePage(${currentPageIndex + 1})">
                <i class="fas fa-chevron-right"></i>
            </a>
        </li>`;
}

// Thay đổi trang
function changePage(page) {
    if (page < 0) return;
    currentPage = page;
    fetchMenuItems();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Chỉnh sửa món ăn
function editItem(id) {
    window.location.href = `/foodhub/menu-manager/edit-dish.html?id=${id}`;
}

// Xóa món ăn
function deleteItem(id) {
    if (confirm('Bạn có chắc chắn muốn xóa món ăn này?\n(Món ăn sẽ chuyển sang trạng thái UNAVAILABLE)')) {
        const deleteButton = document.querySelector(`button[onclick="deleteItem(${id})"]`);
        const originalText = deleteButton.innerHTML;
        deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        deleteButton.disabled = true;

        axios.delete(`${apiMenuUrl}/${id}`)
            .then(response => {
                if (response.data.code === 1000) {
                    showNotification(response.data.message, 'success');
                    fetchMenuItems();
                } else {
                    showNotification(response.data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error deleting item:', error);
                const errorMessage = error.response?.data?.message || 'Không thể xóa món ăn. Vui lòng thử lại!';
                showNotification(errorMessage, 'error');
            })
            .finally(() => {
                deleteButton.innerHTML = originalText;
                deleteButton.disabled = false;
            });
    }
}

// Khôi phục món ăn
function restoreItem(id) {
    if (confirm('Bạn có chắc chắn muốn khôi phục món ăn này?\n(Món ăn sẽ chuyển sang trạng thái AVAILABLE)')) {
        const restoreButton = document.querySelector(`button[onclick="restoreItem(${id})"]`);
        const originalText = restoreButton.innerHTML;
        restoreButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        restoreButton.disabled = true;

        axios.put(`${apiMenuUrl}/${id}/restore`)
            .then(response => {
                if (response.data.code === 1000) {
                    showNotification(response.data.message, 'success');
                    fetchMenuItems();
                } else {
                    showNotification(response.data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error restoring item:', error);
                const errorMessage = error.response?.data?.message || 'Không thể khôi phục món ăn. Vui lòng thử lại!';
                showNotification(errorMessage, 'error');
            })
            .finally(() => {
                restoreButton.innerHTML = originalText;
                restoreButton.disabled = false;
            });
    }
}

// Event listeners
document.getElementById('filterForm').addEventListener('submit', e => {
    e.preventDefault();
    currentPage = 0;
    fetchMenuItems();
});

// Khởi tạo
fetchCategories();
fetchMenuItems();