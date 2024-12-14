import axios from 'axios';

const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://chaos-ff-53c4135ff7c5.herokuapp.com';
  }
  return 'http://localhost:8000';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

console.log('API Base URL:', api.defaults.baseURL);

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;