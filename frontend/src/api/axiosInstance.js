// axiosInstance.js
import axios from "axios";
import CheckToken from "../utils/checkToken/CheckToken";

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL, // kendi API URL'in
  //   timeout: 10000, // istek zaman asımı (ms)gerekirse etkinleştir
});

// İstek interceptor'u
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await CheckToken();
    if (!token) {
      window.location.href = "/login";
      return Promise.reject(new Error("Lütfen Giriş Yapınız."));
    }

    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("Axios error:", error?.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default axiosInstance;
