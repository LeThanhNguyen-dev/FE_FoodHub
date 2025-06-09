async function introspectToken(token) {
    try {
        const response = await fetch('/introspect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })  // gửi token trong body JSON
        });

        if (!response.ok) {
            // Nếu response lỗi, thử đọc message lỗi từ JSON hoặc trả về lỗi chung
            const contentType = response.headers.get('Content-Type') || '';
            if (contentType.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Lỗi server không xác định');
            } else {
                const errorText = await response.text();
                throw new Error('Lỗi server: ' + errorText);
            }
        }

        const data = await response.json();
        return data.result.valid;  // true hoặc false

    } catch (error) {
        console.error('Lỗi kiểm tra token:', error);
        return false;  // Nếu có lỗi thì coi như token không hợp lệ
    }
}
