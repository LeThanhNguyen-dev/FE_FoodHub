// Initialize chat history from localStorage
let chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
console.log('chat.js loaded, chatHistory:', chatHistory);

// Load chat history on page load
function loadChatHistory() {
    console.log('Loading chat history...');
    const msgDiv = document.getElementById('messages');
    if (!msgDiv) {
        console.error('Messages div not found');
        if (typeof showNotification === 'function') {
            showNotification('Lỗi: Không tìm thấy khu vực hiển thị tin nhắn');
        }
        return;
    }
    msgDiv.innerHTML = ''; // Clear existing messages
    chatHistory.forEach(msg => {
        appendMessage(msg.sender, msg.text, msg.type, msg.timestamp);
    });
    msgDiv.scrollTop = msgDiv.scrollHeight;
    console.log('Chat history loaded');
}

// Toggle chat window visibility
function toggleChat() {
    console.log('Toggling chat...');
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) {
        console.error('Chat container not found');
        if (typeof showNotification === 'function') {
            showNotification('Lỗi: Không tìm thấy cửa sổ chat');
        }
        return;
    }
    const isHidden = chatContainer.classList.contains('show');
    chatContainer.classList.toggle('show', !isHidden);
    chatContainer.classList.toggle('hidden', isHidden);
    if (!isHidden) {
        const userInput = document.getElementById('userInput');
        if (userInput) {
            userInput.focus();
        } else {
            console.error('User input not found');
            if (typeof showNotification === 'function') {
                showNotification('Lỗi: Không tìm thấy trường nhập liệu');
            }
        }
    }
    console.log('Chat toggled, show:', !isHidden);
}

// Send user message and get bot response
async function sendMessage() {
    console.log('sendMessage called');
    const input = document.getElementById('userInput');
    if (!input) {
        console.error('Input element not found');
        if (typeof showNotification === 'function') {
            showNotification('Lỗi: Không tìm thấy trường nhập liệu');
        }
        return;
    }
    const message = input.value.trim();
    if (!message) {
        console.log('Empty message, ignoring');
        return;
    }

    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    console.log('Sending user message:', message);
    const userMsg = { sender: 'Bạn', text: message, type: 'user', timestamp };
    appendMessage(userMsg.sender, userMsg.text, userMsg.type, timestamp);
    chatHistory.push(userMsg);
    saveChatHistory();

    input.value = '';

    try {
        console.log('Fetching from API: http://localhost:8080/api/gemini/reply');
        const response = await fetch('http://localhost:8080/api/gemini/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        console.log('API response status:', response.status);
        if (!response.ok) {
            throw new Error(`Yêu cầu thất bại: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('API response data:', data);
        const reply = data.result?.reply || data.reply; // Handle both response formats
        if (reply) {
            const formattedReply = formatReply(reply);
            const botMsg = { sender: 'FoodHub Bot', text: formattedReply, type: 'bot', timestamp };
            appendMessage(botMsg.sender, botMsg.text, botMsg.type, timestamp);
            chatHistory.push(botMsg);
            saveChatHistory();
            console.log('Bot reply added:', formattedReply);
        } else {
            console.error('No valid reply in response:', data);
            appendMessage('FoodHub Bot', 'Không có phản hồi hợp lệ từ server.', 'bot', timestamp);
            if (typeof showNotification === 'function') {
                showNotification('Lỗi: Không nhận được phản hồi hợp lệ từ server');
            }
        }
    } catch (err) {
        console.error('Error in sendMessage:', err);
        appendMessage('Lỗi', `Không thể kết nối: ${err.message}`, 'bot', timestamp);
        if (typeof showNotification === 'function') {
            showNotification(`Lỗi khi gửi tin nhắn: ${err.message}`);
        }
    }
}

// Format Markdown in bot replies
function formatReply(text) {
    console.log('Formatting reply:', text);
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/`([^`]+)`/g, '<code>$1</code>') // Inline code
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>') // Code block
        .replace(/^### (.*)$/gm, '<h3>$1</h3>') // Heading 3
        .replace(/^## (.*)$/gm, '<h2>$1</h2>') // Heading 2
        .replace(/^# (.*)$/gm, '<h1>$1</h1>') // Heading 1
        .replace(/^\* (.*)$/gm, '<li>$1</li>') // Unordered list
        .replace(/^\d+\. (.*)$/gm, '<li>$1</li>') // Ordered list
        .replace(/(<li>.*<\/li>)/g, match => `<ul>${match}</ul>`) // Wrap lists
        .replace(/<\/ul>\s*<ul>/g, '') // Merge consecutive lists
        .replace(/^(?!<h[1-3]>|<ul>|<pre>)(.+)$/gm, '<p>$1</p>'); // Paragraphs
    return formatted;
}

// Append message to chat UI
function appendMessage(sender, text, type, timestamp) {
    console.log('Appending message:', { sender, text, type, timestamp });
    const msgDiv = document.getElementById('messages');
    if (!msgDiv) {
        console.error('Messages div not found');
        if (typeof showNotification === 'function') {
            showNotification('Lỗi: Không tìm thấy khu vực hiển thị tin nhắn');
        }
        return;
    }
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerHTML = `
        <strong>${sender}</strong>: ${text}
        <div class="message-time">${timestamp}</div>
    `;
    msgDiv.appendChild(div);
    msgDiv.scrollTop = msgDiv.scrollHeight;
    console.log('Message appended, scrolled to bottom');
}

// Save chat history to localStorage
function saveChatHistory() {
    console.log('Saving chat history:', chatHistory);
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

// Clear chat history
function clearChatHistory() {
    console.log('Clearing chat history');
    chatHistory = [];
    const msgDiv = document.getElementById('messages');
    if (msgDiv) {
        msgDiv.innerHTML = '';
        console.log('Chat history cleared from UI');
    } else {
        console.error('Messages div not found for clearing');
        if (typeof showNotification === 'function') {
            showNotification('Lỗi: Không tìm thấy khu vực hiển thị tin nhắn');
        }
    }
    saveChatHistory();
}