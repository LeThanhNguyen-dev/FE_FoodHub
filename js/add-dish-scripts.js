const apiMenuUrl = '/foodhub/menu-items';
const apiCategoryUrl = '/foodhub/categories';
let selectedImageBase64 = null;

function fetchCategories() {
    axios.get(apiCategoryUrl)
        .then(response => {
            if (response.data.code === 1000) {
                const select = document.getElementById('dishCategories');
                const categories = response.data.result || [];
                select.innerHTML = '';
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
            const errorMessage = error.response?.data?.message || 'Không thể tải danh mục do lỗi kết nối!';
            showNotification(errorMessage, 'error');
        });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
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
            showNotification('Đã chọn ảnh mới!', 'success');
        } catch (error) {
            console.error('Lỗi khi xử lý ảnh:', error);
            showNotification('Không thể xử lý ảnh. Vui lòng thử lại!', 'error');
        }
    } else {
        selectedImageBase64 = null;
        document.getElementById('imagePreview').style.display = 'none';
    }
});

document.getElementById('addDishForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const name = document.getElementById('dishName').value.trim();
    const price = parseFloat(document.getElementById('dishPrice').value);
    const description = document.getElementById('dishDescription').value.trim();
    const categoryIds = Array.from(document.getElementById('dishCategories').selectedOptions).map(opt => parseInt(opt.value));

    document.getElementById('nameError').style.display = 'none';
    document.getElementById('priceError').style.display = 'none';

    let isValid = true;
    if (!name) {
        document.getElementById('nameError').style.display = 'block';
        isValid = false;
    }
    if (name.length < 2) {
        showNotification('Tên món ăn phải có ít nhất 2 ký tự!', 'error');
        isValid = false;
    }
    if (!price || price <= 1000) {
        document.getElementById('priceError').style.display = 'block';
        isValid = false;
    }
    if (categoryIds.length === 0) {
        showNotification('Vui lòng chọn ít nhất một danh mục!', 'error');
        isValid = false;
    }

    if (!isValid) return;

    const payload = {
        name: name,
        description: description || null,
        price: price,
        imageUrl: selectedImageBase64,
        categoryIds: categoryIds
    };

    console.log('Sending JSON payload:', payload);

    axios.post(apiMenuUrl, payload, {
        headers: { 'Content-Type': 'application/json' }
    }).then(response => {
        if (response.data.code === 1000) {
            showNotification(response.data.message, 'success');
            document.getElementById('addDishForm').reset();
            document.getElementById('imagePreview').style.display = 'none';
            selectedImageBase64 = null;
            setTimeout(() => window.location.href = '/foodhub/menu-manager/menu.html', 1500);
        } else {
            showNotification(response.data.message, 'error');
        }
    }).catch(error => {
        console.error('Error details:', error.response?.data);
        const errorMessage = error.response?.data?.message || 'Không thể tạo món ăn. Vui lòng thử lại!';
        showNotification(errorMessage, 'error');
    });
});

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

fetchCategories();