 
// ==================apifetch=====================================================
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('accessToken');
    const headers = {
        ...(options.headers || {}),
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const url = endpoint.startsWith('http') ? endpoint : API_BASE_URL + endpoint;
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        let errorMessage = 'Lỗi khi gọi API';
        try {
            const errorData = await response.text();
            errorMessage = errorData || response.statusText;
        } catch (e) {
            errorMessage = response.statusText || 'Lỗi không xác định';
        }
        throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    } else if (contentType && contentType.includes('text/plain')) {
        return await response.text(); // Trả về chuỗi cho URL
    } else if (contentType && contentType.includes('application/pdf')) {
        return await response.blob(); // Hỗ trợ file PDF nếu cần
    } else {
        throw new Error('Phản hồi từ server không được hỗ trợ');
    }
}




    // Hàm debounce
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}


  // Hiển thị thông báo lỗi
      function showError(elementId, message) {
          const errorElement = document.getElementById(elementId);
          if (errorElement) {
              errorElement.textContent = message;
              errorElement.style.display = 'block';
              
          } else {
              console.error(`Element with id "${elementId}" not found`);
          }
      }


        // Xóa tất cả thông báo lỗi và tin nhắn
      function clearMessages() {
          const elements = ['message', 'error', 'transactionsStartDateError', 'transactionsEndDateError', 'revenueStartDateError', 'revenueEndDateError'];
          elements.forEach(id => {
              const el = document.getElementById(id);
              if (el) el.textContent = '';
          });
      }


      
      // Cập nhật thời gian thực trên giao diện
      function updateTime() {
          const now = new Date();
          document.getElementById('current-time').textContent = now.toLocaleTimeString('vi-VN');
      }
      setInterval(updateTime, 1000);
      updateTime();



      function parseJwt(token) {
    console.log('parseJwt at:', new Date().toLocaleTimeString(), 'Token:', token ? token.substring(0, 20) + '...' : 'null');
    if (!token) {
        console.error('No token at:', new Date().toLocaleTimeString());
        return null;
    }
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        const payload = JSON.parse(jsonPayload);
        console.log('Parsed payload at:', new Date().toLocaleTimeString(), 'Payload:', payload);
        return payload;
    } catch (e) {
        console.error('JWT error at:', new Date().toLocaleTimeString(), 'Error:', e.message);
        return null;
    }
}

function getToken() {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
    console.log('getToken at:', new Date().toLocaleTimeString(), 'Token:', token ? token.substring(0, 20) + '...' : 'null');
    return token;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded at:', new Date().toLocaleTimeString());
    const token = getToken();
    console.log('Token retrieved at:', new Date().toLocaleTimeString(), 'Token:', token ? token.substring(0, 20) + '...' : 'null');

    if (!token) {
        console.log('No token at:', new Date().toLocaleTimeString(), 'Redirecting to access-denied');
        window.location.href = '/adminDashboard/components/access-denied.html';
        return;
    }

    const payload = parseJwt(token);
    console.log('Payload checked at:', new Date().toLocaleTimeString(), 'Payload:', payload);

    if (!payload || typeof payload !== 'object') {
        console.log('Invalid payload at:', new Date().toLocaleTimeString(), 'Redirecting to access-denied');
        window.location.href = '/adminDashboard/components/access-denied.html';
        return;
    }

    // Trích xuất roles từ scope nếu roles không tồn tại hoặc rỗng
    let roles = payload.roles || [];
    if (!Array.isArray(roles) || roles.length === 0) {
        console.log('Roles empty, extracting from scope at:', new Date().toLocaleTimeString());
        roles = payload.scope ? payload.scope.split(' ').map(role => role.trim()) : [];
    }
    console.log('Roles checked at:', new Date().toLocaleTimeString(), 'Roles:', roles);

    if (!Array.isArray(roles) || !roles.some(role => role.toLowerCase() === 'role_cashier' || role.toLowerCase() === 'cashier')) {
        console.log('No cashier role at:', new Date().toLocaleTimeString(), 'Roles:', roles, 'Redirecting to access-denied');
        window.location.href = '/adminDashboard/components/access-denied.html';
        return;
    }

    console.log('Cashier role found at:', new Date().toLocaleTimeString(), 'Roles:', roles, 'Initializing dashboard with 15s delay');
    setTimeout(() => initializeDashboard(), 15000); // Delay 15 giây để chụp ảnh
});

window.onbeforeunload = null;
window.onpopstate = null;

function initializeDashboard() {
    console.log('Initializing dashboard at:', new Date().toLocaleTimeString());
    const payload = parseJwt(getToken());
    if (payload && payload.sub) {
        document.getElementById('cashier-name').innerText = `👤 Cashier: ${payload.sub || payload.email || 'Unknown'}`;
    } else {
        console.warn('No payload/sub at:', new Date().toLocaleTimeString(), 'Using default');
        document.getElementById('cashier-name').innerText = `👤 Cashier: Unknown`;
    }
}
