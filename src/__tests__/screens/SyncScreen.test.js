// src/__tests__/screens/SyncScreen.test.js
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import SyncScreen from '../../screens/SyncScreen';
import { syncManager, setApiUrl, isConnected } from '../../services/api';
import * as database from '../../database/database';
import { getLocalSales } from '../../database/salesRepository';

jest.mock('../../services/api', () => ({
  syncManager: {
    syncAllData: jest.fn().mockResolvedValue(),
  },
  setApiUrl: jest.fn().mockResolvedValue(true),
  getApiUrl: jest.fn().mockReturnValue('http://192.168.1.65:5000/api'),
  isConnected: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../database/database', () => ({
  getLocalProducts: jest.fn().mockResolvedValue([{ id: 1 }]),
  getLocalClients: jest.fn().mockResolvedValue([{ id: 1 }]),
  getPendingActions: jest.fn().mockResolvedValue([]),
  clearAllData: jest.fn().mockResolvedValue(),
  getLastSyncTime: jest.fn().mockResolvedValue(new Date().toISOString()),
}));

jest.mock('../../database/salesRepository', () => ({
  getLocalSales: jest.fn().mockResolvedValue([{ id: 1, total: 100 }]),
}));

describe('SyncScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders and fetches stats', async () => {
    const { getByText, findByText } = render(<SyncScreen />);
    
    expect(getByText('Synchronisation ERP')).toBeTruthy();
    
    // Stats will load asynchronously
    await findByText('Connecté: http://192.168.1.65:5000/api');
    
    // Wait for the stat cards
    await waitFor(() => {
      // 1 product, 1 client, 1 sale
      expect(database.getLocalProducts).toHaveBeenCalled();
      expect(getLocalSales).toHaveBeenCalled();
    });
  });

  it('triggers manual sync', async () => {
    const { getByText, findByText } = render(<SyncScreen />);
    await findByText('Connecté: http://192.168.1.65:5000/api');

    const syncBtn = getByText('Synchroniser maintenant');
    await act(async () => {
      fireEvent.press(syncBtn);
    });

    expect(syncManager.syncAllData).toHaveBeenCalled();
  });

  it('tests connection configuration', async () => {
    const { getByText, getByPlaceholderText } = render(<SyncScreen />);
    
    const testBtn = getByText('Tester et enregistrer');
    await act(async () => {
      fireEvent.press(testBtn);
    });

    expect(setApiUrl).toHaveBeenCalledWith('http://192.168.1.65:5000/api');
  });
});
