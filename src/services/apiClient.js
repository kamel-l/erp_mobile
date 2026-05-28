import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';
import { getConfig, setConfig } from '../config/config';
import { logger } from './logger';
import { handleNetworkError } from './errorHandler';

const getApiClient = () => {
  const apiUrl = getConfig('API_URL');
  const timeout = getConfig('API_TIMEOUT');
  const api = axios.create({
    baseURL: apiUrl,
    timeout: timeout || 10000,
    headers: { 'Content-Type': 'application/json' },
  });
  api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token && token !== 'offline-token') {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  });
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      const appError = handleNetworkError(error);
      logger.error('API Error', appError);
      return Promise.reject(appError);
    }
  );
  return api;
};

export let api = getApiClient();

export const generateOperationId = () =>
  `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const isConnected = async () => {
  try {
    const netInfo = await Network.getNetworkStateAsync();
    return Boolean(netInfo.isConnected);
  } catch {
    return false;
  }
};

export const reinitializeApi = () => {
  api = getApiClient();
  logger.info('API client réinitialisé avec nouvelle config');
};

export const getApiUrl = () => getConfig('API_URL');

export const setApiUrl = async (newUrl) => {
  try {
    new URL(newUrl);
    await setConfig('API_URL', newUrl);
    reinitializeApi();
    logger.info('URL API mise à jour', { url: newUrl });
    return true;
  } catch (err) {
    logger.error('URL API invalide', err);
    return false;
  }
};
