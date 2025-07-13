// chat-realtime.js
class ChatManager {
    constructor(tableNumber) {
        this.tableNumber = tableNumber;
        this.stompClient = null;
        this.connected = false;
        this.messageHistory = [];
        this.unreadCount = 0;
        
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.loadChatHistory();
    }

    connectWebSocket() {
        const socket = new SockJS(`${BACKEND_BASE_URL}/ws`);
        this.stompClient = Stomp.over(socket);
        
        // Disable debug logging
        this.stompClient.debug = null;
        
        this.stompClient.connect({}, 
            (frame) => {
                console.log('Connected to WebSocket: ' + frame);
                this.connected = true;
                this.updateConnectionStatus(true);
                this.subscribeToMessages();
            },
            (error) => {
                console.error('WebSocket connection error:', error);
                this.connected = false;
                this.updateConnectionStatus(false);
                this.reconnectWebSocket();
            }
        );
    }

    reconnectWebSocket() {
        setTimeout(() => {
            console.log('Attempting to reconnect...');
            this.connectWebSocket();
        }, 5000);
    }

    subscribeToMessages() {
        if (this.stompClient && this.connected) {
            // Subscribe to messages for this table
            this.stompClient.subscribe(`/topic/chat/customer/table/${this.tableNumber}`, (message) => {
                const messageData = JSON.parse(message.body);
                this.handleIncomingMessage(messageData);
            });
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (connected) {
            statusElement.innerHTML = '<i class="fas fa-wifi me-1"></i> Đã kết nối';
            statusElement.className = 'connection-status';
            statusElement.style.display = 'block';
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 2000);
        } else {
            statusElement.innerHTML = '<i class="fas fa-wifi me-1"></i> Mất kết nối';
            statusElement.className = 'connection-status disconnected';
            statusElement.style.display = 'block';
        }
    }

    setupEventListeners() {

        // Handle window focus/blur for notification management
        window.addEventListener('focus', () => {
            this.resetNotifications();
        });
    }

    async loadChatHistory() {
    try {
        const token = localStorage.getItem("sessionToken"); // Lấy JWT token từ localStorage

        const response = await fetch(`${BACKEND_BASE_URL}/chat/messages/table/${this.tableNumber}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const messages = await response.json();
            this.messageHistory = messages;
            this.renderMessages();
        } else if (response.status === 401) {
            console.warn('❌ Unauthorized - Token có thể đã hết hạn hoặc không hợp lệ');
        } else {
            console.warn(`⚠️ Lỗi khác khi tải tin nhắn: ${response.status}`);
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}


    sendMessage(message) {
        if (!this.connected || !this.stompClient) {
            this.showError('Không thể gửi tin nhắn. Vui lòng thử lại.');
            return;
        }

        const messageData = {
            message: message,
            sender: 'CUSTOMER'
        };

        try {
            this.stompClient.send(`/app/chat/table/${this.tableNumber}`, {}, JSON.stringify(messageData));
            
            // Add message to local history immediately for better UX
            const localMessage = {
                message: message,
                sender: 'CUSTOMER',
                timestamp: new Date().toISOString(),
                tableNumber: this.tableNumber
            };
            
            this.addMessageToHistory(localMessage);
            this.renderMessages();
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Không thể gửi tin nhắn. Vui lòng thử lại.');
        }
    }

    handleIncomingMessage(messageData) {
        // Only handle messages from staff
        if (messageData.sender === 'WAITER') {
            this.addMessageToHistory(messageData);
            this.renderMessages();
            
            // Show notification if chat is closed
            const chatPopup = document.getElementById('chatPopup');
            if (chatPopup.style.display !== 'flex') {
                this.showNotification();
            }
            
        }
    }

    addMessageToHistory(message) {
        this.messageHistory.push(message);
        // Keep only last 100 messages for performance
        if (this.messageHistory.length > 100) {
            this.messageHistory.shift();
        }
    }

    renderMessages() {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '';

        if (this.messageHistory.length === 0) {
            messagesContainer.innerHTML = `
                <div class="text-center text-muted p-3">
                    <i class="fas fa-comments fa-2x mb-2"></i>
                    <p>Chưa có tin nhắn nào.<br>Hãy bắt đầu cuộc trò chuyện!</p>
                </div>
            `;
            return;
        }

        this.messageHistory.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        const isCustomer = message.sender === 'CUSTOMER';
        
        messageDiv.className = `message ${isCustomer ? 'sent' : 'received'}`;
        
        const timestamp = new Date(message.timestamp);
        const timeString = timestamp.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-avatar">
                ${isCustomer ? 'B' : 'NV'}
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    ${this.escapeHtml(message.message)}
                </div>
                <div class="message-time">${timeString}</div>
            </div>
        `;

        return messageDiv;
    }


    showNotification() {
        this.unreadCount++;
        const notification = document.getElementById('chatNotification');
        notification.textContent = this.unreadCount;
        notification.style.display = 'flex';
        
        // Play notification sound (optional)
        this.playNotificationSound();
    }

    resetNotifications() {
        this.unreadCount = 0;
        const notification = document.getElementById('chatNotification');
        notification.style.display = 'none';
    }

    playNotificationSound() {
        // Create a simple notification sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.log('Audio notification not supported');
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger alert-dismissible fade show';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
        `;
        
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public methods for external use
    disconnect() {
        if (this.stompClient && this.connected) {
            this.stompClient.disconnect();
            this.connected = false;
        }
    }

    isConnected() {
        return this.connected;
    }

    getUnreadCount() {
        return this.unreadCount;
    }

    clearHistory() {
        this.messageHistory = [];
        this.renderMessages();
    }
}

// Auto-reconnect functionality
class ChatAutoReconnect {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5 seconds
        
        this.startHeartbeat();
    }

    startHeartbeat() {
        setInterval(() => {
            if (!this.chatManager.isConnected()) {
                this.attemptReconnect();
            }
        }, 30000); // Check every 30 seconds
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        setTimeout(() => {
            this.chatManager.connectWebSocket();
        }, this.reconnectDelay * this.reconnectAttempts);
    }

    resetAttempts() {
        this.reconnectAttempts = 0;
    }
}

// Chat utilities
class ChatUtils {
    static formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);
        
        if (diffInHours < 1) {
            return 'Vừa xong';
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)} giờ trước`;
        } else {
            return date.toLocaleDateString('vi-VN');
        }
    }

    static validateMessage(message) {
        if (!message || typeof message !== 'string') {
            return false;
        }
        
        const trimmed = message.trim();
        return trimmed.length > 0 && trimmed.length <= 1000;
    }

    static sanitizeMessage(message) {
        return message.trim().replace(/\s+/g, ' ');
    }
}

// Chat storage for offline support
class ChatStorage {
    constructor(tableNumber) {
        this.tableNumber = tableNumber;
        this.storageKey = `chat_${tableNumber}`;
    }

    saveMessage(message) {
        try {
            const messages = this.getMessages();
            messages.push({
                ...message,
                id: Date.now(),
                synced: false
            });
            
            localStorage.setItem(this.storageKey, JSON.stringify(messages));
        } catch (error) {
            console.error('Error saving message to storage:', error);
        }
    }

    getMessages() {
        try {
            const messages = localStorage.getItem(this.storageKey);
            return messages ? JSON.parse(messages) : [];
        } catch (error) {
            console.error('Error loading messages from storage:', error);
            return [];
        }
    }

    clearMessages() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.error('Error clearing messages from storage:', error);
        }
    }

    getUnsynced() {
        return this.getMessages().filter(msg => !msg.synced);
    }

    markAsSynced(messageId) {
        try {
            const messages = this.getMessages();
            const message = messages.find(msg => msg.id === messageId);
            if (message) {
                message.synced = true;
                localStorage.setItem(this.storageKey, JSON.stringify(messages));
            }
        } catch (error) {
            console.error('Error marking message as synced:', error);
        }
    }
}

// Enhanced ChatManager with offline support
class EnhancedChatManager extends ChatManager {
    constructor(tableNumber) {
        super(tableNumber);
        this.storage = new ChatStorage(tableNumber);
        this.autoReconnect = new ChatAutoReconnect(this);
        this.isOnline = navigator.onLine;
        
        this.setupOfflineHandlers();
    }

    setupOfflineHandlers() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncOfflineMessages();
            this.connectWebSocket();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateConnectionStatus(false);
        });
    }

    sendMessage(message) {
        const validatedMessage = ChatUtils.sanitizeMessage(message);
        
        if (!ChatUtils.validateMessage(validatedMessage)) {
            this.showError('Tin nhắn không hợp lệ');
            return;
        }

        if (this.isOnline && this.connected) {
            super.sendMessage(validatedMessage);
        } else {
            // Save to offline storage
            const offlineMessage = {
                message: validatedMessage,
                sender: 'CUSTOMER',
                timestamp: new Date().toISOString(),
                tableNumber: this.tableNumber
            };
            
            this.storage.saveMessage(offlineMessage);
            this.addMessageToHistory(offlineMessage);
            this.renderMessages();
            
            this.showError('Tin nhắn đã được lưu. Sẽ gửi khi có kết nối.');
        }
    }

    async syncOfflineMessages() {
        const unsynced = this.storage.getUnsynced();
        
        for (const message of unsynced) {
            try {
                await this.sendStoredMessage(message);
                this.storage.markAsSynced(message.id);
            } catch (error) {
                console.error('Error syncing message:', error);
            }
        }
    }

    async sendStoredMessage(message) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.stompClient) {
                reject(new Error('Not connected'));
                return;
            }

            try {
                this.stompClient.send(`/app/chat/table/${this.tableNumber}`, {}, JSON.stringify({
                    message: message.message,
                    sender: message.sender
                }));
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Export for global use
window.ChatManager = EnhancedChatManager;
window.ChatUtils = ChatUtils;
window.ChatStorage = ChatStorage;

// Initialize chat manager when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const tableNumber = new URLSearchParams(window.location.search).get('tableNumber');
    if (tableNumber) {
        window.chatManager = new EnhancedChatManager(tableNumber);
    }
});