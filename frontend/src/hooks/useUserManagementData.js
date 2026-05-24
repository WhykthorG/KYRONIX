import { useCallback } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  createManagedProfile,
  deleteManagedUser,
  generateTempPassword,
  getAuthUserByEmail,
  resetUserPassword,
} from '@/lib/supabaseAdmin';
import {
  AVATAR_IMAGE_OPTIMIZATION_DEFAULTS,
  optimizeImageToDataUrl,
  shouldOptimizeImageBeforeUpload,
} from '@/lib/imageUploadOptimizer';
import { syncAvatarToAcademicRecords } from '@/lib/userAvatar';
import {
  ClassApi,
  GuardianStudentLinkApi,
  StudentApi,
  UserProfileApi,
} from '@/services/supabaseApi';

export function useUserManagementData({
  editOpen,
  editProfileId,
  selectedProfileId,
  onEditSaved,
  onResetPasswordGenerated,
}) {
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => UserProfileApi.list('-created_at'),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['guardian-link-students'],
    queryFn: () => StudentApi.list('full_name', 600),
  });

  const {
    data: guardianLinks = [],
    isLoading: guardianLinksLoading,
  } = useQuery({
    queryKey: ['guardian-links', editProfileId],
    queryFn: () => GuardianStudentLinkApi.filter({ guardian_profile_id: editProfileId }, 'created_at', 200),
    enabled: editOpen && !!editProfileId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => UserProfileApi.update(id, data),
    onError: (err) => toast.error(`Erro ao salvar alteração: ${err.message}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
      toast.success('Perfil alterado');
    },
  });

  const saveEditMutation = useMutation({
    mutationFn: async ({ profile, existingLinks, nextStudentIds }) => {
      const payload = {
        full_name: profile.full_name,
        profile_type: profile.profile_type,
        status: profile.status,
        department: profile.department || null,
        phone: profile.phone || null,
        notes: profile.notes || null,
        avatar_url: profile.avatar_url || null,
      };

      const updatedProfile = await UserProfileApi.update(profile.id, payload);

      if (profile.avatar_url !== undefined) {
        try {
          await syncAvatarToAcademicRecords({
            profileType: profile.profile_type,
            userEmail: profile.user_email,
            avatarUrl: profile.avatar_url || null,
          });
        } catch (avatarError) {
          console.warn('[user-management] Falha ao sincronizar avatar.', avatarError);
        }
      }

      const desiredStudentIds = new Set(
        profile.profile_type === 'responsavel' ? nextStudentIds : []
      );
      const currentLinks = Array.isArray(existingLinks) ? existingLinks : [];
      const currentStudentIds = new Set(currentLinks.map((link) => link.student_id));
      const linksToDelete = currentLinks.filter((link) => !desiredStudentIds.has(link.student_id));
      const studentIdsToCreate = [...desiredStudentIds].filter(
        (studentId) => !currentStudentIds.has(studentId)
      );

      if (linksToDelete.length > 0) {
        await Promise.all(linksToDelete.map((link) => GuardianStudentLinkApi.delete(link.id)));
      }

      if (studentIdsToCreate.length > 0) {
        await GuardianStudentLinkApi.bulkCreate(
          studentIdsToCreate.map((studentId) => ({
            guardian_profile_id: profile.id,
            student_id: studentId,
          }))
        );
      }

      return updatedProfile;
    },
    onError: (err) => toast.error(`Erro ao salvar alteração: ${err.message}`),
    onSuccess: async (updatedProfile) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['userProfiles'] }),
        queryClient.invalidateQueries({ queryKey: ['guardian-links'] }),
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['teachers'] }),
      ]);

      onEditSaved?.(updatedProfile);
      toast.success('Perfil alterado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (profile) => deleteManagedUser({ email: profile.user_email, profileId: profile.id }),
    onError: (err) => toast.error(`Erro ao excluir: ${err.message}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
      toast.success('Excluído com sucesso');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userEmail, name }) => {
      const newPassword = generateTempPassword();
      const authUser = await getAuthUserByEmail(userEmail);
      if (!authUser?.id) throw new Error('Usuário não encontrado no sistema de autenticação.');
      await resetUserPassword(authUser.id, newPassword, {
        email: userEmail,
        full_name: name,
      });
      return { email: userEmail, password: newPassword, name };
    },
    onSuccess: (result) => {
      onResetPasswordGenerated?.(result);
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao redefinir senha.'),
  });

  const approveProfile = useCallback((profile) => {
    updateMutation.mutate({ id: profile.id, data: { status: 'ativo', approved_at: new Date().toISOString() } });
  }, [updateMutation]);

  const suspendProfile = useCallback((profile) => {
    updateMutation.mutate({ id: profile.id, data: { status: 'inativo' } });
  }, [updateMutation]);

  const saveEditedProfile = useCallback((profile, linkedStudentIds = []) => {
    if (!profile?.id) return;
    saveEditMutation.mutate({
      profile,
      existingLinks: guardianLinks,
      nextStudentIds: linkedStudentIds,
    });
  }, [guardianLinks, saveEditMutation]);

  const requestPasswordReset = useCallback((profile) => {
    if (!profile.user_email) {
      toast.error('E-mail não encontrado.');
      return;
    }
    if (!confirm(`Redefinir senha de ${profile.full_name}?`)) return;

    resetPasswordMutation.mutate({ userEmail: profile.user_email, name: profile.full_name });
  }, [resetPasswordMutation]);

  const createManagedUserProfile = useCallback(async ({ form, getFinalRole }) => {
    const tempPassword = generateTempPassword();
    await createManagedProfile({
      email: form.email,
      password: tempPassword,
      full_name: form.full_name,
      phone: form.phone || null,
      birth_date: form.birth_date || null,
      document_id: form.cpf || null,
      address: form.address || null,
      department: form.department || null,
      notes: form.notes ? `${form.notes} [primeiro_acesso]` : '[primeiro_acesso]',
      profile_type: getFinalRole(),
    });
    return { email: form.email, password: tempPassword, name: form.full_name };
  }, []);

  const prepareAvatarDataUrl = useCallback(async (file) => {
    if (!shouldOptimizeImageBeforeUpload(file)) {
      throw new Error('Use uma imagem JPG, PNG ou WebP.');
    }

    const result = await optimizeImageToDataUrl(file, AVATAR_IMAGE_OPTIMIZATION_DEFAULTS);
    return result.dataUrl;
  }, []);

  return {
    profiles,
    classes,
    students,
    guardianLinks,
    guardianLinksLoading,
    isLoading,
    selectedProfile: profiles.find((profile) => profile.id === selectedProfileId) || null,
    updateMutation,
    saveEditMutation,
    deleteMutation,
    resetPasswordMutation,
    approveProfile,
    suspendProfile,
    saveEditedProfile,
    requestPasswordReset,
    createManagedUserProfile,
    prepareAvatarDataUrl,
  };
}
