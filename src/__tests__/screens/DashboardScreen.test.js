import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import DashboardScreen from '../../screens/DashboardScreen';
import { AuthProvider } from '../../context/AuthContext';

jest.mock('../../services/api', () => ({
  dashboardAPI: {
    getStats: jest.fn(() =>
      Promise.resolve({
        salesToday: 1000,
        totalProducts: 50,
        lowStockCount: 5,
      })
    ),
    getSalesWeek: jest.fn(() => Promise.resolve([])),
  },
  syncManager: {
    syncAllData: jest.fn(),
  },
}));

jest.mock('../../services/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('react-native-chart-kit', () => ({
  LineChart: () => null,
}));

const renderWithNav = (component) =>
  render(
    <NavigationContainer>
      <AuthProvider>{component}</AuthProvider>
    </NavigationContainer>
  );

describe('DashboardScreen', () => {
  it('affiche la vue principale', async () => {
    const { getByText } = renderWithNav(<DashboardScreen />);

    await waitFor(() => {
      expect(getByText(/Resume du jour|Résumé du jour/i)).toBeTruthy();
    });
  });

  it('affiche les statistiques cles', async () => {
    const { getByText } = renderWithNav(<DashboardScreen />);

    await waitFor(() => {
      expect(getByText(/Ventes aujourd'hui/i)).toBeTruthy();
      expect(getByText(/Stock critique/i)).toBeTruthy();
    });
  });
});
