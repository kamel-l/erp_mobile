// src/__tests__/screens/NotificationsScreen.test.js
import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import NotificationsScreen from '../../screens/NotificationsScreen';
import { getLocalProducts } from '../../database/database';
import { getLocalSales } from '../../database/salesRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

jest.mock('../../database/database', () => ({
  getLocalProducts: jest.fn(),
}));

jest.mock('../../database/salesRepository', () => ({
  getLocalSales: jest.fn(),
}));

jest.spyOn(Alert, 'alert');

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(null);
  });

  it('renders correctly with no notifications', async () => {
    getLocalProducts.mockResolvedValue([]);
    getLocalSales.mockResolvedValue([]);

    const { getByText, queryByText } = render(<NotificationsScreen />);

    await waitFor(() => {
      expect(getByText('Aucune notification')).toBeTruthy();
    });
  });

  it('generates notifications for critical stock and pending sales', async () => {
    getLocalProducts.mockResolvedValue([
      { id: 1, name: 'Prod A', stock_quantity: 5, min_stock: 10, updated_at: new Date().toISOString() }
    ]);
    getLocalSales.mockResolvedValue([
      { id: 1, invoice: 'INV-1', status: 'pending', total: 100, client_name: 'Client A', sale_date: new Date().toISOString() }
    ]);

    const { getByText } = render(<NotificationsScreen />);

    await waitFor(() => {
      expect(getByText('Stock critique')).toBeTruthy();
      expect(getByText('Paiement en attente')).toBeTruthy();
    });
  });

  it('handles mark all read', async () => {
    getLocalProducts.mockResolvedValue([
      { id: 1, name: 'Prod A', stock_quantity: 5, min_stock: 10, updated_at: new Date().toISOString() }
    ]);
    getLocalSales.mockResolvedValue([]);

    const { getByText, queryByText } = render(<NotificationsScreen />);

    await waitFor(() => {
      expect(getByText('Tout lire')).toBeTruthy();
    });

    const markAllBtn = getByText('Tout lire');
    await act(async () => {
      fireEvent.press(markAllBtn);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@erp_read_notifications',
      expect.any(String)
    );
  });

  it('opens modal on notification press', async () => {
    getLocalProducts.mockResolvedValue([
      { id: 1, name: 'Prod A', stock_quantity: 5, min_stock: 10, updated_at: new Date().toISOString() }
    ]);
    getLocalSales.mockResolvedValue([]);

    const { getByText, queryByText } = render(<NotificationsScreen />);

    await waitFor(() => {
      expect(getByText('Stock critique')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('Stock critique'));
    });

    expect(getByText('Fermer')).toBeTruthy();
    
    // Close modal
    await act(async () => {
      fireEvent.press(getByText('Fermer'));
    });
  });
});
