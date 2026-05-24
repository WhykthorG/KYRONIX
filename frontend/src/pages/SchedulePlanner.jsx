import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, WandSparkles } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import {
  ClassApi,
  ScheduleConflictApi,
  ScheduleEntryApi,
  ScheduleGenerationApi,
  ScheduleSuggestionApi,
  SchoolScheduleSettingsApi,
  SubjectApi,
  TeacherApi,
  TeacherAvailabilityFormApi,
  TeacherAvailabilitySlotApi,
  TeacherPreferenceApi,
} from '@/services/supabaseApi';
import { applySuggestionLocally } from '@shared/scheduling/engine';
import {
  buildCurriculumMatrixPayload,
  buildEnvironmentPayload,
  buildScheduleSettingPayload,
  buildShiftPayload,
  buildTeacherAvailabilitySlotPayload,
  buildTeacherPreferencePayload,
  DEFAULT_OPTIMIZATION_WEIGHTS,
  getWeekDayLabel,
  mergeOptimizationWeights,
  SCHEDULE_PLANNER_TABLES,
  SCHEDULE_FORM_STATUS,
} from '@shared/contracts/schedulePlanner';
import { PERMISSIONS } from '@shared/contracts/access';
import {
  createScheduleSetting,
  generateSchedulePlan,
  getOptimizationSettings,
  getScheduleStructures,
  sendTeacherAvailabilityQuestionnaires,
  saveScheduleStructures,
  saveOptimizationSettings,
} from '@/lib/schedulePlannerClient';

const WEEK_DAYS = [1, 2, 3, 4, 5];

const initialSetting = {
  name: 'Planejamento principal',
  academic_year: new Date().getFullYear(),
  term_label: 'Ano letivo',
  default_max_lessons_per_day: 6,
  allow_windows: false,
  notes: '',
};

const initialShift = {
  code: '',
  name: '',
  start_time: '07:00',
  end_time: '12:00',
  lesson_count: 5,
};

const initialEnvironment = {
  code: '',
  name: '',
  environment_type: 'sala',
  capacity: 40,
  is_special: false,
  exclusive_per_slot: true,
  status: 'ativo',
  notes: '',
};

const initialCurriculum = {
  class_id: '',
  subject_id: '',
  teacher_id: '',
  shift_id: '',
  preferred_environment_id: '',
  weekly_lessons: 2,
  requires_special_environment: false,
  double_lesson_preference: 'flexivel',
  max_lessons_per_day: 2,
  distribution_priority: 5,
  notes: '',
};

function Section({ title, description, action, children }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function AvailabilityGrid({ shifts, selected, onToggle }) {
  return (
    <div className="space-y-4">
      {shifts.map((shift) => (
        <div key={shift.id} className="rounded-2xl border border-slate-200 p-4">
          <p className="font-semibold text-slate-900">{shift.name}</p>
          <p className="mb-3 text-sm text-slate-500">{shift.start_time} - {shift.end_time}</p>
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-2 text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-slate-500">Aula</th>
                  {WEEK_DAYS.map((day) => <th key={day} className="px-2 py-1 text-left text-slate-500">{getWeekDayLabel(day)}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Number(shift.lesson_count || 0) }, (_, index) => index + 1).map((lessonIndex) => (
                  <tr key={`${shift.id}-${lessonIndex}`}>
                    <td className="px-2 py-1 font-medium text-slate-700">{lessonIndex}ª</td>
                    {WEEK_DAYS.map((day) => {
                      const key = `${shift.id}:${day}:${lessonIndex}`;
                      const checked = selected.has(key);
                      return (
                        <td key={key}>
                          <button
                            type="button"
                            onClick={() => onToggle(key)}
                            className={`w-full rounded-xl border px-3 py-2 ${
                              checked ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
                            }`}
                          >
                            {checked ? 'Pode' : 'Não pode'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleGrid({ entries, classes, shifts, selectedClassId, onClassChange }) {
  const selected = selectedClassId || classes[0]?.id || '';
  const filtered = entries.filter((entry) => !selected || entry.class_id === selected);
  const slotMap = new Map(filtered.map((entry) => [`${entry.shift_id}:${entry.day_of_week}:${entry.lesson_index}`, entry]));

  return (
    <Section
      title="Grade gerada"
      description="Visualização por turma da última geração."
      action={(
        <Select value={selected} onValueChange={onClassChange}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Turma" /></SelectTrigger>
          <SelectContent>
            {classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-2 text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-slate-500">Faixa</th>
              {WEEK_DAYS.map((day) => <th key={day} className="px-2 py-1 text-left text-slate-500">{getWeekDayLabel(day)}</th>)}
            </tr>
          </thead>
          <tbody>
            {shifts.flatMap((shift) => (
              Array.from({ length: Number(shift.lesson_count || 0) }, (_, index) => {
                const lessonIndex = index + 1;
                return (
                  <tr key={`${shift.id}-${lessonIndex}`}>
                    <td className="rounded-xl bg-slate-100 px-3 py-3 font-medium text-slate-700">{shift.name} • {lessonIndex}ª</td>
                    {WEEK_DAYS.map((day) => {
                      const entry = slotMap.get(`${shift.id}:${day}:${lessonIndex}`);
                      return (
                        <td key={`${shift.id}:${day}:${lessonIndex}`}>
                          <div className={`min-h-[84px] rounded-2xl border px-3 py-3 ${entry ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}>
                            {entry ? (
                              <>
                                <p className="font-semibold text-teal-900">{entry.subject?.name || entry.subject_id}</p>
                                <p className="text-xs text-teal-700">{entry.teacher?.full_name || entry.teacher_id}</p>
                              </>
                            ) : <p className="text-xs text-slate-400">Livre</p>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export default function SchedulePlanner() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission, isTeacher } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.SCHEDULES_MANAGE);
  const canRespond = hasPermission(PERMISSIONS.SCHEDULES_RESPOND);
  const [activeTab, setActiveTab] = useState(canManage ? 'dashboard' : 'questionnaire');
  const [selectedSettingId, setSelectedSettingId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [settingForm, setSettingForm] = useState(initialSetting);
  const [shiftForm, setShiftForm] = useState(initialShift);
  const [environmentForm, setEnvironmentForm] = useState(initialEnvironment);
  const [curriculumForm, setCurriculumForm] = useState(initialCurriculum);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [questionnaireDueAt, setQuestionnaireDueAt] = useState('');
  const [questionnaireNote, setQuestionnaireNote] = useState('');
  const [availabilitySelection, setAvailabilitySelection] = useState(new Set());
  const [preferences, setPreferences] = useState({
    prefers_double_lessons: false,
    prefers_separate_lessons: false,
    accepts_gaps: false,
    avoid_single_lesson_days: true,
    max_lessons_per_day: 5,
    notes: '',
  });
  const [weights, setWeights] = useState(DEFAULT_OPTIMIZATION_WEIGHTS);

  const settingsQuery = useQuery({ queryKey: ['schedule-settings'], queryFn: () => SchoolScheduleSettingsApi.list('-created_at') });
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: () => TeacherApi.list('-created_at', 500) });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => ClassApi.list('-created_at', 500) });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => SubjectApi.list('-created_at', 500) });
  const teacherRecordQuery = useQuery({
    queryKey: ['teacher-record', user?.email],
    queryFn: () => TeacherApi.filter({ email: user?.email }),
    enabled: Boolean(user?.email && isTeacher),
  });

  const teacherRecord = teacherRecordQuery.data?.[0] || null;

  useEffect(() => {
    if (!selectedSettingId && settingsQuery.data?.[0]?.id) {
      setSelectedSettingId(settingsQuery.data[0].id);
    }
  }, [settingsQuery.data, selectedSettingId]);

  const structuresQuery = useQuery({
    queryKey: ['schedule-structures', selectedSettingId],
    queryFn: () => getScheduleStructures(selectedSettingId),
    enabled: Boolean(selectedSettingId),
  });

  const scheduleShifts = structuresQuery.data?.shifts || [];
  const scheduleEnvironments = structuresQuery.data?.environments || [];
  const scheduleCurriculum = structuresQuery.data?.curriculum || [];

  const generationsQuery = useQuery({
    queryKey: ['schedule-generations', selectedSettingId],
    queryFn: () => ScheduleGenerationApi.filter({ setting_id: selectedSettingId }, '-created_at', 30),
    enabled: Boolean(selectedSettingId),
  });

  const latestGeneration = generationsQuery.data?.[0] || null;

  const entriesQuery = useQuery({
    queryKey: ['schedule-entries', latestGeneration?.id, subjectsQuery.data, teachersQuery.data],
    queryFn: async () => {
      const rows = await ScheduleEntryApi.filter({ generation_id: latestGeneration.id }, 'day_of_week', 800);
      return rows.map((row) => ({
        ...row,
        subject: (subjectsQuery.data || []).find((item) => item.id === row.subject_id) || null,
        teacher: (teachersQuery.data || []).find((item) => item.id === row.teacher_id) || null,
      }));
    },
    enabled: Boolean(latestGeneration?.id && subjectsQuery.data && teachersQuery.data),
  });

  const conflictsQuery = useQuery({
    queryKey: ['schedule-conflicts', latestGeneration?.id],
    queryFn: () => ScheduleConflictApi.filter({ generation_id: latestGeneration.id }, '-created_at', 200),
    enabled: Boolean(latestGeneration?.id),
  });

  const suggestionsQuery = useQuery({
    queryKey: ['schedule-suggestions', latestGeneration?.id],
    queryFn: () => ScheduleSuggestionApi.filter({ generation_id: latestGeneration.id }, '-created_at', 200),
    enabled: Boolean(latestGeneration?.id),
  });

  const formQuery = useQuery({
    queryKey: ['teacher-form', selectedSettingId, teacherRecord?.id],
    queryFn: () => TeacherAvailabilityFormApi.filter({ setting_id: selectedSettingId, teacher_id: teacherRecord.id }, '-created_at', 5),
    enabled: Boolean(selectedSettingId && teacherRecord?.id && canRespond),
  });

  const teacherForm = formQuery.data?.[0] || null;

  const slotsQuery = useQuery({
    queryKey: ['teacher-form-slots', teacherForm?.id],
    queryFn: () => TeacherAvailabilitySlotApi.filter({ form_id: teacherForm.id }, 'day_of_week', 400),
    enabled: Boolean(teacherForm?.id),
  });

  const preferencesQuery = useQuery({
    queryKey: ['teacher-form-preferences', teacherForm?.id],
    queryFn: () => TeacherPreferenceApi.filter({ form_id: teacherForm.id }, '-created_at', 5),
    enabled: Boolean(teacherForm?.id),
  });

  const optimizationQuery = useQuery({
    queryKey: ['optimization-settings', selectedSettingId],
    queryFn: () => getOptimizationSettings(selectedSettingId),
    enabled: Boolean(selectedSettingId),
  });

  useEffect(() => {
    const selected = new Set((slotsQuery.data || []).filter((slot) => slot.is_available).map((slot) => `${slot.shift_id}:${slot.day_of_week}:${slot.lesson_index}`));
    setAvailabilitySelection(selected);
  }, [slotsQuery.data]);

  useEffect(() => {
    const current = preferencesQuery.data?.[0];
    if (current) {
      setPreferences({
        prefers_double_lessons: Boolean(current.prefers_double_lessons),
        prefers_separate_lessons: Boolean(current.prefers_separate_lessons),
        accepts_gaps: Boolean(current.accepts_gaps),
        avoid_single_lesson_days: Boolean(current.avoid_single_lesson_days),
        max_lessons_per_day: Number(current.max_lessons_per_day || 5),
        notes: current.notes || '',
      });
    }
  }, [preferencesQuery.data]);

  useEffect(() => {
    const current = optimizationQuery.data?.[0];
    setWeights(mergeOptimizationWeights(current ? {
      reduceTeacherGaps: current.reduce_teacher_gaps,
      avoidSingleLessonDays: current.avoid_single_lesson_days,
      clusterPedagogicalBlocks: current.cluster_pedagogical_blocks,
      spreadAcrossWeek: current.spread_across_week,
      avoidDailyOverload: current.avoid_daily_overload,
      optimizeSpecialEnvironments: current.optimize_special_environments,
      minimizeIntercampusTravel: current.minimize_intercampus_travel,
    } : DEFAULT_OPTIMIZATION_WEIGHTS));
  }, [optimizationQuery.data]);

  const createSettingMutation = useMutation({
    mutationFn: () => createScheduleSetting(buildScheduleSettingPayload(settingForm)),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['schedule-settings'] });
      setSelectedSettingId(record.id);
      toast.success('Planejamento criado.');
    },
    onError: (error) => {
      const isForbidden = Number(error?.status) === 403 || Number(error?.statusCode) === 403;
      toast.error(
        isForbidden
          ? `Seu perfil não tem permissão para gravar em ${SCHEDULE_PLANNER_TABLES.SETTINGS}.`
          : (error?.message || 'Falha ao criar planejamento.')
      );
    },
  });

  const createShiftMutation = useMutation({
    mutationFn: () => saveScheduleStructures({
      settingId: selectedSettingId,
      shifts: [buildShiftPayload(shiftForm, selectedSettingId)],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-structures', selectedSettingId] });
      setShiftForm(initialShift);
      toast.success('Turno cadastrado.');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao cadastrar turno.'),
  });

  const createEnvironmentMutation = useMutation({
    mutationFn: () => saveScheduleStructures({
      settingId: selectedSettingId,
      environments: [buildEnvironmentPayload(environmentForm, selectedSettingId)],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-structures', selectedSettingId] });
      setEnvironmentForm(initialEnvironment);
      toast.success('Ambiente cadastrado.');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao cadastrar ambiente.'),
  });

  const createCurriculumMutation = useMutation({
    mutationFn: () => saveScheduleStructures({
      settingId: selectedSettingId,
      curriculum: [buildCurriculumMatrixPayload(curriculumForm, selectedSettingId)],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-structures', selectedSettingId] });
      setCurriculumForm(initialCurriculum);
      toast.success('Matriz curricular atualizada.');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao salvar matriz curricular.'),
  });

  const sendQuestionnairesMutation = useMutation({
    mutationFn: () => sendTeacherAvailabilityQuestionnaires({
      settingId: selectedSettingId,
      teacherIds: selectedTeachers,
      dueAt: questionnaireDueAt || null,
      note: questionnaireNote || null,
    }),
    onSuccess: () => {
      setSelectedTeachers([]);
      setQuestionnaireNote('');
      queryClient.invalidateQueries({ queryKey: ['teacher-form'] });
      toast.success('Questionários enviados.');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao enviar questionários.'),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateSchedulePlan({ settingId: selectedSettingId, generationMode: 'automatico' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-generations', selectedSettingId] });
      toast.success('Geração concluída.');
      setActiveTab('generation');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao gerar grade.'),
  });

  const saveAvailabilityMutation = useMutation({
    mutationFn: async () => {
      if (!teacherRecord?.id) throw new Error('Professor não vinculado à base docente.');

      const form = teacherForm
        ? await TeacherAvailabilityFormApi.update(teacherForm.id, { status: SCHEDULE_FORM_STATUS.ANSWERED, responded_at: new Date().toISOString() })
        : await TeacherAvailabilityFormApi.create({ setting_id: selectedSettingId, teacher_id: teacherRecord.id, status: SCHEDULE_FORM_STATUS.ANSWERED, responded_at: new Date().toISOString() });

      const shiftList = scheduleShifts;
      const existingSlots = slotsQuery.data || [];
      await Promise.all(shiftList.flatMap((shift) => (
        WEEK_DAYS.flatMap((dayOfWeek) => (
          Array.from({ length: Number(shift.lesson_count || 0) }, (_, index) => {
            const payload = buildTeacherAvailabilitySlotPayload({
              formId: form.id,
              teacherId: teacherRecord.id,
              shiftId: shift.id,
              dayOfWeek,
              lessonIndex: index + 1,
              isAvailable: availabilitySelection.has(`${shift.id}:${dayOfWeek}:${index + 1}`),
            });

            const existing = existingSlots.find((slot) => slot.shift_id === payload.shift_id && slot.day_of_week === payload.day_of_week && slot.lesson_index === payload.lesson_index);
            return existing ? TeacherAvailabilitySlotApi.update(existing.id, payload) : TeacherAvailabilitySlotApi.create(payload);
          })
        ))
      )));

      const existingPreference = preferencesQuery.data?.[0];
      const preferencePayload = buildTeacherPreferencePayload(preferences, form.id, teacherRecord.id);
      await (existingPreference ? TeacherPreferenceApi.update(existingPreference.id, preferencePayload) : TeacherPreferenceApi.create(preferencePayload));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-form', selectedSettingId, teacherRecord?.id] });
      queryClient.invalidateQueries({ queryKey: ['teacher-form-slots', teacherForm?.id] });
      queryClient.invalidateQueries({ queryKey: ['teacher-form-preferences', teacherForm?.id] });
      toast.success('Questionário salvo.');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao salvar questionário.'),
  });

  const saveWeightsMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        setting_id: selectedSettingId,
        reduce_teacher_gaps: weights.reduceTeacherGaps,
        avoid_single_lesson_days: weights.avoidSingleLessonDays,
        cluster_pedagogical_blocks: weights.clusterPedagogicalBlocks,
        spread_across_week: weights.spreadAcrossWeek,
        avoid_daily_overload: weights.avoidDailyOverload,
        optimize_special_environments: weights.optimizeSpecialEnvironments,
        minimize_intercampus_travel: weights.minimizeIntercampusTravel,
      };
      return saveOptimizationSettings(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optimization-settings', selectedSettingId] });
      toast.success('Parâmetros de otimização salvos.');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao salvar parâmetros.'),
  });

  const applySuggestionMutation = useMutation({
    mutationFn: async (suggestion) => {
      const updatedEntries = applySuggestionLocally(entriesQuery.data || [], suggestion);
      const changed = updatedEntries.find((entry, index) => JSON.stringify(entry) !== JSON.stringify((entriesQuery.data || [])[index]));
      if (!changed?.id) throw new Error('Não foi possível localizar aula para aplicar a sugestão.');
      await ScheduleEntryApi.update(changed.id, {
        shift_id: changed.shift_id,
        day_of_week: changed.day_of_week,
        lesson_index: changed.lesson_index,
        source: changed.source,
      });
      await ScheduleSuggestionApi.update(suggestion.id, { status: 'aplicada' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-entries', latestGeneration?.id] });
      queryClient.invalidateQueries({ queryKey: ['schedule-suggestions', latestGeneration?.id] });
      toast.success('Sugestão aplicada.');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao aplicar sugestão.'),
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: (id) => ScheduleSuggestionApi.update(id, { status: 'rejeitada' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-suggestions', latestGeneration?.id] });
      toast.success('Sugestão rejeitada.');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao rejeitar sugestão.'),
  });

  const metrics = useMemo(() => ({
    teachers: (teachersQuery.data || []).length,
    curriculum: scheduleCurriculum.length,
    conflicts: (conflictsQuery.data || []).length,
    suggestions: (suggestionsQuery.data || []).length,
  }), [teachersQuery.data, scheduleCurriculum.length, conflictsQuery.data, suggestionsQuery.data]);

  const toggleTeacherSelection = (teacherId) => {
    setSelectedTeachers((current) => current.includes(teacherId) ? current.filter((item) => item !== teacherId) : [...current, teacherId]);
  };

  const toggleAvailabilitySlot = (slotKey) => {
    setAvailabilitySelection((current) => {
      const next = new Set(current);
      if (next.has(slotKey)) next.delete(slotKey);
      else next.add(slotKey);
      return next;
    });
  };

  return (
    <div className="window-shell-page">
      <div className="window-page-content space-y-6">
        <PageHeader
          title="Módulo de Horários"
          subtitle="Estrutura, coleta com professores, geração automática, pendências, sugestões e otimização da grade."
          backTo="/Dashboard"
          backLabel="Dashboard"
        >
          {canManage && (
            <Select value={selectedSettingId} onValueChange={setSelectedSettingId}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="Planejamento" /></SelectTrigger>
              <SelectContent>
                {(settingsQuery.data || []).map((setting) => <SelectItem key={setting.id} value={setting.id}>{setting.name} • {setting.academic_year}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </PageHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${canManage ? 'grid-cols-7' : 'grid-cols-3'}`}>
            {canManage ? (
              <>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="structure">Estrutura</TabsTrigger>
                <TabsTrigger value="questionnaires">Questionários</TabsTrigger>
                <TabsTrigger value="generation">Geração</TabsTrigger>
                <TabsTrigger value="pendencias">Pendências</TabsTrigger>
                <TabsTrigger value="suggestions">Sugestões</TabsTrigger>
                <TabsTrigger value="optimization">Otimização</TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="questionnaire">Questionário</TabsTrigger>
                <TabsTrigger value="my-schedule">Minha grade</TabsTrigger>
                <TabsTrigger value="optimization">Regras</TabsTrigger>
              </>
            )}
          </TabsList>

          {canManage && (
            <TabsContent value="dashboard" className="space-y-6">
              <div className="app-metric-grid">
                {[
                  ['Professores', metrics.teachers],
                  ['Itens curriculares', metrics.curriculum],
                  ['Pendências', metrics.conflicts],
                  ['Sugestões', metrics.suggestions],
                ].map(([label, value]) => (
                  <Card key={label}><CardContent className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value}</p></CardContent></Card>
                ))}
              </div>

              <Section
                title="Novo planejamento"
                description="Cria a versão-base do processo de horários para o ano/período desejado."
                action={(
                  <Button onClick={() => createSettingMutation.mutate()} disabled={createSettingMutation.isPending}>
                    {createSettingMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                    Iniciar planejamento
                  </Button>
                )}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div><Label>Nome</Label><Input value={settingForm.name} onChange={(event) => setSettingForm((current) => ({ ...current, name: event.target.value }))} /></div>
                  <div><Label>Ano letivo</Label><Input type="number" value={settingForm.academic_year} onChange={(event) => setSettingForm((current) => ({ ...current, academic_year: Number(event.target.value) }))} /></div>
                </div>
                <div><Label>Observações</Label><Textarea rows={3} value={settingForm.notes} onChange={(event) => setSettingForm((current) => ({ ...current, notes: event.target.value }))} /></div>
              </Section>

              {latestGeneration && (
                <SimpleGrid
                  entries={entriesQuery.data || []}
                  classes={classesQuery.data || []}
                  shifts={scheduleShifts}
                  selectedClassId={selectedClassId}
                  onClassChange={setSelectedClassId}
                />
              )}
            </TabsContent>
          )}

          {canManage && (
            <TabsContent value="structure" className="space-y-6">
              <Section title="Turnos" description="Malha horária por turno.">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div><Label>Código</Label><Input value={shiftForm.code} onChange={(event) => setShiftForm((current) => ({ ...current, code: event.target.value }))} /></div>
                    <div><Label>Nome</Label><Input value={shiftForm.name} onChange={(event) => setShiftForm((current) => ({ ...current, name: event.target.value }))} /></div>
                    <div><Label>Início</Label><Input type="time" value={shiftForm.start_time} onChange={(event) => setShiftForm((current) => ({ ...current, start_time: event.target.value }))} /></div>
                    <div><Label>Fim</Label><Input type="time" value={shiftForm.end_time} onChange={(event) => setShiftForm((current) => ({ ...current, end_time: event.target.value }))} /></div>
                    <div><Label>Qtd. aulas</Label><Input type="number" value={shiftForm.lesson_count} onChange={(event) => setShiftForm((current) => ({ ...current, lesson_count: Number(event.target.value) }))} /></div>
                  </div>
                  <div className="space-y-3">
                    <Button onClick={() => createShiftMutation.mutate()} disabled={!selectedSettingId || createShiftMutation.isPending}>{createShiftMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Adicionar turno</Button>
                    {scheduleShifts.map((shift) => <div key={shift.id} className="rounded-2xl border border-slate-200 px-4 py-3"><p className="font-semibold text-slate-900">{shift.name}</p><p className="text-sm text-slate-500">{shift.start_time} - {shift.end_time} • {shift.lesson_count} aulas</p></div>)}
                  </div>
                </div>
              </Section>

              <Section title="Ambientes" description="Laboratórios, quadra, vídeo e demais espaços restritos.">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div><Label>Código</Label><Input value={environmentForm.code} onChange={(event) => setEnvironmentForm((current) => ({ ...current, code: event.target.value }))} /></div>
                    <div><Label>Nome</Label><Input value={environmentForm.name} onChange={(event) => setEnvironmentForm((current) => ({ ...current, name: event.target.value }))} /></div>
                    <div><Label>Tipo</Label><Select value={environmentForm.environment_type} onValueChange={(value) => setEnvironmentForm((current) => ({ ...current, environment_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sala">Sala</SelectItem><SelectItem value="laboratorio">Laboratório</SelectItem><SelectItem value="quadra">Quadra</SelectItem><SelectItem value="video">Sala de vídeo</SelectItem><SelectItem value="especial">Especial</SelectItem></SelectContent></Select></div>
                    <div><Label>Capacidade</Label><Input type="number" value={environmentForm.capacity} onChange={(event) => setEnvironmentForm((current) => ({ ...current, capacity: Number(event.target.value) }))} /></div>
                    <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700"><Checkbox checked={environmentForm.is_special} onCheckedChange={(checked) => setEnvironmentForm((current) => ({ ...current, is_special: Boolean(checked) }))} />Ambiente especial</label>
                  </div>
                  <div className="space-y-3">
                    <Button onClick={() => createEnvironmentMutation.mutate()} disabled={!selectedSettingId || createEnvironmentMutation.isPending}>{createEnvironmentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Adicionar ambiente</Button>
                    {scheduleEnvironments.map((environment) => <div key={environment.id} className="rounded-2xl border border-slate-200 px-4 py-3"><p className="font-semibold text-slate-900">{environment.name}</p><p className="text-sm text-slate-500">{environment.environment_type} • cap. {environment.capacity}</p></div>)}
                  </div>
                </div>
              </Section>

              <Section title="Matriz curricular" description="Turma, disciplina, professor, carga semanal e restrições pedagógicas.">
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div><Label>Turma</Label><Select value={curriculumForm.class_id} onValueChange={(value) => setCurriculumForm((current) => ({ ...current, class_id: value }))}><SelectTrigger><SelectValue placeholder="Turma" /></SelectTrigger><SelectContent>{(classesQuery.data || []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Disciplina</Label><Select value={curriculumForm.subject_id} onValueChange={(value) => setCurriculumForm((current) => ({ ...current, subject_id: value }))}><SelectTrigger><SelectValue placeholder="Disciplina" /></SelectTrigger><SelectContent>{(subjectsQuery.data || []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Professor</Label><Select value={curriculumForm.teacher_id} onValueChange={(value) => setCurriculumForm((current) => ({ ...current, teacher_id: value }))}><SelectTrigger><SelectValue placeholder="Professor" /></SelectTrigger><SelectContent>{(teachersQuery.data || []).map((item) => <SelectItem key={item.id} value={item.id}>{item.full_name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Turno</Label><Select value={curriculumForm.shift_id} onValueChange={(value) => setCurriculumForm((current) => ({ ...current, shift_id: value }))}><SelectTrigger><SelectValue placeholder="Turno" /></SelectTrigger><SelectContent>{scheduleShifts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Aulas semanais</Label><Input type="number" value={curriculumForm.weekly_lessons} onChange={(event) => setCurriculumForm((current) => ({ ...current, weekly_lessons: Number(event.target.value) }))} /></div>
                    <div><Label>Máx. por dia</Label><Input type="number" value={curriculumForm.max_lessons_per_day} onChange={(event) => setCurriculumForm((current) => ({ ...current, max_lessons_per_day: Number(event.target.value) }))} /></div>
                  </div>
                  <div className="space-y-3">
                    <Button onClick={() => createCurriculumMutation.mutate()} disabled={!selectedSettingId || createCurriculumMutation.isPending}>{createCurriculumMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Adicionar item</Button>
                    {scheduleCurriculum.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3"><p className="font-semibold text-slate-900">{(classesQuery.data || []).find((entry) => entry.id === item.class_id)?.name} • {(subjectsQuery.data || []).find((entry) => entry.id === item.subject_id)?.name}</p><p className="text-sm text-slate-500">{(teachersQuery.data || []).find((entry) => entry.id === item.teacher_id)?.full_name} • {item.weekly_lessons} aulas</p></div>)}
                  </div>
                </div>
              </Section>
            </TabsContent>
          )}

          {canManage && (
            <TabsContent value="questionnaires" className="space-y-6">
              <Section title="Envio de questionários" description="Solicitação individual de disponibilidade e preferências." action={<Button onClick={() => sendQuestionnairesMutation.mutate()} disabled={!selectedSettingId || selectedTeachers.length === 0 || sendQuestionnairesMutation.isPending}>{sendQuestionnairesMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enviar</Button>}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div><Label>Prazo</Label><Input type="datetime-local" value={questionnaireDueAt} onChange={(event) => setQuestionnaireDueAt(event.target.value)} /></div>
                    <div><Label>Mensagem</Label><Textarea rows={5} value={questionnaireNote} onChange={(event) => setQuestionnaireNote(event.target.value)} /></div>
                  </div>
                  <div className="space-y-3">
                    {(teachersQuery.data || []).map((teacher) => (
                      <button key={teacher.id} type="button" onClick={() => toggleTeacherSelection(teacher.id)} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${selectedTeachers.includes(teacher.id) ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'}`}>
                        <div><p className="font-semibold text-slate-900">{teacher.full_name}</p><p className="text-sm text-slate-500">{teacher.email}</p></div>
                        {selectedTeachers.includes(teacher.id) && <Badge>Selecionado</Badge>}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>
            </TabsContent>
          )}

          {canManage && (
            <TabsContent value="generation" className="space-y-6">
              <Section title="Geração automática" description="Validação, alocação inicial, conflitos, sugestões e otimização." action={<Button onClick={() => generateMutation.mutate()} disabled={!selectedSettingId || generateMutation.isPending}>{generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}Gerar horário automaticamente</Button>}>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  A geração respeita professor, turma, ambiente, carga semanal, indisponibilidades e parâmetros de qualidade. Restrições obrigatórias não são violadas; preferências geram perda de qualidade ou pendências.
                </div>
                {latestGeneration && <SimpleGrid entries={entriesQuery.data || []} classes={classesQuery.data || []} shifts={scheduleShifts} selectedClassId={selectedClassId} onClassChange={setSelectedClassId} />}
              </Section>
            </TabsContent>
          )}

          {canManage && (
            <TabsContent value="pendencias" className="space-y-6">
              <Section title="Pendências" description="Impossibilidades e motivos prováveis.">
                {(conflictsQuery.data || []).length === 0 && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">Nenhuma pendência aberta na última geração.</div>}
                {(conflictsQuery.data || []).map((conflict) => <div key={conflict.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"><p className="font-semibold text-amber-900">{conflict.reason_text}</p><p className="mt-1 text-sm text-amber-700">{conflict.impact_summary}</p><div className="mt-2 flex gap-2"><Badge variant="outline">{conflict.conflict_type}</Badge><Badge variant="outline">{conflict.severity}</Badge></div></div>)}
              </Section>
            </TabsContent>
          )}

          {canManage && (
            <TabsContent value="suggestions" className="space-y-6">
              <Section title="Sugestões automáticas" description="Rearranjos calculados para destravar ou melhorar a grade.">
                {(suggestionsQuery.data || []).length === 0 && <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Nenhuma sugestão gerada na última execução.</div>}
                {(suggestionsQuery.data || []).map((suggestion) => <div key={suggestion.id} className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-teal-900">{suggestion.title}</p><p className="mt-1 text-sm text-teal-700">{suggestion.description}</p><div className="mt-2 flex gap-2"><Badge variant="outline">{suggestion.suggestion_type}</Badge><Badge variant="outline">{suggestion.status}</Badge></div></div><div className="flex gap-2"><Button size="sm" onClick={() => applySuggestionMutation.mutate(suggestion)} disabled={applySuggestionMutation.isPending || suggestion.status === 'aplicada'}>Aplicar</Button><Button size="sm" variant="outline" onClick={() => rejectSuggestionMutation.mutate(suggestion.id)} disabled={rejectSuggestionMutation.isPending || suggestion.status === 'rejeitada'}>Rejeitar</Button></div></div></div>)}
              </Section>
            </TabsContent>
          )}

          <TabsContent value="optimization" className="space-y-6">
            <Section title={canManage ? 'Parâmetros de otimização' : 'Regras de qualidade'} description="Pesos que melhoram a grade após cumprir as restrições obrigatórias." action={canManage ? <Button onClick={() => saveWeightsMutation.mutate()} disabled={!selectedSettingId || saveWeightsMutation.isPending}>{saveWeightsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar pesos</Button> : null}>
              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  ['reduceTeacherGaps', 'Reduzir janelas'],
                  ['avoidSingleLessonDays', 'Evitar ida para 1 aula'],
                  ['clusterPedagogicalBlocks', 'Agrupar aulas quando fizer sentido'],
                  ['spreadAcrossWeek', 'Distribuir ao longo da semana'],
                  ['avoidDailyOverload', 'Evitar excesso no mesmo dia'],
                  ['optimizeSpecialEnvironments', 'Otimizar ambientes especiais'],
                  ['minimizeIntercampusTravel', 'Minimizar deslocamentos'],
                ].map(([key, label]) => (
                  <div key={key} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div><p className="font-medium text-slate-900">{label}</p><p className="text-sm text-slate-500">Peso {weights[key]}</p></div>
                      {canManage && <div className="w-[220px]"><Slider value={[weights[key]]} min={1} max={10} step={1} onValueChange={([value]) => setWeights((current) => ({ ...current, [key]: value }))} /></div>}
                    </div>
                  </div>
                ))}
              </div>
              {!canManage && <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Restrições obrigatórias: professor/turma/ambiente não podem colidir; carga semanal e indisponibilidades precisam ser respeitadas. Preferências influenciam score e sugestões.</div>}
            </Section>
          </TabsContent>

          {canRespond && (
            <TabsContent value="questionnaire" className="space-y-6">
              <Section title="Meu questionário de disponibilidade" description="Responda sua disponibilidade e preferências pedagógicas." action={<Button onClick={() => saveAvailabilityMutation.mutate()} disabled={!selectedSettingId || saveAvailabilityMutation.isPending}>{saveAvailabilityMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar respostas</Button>}>
                {!teacherRecord && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">Seu usuário não está vinculado a um registro em `teachers`.</div>}
                {teacherRecord && (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Professor</p><p className="mt-2 font-semibold text-slate-900">{teacherRecord.full_name}</p></div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Status</p><p className="mt-2 font-semibold text-slate-900">{teacherForm?.status || 'não iniciado'}</p></div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Carga horária</p><p className="mt-2 font-semibold text-slate-900">{teacherRecord.workload_hours || 0}h</p></div>
                    </div>
                    <AvailabilityGrid shifts={scheduleShifts} selected={availabilitySelection} onToggle={toggleAvailabilitySlot} />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="font-semibold text-slate-900">Preferências</p>
                        <div className="mt-4 space-y-3">
                          <label className="flex items-center gap-2 text-sm text-slate-700"><Checkbox checked={preferences.prefers_double_lessons} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, prefers_double_lessons: Boolean(checked) }))} />Prefiro aulas geminadas</label>
                          <label className="flex items-center gap-2 text-sm text-slate-700"><Checkbox checked={preferences.prefers_separate_lessons} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, prefers_separate_lessons: Boolean(checked) }))} />Prefiro aulas separadas</label>
                          <label className="flex items-center gap-2 text-sm text-slate-700"><Checkbox checked={preferences.accepts_gaps} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, accepts_gaps: Boolean(checked) }))} />Aceito janelas</label>
                          <div><Label>Máx. aulas por dia</Label><Input type="number" value={preferences.max_lessons_per_day} onChange={(event) => setPreferences((current) => ({ ...current, max_lessons_per_day: Number(event.target.value) }))} /></div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4"><Label>Observações</Label><Textarea className="mt-4" rows={9} value={preferences.notes} onChange={(event) => setPreferences((current) => ({ ...current, notes: event.target.value }))} /></div>
                    </div>
                  </>
                )}
              </Section>
            </TabsContent>
          )}

          {canRespond && (
            <TabsContent value="my-schedule" className="space-y-6">
              <Section title="Minha grade atual" description="Leitura operacional da grade gerada para seu vínculo docente.">
                {(entriesQuery.data || []).filter((entry) => entry.teacher_id === teacherRecord?.id).map((entry) => <div key={entry.id} className="rounded-2xl border border-slate-200 px-4 py-3"><div className="flex items-center justify-between gap-4"><div><p className="font-semibold text-slate-900">{entry.subject?.name || entry.subject_id}</p><p className="text-sm text-slate-500">{(classesQuery.data || []).find((item) => item.id === entry.class_id)?.name}</p></div><div className="text-right text-sm text-slate-600"><p>{getWeekDayLabel(entry.day_of_week)} • {entry.lesson_index}ª</p><p>{scheduleShifts.find((item) => item.id === entry.shift_id)?.name}</p></div></div></div>)}
                {(entriesQuery.data || []).filter((entry) => entry.teacher_id === teacherRecord?.id).length === 0 && <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Nenhuma grade gerada disponível.</div>}
              </Section>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
