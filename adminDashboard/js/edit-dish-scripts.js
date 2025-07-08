const apiMenuUrl = '/foodhub/menu-items';
const apiCategoryUrl = '/foodhub/categories';
let selectedImageBase64 = null;
let formDataToSubmit = null;
let originalDishData = null;
let categoriesData = [];

const urlParams = new URLSearchParams(window.location.search);
const dishId = urlParams.get('id');

if (!dishId) {
    showNotification('Không tìm thấy ID món ăn!', 'error');
    setTimeout(() => window.location.href = '/foodhub/menu-manager/menu.html', 1500);
} else {
    initializePage();
}

async function initializePage() {
    try {
        showLoading();
        await fetchCategories();
        await fetchDishDetails();
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Lỗi khởi tạo trang:', error);
        showNotification('Có lỗi xảy ra khi tải trang!', 'error');
    }
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function fetchCategories() {
    return new Promise((resolve, reject) => {
        axios.get(apiCategoryUrl)
            .then(response => {
                if (response.data.code === 1000) {
                    const select = document.getElementById('dishCategories');
                    categoriesData = response.data.result || [];
                    select.innerHTML = '';
                    categoriesData.forEach(cat => {
                        const option = document.createElement('option');
                        option.value = cat.id;
                        option.textContent = cat.name;
                        select.appendChild(option);
                    });
                    resolve();
                } else {
                    showNotification(response.data.message || 'Không thể tải danh mục!', 'error');
                    reject(new Error(response.data.message));
                }
            })
            .catch(error => {
                console.error('Lỗi khi tải danh mục:', error);
                const errorMessage = error.response?.data?.message || 'Không thể tải danh mục do lỗi kết nối!';
                showNotification(errorMessage, 'error');
                reject(error);
            });
    });
}


function fetchDishDetails() {
    return new Promise((resolve, reject) => {
        axios.get(`${apiMenuUrl}/${dishId}`)
            .then(response => {
                if (response.data.code === 1000) {
                    const dish = response.data.result;
                    originalDishData = { ...dish };
                    populateForm(dish);
                    displayCurrentInfo(dish);
                    resolve(dish);
                } else {
                    showNotification(response.data.message || 'Không thể tải thông tin món ăn!', 'error');
                    setTimeout(() => window.location.href = '/foodhub/menu-manager/menu.html', 1500);
                    reject(new Error(response.data.message));
                }
            })
            .catch(error => {
                console.error('Lỗi khi tải thông tin món ăn:', error);
                const errorMessage = error.response?.data?.message || 'Không thể tải thông tin món ăn do lỗi kết nối!';
                showNotification(errorMessage, 'error');
                setTimeout(() => window.location.href = '/foodhub/menu-manager/menu.html', 1500);
                reject(error);
            });
    });
}

function populateForm(dish) {
    console.log('Điền dữ liệu vào form:', dish);

    document.getElementById('dishId').value = dish.id || '';
    document.getElementById('dishName').value = dish.name || '';
    document.getElementById('dishPrice').value = dish.price || '';
    document.getElementById('dishDescription').value = dish.description || '';

    if (dish.imageUrl) {
        selectedImageBase64 = dish.imageUrl;
        const imagePreview = document.getElementById('imagePreview');
        imagePreview.src = dish.imageUrl;
        imagePreview.style.display = 'block';
        document.getElementById('currentImageInfo').style.display = 'block';
    }

    const select = document.getElementById('dishCategories');
    const categoryIds = dish.categoryIds || [];
    Array.from(select.options).forEach(option => {
        const optionValue = parseInt(option.value);
        option.selected = categoryIds.includes(optionValue);
    });
}

function displayCurrentInfo(dish) {
    const categoryNames = dish.categoryIds ?
        dish.categoryIds.map(id => {
            const cat = categoriesData.find(c => c.id === id);
            return cat ? cat.name : 'Unknown';
        }).join(', ') : 'Chưa phân loại';

    const infoHtml = `
        <div class="row">
            <div class="col-md-6">
                <strong>Tên:</strong> ${dish.name || 'Chưa có tên'}<br>
                <strong>Giá:</strong> ${dish.price ? Number(dish.price).toLocaleString() + ' VND' : 'Chưa có giá'}
            </div>
            <div class="col-md-6">
                <strong>Danh mục:</strong> ${categoryNames}<br>
                <strong>Trạng thái:</strong> ${dish.status === 'AVAILABLE' ? 'Có sẵn' : 'Không có sẵn'}
            </div>
        </div>
        ${dish.description ? `<div class="mt-2"><strong>Mô tả:</strong> ${dish.description}</div>` : ''}
    `;

    document.getElementById('currentInfoDisplay').innerHTML = infoHtml;
    document.getElementById('currentInfoCard').style.display = 'block';
}

function resetForm() {
    if (originalDishData) {
        populateForm(originalDishData);
        clearErrors();
        showNotification('Đã khôi phục dữ liệu gốc!', 'info');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function clearErrors() {
    // Xóa lỗi và màu đỏ của label
    document.getElementById('nameError').style.display = 'none';
    document.getElementById('nameError').textContent = '';
    document.querySelector('label[for="dishName"]').classList.remove('error');

    document.getElementById('priceError').style.display = 'none';
    document.getElementById('priceError').textContent = '';
    document.querySelector('label[for="dishPrice"]').classList.remove('error');

    document.getElementById('categoryError').style.display = 'none';
    document.getElementById('categoryError').textContent = '';
    document.querySelector('label[for="dishCategories"]').classList.remove('error');
}

document.getElementById('dishImage').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (file) {
        try {
            if (file.size > 5 * 1024 * 1024) {
                showNotification('Kích thước ảnh không được vượt quá 5MB!', 'error');
                this.value = '';
                return;
            }
            selectedImageBase64 = await fileToBase64(file);
            document.getElementById('imagePreview').src = selectedImageBase64;
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('currentImageInfo').style.display = 'none';
            showNotification('Đã chọn ảnh mới!', 'success');
        } catch (error) {
            console.error('Lỗi khi xử lý ảnh:', error);
            showNotification('Không thể xử lý ảnh. Vui lòng thử lại!', 'error');
        }
    }
});

document.getElementById('editDishForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // Xóa lỗi cũ
    clearErrors();

    const name = document.getElementById('dishName').value.trim();
    const price = parseFloat(document.getElementById('dishPrice').value);
    const description = document.getElementById('dishDescription').value.trim();
    const categoryIds = Array.from(document.getElementById('dishCategories').selectedOptions).map(opt => parseInt(opt.value));

    // Xác thực phía client
    let isValid = true;
    if (!name) {
        document.getElementById('nameError').style.display = 'block';
        document.getElementById('nameError').textContent = 'Tên món ăn không được để trống!';
        document.querySelector('label[for="dishName"]').classList.add('error');
        showNotification('Tên món ăn không được để trống!', 'error');
        isValid = false;
    }
    if (name.length < 2) {
        document.getElementById('nameError').style.display = 'block';
        document.getElementById('nameError').textContent = 'Tên món ăn phải có ít nhất 2 ký tự!';
        document.querySelector('label[for="dishName"]').classList.add('error');
        showNotification('Tên món ăn phải có ít nhất 2 ký tự!', 'error');
        isValid = false;
    }
    if (!price || price <= 0) {
        document.getElementById('priceError').style.display = 'block';
        document.getElementById('priceError').textContent = 'Giá phải lớn hơn 0!';
        document.querySelector('label[for="dishPrice"]').classList.add('error');
        showNotification('Giá phải lớn hơn 0!', 'error');
        isValid = false;
    }
    if (categoryIds.length === 0) {
        document.getElementById('categoryError').style.display = 'block';
        document.getElementById('categoryError').textContent = 'Vui lòng chọn ít nhất một danh mục!';
        document.querySelector('label[for="dishCategories"]').classList.add('error');
        showNotification('Vui lòng chọn ít nhất một danh mục!', 'error');
        isValid = false;
    }

    if (!isValid) return;

    formDataToSubmit = {
        name: name,
        description: description || null,
        price: price,
        imageUrl: selectedImageBase64,
        categoryIds: categoryIds
    };

    document.getElementById('confirmModal').style.display = 'flex';
});

document.getElementById('confirmSaveBtn').addEventListener('click', function() {
    closeModal();

    this.disabled = true;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    axios.put(`${apiMenuUrl}/${dishId}`, formDataToSubmit, {
        headers: { 'Content-Type': 'application/json' }
    }).then(response => {
        if (response.data.code === 1000) {
            showNotification(response.data.message || 'Cập nhật món ăn thành công!', 'success');
            setTimeout(() => window.location.href = '/foodhub/menu-manager/menu.html', 1500);
        } else {
            showNotification(response.data.message || 'Có lỗi xảy ra khi cập nhật!', 'error');
        }
    }).catch(error => {
        console.error('Error details:', error.response?.data);
        const responseData = error.response?.data;

        // Xử lý lỗi xác thực từ backend (code 1005)
        if (responseData?.code === 1005 && responseData.result) {
            const errors = responseData.result;
            if (errors.name) {
                document.getElementById('nameError').style.display = 'block';
                document.getElementById('nameError').textContent = errors.name;
                document.querySelector('label[for="dishName"]').classList.add('error');
                showNotification(errors.name, 'error');
            }
            if (errors.price) {
                document.getElementById('priceError').style.display = 'block';
                document.getElementById('priceError').textContent = errors.price;
                document.querySelector('label[for="dishPrice"]').classList.add('error');
                showNotification(errors.price, 'error');
            }
        } else {
            const errorMessage = responseData?.message || 'Không thể cập nhật món ăn. Vui lòng thử lại!';
            showNotification(errorMessage, 'error');
        }
    }).finally(() => {
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-check"></i> Xác nhận';
    });
});

function closeModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification-enter alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}