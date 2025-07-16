let stompClient = null;
let chatStompClient = null;

function connectNotificationWebSocket(currentWorkSchedule, onMessageCallback) {
    const socket = new SockJS("http://localhost:8080/ws");
    stompClient = Stomp.over(socket);
    console.log("role: ", currentWorkSchedule.role);
    const userRole = currentWorkSchedule.role;
    // Enable debug
    stompClient.debug = function (str) {
        console.log('STOMP: ' + str);
    };

    stompClient.connect({}, function (frame) {

        // Đăng ký nhận thông báo theo vai trò
        switch (userRole) {
            case 'CHEF':
                stompClient.subscribe('/topic/kitchen', message => {
                    const data = JSON.parse(message.body);
                    console.log('Parsed data:', data);
                    onMessageCallback(data);
                });
                break;
            case 'WAITER':

                const area = currentWorkSchedule.area;
                console.log("waiter in area: ", area);
                stompClient.subscribe(`/topic/waiter/area/${area}`, message => {
                    const data = JSON.parse(message.body);
                    console.log('Parsed data:', data);
                    onMessageCallback(data);
                });
                break;
            // ... other cases
        }

        console.log('WebSocket subscription completed');
    }, function (error) {
        console.error("WebSocket connection error:", error);
        setTimeout(() => connectWebSocket(userRole, onMessageCallback), 5000);
    });
}

function connectChatSocketForStaff(currentWorkSchedule, onMessageCallback) {
    const socket = new SockJS("http://localhost:8080/ws");
    chatStompClient = Stomp.over(socket);
    chatStompClient.connect({}, () => {
        console.log("✅ Connected to chat WebSocket");
    });
    console.log("role: ", currentWorkSchedule.role);

    stompClient.debug = function (str) {
        console.log('STOMP: ' + str);
    };
    const area = currentWorkSchedule.area;
    const role = currentWorkSchedule.role;

    chatStompClient.connect({}, () => {
        if (role === "WAITER" && area) {
            chatStompClient.subscribe(`/topic/chat/waiter/area/${area}`, (message) => {
                const data = JSON.parse(message.body);
                console.log('Parsed data:', data);
                onMessageCallback(data);
            });
            console.log(`Subscribed to /topic/chat/waiter/area/${area}`);
        }
        // Có thể mở rộng thêm nếu CHEF cũng nhận chat riêng
    }, (error) => {
        console.error("Chat socket (Staff) error:", error);
        setTimeout(() => connectChatSocketForStaff(currentWorkSchedule, onChatMessageCallback), 5000);
    });
}

function connectChatSocketForCustomer(tableNumber, onMessageCallback) {
    const socket = new SockJS("http://localhost:8080/ws");
    chatStompClient = Stomp.over(socket);

    chatStompClient.connect({}, () => {
        console.log("Chat socket (Customer) connected");

        chatStompClient.subscribe(`/topic/chat/customer/table/${tableNumber}`, (message) => {
            const data = JSON.parse(message.body);
            console.log("Chat received:", data);
            onMessageCallback(data);
        });

        console.log(`Subscribed to /topic/chat/customer/table/${tableNumber}`);
    }, (error) => {
        console.error("Chat socket (Customer) error:", error);
        setTimeout(() => connectChatSocketForCustomer(tableNumber, onChatMessageCallback), 5000);
    });
}

function sendChatMessage(tableNumber, message, sender) {
    if (!chatStompClient || !chatStompClient.connected) {
        console.error("Chat socket chưa kết nối!");
        return false;
    }

    try {
        const chatRequest = {
            message: message,
            sender: sender
        };
        chatStompClient.send(`/app/chat/table/${tableNumber}`, {}, JSON.stringify(chatRequest));
        return true;
    } catch (error) {
        console.error("Error sending chat message:", error);
        return false;
    }
}

function disconnectWebSocket() {
    if (stompClient !== null) {
        stompClient.disconnect();
    }
    console.log("Disconnected");
}