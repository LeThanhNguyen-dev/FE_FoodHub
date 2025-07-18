
const BACKEND_BASE_URL = "http://localhost:8080";

async function RefreshToken() {
    const oldToken = localStorage.getItem("accessToken");


    try {
        const response = await fetch(`${BACKEND_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ token: oldToken })
        });

        const data = await response.json();

        if (data.code === 0 && data.result.authenticated) {
            localStorage.setItem("accessToken", data.result.token);
            console.log("✅ Refresh token thành công");
            return true;
        } else {
            console.error("❌ Lỗi khi làm mới token:", data.message);
            redirectToLogin();
            return false;
        }
    } catch (error) {
        redirectToLogin();
        return false;
    }
}


function redirectToLogin() {
    localStorage.removeItem("accessToken");
    window.location.href = "/home-page/html/login.html";
}

async function apiFetch(endpoint, options = {}) {
    const url = `${BACKEND_BASE_URL}${endpoint}`;
    const fetchWithToken = async () => {
        const latestToken = localStorage.getItem("accessToken");
        return await fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                'Content-Type': 'application/json',
                ...(latestToken ? { 'Authorization': `Bearer ${latestToken}` } : {})
            }
        });
    };

    try {
        let response = await fetchWithToken();
        const contentType = response.headers.get('Content-Type') || '';

        // Xử lý 401 Unauthorized
        if (response.status === 401) {
            console.warn("⚠️ Access token hết hạn. Đang thử làm mới token...");
            const refreshed = await RefreshToken();
            if (refreshed) {
                // Thử lại request với token mới
                response = await fetchWithToken();
            } else {
                // Nếu refresh thất bại, dừng luôn không tiếp tục
                throw new Error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
            }
        }

        // Xử lý 403 Forbidden (không có quyền)
        if (response.status === 403) {
            console.warn("⚠️ Access Denied - Chuyển hướng về trang login");
            redirectToLogin();
            throw new Error("Bạn không có quyền truy cập. Vui lòng đăng nhập lại.");
        }

        // Xử lý DELETE request
        if (options.method === 'DELETE' && (response.status === 200 || response.status === 204)) {
            return { code: 1000, message: 'Xóa thành công' };
        }

        if (!response.ok) {
            if (contentType.includes('application/json')) {
                const errorData = await response.json();

                // Kiểm tra lỗi Access Denied hoặc phân quyền
                if (errorData.code === 9999 &&
                    (errorData.message.includes("Access Denied") ||
                        errorData.message.includes("Uncategorized error : Access Denied"))) {
                    console.warn("Access Denied - Chuyển hướng về trang login");
                    redirectToLogin();
                    throw new Error("Bạn không có quyền truy cập. Vui lòng đăng nhập lại.");
                }

                const error = new Error(errorData.message || `Lỗi HTTP ${response.status}`);
                if (errorData.code) {
                    error.code = errorData.code; // Gắn mã lỗi từ backend
                }
                throw error;
            } else {
                const errorText = await response.text();
                throw new Error(`Lỗi server (${response.status}): ${errorText}`);
            }
        }

        if (contentType.includes('application/json')) {
            return await response.json();
        } else if (contentType.includes('text/html') || contentType.includes('text/plain')) {
            return await response.text();
        } else {
            throw new Error('Phản hồi không được hỗ trợ: ' + contentType);
        }

    } catch (error) {
        // Bắt lỗi network/fetch và các lỗi khác
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.error("Lỗi kết nối mạng:", error);
            window.location.href = "/home-page/html/login.html";
            throw new Error("Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.");
        }

        // Re-throw các lỗi khác để component xử lý
        throw error;
    }
}

// Hàm kiểm tra token còn hạn không
function isTokenValid() {
    const token = localStorage.getItem("accessToken");
    if (!token) return false;

    try {
        // Decode JWT token để kiểm tra exp
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        return payload.exp > currentTime;
    } catch (error) {
        console.error("Lỗi khi decode token:", error);
        return false;
    }
}

// Hàm logout
async function handleLogout() {
    const accessToken = localStorage.getItem("accessToken");
    const response = await fetch(`${BACKEND_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ token: accessToken })
    });

    const data = await response.json();
    if (data.code === 0) {
        redirectToLogin();
    }
}