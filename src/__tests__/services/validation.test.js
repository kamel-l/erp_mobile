// src/__tests__/services/validation.test.js
import {
  LoginSchema,
  ClientSchema,
  ProductSchema,
  validateForm,
} from '../../services/validation';

describe('Validation Service', () => {
  describe('LoginSchema', () => {
    it('accepte des identifiants valides', async () => {
      const result = await validateForm(LoginSchema, {
        username: 'admin',
        password: 'password123',
      });
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('rejette un username trop court', async () => {
      const result = await validateForm(LoginSchema, {
        username: 'ab',
        password: 'password123',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.username).toBeDefined();
    });

    it('rejette un password trop court', async () => {
      const result = await validateForm(LoginSchema, {
        username: 'admin',
        password: '123',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.password).toBeDefined();
    });

    it('rejette les champs vides', async () => {
      const result = await validateForm(LoginSchema, {
        username: '',
        password: '',
      });
      expect(result.isValid).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    });
  });

  describe('ClientSchema', () => {
    it('accepte des données de client valides', async () => {
      const result = await validateForm(ClientSchema, {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        address: '123 Main St',
      });
      expect(result.isValid).toBe(true);
    });

    it('rejette un email invalide', async () => {
      const result = await validateForm(ClientSchema, {
        name: 'John Doe',
        email: 'invalid-email',
        phone: '+1234567890',
        address: '123 Main St',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeDefined();
    });

    it('rejette un téléphone invalide', async () => {
      const result = await validateForm(ClientSchema, {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123',
        address: '123 Main St',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.phone).toBeDefined();
    });
  });

  describe('ProductSchema', () => {
    it('accepte des données de produit valides', async () => {
      const result = await validateForm(ProductSchema, {
        name: 'Produit Test',
        barcode: '123456789',
        category: 'Catégorie A',
        price: 99.99,
        stock_quantity: 50,
        min_stock: 10,
      });
      expect(result.isValid).toBe(true);
    });

    it('rejette un prix négatif', async () => {
      const result = await validateForm(ProductSchema, {
        name: 'Produit Test',
        barcode: '123456789',
        category: 'Catégorie A',
        price: -10,
        stock_quantity: 50,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.price).toBeDefined();
    });

    it('rejette un stock négatif', async () => {
      const result = await validateForm(ProductSchema, {
        name: 'Produit Test',
        barcode: '123456789',
        category: 'Catégorie A',
        price: 99.99,
        stock_quantity: -5,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.stock_quantity).toBeDefined();
    });
  });
});
