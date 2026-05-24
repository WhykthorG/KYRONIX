import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSessionSafely, supabase } from '@/lib/supabase';
import { validatePassword } from '@/lib/validators';

function validateResetPassword(nextPassword, confirmPassword) {
  const { valid, errors } = validatePassword(nextPassword || '');

  if (!valid) {
    throw new Error(errors[0] || 'A senha não atende aos requisitos mínimos.');
  }

  if (nextPassword !== confirmPassword) {
    throw new Error('As senhas não coincidem.');
  }
}

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    getSessionSafely().then(({ data, error: sessionError }) => {
      if (!active) return;

      if (sessionError) {
        setError(sessionError.message || 'Não foi possível validar o link de recuperação.');
        setCheckingSession(false);
        return;
      }

      setHasRecoverySession(Boolean(data.session));
      setCheckingSession(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      validateResetPassword(newPassword, confirmPassword);
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      await supabase.auth.signOut();
      setSuccess(true);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível redefinir sua senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-auth-shell">
      <div className="w-full max-w-md">
        <div className="app-auth-panel">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius)] bg-primary shadow-[0_18px_40px_hsl(var(--primary)/0.32)]">
              <LockKeyhole className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-white">Redefinir senha</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Crie uma nova senha para concluir a recuperação do acesso.
            </p>
          </div>

          {checkingSession ? (
            <div className="flex items-center justify-center rounded-[var(--radius)] border border-white/10 bg-white/5 p-6 text-slate-200">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Validando link de recuperação...
            </div>
          ) : success ? (
            <div className="space-y-4 rounded-[var(--radius)] border border-emerald-400/20 bg-emerald-500/10 p-5 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
              <p className="text-sm leading-6 text-emerald-50">
                Senha redefinida com sucesso. Faça login novamente com a nova credencial.
              </p>
              <Button type="button" className="w-full" onClick={() => { window.location.href = '/login'; }}>
                Ir para o login
              </Button>
            </div>
          ) : !hasRecoverySession ? (
            <div className="space-y-4 rounded-[var(--radius)] border border-amber-400/20 bg-amber-500/10 p-5">
              <AlertCircle className="h-6 w-6 text-amber-200" />
              <p className="text-sm leading-6 text-amber-50">
                O link de recuperação não está válido ou já expirou. Solicite um novo link na tela de login.
              </p>
              <Button type="button" variant="outline" className="w-full border-amber-200/40 bg-transparent text-white hover:bg-white/10" onClick={() => { window.location.href = '/login'; }}>
                Voltar para o login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-sm text-slate-200">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Digite a nova senha"
                  autoComplete="new-password"
                  className="border-slate-600/80 bg-slate-900/65 text-white placeholder:text-slate-400 hover:border-slate-500 focus-visible:ring-blue-400/30"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-sm text-slate-200">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  className="border-slate-600/80 bg-slate-900/65 text-white placeholder:text-slate-400 hover:border-slate-500 focus-visible:ring-blue-400/30"
                />
              </div>

              <div className="rounded-[calc(var(--radius)-4px)] border border-white/10 bg-white/5 p-3 text-xs leading-6 text-slate-300">
                Use ao menos 8 caracteres com letra maiúscula, letra minúscula, número e símbolo.
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-[calc(var(--radius)-4px)] border border-red-500/25 bg-red-500/10 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
                  <p className="text-sm text-red-100">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando nova senha…</>
                  : 'Salvar nova senha'
                }
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
