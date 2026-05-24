import { StudentApi, TeacherApi, UserProfileApi } from '@/services/supabaseApi';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function matchesNormalizedEmail(recordEmail, normalizedEmail) {
  return normalizeEmail(recordEmail) === normalizedEmail;
}

export async function syncAvatarToAcademicRecords({ profileType, userEmail, avatarUrl }) {
  const normalizedEmail = normalizeEmail(userEmail);

  if (!normalizedEmail) return;

  if (profileType === 'aluno') {
    const students = await StudentApi.list('full_name', 1000);
    await Promise.all(
      students
        .filter((student) => matchesNormalizedEmail(student?.email, normalizedEmail))
        .filter((student) => student?.id)
        .map((student) => StudentApi.update(student.id, { photo_url: avatarUrl || null }))
    );
    return;
  }

  if (profileType === 'professor') {
    const teachers = await TeacherApi.list('full_name', 1000);
    await Promise.all(
      teachers
        .filter((teacher) => matchesNormalizedEmail(teacher?.email, normalizedEmail))
        .filter((teacher) => teacher?.id)
        .map((teacher) => TeacherApi.update(teacher.id, { photo_url: avatarUrl || null }))
    );
  }
}

export async function updateUserAvatar({
  profileId,
  avatarUrl,
  profileType,
  userEmail,
  allowStudentPhotoUpload = true,
  syncRelatedRecords = false,
}) {
  if (profileType === 'aluno' && !allowStudentPhotoUpload) {
    throw new Error('A secretaria bloqueou a alteracao da foto do aluno.');
  }

  const updatedProfile = await UserProfileApi.update(profileId, {
    avatar_url: avatarUrl || null,
  });

  if (syncRelatedRecords) {
    try {
      await syncAvatarToAcademicRecords({
        profileType: updatedProfile?.profile_type || profileType,
        userEmail: updatedProfile?.user_email || userEmail,
        avatarUrl: updatedProfile?.avatar_url || null,
      });
    } catch (error) {
      console.warn('[user-avatar] Falha ao sincronizar avatar em registros relacionados.', error);
    }
  }

  return updatedProfile;
}
