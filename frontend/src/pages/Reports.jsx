// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from 'recharts';

import PageHeader from '@/components/common/PageHeader';
import { AttendanceApi, ClassApi, GradeApi, StudentApi, SubjectApi } from '@/services/supabaseApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_PDF_LAYOUT_OPTIONS,
  buildAttendanceListRows,
  buildStudentReportCardPdfModel,
  sanitizePdfFilename,
} from '@shared/contracts/pdfReports';
import {
  generateAttendanceListPdf,
  generateEntityRecordsPdf,
  generateStudentReportCardPdf,
} from '@/lib/pdfReports';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const TODAY_KEY = new Date().toISOString().slice(0, 10);

const STUDENT_STATUS_LABELS = {
  ativo: 'Ativo',
  pendente: 'Pendente',
  inativo: 'Inativo',
  transferido: 'Transferido',
};

const SHIFT_LABELS = {
  matutino: 'Matutino',
  vespertino: 'Vespertino',
  noturno: 'Noturno',
  integral: 'Integral',
};

function formatClassLabel(classItem) {
  if (!classItem) return 'Sem turma';
  return classItem.year ? `${classItem.name} (${classItem.year})` : classItem.name || 'Sem turma';
}

function getPresenceRate(records = []) {
  if (!records.length) return 0;
  const presenceCount = records.filter((item) => ['presente', 'atrasado'].includes(item.status)).length;
  return ((presenceCount / records.length) * 100).toFixed(1);
}

function PdfActionButton({ isPending, onClick, disabled, children }) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isPending}
      className="bg-indigo-600 hover:bg-indigo-700"
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {children}
    </Button>
  );
}

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState('alunos');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedAttendanceClassId, setSelectedAttendanceClassId] = useState('');
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(TODAY_KEY);
  const [exportingKey, setExportingKey] = useState('');
  const [pdfLayout, setPdfLayout] = useState(DEFAULT_PDF_LAYOUT_OPTIONS);

  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students-reporting'],
    queryFn: () => StudentApi.list('full_name', 500),
  });

  const { data: grades = [], isLoading: loadingGrades } = useQuery({
    queryKey: ['grades-reporting'],
    queryFn: () => GradeApi.list('-created_at', 1500),
  });

  const { data: attendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance-reporting'],
    queryFn: () => AttendanceApi.list('-date', 1500),
  });

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes-reporting'],
    queryFn: () => ClassApi.list('name', 300),
  });

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects-reporting'],
    queryFn: () => SubjectApi.list('name', 300),
  });

  const isLoading = loadingStudents || loadingGrades || loadingAttendance || loadingClasses || loadingSubjects;
  const activeClasses = classes.filter((classItem) => classItem.status !== 'encerrada');
  const classesById = Object.fromEntries(classes.map((classItem) => [classItem.id, classItem]));
  const selectedStudent = students.find((student) => student.id === selectedStudentId) || null;
  const selectedAttendanceClass = activeClasses.find((classItem) => classItem.id === selectedAttendanceClassId) || null;

  useEffect(() => {
    if (selectedStudentId && students.some((student) => student.id === selectedStudentId)) return;
    setSelectedStudentId(students[0]?.id ?? '');
  }, [selectedStudentId, students]);

  useEffect(() => {
    if (selectedAttendanceClassId && activeClasses.some((classItem) => classItem.id === selectedAttendanceClassId)) return;
    setSelectedAttendanceClassId(activeClasses[0]?.id ?? '');
  }, [activeClasses, selectedAttendanceClassId]);

  const studentsByStatus = [
    { name: 'Ativos', value: students.filter((student) => student.enrollment_status === 'ativo').length },
    { name: 'Pendentes', value: students.filter((student) => student.enrollment_status === 'pendente').length },
    { name: 'Inativos', value: students.filter((student) => student.enrollment_status === 'inativo').length },
    { name: 'Transferidos', value: students.filter((student) => student.enrollment_status === 'transferido').length },
  ].filter((item) => item.value > 0);

  const studentsByShift = [
    { name: 'Matutino', value: students.filter((student) => student.shift === 'matutino').length },
    { name: 'Vespertino', value: students.filter((student) => student.shift === 'vespertino').length },
    { name: 'Noturno', value: students.filter((student) => student.shift === 'noturno').length },
    { name: 'Integral', value: students.filter((student) => student.shift === 'integral').length },
  ].filter((item) => item.value > 0);

  const gradeDistribution = [
    { range: '0-2', count: grades.filter((grade) => grade.score >= 0 && grade.score < 2).length },
    { range: '2-4', count: grades.filter((grade) => grade.score >= 2 && grade.score < 4).length },
    { range: '4-6', count: grades.filter((grade) => grade.score >= 4 && grade.score < 6).length },
    { range: '6-8', count: grades.filter((grade) => grade.score >= 6 && grade.score < 8).length },
    { range: '8-10', count: grades.filter((grade) => grade.score >= 8 && grade.score <= 10).length },
  ];

  const attendanceByStatus = [
    { name: 'Presentes', value: attendance.filter((item) => item.status === 'presente').length },
    { name: 'Ausentes', value: attendance.filter((item) => item.status === 'ausente').length },
    { name: 'Justificados', value: attendance.filter((item) => item.status === 'justificado').length },
    { name: 'Atrasados', value: attendance.filter((item) => item.status === 'atrasado').length },
  ].filter((item) => item.value > 0);

  const reportTypes = [
    { id: 'alunos', name: 'Alunos', icon: GraduationCap },
    { id: 'notas', name: 'Notas', icon: BarChart3 },
    { id: 'frequencia', name: 'Frequencia', icon: Calendar },
  ];

  const handleLayoutChange = (field, value) => {
    setPdfLayout((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const runPdfExport = async (key, action) => {
    setExportingKey(key);
    try {
      await action();
      toast.success('PDF gerado com sucesso.');
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel gerar o PDF.');
    } finally {
      setExportingKey('');
    }
  };

  const handleExportStudentsPdf = () => runPdfExport('alunos', async () => {
    const studentRecords = await StudentApi.list('full_name', 500);

    generateEntityRecordsPdf({
      reportTitle: 'Cadastro de alunos',
      reportSubtitle: 'Relatorio consolidado da entidade Student',
      layoutOptions: pdfLayout,
      filename: `${sanitizePdfFilename(`cadastro-alunos-${TODAY_KEY}`)}.pdf`,
      metadata: [
        { label: 'Total de alunos', value: studentRecords.length },
        { label: 'Ativos', value: studentRecords.filter((student) => student.enrollment_status === 'ativo').length },
        { label: 'Com bolsa', value: studentRecords.filter((student) => Number(student.scholarship_percentage) > 0).length },
      ],
      columns: [
        { label: 'Aluno', key: 'studentName', width: 68 },
        { label: 'Matricula', key: 'registrationNumber', width: 28, align: 'center' },
        { label: 'Turma', key: 'className', width: 44 },
        { label: 'Turno', key: 'shiftLabel', width: 20, align: 'center' },
        { label: 'Status', key: 'statusLabel', width: 22, align: 'center' },
      ],
      rows: studentRecords.map((student) => ({
        studentName: student.full_name || 'Aluno',
        registrationNumber: student.registration_number || '-',
        className: formatClassLabel(classesById[student.current_class_id]),
        shiftLabel: SHIFT_LABELS[student.shift] || '-',
        statusLabel: STUDENT_STATUS_LABELS[student.enrollment_status] || '-',
      })),
    });
  });

  const handleExportReportCardPdf = () => runPdfExport('boletim', async () => {
    if (!selectedStudentId) {
      throw new Error('Selecione um aluno para emitir o boletim.');
    }

    const [studentGrades, studentAttendance] = await Promise.all([
      GradeApi.filter({ student_id: selectedStudentId }, '-created_at', 500),
      AttendanceApi.filter({ student_id: selectedStudentId }, '-date', 500),
    ]);

    const studentRecord = selectedStudent || await StudentApi.get(selectedStudentId);
    const model = buildStudentReportCardPdfModel({
      student: studentRecord,
      grades: studentGrades,
      attendance: studentAttendance,
      subjects,
      className: formatClassLabel(classesById[studentRecord.current_class_id]),
    });

    generateStudentReportCardPdf({
      model,
      layoutOptions: pdfLayout,
      filename: `${sanitizePdfFilename(`boletim-${model.studentName}`)}.pdf`,
    });
  });

  const handleExportAttendancePdf = () => runPdfExport('frequencia', async () => {
    if (!selectedAttendanceClassId) {
      throw new Error('Selecione uma turma para emitir a lista de presenca.');
    }

    const [classStudents, classAttendance] = await Promise.all([
      StudentApi.filter({
        current_class_id: selectedAttendanceClassId,
        enrollment_status: 'ativo',
      }, 'full_name', 500),
      AttendanceApi.filter({
        class_id: selectedAttendanceClassId,
        date: selectedAttendanceDate,
      }, '-updated_at', 500),
    ]);

    const rows = buildAttendanceListRows({
      students: classStudents,
      attendanceRecords: classAttendance,
    });

    const classRecord = selectedAttendanceClass || await ClassApi.get(selectedAttendanceClassId);
    generateAttendanceListPdf({
      className: formatClassLabel(classRecord),
      date: selectedAttendanceDate,
      rows,
      layoutOptions: pdfLayout,
      filename: `${sanitizePdfFilename(`lista-presenca-${classRecord.name}-${selectedAttendanceDate}`)}.pdf`,
    });
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-10 w-24" />)}
        </div>
        <Skeleton className="h-56 rounded-xl" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/Dashboard"
        backLabel="Dashboard"
        title="Relatorios"
        subtitle="Analises, indicadores e emissao de PDF por entidade"
      />

      <div className="flex flex-wrap gap-3">
        {reportTypes.map((report) => (
          <Button
            key={report.id}
            variant={selectedReport === report.id ? 'default' : 'outline'}
            onClick={() => setSelectedReport(report.id)}
            className={selectedReport === report.id ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
          >
            <report.icon className="mr-2 h-4 w-4" />
            {report.name}
          </Button>
        ))}
      </div>

      <Card className="border-indigo-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-indigo-600" />
              Central de emissao em PDF
            </CardTitle>
            <p className="text-sm text-slate-500">
              Configure cabecalho e rodape uma vez e emita relatorios prontos para boletins e listas de presenca.
            </p>
          </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label>Titulo do cabecalho</Label>
              <Input
                value={pdfLayout.headerTitle}
                onChange={(event) => handleLayoutChange('headerTitle', event.target.value)}
                className="mt-2"
                placeholder="Nome da escola"
              />
            </div>
            <div>
              <Label>Subtitulo do cabecalho</Label>
              <Input
                value={pdfLayout.headerSubtitle}
                onChange={(event) => handleLayoutChange('headerSubtitle', event.target.value)}
                className="mt-2"
                placeholder="Descricao institucional"
              />
            </div>
            <div>
              <Label>Rodape esquerdo</Label>
              <Input
                value={pdfLayout.footerLeft}
                onChange={(event) => handleLayoutChange('footerLeft', event.target.value)}
                className="mt-2"
                placeholder="Mensagem padrao"
              />
            </div>
            <div>
              <Label>Rodape direito</Label>
              <Input
                value={pdfLayout.footerRight}
                onChange={(event) => handleLayoutChange('footerRight', event.target.value)}
                className="mt-2"
                placeholder="Contato, setor ou assinatura"
              />
            </div>
          </div>

          {selectedReport === 'alunos' && (
            <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <p className="font-medium text-slate-900">Cadastro da entidade Aluno</p>
                <p className="text-sm text-slate-500">
                  Emite a relacao nominal com matricula, turma, turno e status para uso administrativo.
                </p>
              </div>
              <div className="flex items-end">
                <PdfActionButton
                  isPending={exportingKey === 'alunos'}
                  onClick={handleExportStudentsPdf}
                  disabled={students.length === 0}
                >
                  Exportar cadastro em PDF
                </PdfActionButton>
              </div>
            </div>
          )}

          {selectedReport === 'notas' && (
            <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Aluno</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecione o aluno" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    {selectedStudent?.full_name || 'Selecione um aluno'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedStudent
                      ? `${formatClassLabel(classesById[selectedStudent.current_class_id])} • Matrícula ${selectedStudent.registration_number || '-'}`
                      : 'O PDF sera montado com notas publicadas e resumo de frequencia do aluno.'}
                  </p>
                </div>
              </div>
              <div className="flex items-end">
                <PdfActionButton
                  isPending={exportingKey === 'boletim'}
                  onClick={handleExportReportCardPdf}
                  disabled={!selectedStudentId}
                >
                  Emitir boletim em PDF
                </PdfActionButton>
              </div>
            </div>
          )}

          {selectedReport === 'frequencia' && (
            <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <Label>Turma</Label>
                  <Select value={selectedAttendanceClassId} onValueChange={setSelectedAttendanceClassId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecione a turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeClasses.map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.id}>
                          {formatClassLabel(classItem)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data da chamada</Label>
                  <Input
                    type="date"
                    value={selectedAttendanceDate}
                    onChange={(event) => setSelectedAttendanceDate(event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    {selectedAttendanceClass ? formatClassLabel(selectedAttendanceClass) : 'Selecione uma turma'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    A lista sai com numeracao, matricula e situacao diaria de cada aluno ativo.
                  </p>
                </div>
              </div>
              <div className="flex items-end">
                <PdfActionButton
                  isPending={exportingKey === 'frequencia'}
                  onClick={handleExportAttendancePdf}
                  disabled={!selectedAttendanceClassId || !selectedAttendanceDate}
                >
                  Emitir lista em PDF
                </PdfActionButton>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedReport === 'alunos' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Alunos por status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={studentsByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {studentsByStatus.map((entry, index) => (
                        <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Alunos por turno</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={studentsByShift}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <div className="rounded-xl bg-indigo-50 p-4 text-center">
                  <p className="text-3xl font-bold text-indigo-600">{students.length}</p>
                  <p className="text-sm text-slate-600">Total de alunos</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 text-center">
                  <p className="text-3xl font-bold text-emerald-600">
                    {students.filter((student) => student.enrollment_status === 'ativo').length}
                  </p>
                  <p className="text-sm text-slate-600">Alunos ativos</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4 text-center">
                  <p className="text-3xl font-bold text-amber-600">
                    {students.filter((student) => Number(student.scholarship_percentage) > 0).length}
                  </p>
                  <p className="text-sm text-slate-600">Com bolsa</p>
                </div>
                <div className="rounded-xl bg-purple-50 p-4 text-center">
                  <p className="text-3xl font-bold text-purple-600">
                    {students.filter((student) => student.uses_transport).length}
                  </p>
                  <p className="text-sm text-slate-600">Usam transporte</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedReport === 'notas' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuicao de notas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="range" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-3xl font-bold text-slate-700">{grades.length}</p>
                  <p className="text-sm text-slate-600">Total de notas lancadas</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-emerald-50 p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      {grades.filter((grade) => grade.score >= 7).length}
                    </p>
                    <p className="text-sm text-slate-600">Aprovados (&gt;=7)</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">
                      {grades.filter((grade) => grade.score >= 5 && grade.score < 7).length}
                    </p>
                    <p className="text-sm text-slate-600">Recuperacao</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-4 text-center">
                    <p className="text-2xl font-bold text-rose-600">
                      {grades.filter((grade) => grade.score < 5).length}
                    </p>
                    <p className="text-sm text-slate-600">Reprovados (&lt;5)</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {grades.length > 0
                        ? (grades.reduce((sum, grade) => sum + (grade.score || 0), 0) / grades.length).toFixed(1)
                        : 0}
                    </p>
                    <p className="text-sm text-slate-600">Media geral</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedReport === 'frequencia' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Frequencia por status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={attendanceByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {attendanceByStatus.map((entry, index) => (
                        <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-3xl font-bold text-slate-700">{attendance.length}</p>
                  <p className="text-sm text-slate-600">Total de registros</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-emerald-50 p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      {attendance.filter((item) => item.status === 'presente').length}
                    </p>
                    <p className="text-sm text-slate-600">Presencas</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-4 text-center">
                    <p className="text-2xl font-bold text-rose-600">
                      {attendance.filter((item) => item.status === 'ausente').length}
                    </p>
                    <p className="text-sm text-slate-600">Faltas</p>
                  </div>
                </div>
                <div className="rounded-xl bg-indigo-50 p-4 text-center">
                  <p className="text-3xl font-bold text-indigo-600">{getPresenceRate(attendance)}%</p>
                  <p className="text-sm text-slate-600">Taxa de presenca</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
