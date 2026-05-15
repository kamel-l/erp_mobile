// src/__tests__/screens/SaleDetailScreen.test.js
import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import SaleDetailScreen from '../../screens/SaleDetailScreen';
import * as salesRepo from '../../database/salesRepository';
import { Alert } from 'react-native';
import * as Print from 'expo-print';

jest.mock('../../database/salesRepository', () => ({
  getSaleWithItems: jest.fn(),
  updateSaleStatus: jest.fn(),
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file://test.pdf' }),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(),
}));

jest.spyOn(Alert, 'alert');

describe('SaleDetailScreen', () => {
  const mockNavigation = { navigate: jest.fn() };
  const mockRoute = { params: { saleId: 1 } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state then sale details', async () => {
    salesRepo.getSaleWithItems.mockResolvedValue({
      id: 1,
      invoice: 'FAC-001',
      client_name: 'Client A',
      status: 'pending',
      total: 1000,
      sale_date: new Date().toISOString(),
      items: [
        { name: 'Prod A', quantity: 2, unit_price: 500, total: 1000 }
      ]
    });

    const { getByText, queryByText } = render(
      <SaleDetailScreen route={mockRoute} navigation={mockNavigation} />
    );

    expect(getByText('Chargement...')).toBeTruthy();

    await waitFor(() => {
      expect(getByText('FAC-001')).toBeTruthy();
      expect(getByText('Client A')).toBeTruthy();
    });
  });

  it('handles status change', async () => {
    salesRepo.getSaleWithItems.mockResolvedValue({
      id: 1,
      invoice: 'FAC-001',
      status: 'pending',
      total: 1000,
      sale_date: new Date().toISOString(),
      items: []
    });
    salesRepo.updateSaleStatus.mockResolvedValue();

    const { getByText } = render(
      <SaleDetailScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('✓ Marquer payée')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('✓ Marquer payée'));
    });

    expect(salesRepo.updateSaleStatus).toHaveBeenCalledWith(1, 'paid');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Succès',
      'Statut modifié en Payée'
    );
  });

  it('handles PDF export', async () => {
    salesRepo.getSaleWithItems.mockResolvedValue({
      id: 1,
      invoice: 'FAC-001',
      status: 'paid',
      total: 1000,
      sale_date: new Date().toISOString(),
      items: []
    });

    const { getByText } = render(
      <SaleDetailScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(getByText('📎 Exporter PDF')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('📎 Exporter PDF'));
    });

    expect(Print.printToFileAsync).toHaveBeenCalled();
  });
});
