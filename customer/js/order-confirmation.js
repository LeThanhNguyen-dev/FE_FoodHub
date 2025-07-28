let currentOrderData = null;

        // Function to get URL parameters
        function getUrlParameter(name) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        }

        // Function to show loading state
        function showLoading() {
            document.getElementById('loadingState').style.display = 'block';
            document.getElementById('errorState').style.display = 'none';
            document.getElementById('successSection').style.display = 'none';
            document.getElementById('orderContent').style.display = 'none';
            document.getElementById('actionButtons').style.display = 'none';
        }

        // Function to show error state
        function showError() {
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('errorState').style.display = 'block';
            document.getElementById('successSection').style.display = 'none';
            document.getElementById('orderContent').style.display = 'none';
            document.getElementById('actionButtons').style.display = 'none';
        }

        // Function to show success state
        function showSuccess() {
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('errorState').style.display = 'none';
            document.getElementById('successSection').style.display = 'block';
            document.getElementById('orderContent').style.display = 'block';
            document.getElementById('actionButtons').style.display = 'block';
        }

        // Function to format currency
        function formatCurrency(amount) {
            return amount.toLocaleString('vi-VN') + 'đ';
        }

        // Function to format date
        function formatDateTime(dateString) {
            try {
                const corrected = dateString.replace(/Z$/, '');
                const date = new Date(corrected);
                return date.toLocaleString('vi-VN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                return dateString;
            }
        }


        // Function to get status display text and class
        function getStatusInfo(status) {
            const statusMap = {
                'PENDING': { text: 'Đang chờ', class: 'status-pending' },
                'CONFIRMED': { text: 'Đã xác nhận', class: 'status-confirmed' },
                'PREPARING': { text: 'Đang chuẩn bị', class: 'status-preparing' },
                'COMPLETED': { text: 'Hoàn thành', class: 'status-confirmed' },
                'CANCELLED': { text: 'Đã hủy', class: 'status-pending' }
            };
            return statusMap[status] || { text: status, class: 'status-pending' };
        }

        // Function to initialize the page with order data from localStorage
        async function initializeFromLocalStorage() {
            try {
                const savedOrderData = localStorage.getItem('orderConfirmationData');
                if (!savedOrderData) {
                    throw new Error('No saved order data');
                }

                const orderData = JSON.parse(savedOrderData);

                // Update success messages based on order type
                const isNewOrder = orderData.isNewOrder !== false;
                document.getElementById('successTitle').textContent = isNewOrder ?
                    'Đặt món thành công!' : 'Thêm món thành công!';
                document.getElementById('successSubtitle').textContent = isNewOrder ?
                    'Đơn hàng mới đã được tạo' : 'Đã thêm món vào đơn hàng hiện tại';

                // Update order details
                document.getElementById('orderId').textContent = '#' + orderData.id;
                document.getElementById('tableNumber').textContent = orderData.tableNumber || 'N/A';

                // Order type badge
                const orderTypeElement = document.getElementById('orderType');
                if (isNewOrder) {
                    orderTypeElement.textContent = 'Đơn hàng mới';
                    orderTypeElement.className = 'order-type-badge order-type-new';
                } else {
                    orderTypeElement.textContent = 'Thêm món';
                    orderTypeElement.className = 'order-type-badge order-type-add';
                }

                // Status
                const statusInfo = getStatusInfo(orderData.status || 'PENDING');
                const statusElement = document.getElementById('orderStatus');
                statusElement.textContent = statusInfo.text;
                statusElement.className = 'status-badge ' + statusInfo.class;

                // Calculate total amount for new items
                let newItemsTotal = 0;
                if (orderData.items && orderData.items.length > 0) {
                    newItemsTotal = orderData.items.reduce((total, item) => {
                        return total + (item.price * item.quantity);
                    }, 0);
                }

                document.getElementById('totalAmount').textContent = formatCurrency(newItemsTotal);

                // Show total order amount if available
                if (orderData.totalAmount && orderData.totalAmount !== newItemsTotal) {
                    document.getElementById('totalOrderAmount').textContent = formatCurrency(orderData.totalAmount);
                    document.getElementById('totalOrderAmountRow').style.display = 'flex';
                }

                // Time
                document.getElementById('orderTime').textContent = formatDateTime(orderData.createdAt || new Date().toISOString());

                // Render items
                const itemsList = document.getElementById('orderItemsList');
                itemsList.innerHTML = '';

                if (orderData.items && orderData.items.length > 0) {
                    document.getElementById('itemsTitle').textContent = isNewOrder ?
                        'Chi tiết món ăn' : 'Món ăn vừa thêm';

                    orderData.items.forEach(item => {
                        const itemCard = document.createElement('div');
                        itemCard.className = 'item-card';
                        itemCard.innerHTML = `
                            <div class="item-image">🍽️</div>
                            <div class="item-info">
                                <div class="item-name">${item.name}</div>
                                ${item.note ? `<div class="item-note">Ghi chú: ${item.note}</div>` : ''}
                                <div class="item-price">${formatCurrency(item.price)}</div>
                            </div>
                            <div class="item-quantity">x${item.quantity}</div>
                        `;
                        itemsList.appendChild(itemCard);
                    });
                } else {
                    itemsList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Không có thông tin món ăn</div>';
                }

                currentOrderData = orderData;
                showSuccess();

                // Clear localStorage after successful display
                localStorage.removeItem('orderConfirmationData');

            } catch (error) {
                console.error('Error loading from localStorage:', error);
                await initializeFromAPI();
            }
        }

        // Function to initialize the page with order data from API
        async function initializeFromAPI() {
            const orderId = getUrlParameter('orderId');
            const tableNumber = getUrlParameter('tableNumber');
            const token = localStorage.getItem('sessionToken'); 
            console.log('Initializing from API with orderId:', orderId, 'and tableNumber:', tableNumber, 'token:', token);
            if (!orderId) {
                console.error('No order ID provided');
                showError();
                return;
            }

            try {
                const response = await fetch(`${BACKEND_BASE_URL}/orders/${orderId}`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const apiResponse = await response.json();
                const orderData = apiResponse.result;

                if (!orderData) {
                    throw new Error('No order data in response');
                }

                // Update success messages (assume new order from API)
                document.getElementById('successTitle').textContent = 'Đặt món thành công!';
                document.getElementById('successSubtitle').textContent = 'Đơn hàng của bạn đã được tiếp nhận';

                // Update order details
                document.getElementById('orderId').textContent = '#' + orderData.id;
                document.getElementById('tableNumber').textContent = orderData.table?.tableNumber || tableNumber || 'N/A';

                // Order type
                const orderTypeElement = document.getElementById('orderType');
                orderTypeElement.textContent = 'Đơn hàng';
                orderTypeElement.className = 'order-type-badge order-type-new';

                // Status
                const statusInfo = getStatusInfo(orderData.status);
                const statusElement = document.getElementById('orderStatus');
                statusElement.textContent = statusInfo.text;
                statusElement.className = 'status-badge ' + statusInfo.class;

                // Total amount
                document.getElementById('totalAmount').textContent = formatCurrency(orderData.totalAmount || 0);

                // Time
                document.getElementById('orderTime').textContent = formatDateTime(orderData.createdAt);

                // Render items
                const itemsList = document.getElementById('orderItemsList');
                itemsList.innerHTML = '';

                if (orderData.orderItems && orderData.orderItems.length > 0) {
                    orderData.orderItems.forEach(orderItem => {
                        console.log('with orderItem:', orderItem);
                        const itemCard = document.createElement('div');
                        itemCard.className = 'item-card';
                        itemCard.innerHTML = `
                            <div class="item-image">🍽️</div>
                            <div class="item-info">
                                <div class="item-name">${orderItem.menuItemName}</div>
                                ${orderItem.note ? `<div class="item-note">Ghi chú: ${orderItem.note}</div>` : ''}
                                <div class="item-price">${formatCurrency(orderItem.price)}</div>
                            </div>
                            <div class="item-quantity">x${orderItem.quantity}</div>
                        `;
                        itemsList.appendChild(itemCard);
                    });
                } else {
                    itemsList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Không có món ăn trong đơn hàng</div>';
                }

                currentOrderData = orderData;
                showSuccess();

            } catch (error) {
                console.error('Error loading order from API:', error);
                showError();
            }
        }

        // Function to retry loading
        function retryLoad() {
            showLoading();
            setTimeout(() => {
                initializeFromLocalStorage();
            }, 500);
        }

        // Navigation functions
        function goBack() {
            const tableNumber = getUrlParameter('tableNumber');
            if (tableNumber) {
                window.location.href = `view-food-list.html?tableNumber=${encodeURIComponent(tableNumber)}`;
            } else {
                window.history.back();
            }
        }

        function trackOrder() {
            const tableNumber = getUrlParameter('tableNumber') ||
                (currentOrderData && currentOrderData.tableNumber);
            if (tableNumber) {
                window.location.href = `order-history.html?tableNumber=${encodeURIComponent(tableNumber)}`;
            } else {
                window.location.href = 'view-food-list.html';
            }
        }

        function goToMenu() {
            const tableNumber = getUrlParameter('tableNumber') ||
                (currentOrderData && currentOrderData.tableNumber);
            if (tableNumber) {
                window.location.href = `view-food-list.html?tableNumber=${encodeURIComponent(tableNumber)}`;
            } else {
                window.location.href = 'view-food-list.html';
            }
        }

        function goToHome() {
            const tableNumber = getUrlParameter('tableNumber') ||
                (currentOrderData && currentOrderData.tableNumber);
            if (tableNumber) {
                window.location.href = `home-page.html?tableNumber=${encodeURIComponent(tableNumber)}`;
            } else {
                window.location.href = 'home-page.html';
            }
        }

        // Initialize page when loaded
        document.addEventListener('DOMContentLoaded', function () {
            showLoading();
            // Small delay to show loading state
            setTimeout(() => {
                initializeFromLocalStorage();
            }, 500);
        });

        // Function to be called from external applications
        window.showOrderConfirmation = function (orderResult) {
            const data = {
                id: orderResult.id || 'ORD-' + Date.now(),
                tableNumber: getUrlParameter('tableNumber') || orderResult.tableNumber || 'N/A',
                status: orderResult.status || 'PENDING',
                totalAmount: orderResult.totalAmount || 0,
                createdAt: orderResult.createdAt || new Date().toISOString(),
                isNewOrder: orderResult.isNewOrder !== false,
                items: orderResult.items || []
            };

            currentOrderData = data;
            showSuccess();

            // Update all UI elements with the new data
            // ... (same logic as in initializeFromLocalStorage)
        };