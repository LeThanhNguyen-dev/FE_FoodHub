let messageDropdownOpen = false;
let tablesData = [];
let currentChatTable = null;

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
        return `
            <div class="table-item" onclick="openChatPopup(${table.id || table.tableNumber})">
                <div class="table-info">
                    <div class="table-number">Bàn ${table.tableNumber}</div>
                    <div class="table-status">
                        <i class="fas fa-comments"></i>
                        <span>Nhấn để chat</span>
                    </div>
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

        // Update message count - sử dụng response.result
        const messageCount = document.getElementById('messageCount');
        let count = 0;
        
        if (response.result && Array.isArray(response.result)) {
            count = response.result.length;
        }
        
        messageCount.textContent = count;

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
function openChatPopup(tableId) {
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
        showChatPopup(selectedTable);
        hideMessageDropdown();
    } else {
        console.error('Table not found:', tableId);
    }
}


function showChatPopup(table) {
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
                    <div class="welcome-message">
                        <p>Chào mừng! Bạn đang chat với Bàn ${table.tableNumber}</p>
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

    // Focus on input
    setTimeout(() => {
        document.getElementById('chatInput').focus();
    }, 100);
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
        // Add message to chat UI
        addMessageToChat(message, 'sent');
        
        // Clear input
        input.value = '';
        
        console.log(`Đã gửi tin nhắn đến Bàn ${currentChatTable.tableNumber}: ${message}`);
    } else {
        addMessageToChat('Lỗi: Không thể gửi tin nhắn!', 'error');
    }
}


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
    
    // Nếu đang mở chat popup cho bàn này
    if (currentChatTable && currentChatTable.tableNumber === data.tableNumber) {
        addMessageToChat(data.message, 'received');
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
