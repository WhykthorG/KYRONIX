import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { School, Loader2, AlertCircle, ShieldCheck, Sparkles } from 'lucide-react';

export default function Login() {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Preencha e-mail e senha.'); return; }
    setLoading(true);
    try {
      await signIn(email, password);
      sessionStorage.setItem('just_logged_in', 'true');
      // Após login bem-sucedido, faz reload para limpar a URL /login
      window.location.href = '/';
    } catch (err) {
      setError(err.message ?? 'E-mail ou senha incorretos.');
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const nextEmail = (resetEmail || email).toLowerCase().trim();
    if (!nextEmail) {
      setResetFeedback('Informe o e-mail usado no acesso para solicitar a redefinição.');
      return;
    }

    setResetLoading(true);
    setResetFeedback('');

    try {
      await resetPassword(nextEmail);
      setResetFeedback('Se existir uma conta vinculada a este e-mail, você receberá um link seguro para redefinir a senha.');
    } catch (err) {
      setResetFeedback(err.message ?? 'Não foi possível solicitar a redefinição agora.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="app-auth-shell">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="hidden lg:block">
          <div className="max-w-xl space-y-6 text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
              <Sparkles className="h-4 w-4 text-blue-300" />
              Plataforma escolar
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.04em] text-white">
                Gestão escolar clara, rápida e confiável.
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-300">
                Entre para acompanhar matrículas, atividades, frequência, relatórios e comunicação entre equipes, professores e alunos em um único ambiente.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
              <div className="rounded-[var(--radius)] border border-white/10 bg-white/5 p-4">
                <ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" />
                <p className="font-semibold text-white">Acesso controlado</p>
                <p className="mt-1 text-slate-300">Perfis, permissões e fluxos críticos protegidos.</p>
              </div>
              <div className="rounded-[var(--radius)] border border-white/10 bg-white/5 p-4">
                <School className="mb-3 h-5 w-5 text-blue-300" />
                <p className="font-semibold text-white">Operação centralizada</p>
                <p className="mt-1 text-slate-300">Turmas, calendário, biblioteca e comunicação no mesmo sistema.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="app-auth-panel">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius)] bg-primary shadow-[0_18px_40px_hsl(var(--primary)/0.32)]">
              <School className="h-9 w-9 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-white">Project WG</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">Sistema de Gestão Escolar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-slate-200">E-mail</Label>
              <Input
                id="email" type="email"
                data-cy="login-email"
                value={email} onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                placeholder="seu@email.com" autoComplete="email"
                className="border-slate-600/80 bg-slate-900/65 text-white placeholder:text-slate-400 hover:border-slate-500 focus-visible:ring-blue-400/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-slate-200">Senha</Label>
              <Input
                id="password" type="password"
                data-cy="login-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className="border-slate-600/80 bg-slate-900/65 text-white placeholder:text-slate-400 hover:border-slate-500 focus-visible:ring-blue-400/30"
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                data-cy="login-reset-toggle"
                onClick={() => {
                  setResetMode((current) => !current);
                  setResetEmail(email);
                  setResetFeedback('');
                }}
                className="text-sm font-medium text-blue-200 transition hover:text-white"
              >
                Esqueci minha senha
              </button>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-[calc(var(--radius)-4px)] border border-red-500/25 bg-red-500/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
                <p className="text-sm text-red-100">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="mt-2 w-full" data-cy="login-submit">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Entrando…</>
                : 'Entrar'
              }
            </Button>

          </form>

          {resetMode && (
            <div className="rounded-[var(--radius)] border border-white/10 bg-white/5 p-4">
              <form onSubmit={handleResetSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className="text-sm text-slate-200">E-mail para recuperação</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    data-cy="login-reset-email"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value.toLowerCase().trim())}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className="border-slate-600/80 bg-slate-900/65 text-white placeholder:text-slate-400 hover:border-slate-500 focus-visible:ring-blue-400/30"
                  />
                </div>
                {resetFeedback && (
                  <p className="text-sm leading-6 text-slate-200">{resetFeedback}</p>
                )}
                <Button type="submit" variant="outline" disabled={resetLoading} className="w-full border-slate-500/70 bg-slate-900/40 text-white hover:bg-slate-800" data-cy="login-reset-submit">
                  {resetLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando link…</>
                    : 'Enviar link de redefinição'
                  }
                </Button>
              </form>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-slate-400">
            Project WG © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
