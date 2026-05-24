import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Calculator,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Link as LinkIcon,
  Loader2,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { AssignmentApi, ClassApi, GradeApi, StudentApi, SubjectApi, TeacherApi } from '@/services/supabaseApi';
import PageHeader from '@/components/common/PageHeader';
import RenderProfiler from '@/components/common/RenderProfiler';
import VirtualizedTable from '@/components/common/VirtualizedTable';
import StudentGradesView from '@/components/student/StudentGradesView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import {
  buildBimesterGradeSummary,
  buildGradePayload,
  buildGradebookSummaryMap,
  getGradeSituationBadgeClassName,
  getGradeSituationLabel,
  getTermSummary,
  GRADE_SLOT_LABELS,
  GRADE_SLOTS,
  MIN_REGULAR_GRADES,
} from '@shared/contracts/grades';
import { canWriteGrades as canWriteGradesByPermission } from '@shared/contracts/access';
import { usePermissions } from '@/components/hooks/usePermissions';

const EMPTY_SLOT_ASSIGNMENTS = Object.freeze({
  atividade_1: 'none',
  atividade_2: 'none',
  atividade_3: 'none',
  atividade_4: 'none',
  recuperacao: 'none',
});

const GRADEBOOK_ROW_HEIGHT = 72;
const REPORT_CARD_ROW_HEIGHT = 68;
const GRADEBOOK_VIRTUALIZATION_THRESHOLD = 24;

function average(values = []) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return <span className="text-sm text-slate-400">—</span>;
  }

  const value = Number(score);
  const className = value >= 7
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : value >= 5
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-rose-100 text-rose-700 border-rose-200';

  return (
    <Badge variant="outline" className={className}>
      {value.toFixed(1)}
    </Badge>
  );
}

function SummaryCard({ icon: Icon, label, value, detail }) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="flex items-start gap-3 p-5">
        <div className="rounded-2xl bg-[hsl(var(--accent))] p-3 text-[hsl(var(--accent-foreground))]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {detail ? (
            <p className="text-sm text-muted-foreground">{detail}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function GradebookManagementView({ profileType }) {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const canWriteGrades = canWriteGradesByPermission(profileType);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedBimester, setSelectedBimester] = useState('1');
  const [activeTab, setActiveTab] = useState('lancamentos');
  const [draftScores, setDraftScores] = useState({});
  const [slotAssignments, setSlotAssignments] = useState(EMPTY_SLOT_ASSIGNMENTS);

  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list('-created_at', 300),
  });

  const { data: subjects = [], isLoading: isLoadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => SubjectApi.list('-created_at', 300),
  });

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: () => StudentApi.list('-created_at', 800),
  });

  const { data: teacherRecords = [] } = useQuery({
    queryKey: ['grades-teacher-record', authUser?.email],
    queryFn: () => TeacherApi.filter({ email: authUser.email }, '-created_at', 1),
    enabled: canWriteGrades && !!authUser?.email,
  });

  const teacherRecord = teacherRecords[0] ?? null;
  const teacherSubjectIds = Array.isArray(teacherRecord?.subject_ids) ? teacherRecord.subject_ids : [];

  const availableClasses = useMemo(() => {
    if (profileType !== 'professor' || !teacherRecord?.id) {
      return classes;
    }

    return classes.filter((classRecord) => {
      const classTeacherIds = Array.isArray(classRecord.teacher_ids) ? classRecord.teacher_ids : [];
      const classSubjectIds = Array.isArray(classRecord.subject_ids) ? classRecord.subject_ids : [];
      return (
        classTeacherIds.includes(teacherRecord.id)
        || teacherSubjectIds.some((subjectId) => classSubjectIds.includes(subjectId))
      );
    });
  }, [classes, profileType, teacherRecord?.id, teacherSubjectIds]);

  const availableSubjects = useMemo(() => {
    if (profileType !== 'professor' || teacherSubjectIds.length === 0) {
      return subjects;
    }

    return subjects.filter((subject) => teacherSubjectIds.includes(subject.id));
  }, [profileType, subjects, teacherSubjectIds]);

  useEffect(() => {
    if (selectedClass && !availableClasses.some((classRecord) => classRecord.id === selectedClass)) {
      setSelectedClass('');
    }
  }, [availableClasses, selectedClass]);

  useEffect(() => {
    if (selectedSubject && !availableSubjects.some((subject) => subject.id === selectedSubject)) {
      setSelectedSubject('');
    }
  }, [availableSubjects, selectedSubject]);

  const selectedClassRecord = availableClasses.find((classRecord) => classRecord.id === selectedClass) || null;
  const selectedSubjectRecord = availableSubjects.find((subject) => subject.id === selectedSubject) || null;
  const selectedYear = selectedClassRecord?.year || new Date().getFullYear();

  const { data: subjectGrades = [], isLoading: isLoadingGrades } = useQuery({
    queryKey: ['gradebook', selectedClass, selectedSubject, selectedYear],
    queryFn: () => GradeApi.filter({
      class_id: selectedClass,
      subject_id: selectedSubject,
      year: selectedYear,
    }, '-evaluation_date', 1000),
    enabled: Boolean(selectedClass && selectedSubject && selectedYear),
  });

  const { data: bimesterAssignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['gradebook-assignments', selectedClass, selectedSubject, selectedBimester],
    queryFn: () => AssignmentApi.filter({
      class_id: selectedClass,
      subject_id: selectedSubject,
      bimester: Number(selectedBimester),
    }, '-due_date', 100),
    enabled: Boolean(selectedClass && selectedSubject),
  });

  const assignmentsById = useMemo(
    () => Object.fromEntries(bimesterAssignments.map((assignment) => [assignment.id, assignment])),
    [bimesterAssignments]
  );

  const currentTermGrades = useMemo(() => (
    subjectGrades.filter((grade) => Number(grade.bimester) === Number(selectedBimester))
  ), [selectedBimester, subjectGrades]);

  const summaryMap = useMemo(
    () => buildGradebookSummaryMap(subjectGrades),
    [subjectGrades]
  );

  const classStudents = useMemo(() => (
    students
      .filter((student) => (
        student.current_class_id === selectedClass
        && (student.enrollment_status || 'ativo') === 'ativo'
      ))
      .sort((left, right) => (
        String(left.full_name ?? '').localeCompare(String(right.full_name ?? ''), 'pt-BR')
      ))
  ), [selectedClass, students]);

  useEffect(() => {
    const nextAssignments = { ...EMPTY_SLOT_ASSIGNMENTS };

    GRADE_SLOTS.forEach((slot) => {
      const existingAssignmentId = currentTermGrades.find((grade) => (
        grade.grade_slot === slot && grade.assignment_id
      ))?.assignment_id;

      if (existingAssignmentId) {
        nextAssignments[slot] = existingAssignmentId;
      }
    });

    setSlotAssignments(nextAssignments);
    setDraftScores({});
  }, [currentTermGrades, selectedBimester, selectedClass, selectedSubject]);

  const getExistingGrade = useCallback((studentId, slot) => (
    getTermSummary(summaryMap, {
      studentId,
      subjectId: selectedSubject,
      classId: selectedClass,
      bimester: Number(selectedBimester),
      year: selectedYear,
    }).slots[slot]
  ), [selectedBimester, selectedClass, selectedSubject, selectedYear, summaryMap]);

  const getDraftKey = useCallback((studentId, slot) => `${studentId}::${slot}`, []);

  const getScoreValue = useCallback((studentId, slot) => {
    const draftKey = getDraftKey(studentId, slot);
    if (draftScores[draftKey] !== undefined) {
      return draftScores[draftKey];
    }

    const existingGrade = getExistingGrade(studentId, slot);
    return existingGrade?.score === null || existingGrade?.score === undefined
      ? ''
      : String(existingGrade.score);
  }, [draftScores, getDraftKey, getExistingGrade]);

  const handleScoreChange = useCallback((studentId, slot, value) => {
    if (!canWriteGrades) return;
    setDraftScores((current) => ({
      ...current,
      [getDraftKey(studentId, slot)]: value,
    }));
  }, [canWriteGrades, getDraftKey]);

  const bulkSaveMutation = useMutation({
    mutationFn: async () => {
      const operations = [];

      classStudents.forEach((student) => {
        GRADE_SLOTS.forEach((slot) => {
          const existingGrade = getExistingGrade(student.id, slot);
          const rawValue = getScoreValue(student.id, slot);
          const normalizedValue = String(rawValue ?? '').trim();
          const assignmentId = slotAssignments[slot];
          const assignment = assignmentId && assignmentId !== 'none'
            ? assignmentsById[assignmentId]
            : null;

          if (!normalizedValue) {
            if (existingGrade?.id) {
              operations.push(() => GradeApi.delete(existingGrade.id));
            }
            return;
          }

          const payload = buildGradePayload({
            existingGrade,
            studentId: student.id,
            classId: selectedClass,
            subjectId: selectedSubject,
            teacherId: teacherRecord?.id || null,
            bimester: Number(selectedBimester),
            year: selectedYear,
            slot,
            score: normalizedValue,
            assignment,
          });

          if (existingGrade?.id) {
            operations.push(() => GradeApi.update(existingGrade.id, payload));
          } else {
            operations.push(() => GradeApi.create(payload));
          }
        });
      });

      await Promise.all(operations.map((operation) => operation()));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gradebook'] });
      queryClient.invalidateQueries({ queryKey: ['grades-student'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      setDraftScores({});
      toast.success('Lançamentos de notas salvos com sucesso.');
    },
  });

  const reportCardRows = useMemo(() => {
    return classStudents.map((student) => {
      const bimesterValues = [1, 2, 3, 4].map((bimester) => (
        getTermSummary(summaryMap, {
          studentId: student.id,
          subjectId: selectedSubject,
          classId: selectedClass,
          bimester,
          year: selectedYear,
        }).finalAverage
      ));

      const annualAverage = average(bimesterValues.filter((value) => value !== null));
      const annualSituation = annualAverage === null
        ? 'incompleta'
        : annualAverage >= 7
          ? 'aprovado'
          : annualAverage >= 5
            ? 'recuperacao'
            : 'reprovado';

      return {
        id: student.id,
        student,
        b1: bimesterValues[0],
        b2: bimesterValues[1],
        b3: bimesterValues[2],
        b4: bimesterValues[3],
        annualAverage,
        annualSituation,
      };
    });
  }, [classStudents, selectedClass, selectedSubject, selectedYear, summaryMap]);

  const termSummaries = useMemo(() => (
    classStudents.map((student) => ({
      student,
      summary: getTermSummary(summaryMap, {
        studentId: student.id,
        subjectId: selectedSubject,
        classId: selectedClass,
        bimester: Number(selectedBimester),
        year: selectedYear,
      }),
    }))
  ), [classStudents, selectedBimester, selectedClass, selectedSubject, selectedYear, summaryMap]);

  const classAverage = useMemo(() => {
    const finalAverages = termSummaries
      .map(({ summary }) => summary.finalAverage)
      .filter((value) => value !== null);

    return average(finalAverages);
  }, [termSummaries]);

  const readyStudentsCount = useMemo(
    () => termSummaries.filter(({ summary }) => summary.minimumActivitiesMet).length,
    [termSummaries]
  );
  const recoveryCount = useMemo(
    () => termSummaries.filter(({ summary }) => summary.recoveryScore !== null).length,
    [termSummaries]
  );
  const isLoading = isLoadingClasses || isLoadingSubjects || isLoadingStudents || isLoadingGrades || isLoadingAssignments;

  const renderGradebookRow = useCallback(({ student, summary }) => {
    const liveSummary = buildBimesterGradeSummary(
      [
        ...(summary.legacyGrades || []),
        ...GRADE_SLOTS
          .map((slot) => {
            const value = getScoreValue(student.id, slot);
            if (!String(value ?? '').trim()) return null;

            return {
              ...getExistingGrade(student.id, slot),
              score: Number(value),
              grade_slot: slot,
            };
          })
          .filter(Boolean),
      ]
    );

    return (
      <TableRow key={student.id}>
        <TableCell>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {student.full_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {student.registration_number || 'Sem matrícula'}
            </p>
          </div>
        </TableCell>

        {GRADE_SLOTS.map((slot) => (
          <TableCell key={`${student.id}-${slot}`} className="text-center">
            <Input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={getScoreValue(student.id, slot)}
              onChange={(event) => handleScoreChange(student.id, slot, event.target.value)}
              className="mx-auto w-24 text-center"
              disabled={!canWriteGrades}
              readOnly={!canWriteGrades}
            />
          </TableCell>
        ))}

        <TableCell className="text-center">
          <ScoreBadge score={liveSummary.partialAverage} />
        </TableCell>
        <TableCell className="text-center">
          <ScoreBadge score={liveSummary.finalAverage} />
        </TableCell>
        <TableCell className="text-center">
          <Badge
            variant="outline"
            className={getGradeSituationBadgeClassName(liveSummary.situation)}
          >
            {liveSummary.minimumActivitiesMet
              ? getGradeSituationLabel(liveSummary.situation)
              : `Faltam ${liveSummary.missingRegularCount} atividade(s)`}
          </Badge>
        </TableCell>
      </TableRow>
    );
  }, [canWriteGrades, getExistingGrade, getScoreValue, handleScoreChange]);

  const renderReportCardRow = useCallback((row) => (
    <TableRow key={row.id}>
      <TableCell>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.student.full_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.student.registration_number || 'Sem matrícula'}
          </p>
        </div>
      </TableCell>
      <TableCell className="text-center"><ScoreBadge score={row.b1} /></TableCell>
      <TableCell className="text-center"><ScoreBadge score={row.b2} /></TableCell>
      <TableCell className="text-center"><ScoreBadge score={row.b3} /></TableCell>
      <TableCell className="text-center"><ScoreBadge score={row.b4} /></TableCell>
      <TableCell className="text-center"><ScoreBadge score={row.annualAverage} /></TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className={getGradeSituationBadgeClassName(row.annualSituation)}
        >
          {getGradeSituationLabel(row.annualSituation)}
        </Badge>
      </TableCell>
    </TableRow>
  ), []);

  return (
    <RenderProfiler id="Grades">
      <div className="space-y-6">
      <PageHeader
        backTo="/Dashboard"
        backLabel="Dashboard"
        title="Lançamento de Notas"
        subtitle="Lance até quatro atividades por bimestre, aceite no mínimo três e registre recuperação quando necessário."
      >
        <Badge className="rounded-full border-[hsl(var(--feedback-info-fg)/0.16)] bg-[hsl(var(--feedback-info-bg))] px-3 py-1 text-[hsl(var(--feedback-info-fg))]">
          {selectedYear}
        </Badge>
      </PageHeader>

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2 xl:col-span-2">
            <Label>Turma</Label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map((classRecord) => (
                  <SelectItem key={classRecord.id} value={classRecord.id}>
                    {classRecord.name} • {classRecord.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 xl:col-span-2">
            <Label>Disciplina</Label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a disciplina" />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Bimestre</Label>
            <Select value={selectedBimester} onValueChange={setSelectedBimester}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o bimestre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1º bimestre</SelectItem>
                <SelectItem value="2">2º bimestre</SelectItem>
                <SelectItem value="3">3º bimestre</SelectItem>
                <SelectItem value="4">4º bimestre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedClass && selectedSubject ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={GraduationCap}
              label="Alunos na turma"
              value={classStudents.length}
              detail={selectedClassRecord?.name || 'Turma selecionada'}
            />
            <SummaryCard
              icon={ShieldCheck}
              label="Com mínimo de atividades"
              value={readyStudentsCount}
              detail={`Mínimo exigido: ${MIN_REGULAR_GRADES} atividades`}
            />
            <SummaryCard
              icon={Calculator}
              label="Média da turma"
              value={classAverage === null ? '—' : classAverage.toFixed(1)}
              detail={selectedSubjectRecord?.name || 'Disciplina selecionada'}
            />
            <SummaryCard
              icon={FileSpreadsheet}
              label="Com recuperação"
              value={recoveryCount}
              detail={`${selectedBimester}º bimestre`}
            />
          </div>

          <Card className="border-[hsl(var(--feedback-info-fg)/0.14)] bg-[hsl(var(--feedback-info-bg))]">
            <CardContent className="space-y-2 p-5 text-sm text-[hsl(var(--feedback-info-fg))]">
              <p className="font-semibold">Regra do lançamento</p>
              <p>
                Cada bimestre suporta até quatro atividades regulares. A média final do bimestre é calculada
                automaticamente quando o aluno tem pelo menos {MIN_REGULAR_GRADES} atividades lançadas.
                Se houver recuperação e a média regular for inferior a 7, o sistema recalcula a média final
                usando a melhor composição entre a média regular e a recuperação.
              </p>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="lancamentos" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Lançamentos
              </TabsTrigger>
              <TabsTrigger value="boletim" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Boletim simplificado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lancamentos" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Vínculo opcional com atividades do {selectedBimester}º bimestre
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {GRADE_SLOTS.map((slot) => (
                    <div key={slot} className="space-y-2">
                      <Label>{GRADE_SLOT_LABELS[slot]}</Label>
                      <Select
                        value={slotAssignments[slot] || 'none'}
                        onValueChange={(value) => {
                          if (!canWriteGrades) return;
                          setSlotAssignments((current) => ({ ...current, [slot]: value }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sem vínculo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem vínculo</SelectItem>
                          {bimesterAssignments.map((assignment) => (
                            <SelectItem key={`${slot}-${assignment.id}`} value={assignment.id}>
                              {assignment.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {slotAssignments[slot] !== 'none'
                          ? (
                            <>
                              <LinkIcon className="mr-1 inline h-3 w-3" />
                              {assignmentsById[slotAssignments[slot]]?.type || 'atividade'} vinculada
                            </>
                          )
                          : 'Lançamento manual'}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">
                      {selectedClassRecord?.name} • {selectedSubjectRecord?.name} • {selectedBimester}º bimestre
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Digite as notas por aluno. A coluna de média final é recalculada em tempo real.
                    </p>
                  </div>

                  {canWriteGrades ? (
                    <Button
                      onClick={() => bulkSaveMutation.mutate()}
                      disabled={bulkSaveMutation.isPending || classStudents.length === 0}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {bulkSaveMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Salvar notas
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex h-40 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    </div>
                  ) : classStudents.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      Nenhum aluno ativo encontrado para a turma selecionada.
                    </div>
                  ) : (
                    <VirtualizedTable
                      rows={termSummaries}
                      rowHeight={GRADEBOOK_ROW_HEIGHT}
                      rowKey={({ student }) => student.id}
                      renderRow={renderGradebookRow}
                      colSpan={GRADE_SLOTS.length + 4}
                      virtualizationThreshold={GRADEBOOK_VIRTUALIZATION_THRESHOLD}
                      header={(
                        <TableHeader>
                          <TableRow className="bg-accent/60 hover:bg-accent/60">
                            <TableHead className="min-w-[220px]">Aluno</TableHead>
                            {GRADE_SLOTS.map((slot) => (
                              <TableHead key={slot} className="min-w-[124px] text-center">
                                {GRADE_SLOT_LABELS[slot]}
                              </TableHead>
                            ))}
                            <TableHead className="text-center">Média parcial</TableHead>
                            <TableHead className="text-center">Média final</TableHead>
                            <TableHead className="text-center">Situação</TableHead>
                          </TableRow>
                        </TableHeader>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="boletim">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Boletim simplificado da disciplina
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex h-32 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                    </div>
                  ) : reportCardRows.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">
                      Nenhum registro disponível para gerar o boletim.
                    </div>
                  ) : (
                    <VirtualizedTable
                      rows={reportCardRows}
                      rowHeight={REPORT_CARD_ROW_HEIGHT}
                      rowKey={(row) => row.id}
                      renderRow={renderReportCardRow}
                      colSpan={7}
                      virtualizationThreshold={GRADEBOOK_VIRTUALIZATION_THRESHOLD}
                      header={(
                        <TableHeader>
                          <TableRow className="bg-accent/60 hover:bg-accent/60">
                            <TableHead>Aluno</TableHead>
                            <TableHead className="text-center">1º Bim</TableHead>
                            <TableHead className="text-center">2º Bim</TableHead>
                            <TableHead className="text-center">3º Bim</TableHead>
                            <TableHead className="text-center">4º Bim</TableHead>
                            <TableHead className="text-center">Média anual</TableHead>
                            <TableHead className="text-center">Situação</TableHead>
                          </TableRow>
                        </TableHeader>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            Selecione turma e disciplina para abrir o gradebook.
          </CardContent>
        </Card>
      )}
      </div>
    </RenderProfiler>
  );
}

export default function Grades() {
  const { profileType } = usePermissions();

  if (profileType === 'aluno') {
    return <StudentGradesView />;
  }

  return <GradebookManagementView profileType={profileType} />;
}
