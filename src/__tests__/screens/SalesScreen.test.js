// src/__tests__/screens/SalesScreen.test.js
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import SalesScreen from '../../screens/SalesScreen';
import { AuthProvider } from '../../context/AuthContext';

// Mock des dépendances
jest.mock('../../database/salesRepository', () => ({
  getLocalSales: jest.fn(() => Promise.resolve([
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
  ])),
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

const renderWithNav = (component) => {
  return render(
    <NavigationContainer>
      <AuthProvider>
        {component}
      </AuthProvider>
    </NavigationContainer>
  );
};

describe('SalesScreen', () => {
  it('affiche la liste des ventes', async () => {
    const { getByText } = renderWithNav(<SalesScreen />);
    
    await waitFor(() => {
      expect(getByText(/INV-001|Ventes/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('affiche les infos de la vente', async () => {
    const { getByText } = renderWithNav(<SalesScreen />);
    
    await waitFor(() => {
      expect(getByText(/Client Test/)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('affiche le statut de la vente', async () => {
    const { getByText } = renderWithNav(<SalesScreen />);
    
    await waitFor(() => {
      expect(getByText(/PAYÉE|paid/i)).toBeTruthy();
    }, { timeout: 3000 });
  });
});
