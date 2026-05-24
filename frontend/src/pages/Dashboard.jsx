// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Users, School, TrendingUp } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import QuickActions from '@/components/dashboard/QuickActions';
import UpcomingEvents from '@/components/dashboard/UpcomingEvents';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassApi, EventApi, GradeApi, StudentApi, TeacherApi } from '@/services/supabaseApi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--destructive))',
  'hsl(var(--chart-4))',
];

export default function Dashboard({ openApp }) {
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: () => StudentApi.list(),
  });

  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => TeacherApi.list(),
  });

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list(),
  });

  const { data: grades = [], isLoading: loadingGrades } = useQuery({
    queryKey: ['grades'],
    queryFn: () => GradeApi.list(),
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['events'],
    queryFn: () => EventApi.list('-start_date', 10),
  });

  const isLoading = loadingStudents || loadingTeachers || loadingClasses || loadingGrades || loadingEvents;
  const { activeStudents, activeTeachers, activeClasses, gradeDistribution, monthlyEnrollments, studentsByShift } = useMemo(() => {
    const nextActiveStudents = students.filter((student) => student.enrollment_status === 'ativo').length;
    const nextActiveTeachers = teachers.filter((teacher) => teacher.status === 'ativo').length;
    const nextActiveClasses = classes.filter((classItem) => classItem.status === 'ativa').length;

    const nextGradeDistribution = [
      { range: '0-4', count: grades.filter((grade) => grade.score !== undefined && grade.score < 4).length },
      { range: '4-6', count: grades.filter((grade) => grade.score !== undefined && grade.score >= 4 && grade.score < 6).length },
      { range: '6-8', count: grades.filter((grade) => grade.score !== undefined && grade.score >= 6 && grade.score < 8).length },
      { range: '8-10', count: grades.filter((grade) => grade.score !== undefined && grade.score >= 8).length },
    ];

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonthIndex = currentDate.getMonth();
    const nextMonthlyEnrollments = monthNames
      .map((month, index) => ({
        month,
        matriculas: students.filter((student) => {
          if (!student.enrollment_date) return false;
          const enrollmentDate = new Date(student.enrollment_date);
          return enrollmentDate.getFullYear() === currentYear && enrollmentDate.getMonth() === index;
        }).length,
      }))
      .filter((_, index) => index <= currentMonthIndex);

    const shiftLabels = { matutino: 'Matutino', vespertino: 'Vespertino', noturno: 'Noturno', integral: 'Integral' };
    const nextStudentsByShift = Object.entries(shiftLabels)
      .map(([key, name]) => ({
        name,
        value: students.filter((student) => student.shift === key).length,
      }))
      .filter((shift) => shift.value > 0);

    return {
      activeStudents: nextActiveStudents,
      activeTeachers: nextActiveTeachers,
      activeClasses: nextActiveClasses,
      gradeDistribution: nextGradeDistribution,
      monthlyEnrollments: nextMonthlyEnrollments,
      studentsByShift: nextStudentsByShift,
    };
  }, [classes, grades, students, teachers]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="app-surface-card px-6 py-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="app-metric-grid">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do sistema escolar, com indicadores de operação, calendário e atividade recente."
      />

      {/* Stats Cards */}
      <div className="app-metric-grid">
        <StatsCard
          title="Total de Alunos"
          value={activeStudents || 0}
          subtitle={`${students.length} cadastrados`}
          icon={GraduationCap}
          color="indigo"
        />
        <StatsCard
          title="Professores"
          value={activeTeachers || 0}
          subtitle="ativos"
          icon={Users}
          color="emerald"
        />
        <StatsCard
          title="Turmas Ativas"
          value={activeClasses || 0}
          icon={School}
          color="amber"
        />
        <StatsCard
          title="Notas Lançadas"
          value={grades.length}
          subtitle={`${gradeDistribution.find(g => g.range === '8-10')?.count || 0} acima de 8`}
          icon={TrendingUp}
          color="emerald"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions openApp={openApp} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollment Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Matrículas por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyEnrollments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '16px',
                      boxShadow: 'var(--shadow-soft)',
                    }}
                  />
                  <Bar dataKey="matriculas" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Students by Shift */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Alunos por Turno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={studentsByShift}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="hsl(var(--chart-1))"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {studentsByShift.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity and Events Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity students={students} grades={grades} />
        <UpcomingEvents events={events} />
      </div>


    </div>
  );
}
