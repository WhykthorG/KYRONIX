// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getCurrentUserProfile } from '@/services/supabaseApi';
import {
  canCreateSystemUsers,
  canManageUsers,
  canUseDirectChat,
  canViewReports,
  canViewTeacherPortal,
  hasPermission as checkPermission,
  PERMISSIONS,
} from '@shared/contracts/access';

export function usePermissions() {
  const { user, session, isAuthenticated, isLoadingAuth } = useAuth();

  const {
    data: profiles = [],
    isLoading: isLoadingProfile,
    isSuccess,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['user-profile-permissions', user?.email, session?.access_token ?? null],
    queryFn: async () => {
      const profile = await getCurrentUserProfile(session?.access_token ?? null);
      return profile ? [profile] : [];
    },
    enabled: !isLoadingAuth && isAuthenticated && !!user?.email && !!session?.access_token,
    retry: (failureCount, queryError) => queryError?.statusCode !== 401 && failureCount < 2,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const currentProfile = profiles[0] ?? null;
  const fallbackProfileType = user?.user_metadata?.profile_type ?? null;
  const fallbackProfile = fallbackProfileType
    ? {
        id: null,
        user_email: user?.email ?? null,
        full_name: user?.user_metadata?.full_name ?? user?.email ?? null,
        profile_type: fallbackProfileType,
        status: 'ativo',
      }
    : null;
  const resolvedProfile = currentProfile ?? fallbackProfile;
  const profileType = resolvedProfile?.profile_type ?? null;
  const profileStatus = resolvedProfile?.status ?? null;
  const hasActiveProfile = ['ativo', 'pendente'].includes(profileStatus ?? '');
  const hasEffectivePermission = (permission) => (
    hasActiveProfile && checkPermission(profileType, permission)
  );

  return {
    currentProfile: resolvedProfile,
    profileType,
    profileStatus,
    hasActiveProfile,
    isLoadingProfile,
    hasResolvedProfile: isSuccess,
    isProfileLookupError: isError,
    profileLookupError: error,
    hasProfile: profiles.length > 0,
    refetchProfile: refetch,
    isAdmin:      hasActiveProfile && profileType === 'administrador',
    isCoordinator: hasActiveProfile && profileType === 'coordenador',
    isTeacher:    hasActiveProfile && profileType === 'professor',
    isStudent:    hasActiveProfile && profileType === 'aluno',
    isGuardian:   hasActiveProfile && profileType === 'responsavel',
    isSecretary:  hasActiveProfile && profileType === 'secretario',
    hasPermission: hasEffectivePermission,
    canDeleteTeacher: hasEffectivePermission(PERMISSIONS.TEACHERS_WRITE),
    canViewTeacherPortal: hasActiveProfile && canViewTeacherPortal(profileType),
    canManageUsers: hasActiveProfile && canManageUsers(profileType),
    canCreateSystemUsers: hasActiveProfile && canCreateSystemUsers(profileType),
    canViewReports: hasActiveProfile && canViewReports(profileType),
    canUseDirectChat: hasActiveProfile && canUseDirectChat(profileType),
    canViewFinancial: hasEffectivePermission(PERMISSIONS.REPORTS_VIEW),
  };
}
