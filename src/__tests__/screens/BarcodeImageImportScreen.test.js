// src/__tests__/screens/BarcodeImageImportScreen.test.js
import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import BarcodeImageImportScreen from '../../screens/BarcodeImageImportScreen';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as db from '../../database/database';
import { Alert } from 'react-native';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ size: 1000 }),
  readAsStringAsync: jest.fn().mockResolvedValue('base64string'),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file://resized.jpg' }),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('../../database/database', () => ({
  getLocalProducts: jest.fn(),
  updateProductImage: jest.fn(),
  updateProductBarcode: jest.fn(),
}));

jest.spyOn(Alert, 'alert');

describe('BarcodeImageImportScreen', () => {
  const mockNavigation = { goBack: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders and allows picking images', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://test.jpg', name: 'produit_A.jpg' }]
    });

    const { getByText } = render(
      <BarcodeImageImportScreen navigation={mockNavigation} />
    );

    await act(async () => {
      fireEvent.press(getByText('📁 Choisir des images'));
    });

    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalled();
    
    await waitFor(() => {
      expect(getByText(/Associer automatiquement/)).toBeTruthy();
    });
  });

  it('processes images and links to product', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://test.jpg', name: 'produit_A.jpg' }]
    });

    db.getLocalProducts.mockResolvedValue([
      { id: 1, name: 'Produit A', barcode: '123456' }
    ]);

    const { getByText, findByText } = render(
      <BarcodeImageImportScreen navigation={mockNavigation} />
    );

    await act(async () => {
      fireEvent.press(getByText('📁 Choisir des images'));
    });

    const processBtn = await findByText(/Associer automatiquement/);
    
    await act(async () => {
      fireEvent.press(processBtn);
    });

    expect(db.updateProductImage).toHaveBeenCalledWith(1, 'data:image/jpeg;base64,base64string');
    
    await waitFor(() => {
      expect(getByText('✅ Terminer')).toBeTruthy();
    });
  });

  it('processes barcode-like filename', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://test2.jpg', name: '1234567890123.jpg' }]
    });

    db.getLocalProducts.mockResolvedValue([
      { id: 2, name: 'Produit B', barcode: null }
    ]);

    const { getByText, findByText } = render(
      <BarcodeImageImportScreen navigation={mockNavigation} />
    );

    await act(async () => {
      fireEvent.press(getByText('📁 Choisir des images'));
    });

    const processBtn = await findByText(/Associer automatiquement/);
    
    await act(async () => {
      fireEvent.press(processBtn);
    });

    // Wait for the processing to finish, where it handles the mismatch or match
    // '1234567890123' does not match 'Produit B' (score=0), so it will not link
    // unless the code matches. Let's verify it shows "Aucun produit trouvé".
    await waitFor(() => {
      expect(getByText(/Aucun produit trouvé/)).toBeTruthy();
    });
  });
});
