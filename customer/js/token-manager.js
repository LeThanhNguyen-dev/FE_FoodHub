/**
 * FoodHub Token Manager
 * Quản lý token, refresh token và clean expired tokens
 */

class TokenManager {
    constructor(apiBaseUrl = this.API_BASE_URL) {
        this.API_BASE_URL = apiBaseUrl;
        this.API_ENDPOINTS = {
            scanQR: '/qr/scan',
            validateToken: '/qr/validate',
            refreshToken: '/qr/refresh-token',
            finishSession: '/qr/finish-session'
        };
        
        // Bắt đầu monitoring token
        this.startTokenMonitoring();
        this.setupEventListeners();
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
            return false;
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}${this.API_ENDPOINTS.validateToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: tokenToValidate
                })
            });

            const data = await response.json();
            return response.ok && data.result && data.result.isValid;

        } catch (error) {
            console.error('Lỗi khi validate token với server:', error);
            return false;
        }
    }

    // Refresh token
    async refreshToken() {
        const sessionData = this.getSessionData();
        
        if (!sessionData.token) {
            console.warn('Không có token để refresh');
            return { success: false, error: 'No token to refresh' };
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}${this.API_ENDPOINTS.refreshToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: sessionData.token
                })
            });

            const data = await response.json();

            if (response.ok && data.result) {
                // Cập nhật session data với token mới
                const updatedSessionData = {
                    ...sessionData,
                    token: data.result.newToken,
                    expiryTime: data.result.expiryTime,
                    lastRefresh: new Date().toISOString()
                };
                
                this.saveSessionData(updatedSessionData);
                
                console.log('Token đã được refresh thành công');
                return { success: true, newToken: data.result.newToken };
            } else {
                console.error('Lỗi refresh token:', data.message);
                return { success: false, error: data.message };
            }

        } catch (error) {
            console.error('Lỗi khi refresh token:', error);
            return { success: false, error: error.message };
        }
    }

    // Kiểm tra và tự động refresh token nếu cần
    async checkAndRefreshToken() {
        const sessionData = this.getSessionData();
        
        if (!sessionData.token || !sessionData.expiryTime) {
            return { success: false, needNewSession: true };
        }

        const expiryTime = new Date(sessionData.expiryTime);
        const now = new Date();
        const timeUntilExpiry = expiryTime.getTime() - now.getTime();
        
        // Token đã hết hạn
        if (timeUntilExpiry <= 0) {
            console.warn('Token đã hết hạn');
            this.clearExpiredSession();
            return { success: false, expired: true, needNewSession: true };
        }
        
        // Refresh token nếu còn ít hơn 5 phút (300000ms)
        if (timeUntilExpiry < 300000) {
            console.log('Token sắp hết hạn, đang refresh...');
            const refreshResult = await this.refreshToken();
            
            if (!refreshResult.success) {
                this.clearExpiredSession();
                return { success: false, refreshFailed: true, needNewSession: true };
            }
            
            return { success: true, refreshed: true };
        }
        
        return { success: true };
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

    // Bắt đầu theo dõi token
    startTokenMonitoring() {
        // Kiểm tra token mỗi 2 phút
        this.tokenCheckInterval = setInterval(async () => {
            const sessionData = this.getSessionData();
            
            if (sessionData.token) {
                const checkResult = await this.checkAndRefreshToken();
                
                if (checkResult.needNewSession) {
                    // Dispatch event để thông báo cần session mới
                    window.dispatchEvent(new CustomEvent('sessionExpired', {
                        detail: { reason: checkResult.expired ? 'expired' : 'refresh_failed' }
                    }));
                }
                
                // Validate với server mỗi 10 phút
                const lastValidation = localStorage.getItem('lastTokenValidation');
                const now = Date.now();
                
                if (!lastValidation || (now - parseInt(lastValidation)) > 600000) {
                    const isValidServer = await this.validateTokenWithServer();
                    
                    if (!isValidServer) {
                        console.warn('Token không hợp lệ trên server');
                        this.clearExpiredSession();
                        window.dispatchEvent(new CustomEvent('sessionExpired', {
                            detail: { reason: 'server_invalid' }
                        }));
                    } else {
                        localStorage.setItem('lastTokenValidation', now.toString());
                    }
                }
            }
        }, 120000); // 2 phút
    }

    // Dừng theo dõi token
    stopTokenMonitoring() {
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
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
                this.checkAndRefreshToken();
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
            
            // Nếu token không hợp lệ, thử refresh
            if (response.status === 401) {
                const refreshResult = await this.checkAndRefreshToken();
                
                if (refreshResult.success) {
                    // Retry với token mới
                    config.headers = this.getAuthHeaders();
                    return await fetch(`${this.API_BASE_URL}${endpoint}`, config);
                } else {
                    throw new Error('Token expired and refresh failed');
                }
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
    refreshToken: () => window.tokenManager.refreshToken(),
    finishSession: () => window.tokenManager.finishSession(),
    callAPI: (endpoint, data, method) => window.tokenManager.callAPI(endpoint, data, method)
};