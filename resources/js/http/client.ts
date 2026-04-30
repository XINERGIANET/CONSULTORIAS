import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

/** Misma instancia que `window.axios`: CSRF + cookies para rutas Laravel (web + mismo origen). */
export const httpClient = axios.create({
  withCredentials: true,
  headers: {
    "X-Requested-With": "XMLHttpRequest",
  },
});

httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof document === "undefined") {
    return config;
  }
  const meta = document.querySelector("meta[name='csrf-token']");
  const token = meta?.getAttribute("content")?.trim();
  if (token) {
    config.headers.set("X-CSRF-TOKEN", token);
  }
  return config;
});
