// Định nghĩa các ca làm việc với màu sắc cải tiến
const SHIFTS = {
  'Ca Sáng': { 
    start: '08:30', 
    end: '12:30', 
    color: '#FFE0B2',        // Cam rất nhạt - dễ nhìn
    textColor: '#E65100',    // Chữ cam đậm
    borderColor: '#FFCC80'   // Viền cam nhạt
  },
  'Ca Chiều': { 
    start: '12:30', 
    end: '17:30', 
    color: '#FF9800',        // Cam chính - giống header
    textColor: '#ffffff',    // Chữ trắng
    borderColor: '#F57C00'   // Viền cam đậm hơn
  },
  'Ca Tối': { 
    start: '17:30', 
    end: '22:30', 
    color: '#E65100',        // Cam đậm - phù hợp cho tối
    textColor: '#ffffff',    // Chữ trắng
    borderColor: '#BF360C'   // Viền cam rất đậm
  },
  'Ca Tùy chọn': { 
    start: '', 
    end: '', 
    color: '#BDBDBD',        // Xám nhạt
    textColor: '#424242',    // Chữ xám đậm
    borderColor: '#9E9E9E'   // Viền xám
  }
};

// Hàm xác định ca dựa trên giờ bắt đầu và kết thúc - cải tiến
function determineShift(startTime, endTime) {
  for (const [shiftName, shift] of Object.entries(SHIFTS)) {
    if (startTime === shift.start && endTime === shift.end) {
      return { 
        name: shiftName, 
        color: shift.color,
        textColor: shift.textColor,
        borderColor: shift.borderColor
      };
    }
  }
  return { 
    name: 'Ca Khác', 
    color: SHIFTS['Ca Tùy chọn'].color,
    textColor: SHIFTS['Ca Tùy chọn'].textColor,
    borderColor: SHIFTS['Ca Tùy chọn'].borderColor
  };
}

// Lấy ngày thứ Hai của tuần hiện tại
function getMondayOfCurrentWeek() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Điều chỉnh để lấy thứ Hai
  return new Date(today.setDate(diff));
}

// Biến lưu trữ ngày bắt đầu tuần hiện tại
let currentWeekStart = getMondayOfCurrentWeek();

// Hiển thị khoảng thời gian của tuần
function updateWeekRangeDisplay() {
  const weekStart = currentWeekStart.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' });
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' });
  document.getElementById('scheduleWeekRange').textContent = `Tuần: ${weekStart} đến ${weekEndStr}/${weekEnd.getFullYear()}`;
}

// Lấy thông tin user từ token
function getCurrentUserInfo() {
  const token = getToken();
  if (token) {
    const payload = parseJwt(token);
    console.log('Token payload:', payload);
    return payload ? { id: payload.id, sub: payload.sub } : null;
  }
  return null;
}

// Tạo và hiển thị popup
function showPopup(schedule) {
  let modal = document.createElement('div');
  modal.className = 'modal';

  let modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  const date = new Date(schedule.date);
  const formattedDate = date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });

  modalContent.innerHTML = `
    <h2>Chi tiết ca làm việc</h2>
    <p><strong>Tên nhân viên:</strong> ${schedule.name}</p>
    <p><strong>Ngày làm việc:</strong> ${formattedDate}</p>
    <p><strong>Giờ làm:</strong> ${schedule.startTime} - ${schedule.endTime}</p>
    <p><strong>Ca làm việc:</strong> ${schedule.shift || determineShift(schedule.startTime, schedule.endTime).name}</p>
    <p><strong>Khu vực:</strong> ${schedule.area}</p>
    <button onclick="this.parentElement.parentElement.remove();document.body.removeChild(document.querySelector('.modal'))">Đóng</button>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// Hàm tạo shift item với style đơn giản
function createShiftItem(schedule, shiftInfo) {
  const formDiv = document.createElement('div');
  formDiv.className = 'shift-item';
  
  const nameSpan = document.createElement('span');
  nameSpan.textContent = `${schedule.name} [${shiftInfo.name}]`;
  nameSpan.style.fontWeight = 'bold';
  nameSpan.style.display = 'block';
  
  const areaSpan = document.createElement('span');
  areaSpan.textContent = `(${schedule.area})`;
  areaSpan.style.fontSize = '11px';
  areaSpan.style.opacity = '0.9';
  
  formDiv.appendChild(nameSpan);
  formDiv.appendChild(areaSpan);
  
  // Áp dụng style đơn giản
  formDiv.style.backgroundColor = shiftInfo.color;
  formDiv.style.color = shiftInfo.textColor;
  formDiv.style.border = `2px solid ${shiftInfo.borderColor}`;
  formDiv.style.padding = '4px 6px';
  formDiv.style.marginBottom = '8px';
  formDiv.style.fontSize = '11px';
  formDiv.style.cursor = 'pointer';
  formDiv.style.width = '80%';
  formDiv.style.minHeight = '35px';
  formDiv.style.boxSizing = 'border-box';
  formDiv.style.display = 'flex';
  formDiv.style.flexDirection = 'column';
  formDiv.style.justifyContent = 'center';
  formDiv.style.margin = '0 auto';
  formDiv.style.marginRight = '10px';

  formDiv.onclick = (e) => {
    e.preventDefault();
    showPopup(schedule);
  };
  
  return formDiv;
}

// Tải lịch làm việc của user hiện tại - cải tiến
async function loadSchedule() {
  const userInfo = getCurrentUserInfo();
  if (!userInfo) {
    showError('error', '❌ Vui lòng đăng nhập để xem lịch làm việc.');
    return;
  }

  try {
    const weekStartStr = currentWeekStart.toISOString().split('T')[0];
    const data = await apiFetch(`${API_BASE_URL}/shifts?weekStart=${weekStartStr}`);
    console.log('API Response:', data);

    if (data.code === 1000 && data.result) {
      const schedules = data.result;
      const scheduleBody = document.getElementById('scheduleBody');
      const scheduleMessage = document.getElementById('scheduleMessage');

      // Xóa nội dung cũ
      const dateRow = scheduleBody.getElementsByTagName('tr')[0];
      const shiftRow = scheduleBody.getElementsByTagName('tr')[1];
      const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

      // Đặt ngày cho từng ô
      const weekStartDate = new Date(currentWeekStart);
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStartDate);
        date.setDate(weekStartDate.getDate() + i);
        document.getElementById(`${days[i]}Date`).textContent = date.getDate();
        document.getElementById(`${days[i]}Date`).setAttribute('data-full-date', date.toISOString().split('T')[0]);
      }

      // Xóa ca làm việc cũ
      days.forEach(day => {
        const shiftCell = document.getElementById(`${day}Shift`);
        if (shiftCell) {
          shiftCell.innerHTML = '';
          shiftCell.style.minHeight = '50px';
          shiftCell.style.verticalAlign = 'middle';
          shiftCell.style.padding = '4px';
          shiftCell.style.width = '100%';
          shiftCell.style.boxSizing = 'border-box';
          shiftCell.style.marginRight = '15px';
          shiftCell.style.textAlign = 'center';
        }
      });

      // Lọc và gán ca làm việc của user hiện tại
      const usernameFromSub = userInfo.sub.split('@')[0];
      const userSchedules = schedules.filter(schedule => {
        console.log('Filtering schedule:', schedule, 'Sub username:', usernameFromSub);
        return schedule.name === usernameFromSub || (schedule.userId && schedule.userId.toString() === userInfo.id);
      });
      console.log('User Schedules:', userSchedules);

      userSchedules.forEach(schedule => {
        const date = new Date(schedule.date);
        console.log('Parsed schedule date:', date.toISOString().split('T')[0], 'Day index:', date.getDay());
        const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 6);
        const shiftCell = document.getElementById(`${days[dayIndex]}Shift`);
        const cellDate = document.getElementById(`${days[dayIndex]}Date`).getAttribute('data-full-date');
        console.log('Cell date:', cellDate, 'Schedule date:', schedule.date);

        if (shiftCell && !isNaN(date.getTime()) && schedule.date >= weekStartDate.toISOString().split('T')[0] && schedule.date <= weekEndDate.toISOString().split('T')[0]) {
          const shiftInfo = determineShift(schedule.startTime, schedule.endTime);
          const shiftItem = createShiftItem(schedule, shiftInfo);
          // Thêm khoảng cách giữa các shift-item trong cùng một cell
          if (shiftCell.children.length > 0) {
            shiftItem.style.marginTop = '10px';
          }
          shiftCell.appendChild(shiftItem);
        }
      });

      scheduleMessage.textContent = userSchedules.length > 0 ? `Tổng số ca: ${userSchedules.length}` : 'Không có ca làm việc nào trong tuần này.';
      updateWeekRangeDisplay();
    } else {
      showError('error', `❌ ${data.message || 'Không thể tải lịch làm việc.'}`);
    }
  } catch (error) {
    console.error('Error fetching schedule:', error);
    showError('error', `❌ ${error.message || 'Lỗi kết nối hệ thống, vui lòng thử lại.'}`);
  }
}

// Điều hướng tuần trước/sau
function changeWeek(offset) {
  currentWeekStart.setDate(currentWeekStart.getDate() + offset * 7);
  loadSchedule();
}

// Cập nhật showSection để tải lịch khi hiển thị
function showSection(sectionId) {
  const sections = document.querySelectorAll('.section');
  sections.forEach(section => section.classList.remove('active'));
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => link.classList.remove('active'));
  const sidebarLink = document.getElementById(`sidebar${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`);
  if (sidebarLink) sidebarLink.classList.add('active');
  document.getElementById(`${sectionId}Section`).classList.add('active');

  if (sectionId === 'revenue') {
    refreshRevenue();
  } else if (sectionId === 'transactions') {
    refreshTransactions();
  } else if (sectionId === 'schedule') {
    loadSchedule();
  }
}

// Hàm khởi tạo (gọi khi trang tải)
document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  if (token) {
    const payload = parseJwt(token);
    if (payload && payload.sub) {
      document.getElementById('cashier-name').textContent = `👤 Cashier: ${payload.sub}`;
    }
  }
  
  // Thêm CSS cho shift items, giữ đơn giản
  const style = document.createElement('style');
  style.textContent = `
    .shift-item {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.2;
      user-select: none;
      width: 80% !important;
      min-height: 35px !important;
      box-sizing: border-box !important;
      margin: 0 auto;
      margin-right: 10px;
    }
    
    /* Loại bỏ hoàn toàn ::before để đơn giản hơn */
    
    /* Responsive cho mobile */
    @media (max-width: 768px) {
      .shift-item {
        font-size: 10px !important;
        padding: 4px 6px !important;
      }
    }
  `;
  document.head.appendChild(style);
  
  loadSchedule();
});

// =====================================================xem lịch===============
window.addEventListener('load', () => {
    if (!getToken()) {
        window.location.href = 'login.html';
    } else {
        loadSchedule();
    }
});