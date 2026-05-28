// src/hooks/useFormValidation.js
// Hook réutilisable pour validation de formulaires

import { useState, useCallback } from 'react';
import { validateForm } from '../services/validation';
import { logger } from '../services/logger';

export const useFormValidation = (initialValues, schema, onSubmit) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((field, value) => {
    setValues(prev => ({
      ...prev,
      [field]: value,
    }));
    // Effacer l'erreur du champ si il était touché
    if (touched[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null,
      }));
    }
  }, [touched]);

  const handleBlur = useCallback((field) => {
    setTouched(prev => ({
      ...prev,
      [field]: true,
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    
    // Valider le formulaire
    const { isValid, errors: validationErrors } = await validateForm(schema, values);
    
    if (!isValid) {
      setErrors(validationErrors);
      setIsSubmitting(false);
      return;
    }

    // Appeler le callback
    try {
      await onSubmit(values);
      // Réinitialiser si succès
      setValues(initialValues);
      setErrors({});
      setTouched({});
    } catch (err) {
      logger.error('Erreur soumission formulaire', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, schema, onSubmit, initialValues]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setValues,
    setErrors,
  };
};
