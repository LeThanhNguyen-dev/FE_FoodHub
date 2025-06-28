let stompClient = null;

function connectWebSocket(currentWorkSchedule, onMessageCallback) {

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

function disconnectWebSocket() {
    if (stompClient !== null) {
        stompClient.disconnect();
    }
    console.log("Disconnected");
}