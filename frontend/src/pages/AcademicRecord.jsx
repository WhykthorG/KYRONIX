import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClassApi, SubjectApi, StudentApi, GradeApi, AttendanceApi } from '@/services/supabaseApi';
import PageHeader from '@/components/common/PageHeader';
import RenderProfiler from '@/components/common/RenderProfiler';
import VirtualizedTable from '@/components/common/VirtualizedTable';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Check, X, Clock, FileWarning, Loader2, BookOpen, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";

const statusConfig = {
  presente:    { label: 'P', color: 'bg-emerald-500 text-white hover:bg-emerald-600', Icon: Check },
  ausente:     { label: 'F', color: 'bg-rose-500 text-white hover:bg-rose-600', Icon: X },
  justificado: { label: 'J', color: 'bg-amber-500 text-white hover:bg-amber-600', Icon: FileWarning },
  atrasado:    { label: 'A', color: 'bg-blue-500 text-white hover:bg-blue-600', Icon: Clock },
};

function GradeInput({ value, onChange }) {
  const num = parseFloat(value);
  const colorClass =
    value === '' || value === undefined ? '' :
    num >= 7 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    num >= 5 ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-rose-700 bg-rose-50 border-rose-200';
  return (
    <Input type="number" min="0" max="10" step="0.1" value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-20 text-center font-semibold ${colorClass}`} />
  );
}

const ACADEMIC_RECORD_GRADE_ROW_HEIGHT = 72;
const ACADEMIC_RECORD_ATTENDANCE_ROW_HEIGHT = 76;
const ACADEMIC_RECORD_VIRTUALIZATION_THRESHOLD = 24;
const ACADEMIC_RECORD_ATTENDANCE_OVERSCAN = 6;
const ACADEMIC_RECORD_ATTENDANCE_MAX_HEIGHT = 560;

const AcademicAttendanceRow = memo(function AcademicAttendanceRow({
  student,
  index,
  currentStatus,
  onStatusChange,
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-400 w-6">{index + 1}</span>
        <Avatar className="w-9 h-9">
          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm">
            {student.full_name?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-sm">{student.full_name}</p>
          <p className="text-xs text-slate-400">{student.registration_number}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {Object.entries(statusConfig).map(([status, cfg]) => (
          <Button
            key={status}
            variant="outline"
            size="sm"
            title={status}
            onClick={() => onStatusChange(student.id, status)}
            className={cn('w-10 h-10 p-0 text-xs font-bold', currentStatus === status && cfg.color)}
          >
            {cfg.label}
          </Button>
        ))}
      </div>
    </div>
  );
});

const VirtualizedAcademicAttendanceList = memo(function VirtualizedAcademicAttendanceList({
  students,
  attendanceData,
  onStatusChange,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = students.length * ACADEMIC_RECORD_ATTENDANCE_ROW_HEIGHT;
  const viewportHeight = Math.min(ACADEMIC_RECORD_ATTENDANCE_MAX_HEIGHT, totalHeight);
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / ACADEMIC_RECORD_ATTENDANCE_ROW_HEIGHT));
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ACADEMIC_RECORD_ATTENDANCE_ROW_HEIGHT) - ACADEMIC_RECORD_ATTENDANCE_OVERSCAN,
  );
  const endIndex = Math.min(
    students.length,
    startIndex + visibleCount + ACADEMIC_RECORD_ATTENDANCE_OVERSCAN * 2,
  );
  const visibleStudents = students.slice(startIndex, endIndex);
  const offsetY = startIndex * ACADEMIC_RECORD_ATTENDANCE_ROW_HEIGHT;

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
        <div className="space-y-2 p-2" style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleStudents.map((student, visibleIndex) => (
            <AcademicAttendanceRow
              key={student.id}
              student={student}
              index={startIndex + visibleIndex}
              currentStatus={attendanceData[student.id]}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default function AcademicRecord() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedBimester, setSelectedBimester] = useState('1');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [gradesData, setGradesData] = useState({});
  const [attendanceData, setAttendanceData] = useState({});
  const [activeTab, setActiveTab] = useState('grades');
  const queryClient = useQueryClient();

  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: () => ClassApi.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => SubjectApi.list() });
  const { data: students = [] } = useQuery({ queryKey: ['students'], queryFn: () => StudentApi.list() });

  const { data: grades = [], isLoading: loadingGrades } = useQuery({
    queryKey: ['grades', selectedClass, selectedSubject, selectedBimester],
    queryFn: () => GradeApi.filter({ class_id: selectedClass, subject_id: selectedSubject, bimester: Number(selectedBimester) }),
    enabled: !!selectedClass && !!selectedSubject,
  });

  const { data: attendance = [], isLoading: loadingAtt } = useQuery({
    queryKey: ['attendance', selectedClass, selectedDate],
    queryFn: () => AttendanceApi.filter({ class_id: selectedClass, date: selectedDate }),
    enabled: !!selectedClass && !!selectedDate,
  });

  const classStudents = useMemo(() => (
    students
      .filter((student) => student.current_class_id === selectedClass && student.enrollment_status === 'ativo')
      .sort((left, right) => String(left.full_name ?? '').localeCompare(String(right.full_name ?? ''), 'pt-BR'))
  ), [selectedClass, students]);
  const gradesByStudent = useMemo(
    () => Object.fromEntries(grades.map((grade) => [grade.student_id, grade])),
    [grades]
  );
  const attendanceByStudent = useMemo(
    () => Object.fromEntries(attendance.map((item) => [item.student_id, item])),
    [attendance]
  );

  useEffect(() => {
    if (!selectedClass) return;
    const data = {};
    classStudents.forEach(s => { data[s.id] = 'presente'; });
    attendance.forEach(a => { data[a.student_id] = a.status; });
    setAttendanceData(data);
  }, [attendance, classStudents, selectedClass, selectedDate]);

  useEffect(() => { setGradesData({}); }, [selectedClass, selectedSubject, selectedBimester]);

  const bulkGradesMutation = useMutation({
    mutationFn: async (list) => Promise.all(list.map(g => g.id ? GradeApi.update(g.id, g) : GradeApi.create(g))),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['grades'] }); setGradesData({}); toast.success('Notas salvas!'); },
  });

  const bulkAttMutation = useMutation({
    mutationFn: async (list) => Promise.all(list.map(att => {
      const existing = attendanceByStudent[att.student_id];
      return existing ? AttendanceApi.update(existing.id, att) : AttendanceApi.create(att);
    })),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); toast.success('Frequência salva!'); },
  });

  const getGradeValue = useCallback((studentId) => {
    if (gradesData[studentId] !== undefined) return gradesData[studentId];
    const g = gradesByStudent[studentId];
    return g?.score ?? '';
  }, [gradesByStudent, gradesData]);

  const handleGradeChange = useCallback((studentId, value) => {
    setGradesData((prev) => ({ ...prev, [studentId]: value }));
  }, []);

  const handleSaveGrades = useCallback(() => {
    const list = Object.entries(gradesData).map(([studentId, score]) => {
      const existing = gradesByStudent[studentId];
      return { ...(existing && { id: existing.id }), student_id: studentId, class_id: selectedClass, subject_id: selectedSubject, bimester: Number(selectedBimester), year: new Date().getFullYear(), score: parseFloat(score), evaluation_type: 'prova', evaluation_name: `${selectedBimester}º Bimestre`, status: 'publicado' };
    });
    if (list.length === 0) return toast.warning('Nenhuma nota alterada.');
    bulkGradesMutation.mutate(list);
  }, [bulkGradesMutation, gradesByStudent, gradesData, selectedBimester, selectedClass, selectedSubject]);

  const handleSaveAttendance = useCallback(() => {
    const list = Object.entries(attendanceData).map(([studentId, status]) => ({
      student_id: studentId, class_id: selectedClass, subject_id: selectedSubject || undefined, date: selectedDate, status,
    }));
    bulkAttMutation.mutate(list);
  }, [attendanceData, bulkAttMutation, selectedClass, selectedDate, selectedSubject]);

  const markAllAs = useCallback((status) => {
    const data = {};
    classStudents.forEach(s => { data[s.id] = status; });
    setAttendanceData(data);
  }, [classStudents]);

  const handleAttendanceStatusChange = useCallback((studentId, status) => {
    setAttendanceData((prev) => ({ ...prev, [studentId]: status }));
  }, []);

  const attStats = useMemo(() => ({
    total: classStudents.length,
    present: Object.values(attendanceData).filter(s => s === 'presente').length,
    absent: Object.values(attendanceData).filter(s => s === 'ausente').length,
    late: Object.values(attendanceData).filter(s => s === 'atrasado').length,
    justified: Object.values(attendanceData).filter(s => s === 'justificado').length,
  }), [attendanceData, classStudents.length]);

  const shouldVirtualizeRows = classStudents.length > ACADEMIC_RECORD_VIRTUALIZATION_THRESHOLD;

  const renderGradeRow = useCallback((student, index) => {
    const val = getGradeValue(student.id);
    const num = parseFloat(val);

    return (
      <TableRow key={student.id}>
        <TableCell className="text-slate-400 text-sm">{index + 1}</TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{student.full_name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{student.full_name}</span>
          </div>
        </TableCell>
        <TableCell className="text-slate-500 text-sm">{student.registration_number || '—'}</TableCell>
        <TableCell>
          <GradeInput value={val} onChange={(value) => handleGradeChange(student.id, value)} />
        </TableCell>
        <TableCell>
          {val !== '' && (
            <Badge className={num >= 7 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : num >= 5 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}>
              {num >= 7 ? 'Aprovado' : num >= 5 ? 'Recuperação' : 'Reprovado'}
            </Badge>
          )}
        </TableCell>
      </TableRow>
    );
  }, [getGradeValue, handleGradeChange]);

  return (
    <RenderProfiler id="AcademicRecord">
      <div className="space-y-6">
      <PageHeader
          backTo="/Dashboard"
          backLabel="Dashboard" title="Registro Acadêmico" subtitle="Lance notas e frequência por turma e disciplina" />

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Turma *</Label>
              <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedSubject(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.year}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Disciplina</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedClass}>
                <SelectTrigger><SelectValue placeholder="Selecione a disciplina" /></SelectTrigger>
                <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bimestre</Label>
              <Select value={selectedBimester} onValueChange={setSelectedBimester}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['1','2','3','4'].map(b => <SelectItem key={b} value={b}>{b}º Bimestre</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data (frequência)</Label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedClass ? (
        <Card><CardContent className="py-14 text-center text-slate-500"><BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" /><p className="font-medium">Selecione uma turma para começar</p></CardContent></Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-sm">
            <TabsTrigger value="grades" className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Notas</TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Frequência</TabsTrigger>
          </TabsList>

          <TabsContent value="grades" className="mt-4">
            {!selectedSubject ? (
              <Card><CardContent className="py-10 text-center text-slate-500"><p>Selecione uma <strong>disciplina</strong> para lançar as notas.</p></CardContent></Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{classes.find(c=>c.id===selectedClass)?.name} — {subjects.find(s=>s.id===selectedSubject)?.name} — {selectedBimester}º Bimestre</CardTitle>
                  <Button onClick={handleSaveGrades} disabled={Object.keys(gradesData).length === 0 || bulkGradesMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                    {bulkGradesMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar Notas
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingGrades ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
                  : classStudents.length === 0 ? <p className="text-center py-8 text-slate-500">Nenhum aluno ativo.</p>
                  : (
                    <VirtualizedTable
                      rows={classStudents}
                      rowHeight={ACADEMIC_RECORD_GRADE_ROW_HEIGHT}
                      rowKey={(student) => student.id}
                      renderRow={renderGradeRow}
                      colSpan={5}
                      virtualizationThreshold={ACADEMIC_RECORD_VIRTUALIZATION_THRESHOLD}
                      header={(
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Aluno</TableHead>
                            <TableHead>Matrícula</TableHead>
                            <TableHead className="w-28">Nota (0–10)</TableHead>
                            <TableHead>Situação</TableHead>
                          </TableRow>
                        </TableHeader>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="attendance" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[{ label: 'Total', value: attStats.total, cls: '' },
                { label: 'Presentes', value: attStats.present, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
                { label: 'Ausentes', value: attStats.absent, cls: 'border-rose-200 bg-rose-50 text-rose-700' },
                { label: 'Justificados', value: attStats.justified, cls: 'border-amber-200 bg-amber-50 text-amber-700' },
                { label: 'Atrasados', value: attStats.late, cls: 'border-blue-200 bg-blue-50 text-blue-700' },
              ].map(s => <Card key={s.label} className={`p-4 ${s.cls}`}><p className="text-xs opacity-70 mb-1">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></Card>)}
            </div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{classes.find(c=>c.id===selectedClass)?.name} — {format(new Date(selectedDate + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => markAllAs('presente')}><Check className="w-4 h-4 mr-1" /> Todos Presentes</Button>
                  <Button onClick={handleSaveAttendance} disabled={!selectedClass || bulkAttMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                    {bulkAttMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar Frequência
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAtt ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
                : classStudents.length === 0 ? <p className="text-center py-8 text-slate-500">Nenhum aluno ativo.</p>
                : (
                  shouldVirtualizeRows ? (
                    <VirtualizedAcademicAttendanceList
                      students={classStudents}
                      attendanceData={attendanceData}
                      onStatusChange={handleAttendanceStatusChange}
                    />
                  ) : (
                    <div className="space-y-2">
                      {classStudents.map((student, index) => (
                        <AcademicAttendanceRow
                          key={student.id}
                          student={student}
                          index={index}
                          currentStatus={attendanceData[student.id]}
                          onStatusChange={handleAttendanceStatusChange}
                        />
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
      </div>
    </RenderProfiler>
  );
}
