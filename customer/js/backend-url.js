const BACKEND_MAP = {
    "localhost": "http://localhost:8080",
    "127.0.0.1": "http://localhost:8080",
    "172.20.10.2": "http://172.20.10.2:8080",
    "192.168.1.2": "http://192.168.1.2:8080",
    "192.168.1.26": "http://192.168.1.26:8080",
    "172.31.224.1": "http://172.31.224.1:8080",
    "192.168.1.37": "http://192.168.1.37:8080"
    "172.20.10.7": "http://172.20.10.7:8080"
};

const BACKEND_BASE_URL = BACKEND_MAP[window.location.hostname] || "http://localhost:8080";
