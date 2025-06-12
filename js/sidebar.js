function handleLogout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?')) {
        document.body.style.opacity = '0.5';
        document.body.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            alert('Đã đăng xuất thành công!');
            window.location.href = '/login.html';
        }, 1000);
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        sidebar.classList.toggle('show');
        if (!sidebar.classList.contains('show')) {
            sidebar.classList.remove('collapsed');
        }
    } else {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }
}

function showReports() {
    alert('Chức năng báo cáo đang được phát triển!');
}

function setActiveNavLink() {
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPath = window.location.pathname.toLowerCase().replace(/^\//, '').replace(/\.html$/, '');
    console.log('Current Path:', currentPath); // Debug

    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href')?.toLowerCase().replace(/^\//, '').replace(/\.html$/, '');
        console.log('Link Href:', href); // Debug

        if (href) {
            // Kiểm tra theo thư mục
            if (currentPath.startsWith('menu-manager') && href.includes('menu-manager')) {
                link.classList.add('active');
                console.log('Active: menu-manager', href); // Debug
            } else if (currentPath.startsWith('staff-manager') && href.includes('staff-manager')) {
                link.classList.add('active');
                console.log('Active: staff-manager', href); // Debug
            }
            // Kiểm tra chính xác cho các trang khác
            else if (currentPath === href) {
                link.classList.add('active');
                console.log('Active: exact match', href); // Debug
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', setActiveNavLink);