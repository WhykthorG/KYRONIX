/**
 * src/hooks/useFormSubmit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook reutilizável para formulários com feedback de loading/success/error.
 * 
 * Uso:
 *   const { isLoading, error, success, submitForm } = useFormSubmit();
 *   
 *   const handleSubmit = async (data) => {
 *     await submitForm(async () => {
 *       await api.save(data);
 *     });
 *   };
 *
 * Retorna estado para renderizar UI:
 *   { isLoading, error, success, reset }
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export function useFormSubmit({
  onSuccess = null,
  onError = null,
  successMessage = 'Operação realizada com sucesso!',
  errorMessageFallback = 'Erro ao processar operação',
  showToast = true,
  resetAfter = 0, // ms para resetar após sucesso (0 = não reseta automaticamente)
} = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  const submitForm = useCallback(
    async (submitFn) => {
      setIsLoading(true);
      setError(null);
      setSuccess(false);

      try {
        await submitFn();

        setSuccess(true);
        if (showToast) {
          toast.success(successMessage);
        }

        if (onSuccess) {
          onSuccess();
        }

        if (resetAfter > 0) {
          setTimeout(() => {
            reset();
          }, resetAfter);
        }
      } catch (err) {
        const errorMsg = err?.message || errorMessageFallback;
        setError(errorMsg);

        if (showToast) {
          toast.error(errorMsg);
        }

        if (onError) {
          onError(err);
        }

        console.error('[useFormSubmit]', err);
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError, successMessage, errorMessageFallback, showToast, resetAfter, reset]
  );

  return {
    isLoading,
    error,
    success,
    reset,
    submitForm,
  };
}

/**
 * Hook auxiliar para validação básica de formulário
 */
export function useFormValidation(initialValues = {}, validate = null) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Limpar erro daquele campo ao começar a digitar
    setErrors(prev => ({ ...prev, [name]: null }));
  }, []);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Validar campo individual se função de validação foi passada
    if (validate) {
      const fieldErrors = validate(values);
      setErrors(fieldErrors);
    }
  }, [values, validate]);

  const validateAll = useCallback(() => {
    if (!validate) return true;
    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  }, [values, validate]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    setValues,
    errors,
    setErrors,
    touched,
    setTouched,
    handleChange,
    handleBlur,
    validateAll,
    reset,
  };
}

/**
 * Hook para gerenciar estado de carregamento de dados
 */
export function useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = useState(initialState);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const load = useCallback(async (fn) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { isLoading, error, data, load, reset };
}
