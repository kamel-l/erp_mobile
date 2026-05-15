import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import SalesScreen from '../../screens/SalesScreen';
import { AuthProvider } from '../../context/AuthContext';

jest.mock('../../database/salesRepository', () => ({
  getLocalSales: jest.fn(() =>
    Promise.resolve([
      {
        id: 1,
        invoice: 'INV-001',
        client_name: 'Client Test',
        total: 5000,
        status: 'paid',
        date: new Date().toISOString(),
        items: [
          {
            id: 1,
            name: 'Produit 1',
            quantity: 2,
            unit_price: 2500,
          },
        ],
      },
    ])
  ),
}));

jest.mock('../../services/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('expo-print', () => ({
  printAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
}));

const renderWithNav = (component) =>
  render(
    <NavigationContainer>
      <AuthProvider>{component}</AuthProvider>
    </NavigationContainer>
  );

describe('SalesScreen', () => {
  it('affiche la liste des ventes', async () => {
    const { getAllByText } = renderWithNav(<SalesScreen />);

    await waitFor(() => {
      expect(getAllByText(/Nouvelle vente|Factures émises/i).length).toBeGreaterThan(0);
    });
  });

  it('affiche les infos de la vente', async () => {
    const { getByText } = renderWithNav(<SalesScreen />);

    await waitFor(() => {
      expect(getByText(/Client Test/)).toBeTruthy();
    });
  });

  it('affiche le statut de la vente', async () => {
    const { getByText } = renderWithNav(<SalesScreen />);

    await waitFor(() => {
      expect(getByText(/PAYÉE|paid/i)).toBeTruthy();
    });
  });
});
