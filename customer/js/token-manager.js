/**
 * FoodHub Token Manager
 * Quản lý token, refresh token và clean expired tokens
 */

class TokenManager {
    constructor(apiBaseUrl = BACKEND_BASE_URL) {
        this.API_BASE_URL = apiBaseUrl;
        this.API_ENDPOINTS = {
            scanQR: '/qr/scan',
            validateToken: '/qr/validate',
            finishSession: '/qr/finish-session'
        };

    }

    // Lấy session data từ localStorage
    getSessionData() {
        try {
            return JSON.parse(localStorage.getItem('qrSession') || '{}');
        } catch (error) {
            console.error('Lỗi khi đọc session data:', error);
            return {};
        }
    }

    // Lưu session data vào localStorage
    saveSessionData(sessionData) {
        try {
            localStorage.setItem('qrSession', JSON.stringify(sessionData));
            localStorage.setItem('sessionToken', sessionData.token);
            localStorage.setItem('tableNumber', sessionData.tableNumber);
        } catch (error) {
            console.error('Lỗi khi lưu session data:', error);
        }
    }

    // Kiểm tra token có hợp lệ không (local check)
    isTokenValid() {
        const sessionData = this.getSessionData();

        if (!sessionData.token || !sessionData.expiryTime) {
            return false;
        }

        const expiryTime = new Date(sessionData.expiryTime);
        const now = new Date();

        return expiryTime.getTime() > now.getTime();
    }

    // Validate token với server
    async validateTokenWithServer(token = null) {
        const sessionData = this.getSessionData();
        const tokenToValidate = token || sessionData.token;

        if (!tokenToValidate) {
            console.warn('Không có token để validate');
            return false;
        }

        console.log('Đang validate token với server:', tokenToValidate);

        try {
            const response = await fetch(`${this.API_BASE_URL}${this.API_ENDPOINTS.validateToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: tokenToValidate })
            });

            const data = await response.json();
            console.log('Kết quả validate token:', data);

            if (!response.ok) {
                console.warn(`Server trả về lỗi HTTP ${response.status}:`, data?.message || 'Không rõ');
                return false;
            }

            // Check chắc chắn data.result là object có isValid boolean
            if (data && data.result && typeof data.result.valid === 'boolean') {
                return data.result.valid;
            } else {
                console.warn('Phản hồi từ server không đúng định dạng mong đợi');
                return false;
            }

        } catch (error) {
            console.error('Lỗi khi validate token với server:', error);
            return false;
        }
    }


    // Xóa session hết hạn
    clearExpiredSession() {
        localStorage.removeItem('qrSession');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('tableNumber');
        localStorage.removeItem('customerName');
        localStorage.removeItem('customerSession');
        localStorage.removeItem('lastTokenValidation');

        console.log('Đã xóa session hết hạn');

        // Dispatch event để các component khác biết session đã bị xóa
        window.dispatchEvent(new CustomEvent('sessionCleared'));
    }

    // Finish session (khi khách hàng rời bàn)
    async finishSession() {
        const sessionData = this.getSessionData();

        if (!sessionData.token) {
            return { success: true, message: 'No active session' };
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}${this.API_ENDPOINTS.finishSession}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: sessionData.token
                }),
                keepalive: true
            });

            const data = await response.json();

            if (response.ok) {
                this.clearExpiredSession();
                console.log('Session đã được kết thúc thành công');
                return { success: true };
            } else {
                console.error('Lỗi khi finish session:', data.message);
                return { success: false, error: data.message };
            }

        } catch (error) {
            console.error('Lỗi khi finish session:', error);
            return { success: false, error: error.message };
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Xử lý khi trang được đóng
        window.addEventListener('beforeunload', () => {
            const sessionData = this.getSessionData();

            // Chỉ finish session nếu là reservation token (chưa có order)
            if (sessionData.token && sessionData.isReservationToken) {
                this.finishSession();
            }
        });

        // Xử lý khi visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Kiểm tra token khi quay lại trang
                const sessionData = this.getSessionData();
                const expiry = new Date(sessionData.expiryTime || 0);
                const now = new Date();
                if (expiry <= now) {
                    this.clearExpiredSession();
                    window.dispatchEvent(new CustomEvent('sessionExpired', {
                        detail: { reason: 'expired' }
                    }));
                }
            }
        });
    }

    // Utility method để thêm Authorization header vào API calls
    getAuthHeaders() {
        const sessionData = this.getSessionData();
        return sessionData.token ? {
            'Authorization': `Bearer ${sessionData.token}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };
    }

    // API call wrapper với token
    async callAPI(endpoint, data = null, method = 'POST') {
        const headers = this.getAuthHeaders();

        const config = {
            method: method,
            headers: headers
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}${endpoint}`, config);

            if (response.status === 401) {
                this.clearExpiredSession();
                window.dispatchEvent(new CustomEvent('sessionExpired', {
                    detail: { reason: 'unauthorized' }
                }));
                throw new Error('Token expired or unauthorized');
            }

            return response;

        } catch (error) {
            console.error(`API call failed for ${endpoint}:`, error);
            throw error;
        }
    }

    // Clean up khi destroy
    destroy() {
        this.stopTokenMonitoring();
    }
}

// Export để sử dụng ở các trang khác
window.TokenManager = TokenManager;

// Tạo instance global
window.tokenManager = new TokenManager();

// Expose các method chính để sử dụng dễ dàng
window.FoodHubAuth = {
    isLoggedIn: () => window.tokenManager.isTokenValid(),
    getSessionData: () => window.tokenManager.getSessionData(),
    finishSession: () => window.tokenManager.finishSession(),
    callAPI: (endpoint, data, method) => window.tokenManager.callAPI(endpoint, data, method)
};
