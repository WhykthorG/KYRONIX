import React, { useMemo } from 'react';

import MobileShellRoot from '@/components/mobile-shell/MobileShellRoot';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/AuthContext';
import { buildCanonicalMobileModules } from '@/lib/mocks/mobileShell';

function formatNameFromEmail(email) {
  if (!email || !email.includes('@')) return 'Usuário';

  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildViewerFromUser(user) {
  if (!user) {
    return {
      name: 'KYRONIX S.E.N.O',
      role: 'Operação Escolar',
      campus: 'Shell Mobile',
      avatarFallback: 'KY',
    };
  }

  const displayName =
    user.user_metadata?.full_name
    || user.user_metadata?.name
    || formatNameFromEmail(user.email);
  const campus = user.user_metadata?.campus || 'Ambiente autenticado';

  return {
    name: displayName,
    role: user.user_metadata?.role || 'Usuário autenticado',
    campus,
    avatarFallback: displayName.slice(0, 2).toUpperCase(),
  };
}

export default function MobileShell({
  apps = [],
  requestedAppLaunch = null,
  onRequestedAppHandled = null,
  profileKey = null,
}) {
  const { logout, user } = useAuth();
  const { currentProfile } = usePermissions();
  const moduleCatalog = useMemo(() => buildCanonicalMobileModules(apps), [apps]);
  const viewer = useMemo(() => buildViewerFromUser(user), [user]);

  return (
    <MobileShellRoot
      moduleCatalog={moduleCatalog}
      viewer={viewer}
      onLogout={logout}
      requestedAppLaunch={requestedAppLaunch}
      onRequestedAppHandled={onRequestedAppHandled}
      profileKey={profileKey || currentProfile?.id || user?.email || user?.id || null}
    />
  );
}
