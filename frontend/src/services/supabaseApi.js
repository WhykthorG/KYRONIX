// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import { getAccessTokenOrThrow, getSessionSafely, supabase } from '@/lib/supabase';
import {
  assertSafeIdentifier,
  normalizeSafeIdentifierList,
} from '@shared/contracts/dbIdentifiers';

function parseSort(sort) {
  if (!sort) return { column: 'created_at', ascending: false };
  if (sort.startsWith('-')) return { column: sort.slice(1), ascending: false };
  return { column: sort, ascending: true };
}

export function createEntityApi(tableName) {
  const safeTableName = assertSafeIdentifier(tableName, 'Tabela');

  function normalizeOrderColumn(sort = '-created_at') {
    const { column, ascending } = parseSort(sort);
    return {
      column: assertSafeIdentifier(column, 'Ordenação'),
      ascending,
    };
  }

  function normalizeFilterKeys(filters = {}) {
    return Object.entries(filters).map(([field, value]) => ({
      field: assertSafeIdentifier(field, 'Filtro'),
      value,
    }));
  }

  return {
    async list(sort = '-created_at', limit = 100) {
      const { column, ascending } = normalizeOrderColumn(sort);
      const { data, error } = await supabase
        .from(safeTableName)
        .select('*')
        .order(column, { ascending })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },

    async listPaginated({ sort = '-created_at', page = 1, perPage = 50 } = {}) {
      const { column, ascending } = normalizeOrderColumn(sort);
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      const { data, error, count } = await supabase
        .from(safeTableName)
        .select('*', { count: 'exact' })
        .order(column, { ascending })
        .range(from, to);

      if (error) throw error;
      return {
        data: data ?? [],
        count: count ?? 0,
        page,
        totalPages: Math.ceil((count ?? 0) / perPage),
      };
    },

    async get(id) {
      const { data, error } = await supabase
        .from(safeTableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async getOptional(id) {
      const { data, error } = await supabase
        .from(safeTableName)
        .select('*')
        .eq('id', id)
        .limit(1);
      if (error) throw error;
      return Array.isArray(data) ? data[0] ?? null : null;
    },

    async create(payload) {
      const { data, error } = await supabase
        .from(safeTableName)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(safeTableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /** Insert or update by conflict target */
    async upsert(payload, { onConflict = 'id' } = {}) {
      const safeOnConflict = normalizeSafeIdentifierList(onConflict, 'Chave de conflito');
      const { data, error } = await supabase
        .from(safeTableName)
        .upsert(payload, { onConflict: safeOnConflict })
        .select();
      if (error) throw error;
      return Array.isArray(data) ? data[0] ?? null : data;
    },

    /** Delete a row by id */
    async delete(id) {
      const { error } = await supabase
        .from(safeTableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    },

    async filter(filters = {}, sortOrOptions = '-created_at', limit = 100) {
      let sort;
      let page;
      let perPage;

      if (typeof sortOrOptions === 'object' && sortOrOptions !== null) {
        ({ sort = '-created_at', page, perPage } = sortOrOptions);
      } else {
        sort = sortOrOptions;
      }

      const { column, ascending } = normalizeOrderColumn(sort);

      if (page && perPage) {
        const from = (page - 1) * perPage;
        const to = from + perPage - 1;

        let query = supabase
          .from(safeTableName)
          .select('*', { count: 'exact' })
          .order(column, { ascending })
          .range(from, to);

        for (const { field, value } of normalizeFilterKeys(filters)) {
          if (value !== undefined && value !== null) {
            query = query.eq(field, value);
          }
        }

        const { data, error, count } = await query;
        if (error) throw error;
        return {
          data: data ?? [],
          count: count ?? 0,
          page,
          totalPages: Math.ceil((count ?? 0) / perPage),
        };
      }

      let query = supabase
        .from(safeTableName)
        .select('*')
        .order(column, { ascending })
        .limit(limit);

      for (const { field, value } of normalizeFilterKeys(filters)) {
        if (value !== undefined && value !== null) {
          query = query.eq(field, value);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },

    async bulkCreate(rows) {
      if (!rows?.length) return [];
      const { data, error } = await supabase
        .from(safeTableName)
        .insert(rows)
        .select();
      if (error) throw error;
      return data ?? [];
    },
  };
}

async function resolveCurrentAccessToken(preferredAccessToken = null) {
  if (preferredAccessToken) {
    return preferredAccessToken;
  }

  const { data, error } = await getSessionSafely();
  if (error) throw error;
  return data.session?.access_token ?? null;
}

async function fetchCurrentUserProfile(accessToken) {
  const response = await fetch('/api/security/me/profile', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-supabase-access-token': accessToken,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || 'Nao foi possivel carregar o perfil do usuario.');
    error.statusCode = response.status;
    error.code = payload?.code || null;
    error.traceId = payload?.traceId || null;
    throw error;
  }

  return payload?.profile || null;
}

async function fetchCurrentUserProfileDirect(accessToken) {
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError) throw userError;

  const userEmail = userData?.user?.email ?? null;
  if (!userEmail) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, user_email, full_name, profile_type, status, tenant_id')
    .ilike('user_email', userEmail)
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : null;
}

function shouldFallbackToDirectProfileLookup(error) {
  const statusCode = Number(error?.statusCode || error?.status || 0);
  return statusCode === 404 || statusCode >= 500;
}

export async function getCurrentUserProfile(accessToken = null) {
  const resolvedAccessToken = await resolveCurrentAccessToken(accessToken);

  if (!resolvedAccessToken) {
    throw new Error('Token de autenticacao ausente.');
  }

  try {
    return await fetchCurrentUserProfile(resolvedAccessToken);
  } catch (error) {
    if (shouldFallbackToDirectProfileLookup(error)) {
      return fetchCurrentUserProfileDirect(resolvedAccessToken);
    }

    if (error?.statusCode !== 401) {
      throw error;
    }

    const { data, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw error;
    }

    const refreshedAccessToken = data.session?.access_token ?? null;
    if (!refreshedAccessToken || refreshedAccessToken === resolvedAccessToken) {
      throw error;
    }

    try {
      return await fetchCurrentUserProfile(refreshedAccessToken);
    } catch (refetchError) {
      if (shouldFallbackToDirectProfileLookup(refetchError)) {
        return fetchCurrentUserProfileDirect(refreshedAccessToken);
      }

      throw refetchError;
    }
  }
}

export const StudentApi = createEntityApi('students');
export const TeacherApi = createEntityApi('teachers');
export const ClassApi = createEntityApi('classes');
export const SubjectApi = createEntityApi('subjects');
export const AttendanceApi = createEntityApi('attendance');
export const GradeApi = createEntityApi('grades');
export const AssignmentApi = createEntityApi('assignments');
export const SubmissionApi = createEntityApi('submissions');
export const AssignmentViewApi = createEntityApi('assignment_views');
export const MessageApi = createEntityApi('messages');
export const EventApi = createEntityApi('events');
export const ScheduleApi = createEntityApi('schedules');
export const DiaryApi = createEntityApi('class_diary');
export const LessonPlanApi = createEntityApi('lesson_plans');
export const LibraryItemApi = createEntityApi('library_items');
export const LibraryLoanApi = createEntityApi('library_loans');
export const GoalApi = createEntityApi('goals');
export const GoalTaskApi = createEntityApi('goal_tasks');
export const OccurrenceApi = createEntityApi('occurrences');
export const UserProfileApi = createEntityApi('user_profiles');
export const StudentPhotoRequestApi = createEntityApi('student_photo_requests');
export const GuardianStudentLinkApi = createEntityApi('guardian_student_links');
export const TeacherCalendarApi = createEntityApi('teacher_calendar_events');
export const AppSettingsApi = createEntityApi('app_settings');
export const HomeworkApi = createEntityApi('homework');
export const HomeworkCompletionApi = createEntityApi('homework_completions');
export const DirectMessageApi = createEntityApi('direct_messages');
export const SchoolScheduleSettingsApi = createEntityApi('school_schedule_settings');
export const SchoolShiftApi = createEntityApi('school_shifts');
export const SchoolEnvironmentApi = createEntityApi('school_environments');
export const CurriculumMatrixApi = createEntityApi('curriculum_matrix');
export const TeacherAvailabilityFormApi = createEntityApi('teacher_availability_forms');
export const TeacherAvailabilitySlotApi = createEntityApi('teacher_availability_slots');
export const TeacherPreferenceApi = createEntityApi('teacher_preferences');
export const ScheduleGenerationApi = createEntityApi('schedule_generations');
export const ScheduleEntryApi = createEntityApi('schedule_entries');
export const ScheduleConflictApi = createEntityApi('schedule_conflicts');
export const ScheduleSuggestionApi = createEntityApi('schedule_suggestions');
export const OptimizationSettingApi = createEntityApi('optimization_settings');
export const ScheduleVersionApi = createEntityApi('schedule_versions');

export const InternshipApi = createEntityApi('internships');
export const InternshipCompanyApi = createEntityApi('internship_companies');
export const InternshipSupervisorApi = createEntityApi('internship_supervisors');
export const InternshipDiaryApi = createEntityApi('internship_diary');
export const InternshipEvaluationApi = createEntityApi('internship_evaluations');

export const TccProjectApi = createEntityApi('tcc_projects');
export const TccMemberApi = createEntityApi('tcc_members');
export const TccDeliveryApi = createEntityApi('tcc_deliveries');
export const TccBancaApi = createEntityApi('tcc_bancas');
export const TccOrientationApi = createEntityApi('tcc_orientations');

export const LaboratoryApi = createEntityApi('laboratories');
export const LabReservationApi = createEntityApi('lab_reservations');
export const LabEquipmentApi = createEntityApi('lab_equipment');
export const LabMaterialLoanApi = createEntityApi('lab_material_loans');
export const LabUsageLogApi = createEntityApi('lab_usage_logs');

export const CourseApi = createEntityApi('courses');
export const SeriesApi = createEntityApi('series');
export const ClassSeriesApi = createEntityApi('class_series');
export const CertificateApi = createEntityApi('certificates');

export const LibraryReservationApi = createEntityApi('library_reservations');
export const LibraryFineApi = createEntityApi('library_fines');

export const SecondChanceApi = createEntityApi('second_chances');
export const ClassCouncilApi = createEntityApi('class_councils');
export const CouncilDecisionApi = createEntityApi('council_decisions');

export const UserManagementApi = {
  async batchOperation(action, profileIds, reason) {
    const { getAccessTokenOrThrow } = await import('../lib/supabase.js');
    const token = await getAccessTokenOrThrow();
    const response = await fetch('/api/admin/users/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, profileIds, reason }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Erro na operação em lote.');
    }
    return response.json();
  },
  async updateProfile(profileId, data) {
    const { getAccessTokenOrThrow } = await import('../lib/supabase.js');
    const token = await getAccessTokenOrThrow();
    const response = await fetch('/api/admin/users/profile-update', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profileId, ...data }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Erro ao atualizar perfil.');
    }
    return response.json();
  },
};

export const base44 = {
  entities: {
    Student: StudentApi,
    Teacher: TeacherApi,
    Class: ClassApi,
    Subject: SubjectApi,
    Attendance: AttendanceApi,
    Grade: GradeApi,
    Assignment: AssignmentApi,
    Submission: SubmissionApi,
    AssignmentView: AssignmentViewApi,
    Message: MessageApi,
    Event: EventApi,
    Schedule: ScheduleApi,
    ClassDiary: DiaryApi,
    LessonPlan: LessonPlanApi,
    LibraryItem: LibraryItemApi,
    LibraryLoan: LibraryLoanApi,
    Goal: GoalApi,
    GoalTask: GoalTaskApi,
    Occurrence: OccurrenceApi,
    UserProfile: UserProfileApi,
    GuardianStudentLink: GuardianStudentLinkApi,
    TeacherCalendarEvent: TeacherCalendarApi,
    AppSettings: AppSettingsApi,
    Homework: HomeworkApi,
    HomeworkCompletion: HomeworkCompletionApi,
    DirectMessage: DirectMessageApi,
    SchoolScheduleSettings: SchoolScheduleSettingsApi,
    SchoolShift: SchoolShiftApi,
    SchoolEnvironment: SchoolEnvironmentApi,
    CurriculumMatrix: CurriculumMatrixApi,
    TeacherAvailabilityForm: TeacherAvailabilityFormApi,
    TeacherAvailabilitySlot: TeacherAvailabilitySlotApi,
    TeacherPreference: TeacherPreferenceApi,
    ScheduleGeneration: ScheduleGenerationApi,
    ScheduleEntry: ScheduleEntryApi,
    ScheduleConflict: ScheduleConflictApi,
    ScheduleSuggestion: ScheduleSuggestionApi,
    OptimizationSetting: OptimizationSettingApi,
    Internship: InternshipApi,
    InternshipCompany: InternshipCompanyApi,
    InternshipSupervisor: InternshipSupervisorApi,
    InternshipDiary: InternshipDiaryApi,
    InternshipEvaluation: InternshipEvaluationApi,
    TccProject: TccProjectApi,
    TccMember: TccMemberApi,
    TccDelivery: TccDeliveryApi,
    TccBanca: TccBancaApi,
    TccOrientation: TccOrientationApi,
    Laboratory: LaboratoryApi,
    LabReservation: LabReservationApi,
    LabEquipment: LabEquipmentApi,
    LabMaterialLoan: LabMaterialLoanApi,
    LabUsageLog: LabUsageLogApi,
    Course: CourseApi,
    Series: SeriesApi,
    ClassSeries: ClassSeriesApi,
    Certificate: CertificateApi,
    LibraryReservation: LibraryReservationApi,
    LibraryFine: LibraryFineApi,
    SecondChance: SecondChanceApi,
    ClassCouncil: ClassCouncilApi,
    CouncilDecision: CouncilDecisionApi,
  },
  auth: {
    async me() {
      const accessToken = await getAccessTokenOrThrow('Not authenticated');
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);
      if (error || !user) throw error ?? new Error('Not authenticated');
      return { email: user.email, id: user.id, ...user.user_metadata };
    },
    logout(redirectUrl) {
      supabase.auth.signOut().then(() => {
        if (redirectUrl) window.location.href = redirectUrl;
      });
    },
    redirectToLogin() {
      window.location.href = '/login';
    },
  },
};

export default base44;
