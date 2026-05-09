// src/services/validation.js
// Schémas de validation Yup pour tous les formulaires

import * as Yup from 'yup';

/**
 * Validation Login
 */
export const LoginSchema = Yup.object().shape({
  username: Yup.string()
    .min(3, 'Minimum 3 caractères')
    .max(50, 'Maximum 50 caractères')
    .required('Nom d\'utilisateur requis'),
  password: Yup.string()
    .min(6, 'Minimum 6 caractères')
    .required('Mot de passe requis'),
});

/**
 * Validation Client
 */
export const ClientSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Minimum 2 caractères')
    .max(100, 'Maximum 100 caractères')
    .required('Nom requis'),
  email: Yup.string()
    .email('Email invalide')
    .required('Email requis'),
  phone: Yup.string()
    .matches(/^[\d\s\-\+\(\)]{10,}$/, 'Téléphone invalide')
    .required('Téléphone requis'),
  address: Yup.string()
    .max(255, 'Maximum 255 caractères')
    .required('Adresse requise'),
});

/**
 * Validation Produit
 */
export const ProductSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Minimum 2 caractères')
    .max(100, 'Maximum 100 caractères')
    .required('Nom requis'),
  barcode: Yup.string()
    .max(50, 'Code barre invalide')
    .required('Code barre requis'),
  category: Yup.string()
    .required('Catégorie requise'),
  price: Yup.number()
    .positive('Le prix doit être positif')
    .required('Prix requis'),
  stock_quantity: Yup.number()
    .min(0, 'Stock ne peut être négatif')
    .required('Stock requis'),
  min_stock: Yup.number()
    .min(0, 'Stock minimum ne peut être négatif'),
  description: Yup.string()
    .max(500, 'Maximum 500 caractères'),
});

/**
 * Validation Vente/Ligne de vente
 */
export const SaleLineSchema = Yup.object().shape({
  product_id: Yup.number()
    .positive()
    .required('Produit requis'),
  quantity: Yup.number()
    .positive('Quantité doit être positive')
    .required('Quantité requise'),
  unit_price: Yup.number()
    .positive('Prix doit être positif')
    .required('Prix requis'),
});

export const SaleSchema = Yup.object().shape({
  client_id: Yup.number()
    .positive()
    .required('Client requis'),
  lines: Yup.array()
    .of(SaleLineSchema)
    .min(1, 'Minimum 1 ligne requis'),
  notes: Yup.string()
    .max(500, 'Maximum 500 caractères'),
});

/**
 * Validation Config API
 */
export const APIConfigSchema = Yup.object().shape({
  API_URL: Yup.string()
    .url('URL invalide')
    .required('URL API requise'),
  API_TIMEOUT: Yup.number()
    .positive()
    .required('Timeout requis'),
});

/**
 * Validation Utilisateur (création)
 */
export const UserSchema = Yup.object().shape({
  username: Yup.string()
    .min(3, 'Minimum 3 caractères')
    .max(50, 'Maximum 50 caractères')
    .matches(/^[a-zA-Z0-9_-]+$/, 'Caractères autorisés: lettres, chiffres, tiret, underscore')
    .required('Nom d\'utilisateur requis'),
  password: Yup.string()
    .min(6, 'Minimum 6 caractères')
    .max(100, 'Maximum 100 caractères')
    .required('Mot de passe requis'),
  fullname: Yup.string()
    .max(100, 'Maximum 100 caractères'),
  role: Yup.string()
    .oneOf(['user', 'admin'], 'Rôle invalide')
    .required('Rôle requis'),
});

/**
 * Validation Changement de mot de passe
 */
export const UserPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .min(6, 'Minimum 6 caractères')
    .max(100, 'Maximum 100 caractères')
    .required('Mot de passe requis'),
});

/**
 * Utilitaire: valider et retourner les erreurs
 */
export const validateForm = async (schema, values) => {
  try {
    await schema.validate(values, { abortEarly: false });
    return { isValid: true, errors: {} };
  } catch (err) {
    const errors = {};
    if (err.inner) {
      err.inner.forEach((fieldError) => {
        errors[fieldError.path] = fieldError.message;
      });
    }
    return { isValid: false, errors };
  }
};
