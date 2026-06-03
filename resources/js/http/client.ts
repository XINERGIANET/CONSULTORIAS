import axios, { type AxiosError } from "axios";

export const httpClient = axios.create({
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  headers: {
    "X-Requested-With": "XMLHttpRequest",
  },
});

// 401 = sesión expirada → redirigir al login automáticamente.
httpClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && window.location.pathname !== "/login") {
      window.location.href = "/login";
      return new Promise(() => {});
    }
    return Promise.reject(error);
  },
);
