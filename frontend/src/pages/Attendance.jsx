import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarDays, Check, Clock, FileWarning, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/lib/AuthContext';
import { ClassApi, ScheduleApi, StudentApi, SubjectApi, TeacherApi } from '@/services/supabaseApi';
import PageHeader from '@/components/common/PageHeader';
import RenderProfiler from '@/components/common/RenderProfiler';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/components/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  ATTENDANCE_LESSON_WINDOW_STATES,
  ATTENDANCE_STATUSES,
  buildDailyAttendanceState,
  buildLessonAttendancePayload,
  getAttendanceDayOfWeek,
  getAttendanceLessonWindowState,
  summarizeAttendanceCalendar,
  summarizeAttendanceState,
} from '@shared/contracts/attendance';
import { canWriteAttendance as canWriteAttendanceByPermission } from '@shared/contracts/access';
import { saveLessonAttendance } from '@/lib/attendanceClient';

function toDateKey(value) {
  return format(value, 'yyyy-MM-dd');
}

function fromDateKey(value) {
  return new Date(`${value}T12:00:00`);
}

function buildLessonLabel({
  lessonNumber,
  startTime = null,
  endTime = null,
  subjectName = null,
}) {
  const lessonTitle = `${lessonNumber}ª aula`;
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : 'Horário não configurado';
  return subjectName
    ? `${lessonTitle} • ${subjectName} • ${timeRange}`
    : `${lessonTitle} • ${timeRange}`;
}

async function listDailyAttendanceRecords(classId, date, subjectId, lessonNumber) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('class_id', classId)
    .eq('date', date)
    .eq('subject_id', subjectId)
    .eq('lesson_number', lessonNumber)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function listMonthlyAttendanceRecords(classId, monthDate, subjectId, lessonNumber) {
  let query = supabase
    .from('attendance')
    .select('*')
    .eq('class_id', classId)
    .gte('date', toDateKey(startOfMonth(monthDate)))
    .lte('date', toDateKey(endOfMonth(monthDate)))
    .order('date', { ascending: true })
    .order('updated_at', { ascending: false });

  if (subjectId) {
    query = query.eq('subject_id', subjectId);
  }

  if (lessonNumber) {
    query = query.eq('lesson_number', lessonNumber);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

const STATUS_CONFIG = {
  [ATTENDANCE_STATUSES.PRESENT]: {
    icon: Check,
    color: 'bg-emerald-500 text-white hover:bg-emerald-600',
    title: 'Presente',
  },
  [ATTENDANCE_STATUSES.ABSENT]: {
    icon: X,
    color: 'bg-rose-500 text-white hover:bg-rose-600',
    title: 'Falta',
  },
  [ATTENDANCE_STATUSES.JUSTIFIED]: {
    icon: FileWarning,
    color: 'bg-amber-500 text-white hover:bg-amber-600',
    title: 'Justificado',
  },
  [ATTENDANCE_STATUSES.LATE]: {
    icon: Clock,
    color: 'bg-blue-500 text-white hover:bg-blue-600',
    title: 'Atrasado',
  },
};

const STATUS_ENTRIES = Object.entries(STATUS_CONFIG);
const ATTENDANCE_ROW_HEIGHT = 76;
const ATTENDANCE_LIST_OVERSCAN = 6;
const ATTENDANCE_VIRTUALIZATION_THRESHOLD = 30;
const ATTENDANCE_LIST_MAX_HEIGHT = 560;

const AttendanceStudentRow = memo(function AttendanceStudentRow({
  student,
  index,
  currentStatus,
  canWriteAttendance,
  onStatusChange,
}) {
  return (
    <div className="flex h-[76px] items-center justify-between rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50">
      <div className="flex items-center gap-3">
        <span className="w-6 text-sm text-slate-400">{index + 1}</span>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-indigo-100 text-indigo-700">
            {student.full_name?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{student.full_name}</p>
          <p className="text-sm text-slate-500">{student.registration_number || 'Sem matricula'}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {STATUS_ENTRIES.map(([status, config]) => (
          <Button
            key={status}
            variant="outline"
            size="sm"
            title={config.title}
            onClick={() => onStatusChange(student.id, status)}
            disabled={!canWriteAttendance}
            className={cn(
              'h-10 w-10 p-0',
              currentStatus === status && config.color,
            )}
          >
            <config.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
    </div>
  );
});

const VirtualizedAttendanceList = memo(function VirtualizedAttendanceList({
  students,
  attendanceData,
  canWriteAttendance,
  onStatusChange,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = students.length * ATTENDANCE_ROW_HEIGHT;
  const viewportHeight = Math.min(ATTENDANCE_LIST_MAX_HEIGHT, totalHeight);
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / ATTENDANCE_ROW_HEIGHT));
  const startIndex = Math.max(0, Math.floor(scrollTop / ATTENDANCE_ROW_HEIGHT) - ATTENDANCE_LIST_OVERSCAN);
  const endIndex = Math.min(
    students.length,
    startIndex + visibleCount + ATTENDANCE_LIST_OVERSCAN * 2,
  );
  const offsetY = startIndex * ATTENDANCE_ROW_HEIGHT;
  const visibleStudents = students.slice(startIndex, endIndex);

  useEffect(() => {
    setScrollTop(0);
  }, [students]);

  const handleScroll = useCallback((event) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return (
    <div
      className="overflow-y-auto rounded-xl border border-slate-100"
      style={{ height: viewportHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          className="space-y-2 p-2"
          style={{
            transform: `translateY(${offsetY}px)`,
          }}
        >
          {visibleStudents.map((student, visibleIndex) => {
            const index = startIndex + visibleIndex;
            return (
              <AttendanceStudentRow
                key={student.id}
                student={student}
                index={index}
                currentStatus={attendanceData[student.id]}
                canWriteAttendance={canWriteAttendance}
                onStatusChange={onStatusChange}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default function Attendance() {
  const { user } = useAuth();
  const { profileType } = usePermissions();
  const queryClient = useQueryClient();

  const canWriteAttendance = canWriteAttendanceByPermission(profileType);
  const today = new Date();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const [calendarMonth, setCalendarMonth] = useState(today);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedLessonNumber, setSelectedLessonNumber] = useState('');
  const [attendanceData, setAttendanceData] = useState({});
  const [lateJustification, setLateJustification] = useState('');
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [showLateJustificationDialog, setShowLateJustificationDialog] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-attendance'],
    queryFn: () => ClassApi.list('name', 300),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-attendance'],
    queryFn: () => SubjectApi.list('name', 300),
  });

  const { data: teacherRecords = [] } = useQuery({
    queryKey: ['teacher-attendance-link', user?.email],
    queryFn: () => TeacherApi.filter({ email: user.email }),
    enabled: !!user?.email && canWriteAttendance,
  });

  const teacherId = teacherRecords[0]?.id ?? null;
  const teacherLinkMissing = profileType === 'professor' && !teacherId;

  const availableClasses = useMemo(() => (
    classes.filter((classItem) => {
      if (classItem?.status === 'encerrada') return false;
      if (profileType !== 'professor') return true;
      if (!teacherId) return false;

      const teacherIds = Array.isArray(classItem.teacher_ids) ? classItem.teacher_ids : [];
      return teacherIds.includes(teacherId) || classItem.coordinator_id === teacherId;
    })
  ), [classes, profileType, teacherId]);

  useEffect(() => {
    if (selectedClass && availableClasses.some((classItem) => classItem.id === selectedClass)) return;
    setSelectedClass(availableClasses[0]?.id ?? '');
  }, [availableClasses, selectedClass]);

  const selectedClassRecord = useMemo(
    () => availableClasses.find((classItem) => classItem.id === selectedClass),
    [availableClasses, selectedClass]
  );
  const subjectNameById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  );
  const classSubjectIds = useMemo(() => (
    Array.isArray(selectedClassRecord?.subject_ids)
      ? selectedClassRecord.subject_ids.filter(Boolean)
      : []
  ), [selectedClassRecord]);

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['attendance-students', selectedClass],
    queryFn: () => StudentApi.filter({
      current_class_id: selectedClass,
      enrollment_status: 'ativo',
    }, 'full_name', 500),
    enabled: !!selectedClass,
  });

  const { data: scheduleRows = [], isLoading: scheduleRowsLoading } = useQuery({
    queryKey: ['attendance-schedule-rows', selectedClass, selectedDate],
    queryFn: () => ScheduleApi.filter({
      class_id: selectedClass,
      day_of_week: getAttendanceDayOfWeek(selectedDate),
      is_active: true,
    }, 'start_time', 50),
    enabled: !!selectedClass && !!selectedDate,
  });

  const scheduleLessonOptions = useMemo(() => (
    [...scheduleRows]
      .sort((left, right) => {
        const leftKey = `${left.start_time || ''}-${left.end_time || ''}-${left.subject_id || ''}`;
        const rightKey = `${right.start_time || ''}-${right.end_time || ''}-${right.subject_id || ''}`;
        return leftKey.localeCompare(rightKey, 'pt-BR');
      })
      .map((row, index) => ({
        id: row.id,
        lessonNumber: String(index + 1),
        subjectId: row.subject_id,
        teacherId: row.teacher_id || null,
        startTime: row.start_time || null,
        endTime: row.end_time || null,
        room: row.room || null,
        label: buildLessonLabel({
          lessonNumber: index + 1,
          startTime: row.start_time || null,
          endTime: row.end_time || null,
          subjectName: subjectNameById.get(row.subject_id) || null,
        }),
      }))
  ), [scheduleRows, subjectNameById]);

  const fallbackSubjectOptions = useMemo(() => (
    classSubjectIds.map((subjectId) => ({
      id: subjectId,
      name: subjectNameById.get(subjectId) || 'Disciplina',
    }))
  ), [classSubjectIds, subjectNameById]);

  const subjectOptions = useMemo(() => {
    if (scheduleLessonOptions.length > 0) {
      return [...new Map(scheduleLessonOptions.map((slot) => [
        slot.subjectId,
        {
          id: slot.subjectId,
          name: subjectNameById.get(slot.subjectId) || 'Disciplina',
        },
      ])).values()];
    }

    return fallbackSubjectOptions;
  }, [fallbackSubjectOptions, scheduleLessonOptions, subjectNameById]);

  useEffect(() => {
    if (selectedSubject && subjectOptions.some((subject) => subject.id === selectedSubject)) return;
    setSelectedSubject(subjectOptions[0]?.id ?? '');
  }, [selectedSubject, subjectOptions]);

  const lessonOptions = useMemo(() => {
    if (scheduleLessonOptions.length > 0) {
      return scheduleLessonOptions.filter((slot) => slot.subjectId === selectedSubject);
    }

    return Array.from({ length: 8 }, (_, index) => ({
      id: `fallback-${index + 1}`,
      lessonNumber: String(index + 1),
      subjectId: selectedSubject || null,
      teacherId: teacherId || null,
      startTime: null,
      endTime: null,
      room: null,
      label: `${index + 1}ª aula`,
    }));
  }, [scheduleLessonOptions, selectedSubject, teacherId]);

  useEffect(() => {
    if (selectedLessonNumber && lessonOptions.some((lesson) => lesson.lessonNumber === selectedLessonNumber)) return;
    setSelectedLessonNumber(lessonOptions[0]?.lessonNumber ?? '');
  }, [lessonOptions, selectedLessonNumber]);

  const selectedLessonSlot = useMemo(
    () => lessonOptions.find((lesson) => lesson.lessonNumber === selectedLessonNumber) || null,
    [lessonOptions, selectedLessonNumber]
  );

  const { data: attendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance-daily-call', selectedClass, selectedDate, selectedSubject, selectedLessonNumber],
    queryFn: () => listDailyAttendanceRecords(
      selectedClass,
      selectedDate,
      selectedSubject,
      Number(selectedLessonNumber)
    ),
    enabled: !!selectedClass && !!selectedDate && !!selectedSubject && !!selectedLessonNumber,
  });

  const { data: monthAttendance = [], isLoading: monthAttendanceLoading } = useQuery({
    queryKey: ['attendance-month-daily-call', selectedClass, format(calendarMonth, 'yyyy-MM'), selectedSubject, selectedLessonNumber],
    queryFn: () => listMonthlyAttendanceRecords(
      selectedClass,
      calendarMonth,
      selectedSubject,
      Number(selectedLessonNumber)
    ),
    enabled: !!selectedClass && !!selectedSubject && !!selectedLessonNumber,
  });

  const classStudents = useMemo(
    () => students.filter((student) => student.current_class_id === selectedClass),
    [selectedClass, students]
  );
  const selectedDateObject = fromDateKey(selectedDate);
  useEffect(() => {
    if (!selectedClass) {
      setAttendanceData({});
      setAttendanceNotes('');
      setLateJustification('');
      return;
    }

    setAttendanceData(buildDailyAttendanceState(classStudents, attendance));
    setAttendanceNotes(attendance[0]?.notes || '');
    setLateJustification(attendance[0]?.justification || '');
  }, [attendance, classStudents, selectedClass]);

  const monthlySummary = useMemo(
    () => summarizeAttendanceCalendar(monthAttendance, classStudents.length),
    [classStudents.length, monthAttendance]
  );
  const selectedDaySummary = monthlySummary[selectedDate] ?? null;
  const completeDays = useMemo(
    () => Object.entries(monthlySummary)
      .filter(([, summary]) => summary.coverage === 'complete')
      .map(([date]) => fromDateKey(date)),
    [monthlySummary]
  );
  const partialDays = useMemo(
    () => Object.entries(monthlySummary)
      .filter(([, summary]) => summary.coverage === 'partial')
      .map(([date]) => fromDateKey(date)),
    [monthlySummary]
  );
  const monthSummaryTotals = useMemo(() => ({
    recordedDays: Object.keys(monthlySummary).length,
    completeDays: Object.values(monthlySummary).filter((summary) => summary.coverage === 'complete').length,
    partialDays: Object.values(monthlySummary).filter((summary) => summary.coverage === 'partial').length,
  }), [monthlySummary]);
  const stats = useMemo(
    () => summarizeAttendanceState(attendanceData, classStudents),
    [attendanceData, classStudents]
  );
  const shouldVirtualizeStudents = classStudents.length > ATTENDANCE_VIRTUALIZATION_THRESHOLD;
  const lessonWindowState = useMemo(() => getAttendanceLessonWindowState({
    date: selectedDate,
    startTime: selectedLessonSlot?.startTime || null,
    endTime: selectedLessonSlot?.endTime || null,
  }), [selectedDate, selectedLessonSlot?.endTime, selectedLessonSlot?.startTime]);
  const selectedLessonLabel = selectedLessonSlot?.label || (selectedLessonNumber ? `${selectedLessonNumber}ª aula` : 'Aula');
  const scheduleFallbackMode = scheduleLessonOptions.length === 0;
  const isLoading = studentsLoading || attendanceLoading || scheduleRowsLoading;

  const bulkSaveMutation = useMutation({
    mutationFn: async (payload) => saveLessonAttendance(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-daily-call'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-month-daily-call'] });
      toast.success('Chamada da aula salva com sucesso!');
    },
  });

  const handleStatusChange = useCallback((studentId, status) => {
    if (!canWriteAttendance) return;

    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  }, [canWriteAttendance]);

  const handleSaveAll = useCallback(() => {
    if (!canWriteAttendance) return;

    if (!selectedClass) {
      toast.warning('Selecione uma turma antes de salvar a chamada.');
      return;
    }

    if (classStudents.length === 0) {
      toast.warning('Nao ha alunos ativos para registrar nesta turma.');
      return;
    }

    if (!selectedSubject) {
      toast.warning('Selecione a disciplina da aula.');
      return;
    }

    if (!selectedLessonNumber) {
      toast.warning('Selecione o numero da aula.');
      return;
    }

    const payload = buildLessonAttendancePayload({
      attendanceState: attendanceData,
      classId: selectedClass,
      subjectId: selectedSubject,
      date: selectedDate,
      lessonNumber: Number(selectedLessonNumber),
      justification: lateJustification,
      notes: attendanceNotes,
    });

    bulkSaveMutation.mutate(payload, {
      onSuccess: () => {
        setShowLateJustificationDialog(false);
        setLateJustification('');
      },
      onError: (error) => {
        if (error?.code === 'ATTENDANCE_JUSTIFICATION_REQUIRED') {
          setShowLateJustificationDialog(true);
          return;
        }

        toast.error(error?.message || 'Nao foi possivel salvar a chamada.');
      },
    });
  }, [
    attendanceData,
    attendanceNotes,
    bulkSaveMutation,
    canWriteAttendance,
    classStudents.length,
    lateJustification,
    selectedClass,
    selectedDate,
    selectedLessonNumber,
    selectedSubject,
  ]);

  const handleRequestSave = useCallback(() => {
    if (lessonWindowState === ATTENDANCE_LESSON_WINDOW_STATES.LATE && !lateJustification.trim()) {
      setShowLateJustificationDialog(true);
      return;
    }

    handleSaveAll();
  }, [handleSaveAll, lateJustification, lessonWindowState]);

  const markAllAs = useCallback((status) => {
    if (!canWriteAttendance) return;

    const nextState = {};
    classStudents.forEach((student) => {
      nextState[student.id] = status;
    });
    setAttendanceData(nextState);
  }, [canWriteAttendance, classStudents]);

  const handleSelectDate = useCallback((date) => {
    if (!date) return;
    setSelectedDate(toDateKey(date));
    setCalendarMonth(date);
    setLateJustification('');
  }, []);

  return (
    <RenderProfiler id="Attendance">
      <div className="space-y-6">
      <PageHeader
        backTo="/Dashboard"
        backLabel="Dashboard"
        title="Chamada por Aula"
        subtitle={canWriteAttendance
          ? 'Selecione turma, data, disciplina e aula para registrar a frequencia com controle de horario.'
          : 'Acompanhe a chamada registrada por turma, disciplina e aula.'}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div>
              <Label>Turma</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((classItem) => (
                    <SelectItem key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Disciplina</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedClass || subjectOptions.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Aula</Label>
              <Select value={selectedLessonNumber} onValueChange={setSelectedLessonNumber} disabled={!selectedSubject || lessonOptions.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a aula" />
                </SelectTrigger>
                <SelectContent>
                  {lessonOptions.map((lesson) => (
                    <SelectItem key={lesson.id} value={lesson.lessonNumber}>
                      {lesson.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleSelectDate(new Date())}
                disabled={!selectedClass}
              >
                Hoje
              </Button>
              {canWriteAttendance && (
                <Button
                  onClick={handleRequestSave}
                  disabled={!selectedClass || !selectedSubject || !selectedLessonNumber || bulkSaveMutation.isPending || classStudents.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {bulkSaveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Aula
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {teacherLinkMissing && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 pt-6 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Professor sem vinculo na tabela de docentes</p>
              <p className="text-sm text-amber-800">
                A chamada diaria tenta localizar o professor em <code>teachers</code> pelo e-mail do usuario para restringir as turmas e gravar o docente responsavel.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedClass && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className={cn(
            lessonWindowState === ATTENDANCE_LESSON_WINDOW_STATES.LATE && 'border-amber-200 bg-amber-50',
            lessonWindowState === ATTENDANCE_LESSON_WINDOW_STATES.OPEN && 'border-emerald-200 bg-emerald-50',
          )}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">Janela da aula</p>
                  <p className="text-sm text-slate-600">
                    {selectedLessonLabel}
                  </p>
                  <p className="text-sm text-slate-600">
                    {lessonWindowState === ATTENDANCE_LESSON_WINDOW_STATES.OPEN && 'A chamada está dentro do horário normal da aula.'}
                    {lessonWindowState === ATTENDANCE_LESSON_WINDOW_STATES.UPCOMING && 'A aula ainda não começou; você pode preparar a chamada antes do horário.'}
                    {lessonWindowState === ATTENDANCE_LESSON_WINDOW_STATES.LATE && 'A aula já terminou. Alterações agora exigem justificativa.'}
                    {lessonWindowState === ATTENDANCE_LESSON_WINDOW_STATES.UNAVAILABLE && 'Sem horário configurado para esta aula; a trava institucional não será aplicada.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {scheduleFallbackMode && (
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">Grade indisponível para a data</p>
                    <p className="text-sm text-slate-600">
                      A turma não possui horários ativos em <code>schedules</code> para o dia selecionado. A chamada continuará disponível em modo manual, sem horário automático da aula.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedClass ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Card className="p-4">
              <div className="text-sm text-slate-500">Total</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm text-emerald-600">Presentes</div>
              <div className="text-2xl font-bold text-emerald-700">{stats.present}</div>
            </Card>
            <Card className="border-rose-200 bg-rose-50 p-4">
              <div className="text-sm text-rose-600">Ausentes</div>
              <div className="text-2xl font-bold text-rose-700">{stats.absent}</div>
            </Card>
            <Card className="border-amber-200 bg-amber-50 p-4">
              <div className="text-sm text-amber-600">Justificados</div>
              <div className="text-2xl font-bold text-amber-700">{stats.justified}</div>
            </Card>
            <Card className="border-blue-200 bg-blue-50 p-4">
              <div className="text-sm text-blue-600">Atrasados</div>
              <div className="text-2xl font-bold text-blue-700">{stats.late}</div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-5 w-5" />
                  Calendario de Chamada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CalendarPicker
                  mode="single"
                  locale={ptBR}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selected={selectedDateObject}
                  onSelect={handleSelectDate}
                  modifiers={{
                    complete: completeDays,
                    partial: partialDays,
                  }}
                  modifiersClassNames={{
                    complete: 'bg-emerald-100 text-emerald-700 font-semibold',
                    partial: 'bg-amber-100 text-amber-700 font-semibold',
                  }}
                  className="rounded-xl border"
                />

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Dias com chamada</div>
                    <div className="text-xl font-semibold">{monthSummaryTotals.recordedDays}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs text-emerald-600">Completos</div>
                    <div className="text-xl font-semibold text-emerald-700">{monthSummaryTotals.completeDays}</div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs text-amber-600">Parciais</div>
                    <div className="text-xl font-semibold text-amber-700">{monthSummaryTotals.partialDays}</div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-200" />
                    Dia com chamada completa
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-amber-200" />
                    Dia com chamada parcial
                  </div>
                </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <div className="font-medium text-slate-900">
                      {format(selectedDateObject, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </div>
                    <div className="mt-2 text-slate-600">
                      {selectedDaySummary
                        ? `${selectedDaySummary.recordedCount} aluno(s) já possuem chamada registrada para ${selectedLessonLabel.toLowerCase()}.`
                        : 'Nenhuma chamada salva para a aula selecionada nesta data.'}
                    </div>
                  </div>
                </CardContent>
              </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">
                    {selectedClassRecord?.name} - {format(selectedDateObject, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedLessonLabel}
                  </p>
                </div>

                {canWriteAttendance && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => markAllAs(ATTENDANCE_STATUSES.PRESENT)}>
                      <Check className="mr-1 h-4 w-4" />
                      Todos Presentes
                    </Button>
                    <Button variant="outline" onClick={() => markAllAs(ATTENDANCE_STATUSES.ABSENT)}>
                      <X className="mr-1 h-4 w-4" />
                      Todos Faltaram
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">Contexto da aula</p>
                    <p className="mt-2">
                      Disciplina: <span className="font-medium text-slate-900">{subjectNameById.get(selectedSubject) || 'Não definida'}</span>
                    </p>
                    <p>
                      Aula: <span className="font-medium text-slate-900">{selectedLessonNumber || '-'}</span>
                    </p>
                    <p>
                      Horário: <span className="font-medium text-slate-900">
                        {selectedLessonSlot?.startTime && selectedLessonSlot?.endTime
                          ? `${selectedLessonSlot.startTime} - ${selectedLessonSlot.endTime}`
                          : 'Não configurado'}
                      </span>
                    </p>
                    {selectedLessonSlot?.room && (
                      <p>
                        Sala: <span className="font-medium text-slate-900">{selectedLessonSlot.room}</span>
                      </p>
                    )}
                  </div>

                  {canWriteAttendance && (
                    <div className="space-y-2">
                      <Label htmlFor="attendance-notes">Observações da chamada</Label>
                      <Textarea
                        id="attendance-notes"
                        value={attendanceNotes}
                        onChange={(event) => setAttendanceNotes(event.target.value)}
                        placeholder="Opcional: observações gerais da aula, intercorrências ou contexto pedagógico."
                        className="min-h-[120px]"
                      />
                    </div>
                  )}
                </div>

                {isLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                  </div>
                ) : classStudents.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    Nenhum aluno ativo encontrado nesta turma.
                  </div>
                ) : shouldVirtualizeStudents ? (
                  <VirtualizedAttendanceList
                    students={classStudents}
                    attendanceData={attendanceData}
                    canWriteAttendance={canWriteAttendance}
                    onStatusChange={handleStatusChange}
                  />
                ) : (
                  <div className="space-y-2">
                    {classStudents.map((student, index) => (
                      <AttendanceStudentRow
                        key={student.id}
                        student={student}
                        index={index}
                        currentStatus={attendanceData[student.id]}
                        canWriteAttendance={canWriteAttendance}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-slate-500">
              {monthAttendanceLoading ? (
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-slate-300" />
              ) : (
                <CalendarDays className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              )}
              <p>
                {profileType === 'professor'
                  ? 'Nenhuma turma disponivel para este professor.'
                  : 'Selecione uma turma para registrar a chamada diaria.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showLateJustificationDialog} onOpenChange={setShowLateJustificationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificativa obrigatória</DialogTitle>
            <DialogDescription>
              A aula selecionada já está fora do horário normal. Informe o motivo da edição tardia antes de salvar a chamada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="attendance-late-justification">Motivo da alteração tardia</Label>
            <Textarea
              id="attendance-late-justification"
              value={lateJustification}
              onChange={(event) => setLateJustification(event.target.value)}
              placeholder="Explique por que a chamada está sendo registrada ou alterada após o horário da aula."
              className="min-h-[140px]"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLateJustificationDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={bulkSaveMutation.isPending || !lateJustification.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {bulkSaveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Confirmar e salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </RenderProfiler>
  );
}
