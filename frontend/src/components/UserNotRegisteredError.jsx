// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { ShieldAlert } from 'lucide-react';
import StatePanel from '@/components/common/StatePanel';

export default function UserNotRegisteredError() {
  const { logout } = useAuth();
  return (
    <div className="app-shell-page flex min-h-screen items-center justify-center">
      <div className="app-surface-card w-full max-w-2xl">
        <StatePanel
          variant="error"
          icon={ShieldAlert}
          title="Acesso não autorizado"
          description="Seu e-mail ainda não possui um perfil de acesso cadastrado. Entre em contato com a administração do sistema para concluir a liberação."
          actionLabel="Sair"
          actionVariant="outline"
          onAction={() => logout()}
        />
      </div>
    </div>
  );
}
