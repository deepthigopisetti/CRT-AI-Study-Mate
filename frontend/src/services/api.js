import axios from "axios";

const API = axios.create({
    baseURL: "http://127.0.0.1:5000",
});

// Axios Request Interceptor to automatically add Bearer token to requests
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default API;