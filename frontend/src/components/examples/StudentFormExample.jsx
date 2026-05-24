// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
/**
 * src/components/examples/StudentFormExample.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * EXEMPLO COMPLETO: Formulário de aluno com:
 * - Validação de CPF com máscara
 * - Feedback loading/success/error
 * - Tratamento de erro robusto
 * - try/catch para evitar tela branca
 *
 * USE COMO REFERÊNCIA PARA OUTROS FORMULÁRIOS
 */

import React, { useState } from 'react';
import { CPFInput, PhoneInput, EmailInput, NameInput } from '@/components/common/ValidatedInput';
import { FormFeedback, SubmitButton, FormAlert } from '@/components/common/FormFeedback';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { Button } from '@/components/ui/button';
import DOMPurify from 'dompurify';

/**
 * Exemplo de uso em um formulário
 */
export function StudentFormExample() {
  // Estado do formulário
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    birthDate: '',
  });

  // Hook de feedback de formulário (loading/success/error)
  const { isLoading, error, success, reset, submitForm } = useFormSubmit({
    successMessage: 'Aluno salvo com sucesso!',
    errorMessageFallback: 'Erro ao salvar aluno',
    onSuccess: () => {
      // Limpar formulário após sucesso
      setTimeout(() => {
        setFormData({
          name: '',
          email: '',
          cpf: '',
          phone: '',
          birthDate: '',
        });
        reset();
      }, 1000);
    },
  });

  // Validação local
  const [validationErrors, setValidationErrors] = useState({});

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email é obrigatório';
    }

    if (!formData.cpf.replace(/\D/g, '') || formData.cpf.replace(/\D/g, '').length !== 11) {
      errors.cpf = 'CPF deve ter 11 dígitos';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Telefone é obrigatório';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handler do submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validar localmente
    if (!validateForm()) {
      return;
    }

    // 2. Enviar com feedback
    await submitForm(async () => {
      // 3. Sanitizar dados antes de enviar
      const sanitizedData = {
        name: DOMPurify.sanitize(formData.name),
        email: DOMPurify.sanitize(formData.email),
        cpf: formData.cpf.replace(/\D/g, ''),
        phone: formData.phone.replace(/\D/g, ''),
        birthDate: formData.birthDate,
      };

      // 4. Chamar API (envolver em try/catch)
      try {
        const response = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitizedData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Erro ao salvar');
        }

        const result = await response.json();
        console.log('Aluno criado:', result);
      } catch (err) {
        // Mensagem amigável ao usuário
        throw new Error(
          err.message || 'Erro ao processar. Tente novamente em alguns segundos.'
        );
      }
    });
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cadastro de Aluno</h1>
        <p className="text-sm text-slate-600 mt-1">Preencha os dados do aluno</p>
      </div>

      {/* Feedback geral do formulário */}
      <FormFeedback
        isLoading={isLoading}
        error={error}
        success={success}
        successMessage="Aluno salvo com sucesso!"
      />

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome */}
        <NameInput
          value={formData.name}
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            setValidationErrors({ ...validationErrors, name: null });
          }}
          label="Nome Completo"
          required
        />

        {/* Email */}
        <EmailInput
          value={formData.email}
          onChange={(e) => {
            setFormData({ ...formData, email: e.target.value });
            setValidationErrors({ ...validationErrors, email: null });
          }}
          label="E-mail"
          required
        />

        {/* CPF com máscara automática */}
        <CPFInput
          value={formData.cpf}
          onChange={(formatted) => {
            setFormData({ ...formData, cpf: formatted });
            setValidationErrors({ ...validationErrors, cpf: null });
          }}
          label="CPF"
          required
        />
        {validationErrors.cpf && (
          <FormAlert
            type="error"
            message={validationErrors.cpf}
            className="mt-2"
          />
        )}

        {/* Telefone com máscara automática */}
        <PhoneInput
          value={formData.phone}
          onChange={(formatted) => {
            setFormData({ ...formData, phone: formatted });
            setValidationErrors({ ...validationErrors, phone: null });
          }}
          label="Telefone"
          required
        />

        {/* Data de nascimento */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Data de Nascimento
          </label>
          <input
            type="date"
            value={formData.birthDate}
            onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Botões de ação */}
        <div className="flex gap-3 pt-4">
          <SubmitButton
            isLoading={isLoading}
            success={success}
            className="flex-1"
          >
            Salvar Aluno
          </SubmitButton>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFormData({
                name: '',
                email: '',
                cpf: '',
                phone: '',
                birthDate: '',
              });
              setValidationErrors({});
              reset();
            }}
          >
            Limpar
          </Button>
        </div>
      </form>

      {/* Dicas */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
        <p className="font-semibold text-slate-700">💡 Dicas:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>O CPF é validado automaticamente com dígitos verificadores</li>
          <li>A máscara é aplicada enquanto você digita</li>
          <li>Se houver erro, um ícone vermelho aparece</li>
          <li>Ao salvar, você verá feedback visual de loading/sucesso</li>
        </ul>
      </div>
    </div>
  );
}

export default StudentFormExample;
