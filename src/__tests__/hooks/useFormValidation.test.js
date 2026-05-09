// src/__tests__/hooks/useFormValidation.test.js
import { renderHook, act } from '@testing-library/react-native';
import { useFormValidation } from '../../hooks/useFormValidation';
import { LoginSchema } from '../../services/validation';

describe('useFormValidation Hook', () => {
  const initialValues = {
    username: '',
    password: '',
  };

  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('initialise les valeurs', () => {
    const { result } = renderHook(() =>
      useFormValidation(initialValues, LoginSchema, mockOnSubmit)
    );

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
  });

  it('met à jour les valeurs', () => {
    const { result } = renderHook(() =>
      useFormValidation(initialValues, LoginSchema, mockOnSubmit)
    );

    act(() => {
      result.current.handleChange('username', 'testuser');
    });

    expect(result.current.values.username).toBe('testuser');
  });

  it('marque les champs comme touchés', () => {
    const { result } = renderHook(() =>
      useFormValidation(initialValues, LoginSchema, mockOnSubmit)
    );

    act(() => {
      result.current.handleBlur('username');
    });

    expect(result.current.touched.username).toBe(true);
  });

  it('valide et appelle onSubmit avec données valides', async () => {
    const { result } = renderHook(() =>
      useFormValidation(initialValues, LoginSchema, mockOnSubmit)
    );

    act(() => {
      result.current.handleChange('username', 'testuser');
      result.current.handleChange('password', 'password123');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockOnSubmit).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password123',
    });
  });

  it('affiche les erreurs avec données invalides', async () => {
    const { result } = renderHook(() =>
      useFormValidation(initialValues, LoginSchema, mockOnSubmit)
    );

    act(() => {
      result.current.handleChange('username', 'ab');
      result.current.handleChange('password', '123');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.errors.username).toBeDefined();
    expect(result.current.errors.password).toBeDefined();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('réinitialise le formulaire', () => {
    const { result } = renderHook(() =>
      useFormValidation(initialValues, LoginSchema, mockOnSubmit)
    );

    act(() => {
      result.current.handleChange('username', 'testuser');
      result.current.handleBlur('username');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.touched).toEqual({});
  });
});
