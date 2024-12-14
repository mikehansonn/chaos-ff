import axios from 'axios';

// Define the base URL based on environment
const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    // Use the Heroku domain for production
    return 'https://chaos-ff-api-e4512543d694.herokuapp.com/';
  }
  return 'http://localhost:8000';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

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