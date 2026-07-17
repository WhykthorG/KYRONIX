import React, { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight, Monitor, Power, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppSettingsApi, UserProfileApi } from '@/services/supabaseApi';
import { useDesktopShellStore } from '@/stores/desktopShellStore';
import { useAuth } from '@/lib/AuthContext';
import {
  AVATAR_IMAGE_OPTIMIZATION_DEFAULTS,
  OPTIMIZABLE_IMAGE_MIME_TYPES,
  optimizeImageToDataUrl,
  shouldOptimizeImageBeforeUpload,
} from '@/lib/imageUploadOptimizer';
import { updateUserAvatar } from '@/lib/userAvatar';
import StudentPhotoRequestDialog from '@/components/desktop/StudentPhotoRequestDialog';

const MENU_MAX_WIDTH = 640;
const VIEWPORT_MARGIN = 12;
const PINNED_LIMIT = 8;
const RECOMMENDED_LIMIT = 4;

function getMenuPosition(startButtonRef) {
  if (typeof window === 'undefined') {
    return { left: VIEWPORT_MARGIN, width: MENU_MAX_WIDTH };
  }

  const viewportWidth = window.innerWidth;
  const width = Math.min(MENU_MAX_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
  const buttonRect = startButtonRef?.current?.getBoundingClientRect();
  const preferredLeft = buttonRect
    ? buttonRect.left + buttonRect.width / 2 - width / 2
    : viewportWidth / 2 - width / 2;
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN);
  const left = Math.min(Math.max(preferredLeft, VIEWPORT_MARGIN), maxLeft);

  return { left, width };
}

function getUserDisplayName(user) {
  const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name;
  if (metadataName) return metadataName;
  if (user?.email) return user.email.split('@')[0];
  return 'Usuário';
}

function getProfileLabel(profileType) {
  const labels = {
    administrador: 'Administrador',
    coordenador: 'Coordenação',
    secretario: 'Secretaria',
    professor: 'Professor',
    aluno: 'Aluno',
    responsavel: 'Responsável',
  };

  return labels[profileType] || 'Conta ativa';
}

function matchesSearch(app, searchTerm) {
  if (!searchTerm) return true;

  const normalizedSearch = searchTerm.toLowerCase();
  return [app.title, app.page, app.id]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedSearch));
}

function StartMenu({
  apps,
  onOpenApp,
  onAddDesktopShortcut,
  onClose,
  startButtonRef,
  profileType,
  user,
  reducedMotion = false,
}) {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [menuPosition, setMenuPosition] = useState(() => getMenuPosition(startButtonRef));
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllApps, setShowAllApps] = useState(false);
  const [showMoreRecommended, setShowMoreRecommended] = useState(false);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [photoRequestOpen, setPhotoRequestOpen] = useState(false);
  const searchInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const windows = useDesktopShellStore((state) => state.windows);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const { data: currentProfiles = [] } = useQuery({
    queryKey: ['start-menu-profile', user?.email],
    queryFn: () => UserProfileApi.filter({ user_email: user.email }, 'created_at', 1),
    enabled: !!user?.email,
    staleTime: 60 * 1000,
  });

  const currentProfile = currentProfiles[0] || null;
  const canManageOwnAvatar = ['administrador', 'coordenador', 'secretario'].includes(profileType);
  const { data: systemSettings } = useQuery({
    queryKey: ['system-settings', 'start-menu-photo', user?.email],
    queryFn: async () => {
      try {
        return await AppSettingsApi.getOptional('system');
      } catch {
        return null;
      }
    },
    enabled: !!user?.email,
    staleTime: 60 * 1000,
  });
  const allowStudentPhotoUpload = systemSettings?.allow_student_photo_upload ?? true;

  const updateAvatarMutation = useMutation({
    mutationFn: async (avatarUrl) => {
      if (!currentProfile?.id) {
        throw new Error('Perfil do usuario nao encontrado.');
      }

      return updateUserAvatar({
        profileId: currentProfile.id,
        profileType: currentProfile.profile_type,
        userEmail: currentProfile.user_email,
        avatarUrl,
        syncRelatedRecords: true,
      });
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(['start-menu-profile', user?.email], [updatedProfile]);
      queryClient.setQueryData(['user-profile-permissions', user?.email], [updatedProfile]);
      queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
      toast.success(updatedProfile?.avatar_url ? 'Foto atualizada.' : 'Foto removida.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Nao foi possivel atualizar a foto.');
    },
  });

  useEffect(() => {
    const updatePosition = () => setMenuPosition(getMenuPosition(startButtonRef));
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('keydown', handleKeyDown);

    const focusFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, startButtonRef]);

  const recentAppIds = useMemo(() => {
    const orderedWindows = [...windows].sort((left, right) => (right.zIndex || 0) - (left.zIndex || 0));
    return [...new Set(orderedWindows.map((windowItem) => windowItem.appId))];
  }, [windows]);

  const filteredApps = useMemo(
    () => apps.filter((app) => matchesSearch(app, deferredSearchTerm.trim())),
    [apps, deferredSearchTerm]
  );

  const pinnedApps = useMemo(() => {
    if (deferredSearchTerm.trim()) return filteredApps;
    return apps.slice(0, showAllApps ? apps.length : PINNED_LIMIT);
  }, [apps, deferredSearchTerm, filteredApps, showAllApps]);

  const recommendedApps = useMemo(() => {
    const recentApps = recentAppIds
      .map((appId) => apps.find((app) => app.id === appId))
      .filter(Boolean);
    const fallbackApps = apps.filter((app) => !recentApps.some((recentApp) => recentApp.id === app.id));
    const orderedApps = [...recentApps, ...fallbackApps];

    if (deferredSearchTerm.trim()) {
      return filteredApps.slice(0, Math.max(RECOMMENDED_LIMIT, 6));
    }

    return orderedApps.slice(0, showMoreRecommended ? Math.min(orderedApps.length, 8) : RECOMMENDED_LIMIT);
  }, [apps, deferredSearchTerm, filteredApps, recentAppIds, showMoreRecommended]);

  const userDisplayName = currentProfile?.full_name || getUserDisplayName(user);
  const userEmail = user?.email || 'conta@projectwg.local';
  const footerProfileLabel = getProfileLabel(profileType);
  const avatarUrl = currentProfile?.avatar_url || '';
  const hasAvatar = Boolean(avatarUrl);
  const profileDepartment = currentProfile?.department || 'Nao informado';
  const profilePhone = currentProfile?.phone || 'Nao informado';
  const profileStatus = currentProfile?.status || 'ativo';
  const searchMetaLabel = deferredSearchTerm.trim()
    ? `${filteredApps.length} resultado${filteredApps.length === 1 ? '' : 's'}`
    : `${apps.length} apps`;

  const openSelectedApp = (appId) => {
    onOpenApp(appId);
    onClose?.();
    setSearchTerm('');
  };

  const handleAddDesktopShortcut = (event, appId) => {
    event.stopPropagation();
    onAddDesktopShortcut?.(appId);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (filteredApps[0]) {
      openSelectedApp(filteredApps[0].id);
    }
  };

  const handleAvatarButtonClick = () => {
    if (!canManageOwnAvatar) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!shouldOptimizeImageBeforeUpload(file)) {
      toast.error('Use uma imagem JPG, PNG ou WebP.');
      return;
    }

    setIsPreparingAvatar(true);

    try {
      const result = await optimizeImageToDataUrl(file, AVATAR_IMAGE_OPTIMIZATION_DEFAULTS);
      updateAvatarMutation.mutate(result.dataUrl);
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel preparar a foto.');
    } finally {
      setIsPreparingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    if (!hasAvatar || !canManageOwnAvatar) return;
    updateAvatarMutation.mutate(null);
  };

  const avatarActionPending = isPreparingAvatar || updateAvatarMutation.isPending;

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none" data-cy="start-menu">
      <div
        className="absolute inset-0 z-0 pointer-events-auto bg-slate-950/35"
        onClick={onClose}
      />

      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
        transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
        className="absolute bottom-14 z-10 flex flex-col overflow-hidden rounded-[30px] border border-white/10 text-white pointer-events-auto"
        style={{
          left: `${menuPosition.left}px`,
          width: `${menuPosition.width}px`,
          maxHeight: 'min(78vh, 680px)',
          background:
            'linear-gradient(180deg, rgba(16,24,47,0.98) 0%, rgba(12,19,40,0.99) 52%, rgba(11,18,35,1) 100%)',
          boxShadow: '0 28px 80px rgba(4, 8, 20, 0.58)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 left-10 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -right-10 top-10 h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
        </div>

        <div className="relative flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-6 sm:pb-7">
          <form onSubmit={handleSearchSubmit} className="mb-8">
            <div className="overflow-hidden rounded-[28px] border border-white/15 bg-slate-950/90 shadow-2xl shadow-black/35">
              <label
                htmlFor="start-menu-search"
                className="flex items-center gap-3 px-4 py-1 text-white"
              >
                <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <input
                  id="start-menu-search"
                  data-cy="start-menu-search"
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Digite para pesquisar"
                  className="h-12 min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-white/45"
                  autoComplete="off"
                />
                <div className="hidden items-center gap-2 pr-1 md:flex">
                  <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                    {searchMetaLabel}
                  </span>
                  <kbd className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    Ctrl K
                  </kbd>
                </div>
              </label>
            </div>
          </form>

          <div className="space-y-9">
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-100">Pinned</h2>
                {!deferredSearchTerm.trim() && apps.length > PINNED_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setShowAllApps((current) => !current)}
                    data-cy="start-menu-toggle-all-apps"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.09]"
                  >
                    {showAllApps ? 'Menos apps' : 'All apps'}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {pinnedApps.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center">
                  <p className="text-sm font-medium text-slate-100">Nenhum app encontrado</p>
                  <p className="mt-1 text-xs text-slate-400">Tente buscar por nome, página ou identificador.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-3">
                  {pinnedApps.map((app) => (
                    <div
                      key={app.id}
                      className="group flex flex-col items-center gap-2 rounded-3xl px-3 py-3 text-center transition-all hover:bg-white/[0.06] focus-within:bg-white/[0.06]"
                    >
                      <button
                        type="button"
                        onClick={() => openSelectedApp(app.id)}
                        data-cy="start-menu-app-open"
                        data-app-id={app.id}
                        className="flex w-full flex-col items-center gap-3 text-center"
                      >
                        <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/8 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform duration-200 group-hover:scale-[1.04]">
                          {app.icon && <app.icon className="h-7 w-7" style={{ color: app.iconColor || '#ffffff' }} />}
                        </div>
                        <span className="line-clamp-2 text-[12px] font-medium leading-tight text-slate-100">
                          {app.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleAddDesktopShortcut(event, app.id)}
                        data-cy="start-menu-app-shortcut"
                        data-app-id={app.id}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        Desktop
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-100">Recommended</h2>
                {!deferredSearchTerm.trim() && recommendedApps.length > 0 && apps.length > RECOMMENDED_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setShowMoreRecommended((current) => !current)}
                    data-cy="start-menu-toggle-more-recommended"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.09]"
                  >
                    {showMoreRecommended ? 'Menos' : 'More'}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {recommendedApps.map((app) => {
                  const isRecent = recentAppIds.includes(app.id);

                  return (
                    <div
                      key={`recommended-${app.id}`}
                      className="group flex items-center gap-3 rounded-2xl border border-transparent bg-white/[0.03] px-3 py-3 text-left transition-all hover:border-white/8 hover:bg-white/[0.06] focus-within:border-white/10 focus-within:bg-white/[0.06]"
                    >
                      <button
                        type="button"
                        onClick={() => openSelectedApp(app.id)}
                        data-cy="start-menu-app-open"
                        data-app-id={app.id}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                          {app.icon && <app.icon className="h-5 w-5" style={{ color: app.iconColor || '#ffffff' }} />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-100">{app.title}</p>
                          <p className="truncate text-xs text-slate-400">
                            {isRecent ? 'Usado recentemente' : 'Acesso rápido ao módulo'}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleAddDesktopShortcut(event, app.id)}
                        data-cy="start-menu-app-shortcut"
                        data-app-id={app.id}
                        className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white"
                        aria-label={`Adicionar ${app.title} na area de trabalho`}
                        title="Adicionar na area de trabalho"
                      >
                        <Monitor className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

            </section>
          </div>
        </div>

        <div className="relative flex items-center justify-between gap-3 border-t border-white/8 bg-white/[0.04] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setProfileDialogOpen(true)}
              data-cy="start-menu-profile"
              className="rounded-full transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Abrir perfil"
            >
              <Avatar className="h-11 w-11 flex-shrink-0 border border-white/10 shadow-[0_10px_24px_rgba(15,23,42,0.38)]">
                <AvatarImage src={avatarUrl || undefined} alt={userDisplayName} />
                <AvatarFallback className="bg-blue-500 text-sm font-semibold text-white">
                  {userDisplayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
            <div className="min-w-0 text-left">
              <button
                type="button"
                onClick={() => setProfileDialogOpen(true)}
                data-cy="start-menu-profile-name"
                className="min-w-0 text-left focus-visible:outline-none"
                aria-label="Abrir perfil"
              >
              <p className="truncate text-sm font-semibold text-slate-100">{userDisplayName}</p>
              <p className="truncate text-xs text-slate-400">
                {footerProfileLabel} · {userEmail}
              </p>
              </button>
              {canManageOwnAvatar ? (
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
                  <button
                    type="button"
                    onClick={handleAvatarButtonClick}
                    disabled={avatarActionPending}
                    className="font-medium text-blue-200 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    {avatarActionPending ? 'Processando...' : hasAvatar ? 'Alterar foto' : 'Adicionar foto'}
                  </button>
                  {hasAvatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={avatarActionPending}
                      className="font-medium text-slate-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ) : profileType === 'aluno' ? (
                allowStudentPhotoUpload ? (
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPhotoRequestOpen(true)}
                      className="font-medium text-blue-200 transition-colors hover:text-white"
                    >
                      Solicitar alteração de foto
                    </button>
                    <p className="text-slate-400">
                      A solicitação vai para aprovação da secretaria.
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    A secretaria bloqueou solicitações de foto do aluno.
                  </p>
                )
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">
                  A foto deste perfil e ajustada pela secretaria ou administracao.
                </p>
              )}
            </div>
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept={OPTIMIZABLE_IMAGE_MIME_TYPES.join(',')}
            className="hidden"
            onChange={handleAvatarFileChange}
          />

          <button
            type="button"
            onClick={() => logout()}
            data-cy="start-menu-logout"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
            title="Sair"
            aria-label="Sair"
          >
            <Power className="h-[18px] w-[18px]" />
          </button>
        </div>
      </motion.div>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-md border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Perfil</DialogTitle>
            <DialogDescription>
              Visualize seus dados e gerencie sua foto de usuario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <Avatar className="h-20 w-20 border border-slate-200 shadow-sm">
                <AvatarImage src={avatarUrl || undefined} alt={userDisplayName} />
                <AvatarFallback className="bg-blue-500 text-2xl font-semibold text-white">
                  {userDisplayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-900">{userDisplayName}</p>
                <p className="truncate text-sm text-slate-500">{userEmail}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  {footerProfileLabel}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Status</p>
                <p className="mt-1 font-medium text-slate-800">{profileStatus}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Telefone</p>
                <p className="mt-1 font-medium text-slate-800">{profilePhone}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Departamento</p>
                <p className="mt-1 font-medium text-slate-800">{profileDepartment}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Foto de usuario</p>
              {canManageOwnAvatar ? (
                <>
                  <p className="mt-1 text-xs text-slate-500">
                    JPG, PNG e WebP sao comprimidos automaticamente antes de salvar.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAvatarButtonClick}
                      disabled={avatarActionPending}
                    >
                      {avatarActionPending ? 'Processando...' : hasAvatar ? 'Alterar foto' : 'Adicionar foto'}
                    </Button>
                    {hasAvatar && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRemoveAvatar}
                        disabled={avatarActionPending}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </>
              ) : profileType === 'aluno' ? (
                allowStudentPhotoUpload ? (
                  <>
                    <p className="mt-1 text-xs text-slate-600">
                      Envie uma solicitação para a secretaria aprovar sua nova foto.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPhotoRequestOpen(true)}
                      >
                        Solicitar alteração de foto
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-slate-600">
                    A secretaria bloqueou solicitações de foto do aluno.
                  </p>
                )
              ) : (
                <p className="mt-1 text-xs text-slate-600">
                  A foto deste perfil e ajustada pela secretaria ou administracao.
                </p>
              )}
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {currentProfile && (
        <StudentPhotoRequestDialog
          open={photoRequestOpen}
          onOpenChange={setPhotoRequestOpen}
          profile={currentProfile}
          allowPhotoUpload={allowStudentPhotoUpload}
        />
      )}
    </div>
  );
}

export default memo(StartMenu);
