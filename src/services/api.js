// src/services/api.js - Point d'entrée central réexportant les modules spécialisés
export { api, isConnected, reinitializeApi, getApiUrl, setApiUrl, generateOperationId } from './apiClient';

export { authAPI } from './authApi';
export { dashboardAPI } from './dashboardApi';
export { salesAPI } from './salesApi';
export { stockAPI } from './stockApi';
export { hrAPI } from './hrApi';
export { reportsAPI } from './reportsApi';
export { syncManager } from './syncManager';

export { MOCK_DATA } from './mockData';
