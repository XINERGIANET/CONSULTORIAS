import { httpClient } from './http/client';

<<<<<<< HEAD
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.withCredentials = true;

window.axios.interceptors.request.use((config) => {
  const csrf = document.querySelector('meta[name="csrf-token"]');
  if (csrf) {
    config.headers['X-CSRF-TOKEN'] = csrf.getAttribute('content');
  }
  return config;
});
=======
window.axios = httpClient;
>>>>>>> 35c26abf4f22aac8d5f323b93cbfe0c48b9e7db7
