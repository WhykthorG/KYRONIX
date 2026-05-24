// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Award, Target, Clock, CheckCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function EngagementMetrics({ stats }) {
  // Engajamento nos últimos 7 dias
  const last7Days = [...Array(7)].map((_, i) => {
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    const dayAttendance = stats.attendance.filter(a => a.date === date);
    const daySubmissions = stats.submissions.filter(s =>
      s.submitted_at && s.submitted_at.startsWith(date)
    );

    return {
      date: format(subDays(new Date(), 6 - i), 'dd/MM', { locale: ptBR }),
      presencas: dayAttendance.filter(a => a.status === 'presente').length,
      entregas: daySubmissions.length
    };
  });

  // Eficácia das atividades (taxa de submissão)
  const assignmentEffectiveness = stats.assignments.map(assignment => {
    const subs = stats.submissions.filter(s => s.assignment_id === assignment.id);
    const rate = Math.round((subs.length / (stats.totalStudents || 1)) * 100);

    return {
      title: assignment.title,
      type: assignment.type,
      dueDate: assignment.due_date,
      submissionRate: rate,
      totalSubmissions: subs.length,
      avgScore: subs.filter(s => s.score).length > 0
        ? (subs.reduce((sum, s) => sum + (s.score || 0), 0) / subs.filter(s => s.score).length).toFixed(1)
        : null
    };
  }).sort((a, b) => b.submissionRate - a.submissionRate);

  // Participação por turma
  const classEngagement = stats.classes.map(classData => {
    const classAttendance = stats.attendance.filter(a => a.class_id === classData.id);
    const classSubmissions = stats.submissions.filter(s => {
      const assignment = stats.assignments.find(a => a.id === s.assignment_id);
      return assignment && assignment.class_id === classData.id;
    });

    const attendanceRate = classAttendance.length > 0
      ? ((classAttendance.filter(a => a.status === 'presente').length / classAttendance.length) * 100).toFixed(0)
      : 0;

    return {
      name: classData.name,
      presenca: parseFloat(attendanceRate),
      entregas: classSubmissions.length
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Taxa Média de Entrega</p>
                <p className="text-2xl font-bold text-slate-900">
                  {assignmentEffectiveness.length > 0
                    ? Math.round(assignmentEffectiveness.reduce((sum, a) => sum + a.submissionRate, 0) / assignmentEffectiveness.length)
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Atividades no Prazo</p>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.submissions.filter(s => !s.is_late).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Entregas Atrasadas</p>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.submissions.filter(s => s.is_late).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Notas Acima de 7</p>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.grades.filter(g => g.score >= 7).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Engajamento nos Últimos 7 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="presencas" stroke="#6366f1" strokeWidth={2} name="Presenças" />
                <Line type="monotone" dataKey="entregas" stroke="#10b981" strokeWidth={2} name="Entregas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participação por Turma</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classEngagement}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="presenca" fill="#6366f1" name="Taxa Presença %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eficácia das Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assignmentEffectiveness.slice(0, 10).map((assignment, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900">{assignment.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {assignment.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      {assignment.totalSubmissions} de {stats.totalStudents} entregas
                      {assignment.avgScore && ` • Média: ${assignment.avgScore}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      assignment.submissionRate >= 80 ? 'text-green-600' :
                      assignment.submissionRate >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {assignment.submissionRate}%
                    </p>
                  </div>
                </div>
                <Progress value={assignment.submissionRate} className="h-2" />
              </div>
            ))}

            {assignmentEffectiveness.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                Nenhuma atividade cadastrada ainda
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
