import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AttendanceApi, GradeApi, SubjectApi } from '@/services/supabaseApi';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, BookOpen, Calendar } from 'lucide-react';
import {
  buildStudentReportCardRows,
  filterGradesVisibleToStudent,
  GRADE_STATUSES,
  getGradeSituationBadgeClassName,
  getGradeSituationLabel,
} from '@shared/contracts/grades';

function GradeBadge({ score }) {
  if (score === null || score === undefined || score === '') {
    return <span className="text-sm text-slate-400">—</span>;
  }

  const value = parseFloat(score);
  const className = value >= 7
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : value >= 5
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-rose-100 text-rose-700 border-rose-200';

  return (
    <Badge className={`${className} border`}>
      {value.toFixed(1)}
    </Badge>
  );
}

function SituationBadge({ situation }) {
  return (
    <Badge variant="outline" className={getGradeSituationBadgeClassName(situation)}>
      {getGradeSituationLabel(situation)}
    </Badge>
  );
}

export default function StudentReportCard({ studentId }) {
  const { data: grades = [], isLoading: loadingGrades } = useQuery({
    queryKey: ['grades-student', studentId],
    queryFn: () => GradeApi.filter({ student_id: studentId, status: GRADE_STATUSES.PUBLISHED }, '-evaluation_date', 400),
    enabled: !!studentId,
  });

  const { data: attendance = [], isLoading: loadingAtt } = useQuery({
    queryKey: ['attendance-student', studentId],
    queryFn: () => AttendanceApi.filter({ student_id: studentId }),
    enabled: !!studentId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => SubjectApi.list(),
  });

  const isLoading = loadingGrades || loadingAtt;
  const visibleGrades = React.useMemo(
    () => filterGradesVisibleToStudent(grades, studentId),
    [grades, studentId]
  );

  const reportRows = React.useMemo(
    () => buildStudentReportCardRows({
      grades: visibleGrades,
      studentId,
      subjects,
    }),
    [studentId, subjects, visibleGrades]
  );

  const attStats = React.useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter((item) => ['presente', 'atrasado'].includes(item.status)).length;
    const absent = attendance.filter((item) => item.status === 'ausente').length;
    const justified = attendance.filter((item) => item.status === 'justificado').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : null;
    return { total, present, absent, justified, rate };
  }, [attendance]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="grades">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="grades" className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Boletim</TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Frequência</TabsTrigger>
        </TabsList>

        <TabsContent value="grades" className="mt-4">
          {reportRows.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>Nenhuma nota publicada ainda.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Disciplina</TableHead>
                    <TableHead className="text-center">1º Bim</TableHead>
                    <TableHead className="text-center">2º Bim</TableHead>
                    <TableHead className="text-center">3º Bim</TableHead>
                    <TableHead className="text-center">4º Bim</TableHead>
                    <TableHead className="text-center font-semibold">Média anual</TableHead>
                    <TableHead className="text-center">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportRows.map((row) => (
                    <TableRow key={row.subjectId}>
                      <TableCell className="font-medium">{row.subjectName}</TableCell>
                      <TableCell className="text-center"><GradeBadge score={row.b1} /></TableCell>
                      <TableCell className="text-center"><GradeBadge score={row.b2} /></TableCell>
                      <TableCell className="text-center"><GradeBadge score={row.b3} /></TableCell>
                      <TableCell className="text-center"><GradeBadge score={row.b4} /></TableCell>
                      <TableCell className="text-center"><GradeBadge score={row.annualAverage} /></TableCell>
                      <TableCell className="text-center"><SituationBadge situation={row.situation} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="attendance" className="mt-4 space-y-4">
          {attStats.total === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>Nenhuma frequência registrada ainda.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4"><p className="text-xs text-slate-500 mb-1">Total de aulas</p><p className="text-2xl font-bold">{attStats.total}</p></Card>
                <Card className="p-4 border-emerald-200 bg-emerald-50"><p className="text-xs text-emerald-600 mb-1">Presenças</p><p className="text-2xl font-bold text-emerald-700">{attStats.present}</p></Card>
                <Card className="p-4 border-rose-200 bg-rose-50"><p className="text-xs text-rose-600 mb-1">Faltas</p><p className="text-2xl font-bold text-rose-700">{attStats.absent}</p></Card>
                <Card className="p-4 border-amber-200 bg-amber-50"><p className="text-xs text-amber-600 mb-1">Justificadas</p><p className="text-2xl font-bold text-amber-700">{attStats.justified}</p></Card>
              </div>
              {attStats.rate !== null && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Taxa de Frequência</span>
                    <span className={`text-sm font-bold ${attStats.rate >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>{attStats.rate}%</span>
                  </div>
                  <Progress value={attStats.rate} className="h-3" />
                  <p className={`text-xs mt-2 flex items-center gap-1 ${attStats.rate >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {attStats.rate >= 75 ? <><TrendingUp className="w-3 h-3" /> Frequência regular</> : <><TrendingDown className="w-3 h-3" /> Abaixo do mínimo exigido (75%)</>}
                  </p>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
