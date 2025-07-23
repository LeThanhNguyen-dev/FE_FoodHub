
      // Làm mới thống kê doanh thu===================================================================
// Làm mới thống kê doanh thu//===============================doanh thu kèm css========================================================

// Làm mới thống kê doanh thu cái này là của DUY ĐẸP trai
// Làm mới thống kê doanh thu
// Thêm hàm createOrder để insert đơn và làm mới
async function createOrder(orderData) {
    try {
        const response = await apiFetch(`${API_BASE_URL}/payments/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        console.log('Insert order response:', response);
        if (response.result) {
            console.log('Order inserted successfully, refreshing revenue...');
            await refreshAllCharts(); // Làm mới sau khi insert
            return response.result;
        } else {
            showError('error', `❌ ${response.message || 'Không thể tạo đơn hàng.'}`);
            return null;
        }
    } catch (error) {
        showError('error', `❌ ${error.message || 'Lỗi khi tạo đơn hàng.'}`);
        return null;
    }
}
// Làm mới thống kê doanh thu với thiết kế hiện đại
// Biến global để lưu trữ stats hiện tại
let currentRevenueStats = null;
//==================================================================================

// Hàm cập nhật stats global
function updateGlobalStats(stats) {
  currentRevenueStats = stats;
}
//==================================================================================

// Hàm lấy stats mới nhất từ server
async function getLatestStats() {
  try {
    const data = await apiFetch(`${API_BASE_URL}/payments/todays-revenue-stats`);
    if (data.result) {
      currentRevenueStats = data.result;
      return data.result;
    }
    return null;
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu stats:', error);
    return null;
  }
}
//==================================================================================


// Biến để kiểm tra modal đã mở chưa
let isModalOpen = false;
const MODERN_ORANGE_COLORS = {
  backgrounds: [
    'linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)', // Total - Cam chính
    'linear-gradient(135deg, #FF7043 0%, #FF5722 100%)', // CASH - Cam đậm
    'linear-gradient(135deg, #FFB74D 0%, #FFA726 100%)', // VNPAY - Cam vàng
    'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)', // Pending - Cam chuẩn
    'linear-gradient(135deg, #FFCC80 0%, #FFB74D 100%)', // Paid - Cam nhạt
    'linear-gradient(135deg, #BF360C 0%, #D84315 100%)'  // Cancelled - Cam đỏ đậm
  ],
  borders: [
    '#FF6B35', // Total
    '#FF5722', // CASH
    '#FFA726', // VNPAY
    '#F57C00', // Pending
    '#FFB74D', // Paid
    '#D84315'  // Cancelled
  ],
  shadows: [
    'rgba(255, 140, 66, 0.3)',  // Total
    'rgba(255, 112, 67, 0.3)',  // CASH
    'rgba(255, 183, 77, 0.3)',  // VNPAY
    'rgba(255, 152, 0, 0.3)',   // Pending
    'rgba(255, 204, 128, 0.3)', // Paid
    'rgba(216, 67, 21, 0.3)'    // Cancelled
  ]
};

// Hàm tạo gradient cho canvas
function createGradient(ctx, color1, color2, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

// Hàm hiển thị popup biểu đồ toàn màn hình
async function showChartPopup(stats = null) {
  // Ngăn mở nhiều modal cùng lúc
  if (isModalOpen) return;
  isModalOpen = true;

  // Luôn lấy dữ liệu mới nhất từ server
  let currentStats = stats;
  if (!currentStats) {
    try {
      const data = await apiFetch(`${API_BASE_URL}/payments/todays-revenue-stats`);
      if (data.result) {
        currentStats = data.result;
      } else {
        console.error('Không thể lấy dữ liệu mới nhất');
        isModalOpen = false;
        return;
      }
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu:', error);
      isModalOpen = false;
      return;
    }
  }

  // Đóng modal cũ nếu có
  const existingModal = document.getElementById('chartModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Tạo modal popup với thiết kế hiện đại
  const modal = document.createElement('div');
  modal.id = 'chartModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, rgba(255, 87, 34, 0.1) 100%);
    backdrop-filter: blur(10px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  // Tạo container cho biểu đồ với glass effect
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 248, 240, 0.95) 100%);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 140, 66, 0.2);
    border-radius: 20px;
    padding: 30px;
    width: 90%;
    max-width: 1100px;
    height: 85%;
    max-height: 750px;
    position: relative;
    box-shadow: 
      0 25px 60px rgba(255, 87, 34, 0.15),
      0 10px 30px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    transform: scale(0.8) translateY(20px);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  // Nút đóng hiện đại
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    position: absolute;
    top: 20px;
    right: 25px;
    background: linear-gradient(135deg, #FF6B35 0%, #FF5722 100%);
    border: none;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    color: white;
    z-index: 10000;
    width: 45px;
    height: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: scale(1);
  `;
  closeBtn.onmouseover = () => {
    closeBtn.style.transform = 'scale(1.1)';
    closeBtn.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.transform = 'scale(1)';
    closeBtn.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
  };

  // Tiêu đề với gradient text
  const title = document.createElement('h2');

  // Canvas cho biểu đồ popup
  const canvas = document.createElement('canvas');
  canvas.id = 'popupChart';
  canvas.style.cssText = `
    width: 100%;
    height: calc(100% - 100px);
    border-radius: 12px;
  `;

  // Thêm các elements vào modal
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(title);
  modalContent.appendChild(canvas);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Animation hiển thị mượt mà
  setTimeout(() => {
    modal.style.opacity = '1';
    modalContent.style.transform = 'scale(1) translateY(0)';
  }, 50);

  // Tạo biểu đồ popup với gradient colors, loại bỏ Tổng và VNPAY
  const ctx = canvas.getContext('2d');
  
  const gradients = [
    createGradient(ctx, '#FF7043', '#FF5722', 400), // Tiền mặt
    createGradient(ctx, '#FF9800', '#F57C00', 400), // Chưa thanh toán
    createGradient(ctx, '#FFCC80', '#FFB74D', 400), // Đã thanh toán
    createGradient(ctx, '#BF360C', '#D84315', 400)  // Đã hủy
  ];

  const popupChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Tiền mặt', 'Chưa thanh toán', 'Đã thanh toán', 'Đã hủy'],
      datasets: [{
        label: 'Doanh thu (VNĐ)',
        data: [
          Number(currentStats.cashRevenue) || 0,
          Number(currentStats.pendingRevenue) || 0,
          Number(currentStats.paidRevenue) || 0,
          Number(currentStats.cancelledRevenue) || 0
        ],
        backgroundColor: gradients,
        borderColor: MODERN_ORANGE_COLORS.borders.slice(1, 5), // Lấy từ CASH đến CANCELLED
        borderWidth: 3,
        borderRadius: 12,
        borderSkipped: false,
        barPercentage: 0.8,
        categoryPercentage: 0.9,
        shadowOffsetX: 3,
        shadowOffsetY: 6,
        shadowBlur: 10,
        shadowColor: 'rgba(255, 87, 34, 0.2)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { 
            display: true, 
            text: 'Doanh thu (VNĐ)', 
            color: '#BF360C', 
            font: { size: 18, weight: 'bold' } 
          },
          ticks: { 
            color: '#FF5722', 
            font: { size: 14, weight: '600' },
            callback: function(value) {
              return value.toLocaleString() + '₫';
            },
            padding: 10
          },
          grid: { 
            color: 'rgba(255, 152, 0, 0.1)', 
            borderColor: '#FF8A65',
            lineWidth: 1
          },
          border: { color: '#FF5722', width: 2 }
        },
        x: { 
          ticks: { 
            color: '#BF360C', 
            font: { size: 14, weight: '600' },
            padding: 10
          }, 
          grid: { display: false },
          border: { color: '#FF5722', width: 2 }
        }
      },
      plugins: {
        legend: { 
          position: 'top', 
          labels: { 
            color: '#BF360C', 
            font: { size: 16, weight: 'bold' },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'rectRounded'
          } 
        },
        title: {
          display: true,
          text: 'Phân tích Doanh thu Ngày ' + new Date().toLocaleDateString('vi-VN'),
          color: '#BF360C',
          font: { size: 22, weight: 'bold' },
          padding: { top: 20, bottom: 30 }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#BF360C',
          bodyColor: '#FF5722',
          borderColor: '#FF8A65',
          borderWidth: 2,
          cornerRadius: 12,
          displayColors: true,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          padding: 12,
          callbacks: {
            label: function(context) {
              return '' + context.dataset.label + ': ' + context.parsed.y.toLocaleString() + '₫';
            }
          }
        }
      },
      layout: { padding: 25 },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart',
        onComplete: function() {
          if (!this.chart || !this.chart.ctx || this.chart.destroyed) {
            return;
          }
          const ctx = this.chart.ctx;
          ctx.save();
          ctx.font = 'bold 13px Inter, -apple-system, sans-serif';
          ctx.fillStyle = '#BF360C';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
          ctx.shadowBlur = 2;
          ctx.shadowOffsetY = 1;

          this.data.datasets.forEach((dataset, i) => {
            const meta = this.getDatasetMeta(i);
            if (meta && meta.data) {
              meta.data.forEach((bar, index) => {
                const data = dataset.data[index];
                if (data > 0 && bar && bar.x !== undefined && bar.y !== undefined) {
                  ctx.fillText(data.toLocaleString() + '₫', bar.x, bar.y - 8);
                }
              });
            }
          });
          ctx.restore();
        }
      }
    }
  });

  // Hàm đóng modal
  function closeModal() {
    modal.style.opacity = '0';
    modalContent.style.transform = 'scale(0.8) translateY(20px)';
    setTimeout(() => {
      try {
        if (popupChart && !popupChart.destroyed) {
          popupChart.destroy();
        }
      } catch (e) {
        console.warn('Error destroying popup chart:', e);
      }
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      isModalOpen = false;
    }, 400);
  }

  // Event listeners để đóng modal
  closeBtn.addEventListener('click', closeModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  });
}







async function refreshRevenue() {
    try {
        const data = await apiFetch(`${API_BASE_URL}/payments/todays-revenue-stats`);
        console.log('API response for refreshRevenue:', data);
        if (data.result) {
            const stats = data.result;
            updateGlobalStats(stats);

            const row1Stats = [
                { title: 'Doanh thu Tiền mặt', value: stats.cashRevenue, color: '#FF5722' }
            ].map(stat => `
                <div class="stat-card" style="border-left: 4px solid ${stat.color}; box-shadow: 0 4px 15px rgba(255, 107, 53, 0.1);">
                    <h4 style="color: ${stat.color};">${stat.title}</h4>
                    <div class="value" style="background: linear-gradient(135deg, ${stat.color}, #FF8A65); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${(Number(stat.value) || 0).toLocaleString()}₫</div>
                </div>
            `).join('');

            const row2Stats = [
                { title: 'Chưa thanh toán', value: stats.pendingRevenue, color: '#F57C00' },
                { title: 'Đã thanh toán', value: stats.paidRevenue, color: '#FFB74D' },
                { title: 'Đã hủy', value: stats.cancelledRevenue, color: '#D84315' }
            ].map(stat => `
                <div class="stat-card" style="border-left: 4px solid ${stat.color}; box-shadow: 0 4px 15px rgba(255, 107, 53, 0.1);">
                    <h4 style="color: ${stat.color};">${stat.title}</h4>
                    <div class="value" style="background: linear-gradient(135deg, ${stat.color}, #FF8A65); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${(Number(stat.value) || 0).toLocaleString()}₫</div>
                </div>
            `).join('');

            const statsContainer = document.querySelector('#revenueResult .revenue-stats-container');
            statsContainer.innerHTML = `
                <div class="revenue-stats-row">${row1Stats}</div>
                <div class="revenue-stats-row">${row2Stats}</div>
            `;

            document.getElementById('revenueCurrentDate').textContent = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

            const ctx = document.getElementById('dailyRevenueChart').getContext('2d');
            if (window.revenueChart && window.revenueChart.canvas) {
                window.revenueChart.destroy();
                window.revenueChart = null;
            }

            const mainGradients = [
                createGradient(ctx, '#FF7043', '#FF5722', 300),
                createGradient(ctx, '#FF9800', '#F57C00', 300),
                createGradient(ctx, '#FFCC80', '#FFB74D', 300),
                createGradient(ctx, '#BF360C', '#D84315', 300)
            ];

            window.revenueChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Tiền mặt', 'Chưa thanh toán', 'Đã thanh toán', 'Đã hủy'],
                    datasets: [{
                        label: 'Doanh thu (VNĐ)',
                        data: [
                            Number(stats.cashRevenue) || 0,
                            Number(stats.pendingRevenue) || 0,
                            Number(stats.paidRevenue) || 0,
                            Number(stats.cancelledRevenue) || 0
                        ],
                        backgroundColor: mainGradients,
                        borderColor: MODERN_ORANGE_COLORS.borders.slice(1, 5),
                        borderWidth: 2,
                        borderRadius: 10,
                        borderSkipped: false,
                        barPercentage: 0.75,
                        categoryPercentage: 0.85
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' },
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Doanh thu (VNĐ)', color: '#BF360C', font: { size: 16, weight: 'bold' } }, ticks: { color: '#FF5722', font: { size: 12, weight: '600' }, callback: function(value) { return value.toLocaleString() + '₫'; } }, grid: { color: 'rgba(255, 152, 0, 0.15)', borderColor: '#FF8A65' } }, x: { ticks: { color: '#BF360C', font: { size: 12, weight: '600' } }, grid: { display: false } } },
                    plugins: { legend: { position: 'top', labels: { color: '#BF360C', font: { size: 13, weight: 'bold' }, usePointStyle: true, pointStyle: 'rectRounded' } }, title: { display: true, text: 'Phân tích Doanh thu Ngày ' + new Date().toLocaleDateString('vi-VN'), color: '#BF360C', font: { size: 18, weight: 'bold' }, padding: { top: 15, bottom: 20 } }, tooltip: { backgroundColor: 'rgba(255, 255, 255, 0.95)', titleColor: '#BF360C', bodyColor: '#FF5722', borderColor: '#FF8A65', borderWidth: 2, cornerRadius: 8, callbacks: { label: function(context) { return '' + context.dataset.label + ': ' + context.parsed.y.toLocaleString() + '₫'; } } } },
                    layout: { padding: 20 },
                    animation: { duration: 1000, easing: 'easeOutQuart', onComplete: function() { if (!this.chart || !this.chart.ctx || this.chart.destroyed) return; const ctx = this.chart.ctx; ctx.save(); ctx.font = 'bold 13px Inter, -apple-system, sans-serif'; ctx.fillStyle = '#BF360C'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1; this.data.datasets.forEach((dataset, i) => { const meta = this.getDatasetMeta(i); if (meta && meta.data) { meta.data.forEach((bar, index) => { const data = dataset.data[index]; if (data > 0 && bar && bar.x !== undefined && bar.y !== undefined) { ctx.fillText(data.toLocaleString() + '₫', bar.x, bar.y - 8); } }); } }); ctx.restore(); } },
                    onClick: (event, elements) => {
                        if (elements.length > 0) {
                            const chart = window.revenueChart;
                            const element = elements[0];
                            const index = element.index;
                            const label = chart.data.labels[index];
                            const value = chart.data.datasets[0].data[index];
                            showRevenuePopup(label, value);
                        }
                    }
                }
            });

            const chartContainer = document.getElementById('dailyRevenueChart').parentElement;
            if (chartContainer) {
                chartContainer.style.cssText += `cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 12px; overflow: hidden;`;
                chartContainer.title = '🖱️ Nhấp để xem biểu đồ chi tiết toàn màn hình';
                chartContainer.onmouseenter = () => { chartContainer.style.transform = 'translateY(-2px)'; chartContainer.style.boxShadow = '0 8px 25px rgba(255, 107, 53, 0.15)'; };
                chartContainer.onmouseleave = () => { chartContainer.style.transform = 'translateY(0)'; chartContainer.style.boxShadow = 'none'; };
                chartContainer.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (!isModalOpen) showChartPopup(); });
            }

            document.getElementById("message").textContent = "🎉 Thống kê doanh thu đã được tải với thiết kế hiện đại!";
        } else {
            showError("error", `❌ ${data.message || "Không thể tải doanh thu."}`);
        }
    } catch (error) {
        showError("error", `❌ ${error.message || "Lỗi kết nối hệ thống, vui lòng thử lại sau."}`);
    }
}

// Gọi createOrder để test
const orderData = { orderId: 66, paymentMethod: 'CASH' };
createOrder(orderData);


// CSS cho stat cards hiện đại
const modernCSS = `
<style>
.stat-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  pointer-events: none;
}

.stat-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 12px 30px rgba(255, 107, 53, 0.2) !important;
}

.revenue-stats-container {
  gap: 15px;
}

.revenue-stats-row {
  gap: 15px;
}
</style>
`;

// Thêm CSS vào head nếu chưa có
if (!document.getElementById('modernChartCSS')) {
  const styleElement = document.createElement('div');
  styleElement.id = 'modernChartCSS';
  styleElement.innerHTML = modernCSS;
  document.head.appendChild(styleElement);
}



// Hàm để refresh cả biểu đồ chính và popup (nếu đang mở)

// Sửa refreshAllCharts để làm mới cả popup
async function refreshAllCharts() {
    console.log('🔄 Refreshing all charts...');
    await refreshRevenue(); // Làm mới stat cards và biểu đồ chính
    if (isModalOpen) {
        const modal = document.getElementById('chartModal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(async () => {
                if (modal && modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
                isModalOpen = false;
                await showChartPopup(); // Làm mới popup với dữ liệu mới
            }, 200);
        }
    }
    console.log('✅ All charts refreshed!');
}


// Gọi hàm khi section revenue được hiển thị
document.addEventListener('DOMContentLoaded', () => {
  const revenueSection = document.getElementById('revenueSection');
  if (revenueSection) {
    showSection('revenue');
  }
});

// Hàm để call sau khi thanh toán thành công
window.onPaymentSuccess = async function() {
  await refreshAllCharts();
  showSection('dashboard');
};



//==================================================================================
      // Xử lý submit form để làm mới doanh thu
      document.getElementById('revenueForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          const button = e.submitter;
          const originalText = button.innerHTML;
          button.innerHTML = originalText + '<span class="loading"></span>';
          button.disabled = true;

          const startDateInput = document.getElementById('revenueStartDateInput').value;
          const endDateInput = document.getElementById('revenueEndDateInput').value;
          const startDate = new Date(startDateInput);
          const endDate = new Date(endDateInput);
          if (endDate < startDate) {
              showError('revenueEndDateError', 'Ngày kết thúc phải sau ngày bắt đầu');
              button.innerHTML = originalText;
              button.disabled = false;
              return;
          } else {
              clearMessages();
          }

          await refreshRevenue();
          button.innerHTML = originalText;
          button.disabled = false;
      });
