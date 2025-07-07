let messageDropdownOpen = false;
let tablesData = [];
let currentChatTable = null;
let chatNotifications = []; // Array to store chat notifications

// API call function
async function fetchTables() {
    try {
        console.log('Calling fetchTables...');
        const data = await apiFetch(`/tables?area=${currentWorkSchedule.area}`, {
            method: 'GET',
        });
        console.log('Raw API response:', data);
        return data;
    } catch (error) {
        console.error('Error fetching tables:', error);
        throw error;
    }
}

// New function to fetch chat messages for a specific table
async function fetchChatMessages(tableNumber) {
    try {
        console.log(`Fetching chat messages for table ${tableNumber}...`);
        const data = await apiFetch(`/chat/messages/table/${tableNumber}`, {
            method: 'GET',
        });
        console.log('Chat messages response:', data);
        return data;
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        throw error;
    }
}

function renderTables(response) {
    console.log('renderTables received:', response);
    const messageList = document.getElementById('messageList');

    // Kiểm tra nếu response là null hoặc undefined
    if (!response) {
        console.error('Response is null or undefined');
        messageList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-table"></i>
                <div>Không có dữ liệu</div>
            </div>
        `;
        return;
    }

    // Dựa vào generateTableOptions, API trả về data.result
    let tables = [];
    
    if (response.result && Array.isArray(response.result)) {
        tables = response.result;
    } else {
        console.error('Invalid response format - expected data.result array:', response);
        messageList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-table"></i>
                <div>Dữ liệu không đúng định dạng</div>
            </div>
        `;
        return;
    }


    if (tables.length === 0) {
        messageList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-table"></i>
                <div>Không có bàn nào</div>
            </div>
        `;
        return;
    }

    const tableItems = tables.map(table => {
        // Check if table has unread messages
        const hasUnreadMessages = chatNotifications.some(n => 
            n.tableNumber === table.tableNumber && !n.read
        );
        
        // Get latest message for this table
        const latestMessage = getLatestMessageForTable(table.tableNumber);
        
        const unreadClass = hasUnreadMessages ? 'has-unread' : '';
        const unreadBadge = hasUnreadMessages ? 
            `<span class="unread-badge">${getUnreadCountForTable(table.tableNumber)}</span>` : '';
        
        return `
            <div class="table-item ${unreadClass}" onclick="openChatPopup(${table.id || table.tableNumber})">
                <div class="table-info">
                    <div class="table-header">
                        <div class="table-number">Bàn ${table.tableNumber}</div>
                        ${unreadBadge}
                    </div>
                    <div class="table-status">
                        <i class="fas fa-comments"></i>
                        <span>${latestMessage ? latestMessage.message : 'Nhấn để chat'}</span>
                    </div>
                    ${latestMessage ? `<div class="last-message-time">${formatMessageTime(latestMessage.timestamp)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    messageList.innerHTML = tableItems;
}


function showLoading() {
    const messageList = document.getElementById('messageList');
    messageList.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <div>Đang tải danh sách bàn...</div>
        </div>
    `;
}

function showError(message) {
    const messageList = document.getElementById('messageList');
    messageList.innerHTML = `
        <div class="error">
            <i class="fas fa-exclamation-triangle"></i>
            <div>${message}</div>
            <button onclick="loadTables()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Thử lại
            </button>
        </div>
    `;
}

async function loadTables() {
    console.log('Loading tables...');
    showLoading();

    try {
        const response = await fetchTables();
        console.log('API response:', response);
        
        // Lưu toàn bộ response để debug
        tablesData = response;
        renderTables(response);

        // Update message count - based on unread chat notifications
        updateChatNotificationCount();

    } catch (error) {
        console.error('Load tables error:', error);
        showError('Không thể tải danh sách bàn. Vui lòng thử lại.');
    }
}


function selectTableChat(tableId) {
    console.log('Selected table ID:', tableId);
    
    // Tìm table trong dữ liệu đã lưu
    let selectedTable = null;
    
    if (tablesData.result && Array.isArray(tablesData.result)) {
        selectedTable = tablesData.result.find(t => 
            t.id === tableId || t.tableNumber === tableId
        );
    }
    
    if (selectedTable) {
        console.log('Selected table:', selectedTable);
        alert(`Đã chọn Bàn ${selectedTable.tableNumber}`);
        hideMessageDropdown();
    } else {
        console.error('Table not found:', tableId);
    }
}


// New function to open chat popup
async function openChatPopup(tableId) {
    console.log('Opening chat for table ID:', tableId);
    
    // Tìm table trong dữ liệu đã lưu
    let selectedTable = null;
    
    if (tablesData.result && Array.isArray(tablesData.result)) {
        selectedTable = tablesData.result.find(t => 
            t.id === tableId || t.tableNumber === tableId
        );
    }
    
    if (selectedTable) {
        currentChatTable = selectedTable;
        
        // Mark notifications as read for this table
        markChatNotificationAsRead(selectedTable.tableNumber);
        
        await showChatPopup(selectedTable);
        hideMessageDropdown();
    } else {
        console.error('Table not found:', tableId);
    }
}


async function showChatPopup(table) {
    // Remove existing popup if any
    const existingPopup = document.getElementById('chatPopup');
    if (existingPopup) {
        existingPopup.remove();
    }

    // Create popup HTML
    const popupHTML = `
        <div class="chat-popup-overlay" id="chatPopup" onclick="closeChatPopup(event)">
            <div class="chat-popup" onclick="event.stopPropagation()">
                <div class="chat-header">
                    <h4>Chat với Bàn ${table.tableNumber}</h4>
                    <button class="close-btn" onclick="closeChatPopup()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="chat-messages" id="chatMessages">
                    <div class="loading-messages">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Đang tải tin nhắn...</span>
                    </div>
                </div>
                <div class="chat-input-container">
                    <input type="text" id="chatInput" placeholder="Nhập tin nhắn..." onkeypress="handleChatKeyPress(event)">
                    <button onclick="sendMessage()" class="send-btn">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add popup to body
    document.body.insertAdjacentHTML('beforeend', popupHTML);

    // Load chat messages for this table
    await loadChatMessages(table.tableNumber);

    // Focus on input
    setTimeout(() => {
        document.getElementById('chatInput').focus();
    }, 100);
}

// New function to load chat messages
async function loadChatMessages(tableNumber) {
    const chatMessages = document.getElementById('chatMessages');
    
    try {
        const messages = await fetchChatMessages(tableNumber);
        
        // Clear loading message
        chatMessages.innerHTML = '';
        
        // Check if messages exist
        if (messages && messages.length > 0) {
            // Sort messages by timestamp
            messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Display each message
            messages.forEach(msg => {
                const messageType = msg.sender === currentWorkSchedule.role ? 'sent' : 'received';
                displayChatMessage(msg.message, messageType, msg.timestamp);
            });
        } else {
            // Show welcome message if no previous messages
            chatMessages.innerHTML = `
                <div class="welcome-message">
                    <p>Chào mừng! Bạn đang chat với Bàn ${tableNumber}</p>
                </div>
            `;
        }
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
    } catch (error) {
        console.error('Error loading chat messages:', error);
        chatMessages.innerHTML = `
            <div class="error-message">
                <p>Không thể tải tin nhắn cũ</p>
                <div class="welcome-message">
                    <p>Chào mừng! Bạn đang chat với Bàn ${tableNumber}</p>
                </div>
            </div>
        `;
    }
}

// New function to display chat message with timestamp
function displayChatMessage(message, type, timestamp) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    let displayTime;
    if (timestamp) {
        // If timestamp is provided, format it
        displayTime = new Date(timestamp).toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } else {
        // Use current time if no timestamp
        displayTime = new Date().toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    messageElement.innerHTML = `
        <div class="message-content">${message}</div>
        <div class="message-time">${displayTime}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


function closeChatPopup(event) {
    // If event is provided, check if it's clicking on overlay
    if (event && event.target !== event.currentTarget) {
        return;
    }

    const popup = document.getElementById('chatPopup');
    if (popup) {
        popup.remove();
    }
    currentChatTable = null;
}


function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || !currentChatTable) return;

    // Kiểm tra WebSocket connection
    if (!chatStompClient || !chatStompClient.connected) {
        addMessageToChat('Lỗi: Không thể kết nối đến máy chủ chat!', 'error');
        return;
    }

    // Gửi tin nhắn qua WebSocket
    const success = sendChatMessage(currentChatTable.tableNumber, message, currentWorkSchedule.role);
    
    if (success) {
        // Add message to chat UI (use displayChatMessage instead of addMessageToChat)
        displayChatMessage(message, 'sent');
        
        // Clear input
        input.value = '';
        
        console.log(`Đã gửi tin nhắn đến Bàn ${currentChatTable.tableNumber}: ${message}`);
    } else {
        addMessageToChat('Lỗi: Không thể gửi tin nhắn!', 'error');
    }
}

// Keep addMessageToChat for backward compatibility and error messages
function addMessageToChat(message, type) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    console.log('message: ', message);
    const timestamp = new Date().toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageElement.innerHTML = `
        <div class="message-content">${message}</div>
        <div class="message-time">${timestamp}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleIncomingChatMessage(data) {
    console.log('Received chat message:', data);
    
    // Add to chat notifications
    const chatNotification = {
        id: Date.now() + Math.random(), // Unique ID
        tableNumber: data.tableNumber,
        message: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        sender: data.sender,
        read: false
    };
    
    chatNotifications.push(chatNotification);
    
    // Update notification count
    updateChatNotificationCount();
    
    // Nếu đang mở chat popup cho bàn này
    if (currentChatTable && currentChatTable.tableNumber === data.tableNumber) {
        displayChatMessage(data.message, 'received', data.timestamp);
        // Mark as read if chat is open for this table
        markChatNotificationAsRead(data.tableNumber);
    }

    showWebSocketNotification(`Bàn ${data.tableNumber}: `+ data.message);
}


function refreshTables() {
    loadTables();
}

function showMessageDropdown() {
    const dropdown = document.getElementById('messageDropdown');
    dropdown.classList.add('show');
    messageDropdownOpen = true;

    // Load tables when dropdown opens
    loadTables();

    // Close dropdown when clicking outside
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
}

function hideMessageDropdown() {
    const dropdown = document.getElementById('messageDropdown');
    dropdown.classList.remove('show');
    messageDropdownOpen = false;

    document.removeEventListener('click', handleOutsideClick);
}

function toggleMessageDropdown() {
    const dropdown = document.getElementById('messageDropdown');
    const isVisible = dropdown.classList.contains('show');
    console.log("in toggleMessageDropdown");

    if (isVisible) {
        hideMessageDropdown();
    } else {
        showMessageDropdown();
    }
}

function handleOutsideClick(event) {
    const dropdown = document.getElementById('messageDropdown');
    const icon = document.querySelector('.message-icon');

    if (!dropdown.contains(event.target) && !icon.contains(event.target)) {
        hideMessageDropdown();
    }
}

// New function to update chat notification count
function updateChatNotificationCount() {
    const messageCount = document.getElementById('messageCount');
    const unreadCount = chatNotifications.filter(n => !n.read).length;

    messageCount.textContent = unreadCount;
    messageCount.style.display = unreadCount > 0 ? 'flex' : 'none';

    if (unreadCount > 0) {
        messageCount.classList.add('notification-pulse');
        setTimeout(() => {
            messageCount.classList.remove('notification-pulse');
        }, 1000);
    }
}

// New function to mark chat notifications as read for a specific table
function markChatNotificationAsRead(tableNumber) {
    let hasUnread = false;
    
    chatNotifications.forEach(notification => {
        if (notification.tableNumber === tableNumber && !notification.read) {
            notification.read = true;
            hasUnread = true;
        }
    });
    
    if (hasUnread) {
        updateChatNotificationCount();
    }
}

// New function to clear all chat notifications
function clearAllChatNotifications() {
    chatNotifications.forEach(notification => {
        notification.read = true;
    });
    updateChatNotificationCount();
}

// New function to get unread chat notifications
function getUnreadChatNotifications() {
    return chatNotifications.filter(n => !n.read);
}

// New function to get chat notifications for a specific table
function getChatNotificationsForTable(tableNumber) {
    return chatNotifications.filter(n => n.tableNumber === tableNumber);
}

// New function to get latest message for a table
function getLatestMessageForTable(tableNumber) {
    const tableNotifications = getChatNotificationsForTable(tableNumber);
    if (tableNotifications.length === 0) return null;
    
    // Sort by timestamp and get the latest
    return tableNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
}

// New function to get unread count for a specific table
function getUnreadCountForTable(tableNumber) {
    return chatNotifications.filter(n => n.tableNumber === tableNumber && !n.read).length;
}

// New function to format message time
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) {
        return 'Vừa xong';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes} phút trước`;
    } else if (diffInMinutes < 1440) { // 24 hours
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours} giờ trước`;
    } else {
        return date.toLocaleDateString('vi-VN', { 
            day: '2-digit', 
            month: '2-digit' 
        });
    }
}

function markAllMessagesRead() {
    clearAllChatNotifications();
    
    // Refresh lại hiển thị danh sách bàn để bỏ các indicator "unread"
    if (tablesData && tablesData.result) {
        renderTables(tablesData);
    }
}