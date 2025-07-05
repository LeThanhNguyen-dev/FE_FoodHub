function handleLogout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        localStorage.removeItem('accessToken');
        sessionStorage.removeItem('accessToken');
        
        
        window.location.href = '/home-page/html/login.html';
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
    console.log('Current Path:', currentPath);

    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href')?.toLowerCase().replace(/^\//, '').replace(/\.html$/, '');
        console.log('Link Href:', href);

        if (href) {
            // Kiểm tra theo thư mục cho các folder có nhiều file
            if (currentPath.startsWith('menu-manager/') && href.includes('menu-manager/')) {
                link.classList.add('active');
                console.log('Active: menu-manager', href);
            } 
            else if (currentPath.startsWith('html/staff-manager/') && href.includes('html/staff-manager/')) {
                link.classList.add('active');
                console.log('Active: staff-manager', href);
            }
            else if (currentPath.startsWith('html/customer-manager/') && href.includes('html/customer-manager/')) {
                link.classList.add('active');
                console.log('Active: customer-manager', href);
            }
            else if (currentPath.startsWith('html/revenue-report/order.html') && href.includes('html/revenue-report/order.html')) {
                link.classList.add('active');
                console.log('Active: revenue-report', href);
            }
             else if (currentPath.startsWith('html/revenue-report/revenue-report.html') && href.includes('html/revenue-report/revenue-report.html')) {
                link.classList.add('active');
                console.log('Active: revenue-report', href);
            }
             else if (currentPath.startsWith('html/revenue-report/transaction.html') && href.includes('html/revenue-report/transaction.html')) {
                link.classList.add('active');
                console.log('Active: revenue-report', href);
            }
            else if (currentPath.startsWith('html/schedule/') && href.includes('html/schedule/')) {
                link.classList.add('active');
                console.log('Active: schedule', href);
            }
            // Kiểm tra chính xác cho các trang đơn lẻ (như dashboard)
            else if (currentPath === href) {
                link.classList.add('active');
                console.log('Active: exact match', href);
            }
        }
    });
}

// Alternative approach - nếu bạn muốn active chính xác từng file
function setActiveNavLinkExact() {
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPath = window.location.pathname.toLowerCase();
    console.log('Current Path:', currentPath);

    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href')?.toLowerCase();
        console.log('Link Href:', href);

        if (href && currentPath.includes(href.replace(/^\//, ''))) {
            link.classList.add('active');
            console.log('Active:', href);
        }
    });
}

document.addEventListener('DOMContentLoaded', setActiveNavLink);