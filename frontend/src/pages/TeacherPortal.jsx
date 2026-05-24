import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle, Award, BookOpen, CheckCircle, TrendingDown, TrendingUp, Users,
} from 'lucide-react';
import PageHeader from "@/components/common/PageHeader";
import TeacherAnalytics from "@/components/teacher/TeacherAnalytics";
import StudentPerformance from "@/components/teacher/StudentPerformance";
import CommunicationCenter from "@/components/teacher/CommunicationCenter";
import EngagementMetrics from "@/components/teacher/EngagementMetrics";
import { AssignmentApi, AttendanceApi, ClassApi, GradeApi, MessageApi, SubmissionApi, TeacherApi, UserProfileApi } from '@/services/supabaseApi';
import { countPendingGradings } from '@shared/contracts/submissions';

async function fetchTeacherPortalStats(authUser) {
  if (!authUser?.email || !authUser?.id) {
    return null;
  }

  const currentUser = { email: authUser.email, id: authUser.id };

  const [teacherResults, profiles] = await Promise.all([
    TeacherApi.filter({ email: currentUser.email }),
    UserProfileApi.filter({ user_email: currentUser.email }),
  ]);

  const userProfile = profiles[0];
  const isAdminOrCoord = userProfile && ['administrador', 'coordenador'].includes(userProfile.profile_type);

  if (teacherResults.length === 0 && !isAdminOrCoord) {
    return null;
  }

  const teacherId = teacherResults.length > 0 ? teacherResults[0].id : null;

  const [classes, grades, attendance, assignments, submissions, messages] = await Promise.all([
    teacherId ? ClassApi.filter({ teacher_ids: teacherId }) : ClassApi.list(),
    teacherId ? GradeApi.filter({ teacher_id: teacherId }) : GradeApi.list(),
    teacherId ? AttendanceApi.filter({ teacher_id: teacherId }) : AttendanceApi.list(),
    teacherId ? AssignmentApi.filter({ teacher_id: teacherId }) : AssignmentApi.list(),
    SubmissionApi.list('-submitted_at', 1000),
    MessageApi.filter({ sender_id: currentUser.id }),
  ]);

  const totalStudents = classes.reduce((sum, item) => sum + (item.current_students || 0), 0);
  const avgGrade = grades.length > 0
    ? (grades.reduce((sum, grade) => sum + (grade.score || 0), 0) / grades.length).toFixed(1)
    : 0;

  const attendanceRate = attendance.length > 0
    ? ((attendance.filter((item) => item.status === 'presente').length / attendance.length) * 100).toFixed(1)
    : 0;

  const pendingGrading = countPendingGradings(submissions, assignments);

  return {
    teacher: teacherResults[0] || { full_name: userProfile?.full_name || currentUser.email, id: null },
    senderType: userProfile?.profile_type || (teacherId ? 'professor' : 'coordenador'),
    isAdminView: !teacherId,
    totalClasses: classes.length,
    totalStudents,
    avgGrade,
    attendanceRate,
    pendingGrading,
    totalAssignments: assignments.length,
    messagesSent: messages.length,
    classes,
    grades,
    attendance,
    assignments,
    submissions,
  };
}

export default function TeacherPortal() {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const {
    data: stats,
    isLoading: loading,
  } = useQuery({
    queryKey: ['teacher-portal-stats', authUser?.id || null, authUser?.email || null],
    queryFn: () => fetchTeacherPortalStats(authUser),
    enabled: Boolean(authUser?.id && authUser?.email),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (loading) {
    return <div className="p-6">Carregando portal...</div>;
  }

  if (!stats) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-slate-600">
              Este portal é exclusivo para professores e coordenadores. Por favor, verifique suas permissões.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title={`${stats.isAdminView ? 'Painel Administrativo' : 'Portal do Professor'} - ${stats.teacher.full_name}`}
        subtitle="Analytics, desempenho dos alunos e comunicação"
        backTo="/Dashboard"
        backLabel="Dashboard"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Turmas Ativas</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalClasses}</p>
              </div>
              <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total de Alunos</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalStudents}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Média Geral</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats.avgGrade}</p>
                <div className="flex items-center gap-1 mt-1">
                  {stats.avgGrade >= 7 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">Ótimo</span>
                    </>
                  ) : stats.avgGrade >= 5 ? (
                    <span className="text-sm text-yellow-600">Regular</span>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-red-600">Atenção</span>
                    </>
                  )}
                </div>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Taxa de Presença</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats.attendanceRate}%</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.pendingGrading > 0 && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="font-semibold text-orange-900">
                  {stats.pendingGrading} {stats.pendingGrading === 1 ? 'trabalho pendente' : 'trabalhos pendentes'} de correção
                </p>
                <p className="text-sm text-orange-700">
                  Acesse a aba de Atividades para corrigir
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="performance">Desempenho</TabsTrigger>
          <TabsTrigger value="engagement">Engajamento</TabsTrigger>
          <TabsTrigger value="communication">Comunicação</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TeacherAnalytics stats={stats} />
        </TabsContent>

        <TabsContent value="performance">
          <StudentPerformance stats={stats} />
        </TabsContent>

        <TabsContent value="engagement">
          <EngagementMetrics stats={stats} />
        </TabsContent>

        <TabsContent value="communication">
          <CommunicationCenter
            classes={stats.classes}
            senderType={stats.senderType}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
