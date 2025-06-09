const BACKEND_BASE_URL = "http://localhost:8080";
function getContextPath() {
    const path = window.location.pathname;
    const firstSlashIndex = path.indexOf("/", 1);
    return firstSlashIndex !== -1 ? path.substring(0, firstSlashIndex) : "";
}

async function RefreshToken() {
    const oldToken = localStorage.getItem("accessToken");
    const contextPath = getContextPath();

    try {
        const response = await fetch(`${contextPath}/auth/refresh`, {
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
            window.location.href = `${contextPath}/login.html`;
            return false;
        }
    } catch (error) {
        console.error("❌ Lỗi khi gọi refresh token:", error);
        window.location.href = `${contextPath}/login.html`;
        return false;
    }
}

async function apiFetch(endpoint, options = {}) {
    const contextPath = getContextPath();
    const url = `${BACKEND_BASE_URL}${endpoint}`;

    const fetchWithToken = async () => {
        const latestToken = localStorage.getItem("accessToken"); // lấy lại token mới nhất ✅
        return await fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                'Content-Type': 'application/json',
                ...(latestToken ? { 'Authorization': `Bearer ${latestToken}` } : {})
            }
        });
    };

    let response = await fetchWithToken();
    const contentType = response.headers.get('Content-Type') || '';

    if (response.status === 401) {
        console.warn("⚠️ Access token hết hạn. Đang thử làm mới token...");
        const refreshed = await RefreshToken();
        if (refreshed) {
            response = await fetchWithToken();
        } else {
            throw new Error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
        }
    }

    if (!response.ok) {
        if (contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Lỗi không xác định');
        } else {
            const errorText = await response.text();
            throw new Error('Lỗi server: ' + errorText);
        }
    }

    if (contentType.includes('application/json')) {
        return await response.json();
    } else if (contentType.includes('text/html') || contentType.includes('text/plain')) {
        return await response.text(); // Return text for HTML or plain text
    } else {
        throw new Error('Phản hồi không được hỗ trợ: ' + contentType);
    }
}
