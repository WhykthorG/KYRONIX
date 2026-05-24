// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { PasswordInput } from '@/components/common/ValidatedInput';
import { validatePassword } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { CheckCircle, KeyRound } from 'lucide-react';
import { FIRST_ACCESS_STEPS, completeFirstAccess } from '@shared/contracts/auth';

export default function ChangePasswordModal({ open, onClose, onPasswordChanged }) {
  const [step, setStep]               = useState(FIRST_ACCESS_STEPS.PROMPT);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [passwordApplied, setPasswordApplied] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(FIRST_ACCESS_STEPS.PROMPT);
      setNewPassword('');
      setConfirm('');
      setLoading(false);
      setError('');
      setPasswordApplied(false);
    }
  }, [open]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      await completeFirstAccess({
        newPassword,
        confirmPassword: confirm,
        validatePassword,
        passwordAlreadyUpdated: passwordApplied,
        updatePassword: async (password) => {
          const { error: authErr } = await supabase.auth.updateUser({ password });
          if (authErr) throw authErr;
          setPasswordApplied(true);
        },
        clearFirstLoginFlag: async () => {
          await onPasswordChanged?.();
        },
      });
      setStep(FIRST_ACCESS_STEPS.DONE);
    } catch (err) {
      setError(err.message ?? 'Erro ao trocar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v && step === 'done') onClose(); }}
    >
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { if (step !== FIRST_ACCESS_STEPS.DONE) e.preventDefault(); }}
      >
        <DialogDescription className="sr-only">
          Primeiro acesso — configuração de senha
        </DialogDescription>

        {step === FIRST_ACCESS_STEPS.PROMPT && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                Bem-vindo ao Project WG!
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600">
                Este é seu primeiro acesso. Para continuar, defina uma senha pessoal antes de usar o sistema.
              </p>
              <p className="text-xs text-slate-400">
                A senha temporária deixa de ser aceita somente depois que a troca for concluída com sucesso.
              </p>
            </div>
            <div className="flex justify-end">
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setStep(FIRST_ACCESS_STEPS.FORM)}>
                Definir nova senha
              </Button>
            </div>
          </>
        )}

        {step === FIRST_ACCESS_STEPS.FORM && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                Criar nova senha
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleChangePassword} className="space-y-4 py-2">
              <PasswordInput
                label="Nova senha"
                required
                value={newPassword}
                onChange={setNewPassword}
                showStrength={true}
              />
              <PasswordInput
                label="Confirmar senha"
                required
                confirm={true}
                confirmValue={newPassword}
                value={confirm}
                onChange={setConfirm}
                showStrength={false}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(FIRST_ACCESS_STEPS.PROMPT)}>
                  Voltar
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar senha'}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === FIRST_ACCESS_STEPS.DONE && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Senha atualizada!
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600 py-2">
              Sua nova senha foi salva. Bem-vindo ao Project WG!
            </p>
            <div className="flex justify-end">
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={onClose}>
                Entrar no sistema
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
