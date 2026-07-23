import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api/backend/api/v1",
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    // Proxy sessiz refresh'i de denedi; buraya gelen 401 = oturum gerçekten bitti.
    if (error.response?.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
