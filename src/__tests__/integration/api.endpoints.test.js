import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as apiModule from '../../services/api';

const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
}));

jest.mock('../../config/config', () => ({
  getConfig: jest.fn((key) => {
    if (key === 'API_URL') return 'http://localhost:5000/api';
    if (key === 'API_TIMEOUT') return 10000;
    return null;
  }),
  setConfig: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../services/errorHandler', () => {
  class MockAppError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return {
    AppError: MockAppError,
    handleNetworkError: jest.fn((e) => e),
    retryWithBackoff: jest.fn((fn) => fn()),
  };
});

jest.mock('../../database/database', () => ({
  getLocalProducts: jest.fn(async () => []),
  saveProductsLocally: jest.fn(async () => true),
  getLocalClients: jest.fn(async () => []),
  saveClientsLocally: jest.fn(async () => true),
  getDashboardStatsOffline: jest.fn(async () => null),
  saveDashboardStatsOffline: jest.fn(async () => true),
  getSalesWeekOffline: jest.fn(async () => []),
  saveSalesWeekOffline: jest.fn(async () => true),
  getLowStockOffline: jest.fn(async () => []),
  saveLowStockOffline: jest.fn(async () => true),
  getEmployeesOffline: jest.fn(async () => []),
  saveEmployeesOffline: jest.fn(async () => true),
  addPendingAction: jest.fn(async () => true),
  getPendingActions: jest.fn(async () => []),
  removePendingAction: jest.fn(async () => true),
  setLastSyncTime: jest.fn(async () => true),
  getLastSyncTime: jest.fn(async () => null),
}));

jest.mock('../../database/salesRepository', () => ({
  getLocalSales: jest.fn(async () => []),
  saveSaleLocally: jest.fn(async () => 1),
  saveSalesOffline: jest.fn(async () => true),
}));

jest.mock('../../utils/performanceOptimizations', () => ({
  cache: {
    clear: jest.fn(),
  },
}));

describe('API Endpoint Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.create.mockReturnValue(mockApiClient);
    apiModule.reinitializeApi();
  });

  test('authAPI.login retourne user/token quand endpoint repond', async () => {
    mockApiClient.post.mockResolvedValueOnce({
      data: {
        data: {
          token: 'jwt-token',
          user: { id: 1, username: 'admin', role: 'admin' },
        },
      },
    });

    const result = await apiModule.authAPI.login('admin', 'password123');

    expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', {
      username: 'admin',
      password: 'password123',
    });
    expect(result.token).toBe('jwt-token');
    expect(result.user.username).toBe('admin');
    expect(SecureStore.setItemAsync).toHaveBeenCalled();
  });

  test('dashboardAPI.getStats lit le endpoint dashboard', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      data: {
        data: {
          salesToday: 1200,
          totalProducts: 10,
        },
      },
    });

    const stats = await apiModule.dashboardAPI.getStats();

    expect(mockApiClient.get).toHaveBeenCalledWith('/dashboard/stats');
    expect(stats.salesToday).toBe(1200);
  });

  test('salesAPI.getAll passe les query params au endpoint sales', async () => {
    const salesData = [{ id: 1, invoice: 'INV-001' }];
    mockApiClient.get.mockResolvedValueOnce({
      data: { data: salesData },
    });

    const result = await apiModule.salesAPI.getAll({ limit: 20 });

    expect(mockApiClient.get).toHaveBeenCalledWith('/sales', { params: { limit: 20 } });
    expect(result).toEqual(salesData);
  });

  test('dashboardAPI.getStats retourne le cache offline si le endpoint echoue', async () => {
    const { getDashboardStatsOffline } = require('../../database/database');
    mockApiClient.get.mockRejectedValueOnce(new Error('network fail'));
    getDashboardStatsOffline.mockResolvedValueOnce({ salesToday: 42 });

    const result = await apiModule.dashboardAPI.getStats();

    expect(result).toEqual({ salesToday: 42 });
  });

  test('setApiUrl retourne false pour une URL invalide, true pour URL valide', async () => {
    const invalid = await apiModule.setApiUrl('not-a-valid-url');
    const valid = await apiModule.setApiUrl('http://127.0.0.1:5000/api');

    expect(invalid).toBe(false);
    expect(valid).toBe(true);
  });
});
