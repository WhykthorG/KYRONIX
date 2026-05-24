/**
 * src/components/common/ValidatedInput.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componentes de input com formatação automática, validação e feedback visual.
 * Uso: substitui os <Input> simples em qualquer formulário do sistema.
 */
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatCPF, validateCPF,
  formatPhone, validatePhone, validateEmail,
  formatName, validateName,
  validatePassword, passwordStrength,
  formatDateInput, validateDate,
  formatCEP, validateCEP,
} from '@/lib/validators';

// ── Field wrapper ─────────────────────────────────────────────
export function FormField({ label, error, hint, required, children }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <Label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </Label>
      )}
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-rose-500">
          <XCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ── Status icon helper ────────────────────────────────────────
function StatusIcon({ value, valid }) {
  if (!value) return null;
  return valid
    ? <CheckCircle className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
    : <XCircle className="w-4 h-4 text-rose-400 absolute right-3 top-1/2 -translate-y-1/2" />;
}

// ── CPF Input ─────────────────────────────────────────────────
export function CPFInput({ value, onChange, label = 'CPF', required, className }) {
  const digits = String(value || '').replace(/\D/g, '');
  const isFull  = digits.length === 11;
  const isValid = isFull && validateCPF(value);
  const isInvalid = isFull && !isValid;

  return (
    <FormField
      label={label}
      required={required}
      error={isInvalid ? 'CPF inválido — verifique os dígitos' : null}
    >
      <div className="relative">
        <Input
          value={value || ''}
          onChange={e => onChange(formatCPF(e.target.value))}
          placeholder="000.000.000-00"
          maxLength={14}
          className={cn(
            'pr-8',
            isInvalid && 'border-rose-400 focus-visible:ring-rose-400',
            isValid  && 'border-emerald-400 focus-visible:ring-emerald-400',
            className
          )}
        />
        <StatusIcon value={value} valid={isValid} />
      </div>
    </FormField>
  );
}

// ── Telefone Input ────────────────────────────────────────────
export function PhoneInput({ value, onChange, label = 'Telefone', required, className }) {
  const isValid   = validatePhone(value);
  const isInvalid = value && value.length > 10 && !isValid;

  return (
    <FormField
      label={label}
      required={required}
      error={isInvalid ? 'Formato inválido. Use (00) 00000-0000' : null}
      hint="Celular: (00) 00000-0000  |  Fixo: (00) 0000-0000"
    >
      <div className="relative">
        <Input
          value={value || ''}
          onChange={e => onChange(formatPhone(e.target.value))}
          placeholder="(00) 00000-0000"
          maxLength={15}
          className={cn(
            'pr-8',
            isInvalid && 'border-rose-400 focus-visible:ring-rose-400',
            isValid  && 'border-emerald-400 focus-visible:ring-emerald-400',
            className
          )}
        />
        <StatusIcon value={value} valid={isValid} />
      </div>
    </FormField>
  );
}

// ── Email Input ───────────────────────────────────────────────
export function EmailInput({ value, onChange, label = 'E-mail', required, className, gmailOnly = false }) {
  const [touched, setTouched] = useState(false);
  const isValid   = validateEmail(value);
  const isInvalid = touched && value && !isValid;

  return (
    <FormField
      label={label}
      required={required}
      error={isInvalid ? 'E-mail inválido' : null}
    >
      <div className="relative">
        <Input
          type="email"
          value={value || ''}
          onChange={e => onChange(e.target.value.toLowerCase())}
          onBlur={() => setTouched(true)}
          placeholder="nome@exemplo.com"
          className={cn(
            'pr-8',
            isInvalid && 'border-rose-400 focus-visible:ring-rose-400',
            touched && isValid && 'border-emerald-400 focus-visible:ring-emerald-400',
            className
          )}
        />
        <StatusIcon value={touched ? value : ''} valid={isValid} />
      </div>
    </FormField>
  );
}

// ── Nome Input ────────────────────────────────────────────────
export function NameInput({ value, onChange, label = 'Nome Completo', required, className }) {
  const [touched, setTouched] = useState(false);
  const isValid   = validateName(value);
  const isInvalid = touched && value && !isValid;

  return (
    <FormField
      label={label}
      required={required}
      error={isInvalid ? 'Informe o nome completo (mínimo 2 palavras)' : null}
    >
      <Input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onBlur={e => { setTouched(true); onChange(formatName(e.target.value)); }}
        placeholder="Nome Sobrenome"
        className={cn(
          isInvalid && 'border-rose-400 focus-visible:ring-rose-400',
          className
        )}
      />
    </FormField>
  );
}

// ── Data Input ────────────────────────────────────────────────
export function DateInput({ value, onChange, label = 'Data', required, className, maxDate, minDate }) {
  const [touched, setTouched] = useState(false);
  const isFull    = String(value || '').replace(/\D/g, '').length === 8;
  const isValid   = isFull && validateDate(value);
  const isInvalid = touched && isFull && !isValid;

  return (
    <FormField
      label={label}
      required={required}
      error={isInvalid ? 'Data inválida. Use DD/MM/AAAA' : null}
    >
      <div className="relative">
        <Input
          value={value || ''}
          onChange={e => onChange(formatDateInput(e.target.value))}
          onBlur={() => setTouched(true)}
          placeholder="DD/MM/AAAA"
          maxLength={10}
          className={cn(
            'pr-8',
            isInvalid && 'border-rose-400 focus-visible:ring-rose-400',
            isValid  && 'border-emerald-400 focus-visible:ring-emerald-400',
            className
          )}
        />
        <StatusIcon value={isFull ? value : ''} valid={isValid} />
      </div>
    </FormField>
  );
}

// ── CEP Input ─────────────────────────────────────────────────
export function CEPInput({ value, onChange, label = 'CEP', required, className }) {
  const isValid   = validateCEP(value);
  const isFull    = String(value || '').replace(/\D/g, '').length === 8;
  const isInvalid = isFull && !isValid;

  return (
    <FormField
      label={label}
      required={required}
      error={isInvalid ? 'CEP inválido. Use 00000-000' : null}
    >
      <div className="relative">
        <Input
          value={value || ''}
          onChange={e => onChange(formatCEP(e.target.value))}
          placeholder="00000-000"
          maxLength={9}
          className={cn(
            'pr-8',
            isInvalid && 'border-rose-400 focus-visible:ring-rose-400',
            isValid  && 'border-emerald-400 focus-visible:ring-emerald-400',
            className
          )}
        />
        <StatusIcon value={isFull ? value : ''} valid={isValid} />
      </div>
    </FormField>
  );
}

// ── Senha Input com medidor de força ─────────────────────────
export function PasswordInput({ value, onChange, label = 'Senha', required, showStrength = true, className, confirm = false, confirmValue }) {
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);

  const { valid, errors } = validatePassword(value || '');
  const strength = passwordStrength(value || '');
  const strengthColors = { fraca: 'bg-rose-400', media: 'bg-amber-400', forte: 'bg-emerald-500' };
  const strengthLabels = { fraca: 'Fraca', media: 'Média', forte: 'Forte' };
  const strengthWidths = { fraca: 'w-1/3', media: 'w-2/3', forte: 'w-full' };

  const mismatch = confirm && touched && confirmValue !== undefined && value !== confirmValue;

  return (
    <FormField
      label={label}
      required={required}
      error={mismatch ? 'As senhas não coincidem' : (touched && !valid && value ? errors[0] : null)}
    >
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="••••••••"
          className={cn(
            'pr-10',
            touched && !valid && value && 'border-rose-400 focus-visible:ring-rose-400',
            touched && valid && 'border-emerald-400 focus-visible:ring-emerald-400',
            className
          )}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          data-tooltip={show ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Medidor de força */}
      {showStrength && value && !confirm && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-full bg-muted h-1.5">
              <div className={cn('h-1.5 rounded-full transition-all', strengthColors[strength], strengthWidths[strength])} />
            </div>
            <span className={cn('text-xs font-medium',
              strength === 'fraca' ? 'text-rose-500' :
              strength === 'media' ? 'text-amber-500' : 'text-emerald-600'
            )}>
              {strengthLabels[strength]}
            </span>
          </div>
          {errors.length > 0 && (
            <ul className="space-y-0.5">
              {errors.map((e, i) => (
                <li key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <AlertCircle className="w-3 h-3 flex-shrink-0 text-amber-400" />
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </FormField>
  );
}
