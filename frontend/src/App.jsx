// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { pagesConfig } from './routes/index.js';
import { getAppByPage } from '@/lib/appManifest';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from '@/pages/Login';
import ResetPasswordPage from '@/pages/ResetPassword';
import ChangePasswordModal from '@/components/common/ChangePasswordModal';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { TooltipPreferencesProvider } from '@/components/common/TooltipPreferencesProvider';
import { AlertTriangle } from 'lucide-react';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { UserProfileApi } from '@/services/supabaseApi';
import { usePermissions } from '@/components/hooks/usePermissions';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import StatePanel from '@/components/common/StatePanel';
import { canAccessPage as canAccessPageByPermission } from '@shared/contracts/access';
import ClientRuntimeObservability from '@/lib/ClientRuntimeObservability';
import NavigationTracker from '@/lib/NavigationTracker';
import MobilePage from '@/pages/MobilePage';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>;

const LEGACY_ROUTE_ALIASES = Object.freeze({
  Users: 'UserManagement',
});

const resolvePageNameFromPath = (pathname) => LEGACY_ROUTE_ALIASES[pathname] ?? pathname;

/**
 * Redireciona qualquer rota de página antiga para o Desktop com a janela correta.
 * Usa getAppByPage do manifesto canônico — sem lista duplicada.
 */
const RedirectPageToDesktop = ({ pageName }) => {
  const location = useLocation();
  const app = getAppByPage(pageName);

  if (!app) {
    return <Navigate to="/Desktop" replace />;
  }

  let appProps;
  if (pageName === 'Registration') {
    const mode = new URLSearchParams(location.search).get('mode');
    if (mode === 'matricula' || mode === 'usuario') {
      appProps = { initialModeProp: mode };
    }
  }

  return (
    <Navigate
      to="/Desktop"
      replace
      state={{
        desktopOpenAppId: app.id,
        ...(appProps ? { desktopOpenAppProps: appProps } : {}),
      }}
    />
  );
};

const RouteHistoryTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const current = sessionStorage.getItem('route_current');
    if (current) sessionStorage.setItem('route_previous', current);
    sessionStorage.setItem('route_current', location.pathname);
  }, [location.pathname]);

  return null;
};

const FullscreenState = ({
  variant = 'loading',
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => (
  <div className="app-shell-page flex min-h-screen items-center justify-center">
    <div className="app-surface-card w-full max-w-2xl">
      <StatePanel
        variant={variant}
        icon={icon}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
        actionVariant={variant === 'error' ? 'outline' : 'default'}
      />
    </div>
  </div>
);

const AppShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, userEmail } = useAuth();
  const {
    profileType,
    isLoadingProfile,
    hasResolvedProfile,
    isProfileLookupError,
    refetchProfile,
  } = usePermissions();
  const [firstAccess, setFirstAccess] = useState(false);
  const [profileId, setProfileId]     = useState(null);
  const [checkedFirst, setCheckedFirst] = useState(false);

  // Check first access flag after login
  useEffect(() => {
    if (!isAuthenticated || !userEmail || checkedFirst) return;

    const checkFirstAccess = async () => {
      try {
        const justLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
        // Remove a flag IMEDIATAMENTE após ler, para que um "F5" ou abrir nova aba
        // (que copia a sessão) não exiba a tela novamente. O modal só aparecerá
        // literalmente 1 vez após o clique no botão de entrar.
        sessionStorage.removeItem('just_logged_in');

        if (!justLoggedIn) return; // Só mostra logo após o login

        const profiles = await UserProfileApi.filter({ user_email: userEmail });
        const profile = profiles[0];
        if (profile?.is_first_login) {
          setProfileId(profile.id);
          setFirstAccess(true);
        }
      } catch {
        // silently ignore
      } finally {
        setCheckedFirst(true);
      }
    };

    checkFirstAccess();
  }, [isAuthenticated, userEmail, checkedFirst]);

  // Reset on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setFirstAccess(false);
      setCheckedFirst(false);
      setProfileId(null);
    }
  }, [isAuthenticated]);

  const handleCloseFirstAccess = async () => {
    setFirstAccess(false);
    sessionStorage.removeItem('just_logged_in');
  };

  const handleFirstAccessCompleted = async () => {
    if (!profileId) return;
    await UserProfileApi.update(profileId, { is_first_login: false });
  };

  const canAccessPage = useCallback((pageName) => {
    return canAccessPageByPermission(profileType, pageName);
  }, [profileType]);

  useEffect(() => {
    if (!isAuthenticated || isLoadingProfile || !profileType) return;

    const pathname = location.pathname.replace(/^\/+/, '');
    const resolvedPathname = resolvePageNameFromPath(pathname);
    if (!resolvedPathname || resolvedPathname === 'Desktop') return;

    const app = getAppByPage(resolvedPathname);
    if (!app) return;
    if (!canAccessPage(resolvedPathname)) return;

    let appProps;
    if (resolvedPathname === 'Registration') {
      const mode = new URLSearchParams(location.search).get('mode');
      if (mode === 'matricula' || mode === 'usuario') {
        appProps = { initialModeProp: mode };
      }
    }

    navigate('/Desktop', {
      replace: true,
      state: {
        desktopOpenAppId: app.id,
        ...(appProps ? { desktopOpenAppProps: appProps } : {}),
      },
    });
  }, [isAuthenticated, isLoadingProfile, profileType, location.pathname, location.search, navigate, canAccessPage]);

  if (isLoadingAuth) {
    return (
      <FullscreenState
        variant="loading"
        title="Preparando seu ambiente"
        description="Estamos validando a sessão e carregando as permissões do sistema."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Login />} />
        </Routes>
        <Toaster />
      </>
    );
  }

  if (isProfileLookupError) {
    return (
      <FullscreenState
        variant="error"
        icon={AlertTriangle}
        title="Não foi possível validar seu perfil"
        description="O sistema não conseguiu confirmar suas permissões neste momento. Isso pode ser uma falha temporária de conexão ou do Supabase."
        actionLabel="Tentar novamente"
        onAction={() => refetchProfile()}
      />
    );
  }

  if (isLoadingProfile || !profileType) {
    if (!isLoadingProfile && hasResolvedProfile && !profileType) {
      return <UserNotRegisteredError />;
    }

    return (
      <FullscreenState
        variant="loading"
        title="Carregando seu perfil"
        description="Estamos finalizando a liberação de acesso e montando as rotas disponíveis."
      />
    );
  }

  return (
    <>
      {/* First access modal */}
      <ChangePasswordModal
        open={firstAccess}
        onClose={handleCloseFirstAccess}
        onPasswordChanged={handleFirstAccessCompleted}
      />

      <ClientRuntimeObservability />
      <NavigationTracker />
      <RouteHistoryTracker />
      <Routes>
        <Route
          path="/"
          element={
            canAccessPage(mainPageKey)
              ? (
                <Suspense
                  fallback={
                    <FullscreenState
                      variant="loading"
                      title="Abrindo módulo principal"
                      description="Estamos carregando a interface inicial."
                    />
                  }
                >
                  <LayoutWrapper currentPageName={mainPageKey}>
                    <MainPage />
                  </LayoutWrapper>
                </Suspense>
              )
              : <Navigate to="/Desktop" replace />
          }
        />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {Object.entries(LEGACY_ROUTE_ALIASES).map(([aliasPath, pageName]) => (
          <Route
            key={aliasPath}
            path={`/${aliasPath}`}
            element={
              canAccessPage(pageName)
                ? <RedirectPageToDesktop pageName={pageName} />
                : <Navigate to="/Desktop" replace />
            }
          />
        ))}
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              canAccessPage(path)
                ? (
                  path === 'Desktop'
                    ? (
                      <Suspense fallback={
                        <FullscreenState
                          variant="loading"
                          title="Abrindo módulo"
                          description="Carregando a interface selecionada sem interromper a sessão."
                        />
                      }
                      >
                        <LayoutWrapper currentPageName={path}>
                          <Page />
                        </LayoutWrapper>
                      </Suspense>
                    )
                    : <RedirectPageToDesktop pageName={path} />
                )
                : <Navigate to="/Desktop" replace />
            }
          />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <Toaster />
      <SonnerToaster position="top-right" richColors />
    </>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QueryClientProvider client={queryClientInstance}>
          <AuthProvider>
            <TooltipPreferencesProvider>
            <Routes>
              <Route path="/mobile" element={<MobilePage />} />
              <Route path="*" element={<AppShell />} />
            </Routes>
            </TooltipPreferencesProvider>
          </AuthProvider>
        </QueryClientProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
