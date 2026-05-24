import React, { useState, useMemo } from 'react';
import { countByStatus } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function TeacherAnalytics({ stats }) {
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedSearch = useMemo(() => searchTerm.toLowerCase().trim(), [searchTerm]);

  const filteredGrades = useMemo(() => {
    if (!normalizedSearch) return stats.grades;
    return stats.grades.filter(g => 
      (g.student_name?.toLowerCase().includes(normalizedSearch) || false) ||
      (g.subject_name?.toLowerCase().includes(normalizedSearch) || false) ||
      g.score?.toString().includes(normalizedSearch)
    );
  }, [stats.grades, normalizedSearch]);

  const filteredSubmissions = useMemo(() => {
    if (!normalizedSearch) return stats.submissions;
    return stats.submissions.filter(s => 
      (s.student_name?.toLowerCase().includes(normalizedSearch) || false) ||
      (s.assignment_title?.toLowerCase().includes(normalizedSearch) || false)
    );
  }, [stats.submissions, normalizedSearch]);

  const filteredAttendance = useMemo(() => {
    if (!normalizedSearch) return stats.attendance;
    return stats.attendance.filter(a => 
      (a.student_name?.toLowerCase().includes(normalizedSearch) || false)
    );
  }, [stats.attendance, normalizedSearch]);

  const filteredAssignments = useMemo(() => {
    if (!normalizedSearch) return stats.assignments;
    return stats.assignments.filter(a => 
      a.title?.toLowerCase().includes(normalizedSearch)
    );
  }, [stats.assignments, normalizedSearch]);

  // Distribuição de notas
  const gradeDistribution = useMemo(() => [
    { range: '9-10', count: filteredGrades.filter(g => g.score >= 9).length },
    { range: '7-8.9', count: filteredGrades.filter(g => g.score >= 7 && g.score < 9).length },
    { range: '5-6.9', count: filteredGrades.filter(g => g.score >= 5 && g.score < 7).length },
    { range: '0-4.9', count: filteredGrades.filter(g => g.score < 5).length }
  ], [filteredGrades]);

  // Performance por bimestre
  const bimesterData = useMemo(() => [1, 2, 3, 4].map(bim => {
    const bimGrades = filteredGrades.filter(g => g.bimester === bim);
    const avg = bimGrades.length > 0
      ? (bimGrades.reduce((sum, g) => sum + (g.score || 0), 0) / bimGrades.length).toFixed(1)
      : 0;
    return {
      bimestre: `${bim}º Bim`,
      media: parseFloat(avg)
    };
  }), [filteredGrades]);

  // Taxa de submissão de atividades
  const submissionRate = useMemo(() => filteredAssignments.map(assignment => {
    const subs = filteredSubmissions.filter(s => s.assignment_id === assignment.id);
    return {
      name: assignment.title.substring(0, 20) + '...',
      taxa: Math.round((subs.length / (stats.totalStudents || 1)) * 100)
    };
  }).slice(0, 5), [filteredAssignments, filteredSubmissions, stats.totalStudents]);

  // Distribuição de presença
  const attendanceData = useMemo(() => [
    { name: 'Presentes', value: countByStatus(filteredAttendance, 'presente'), color: '#10b981' },
    { name: 'Ausentes', value: countByStatus(filteredAttendance, 'ausente'), color: '#ef4444' },
    { name: 'Justificados', value: countByStatus(filteredAttendance, 'justificado'), color: '#f59e0b' },
    { name: 'Atrasados', value: countByStatus(filteredAttendance, 'atrasado'), color: '#8b5cf6' }
  ], [filteredAttendance]);

  const hasResults = filteredGrades.length > 0 || filteredSubmissions.length > 0 || filteredAttendance.length > 0 || filteredAssignments.length > 0;

  return (
    <div className="space-y-6">
      <div className="max-w-lg">
        <div className="relative flex items-center overflow-hidden rounded-[28px] border border-white/15 bg-slate-950/70 shadow-2xl shadow-black/35 backdrop-blur-3xl">
          <Search className="ml-4 h-4 w-4 flex-shrink-0 text-slate-400" />
          <Input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por aluno, disciplina ou atividade..."
            className="h-12 border-0 bg-transparent px-3 text-sm text-white placeholder:text-white/45 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ml-1 flex-1"
          />
          {normalizedSearch && (
            <div className="mr-3 text-xs text-slate-400 font-medium">
              {filteredGrades.length + filteredSubmissions.length + filteredAttendance.length} resultados
            </div>
          )}
        </div>
      </div>

      {!hasResults && normalizedSearch ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500">
          <Search className="h-12 w-12 text-slate-400 mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2 text-slate-300">Nenhum resultado encontrado</h3>
          <p className="text-sm">Tente buscar por nome do aluno, disciplina ou título da atividade.</p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Notas{normalizedSearch && ` (${filteredGrades.length})`}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={gradeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance por Bimestre</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={bimesterData}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis dataKey="bimestre" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="media" stroke="#8b5cf6" strokeWidth={2} dot={true} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Taxa de Entrega de Atividades{normalizedSearch && ` (${filteredAssignments.length})`}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={submissionRate} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" width={150} />
                    <Tooltip />
                    <Bar dataKey="taxa" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Frequência{normalizedSearch && ` (${filteredAttendance.length})`}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={attendanceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {attendanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumo de Atividades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <p className="text-sm text-indigo-600 font-medium">Total de Atividades</p>
                  <p className="text-2xl font-bold text-indigo-900 mt-1">{filteredAssignments.length}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Submissões Recebidas</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">{filteredSubmissions.length}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-orange-600 font-medium">Aguardando Correção</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">
                    {countByStatus(filteredSubmissions, 'entregue')}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Já Corrigidas</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {countByStatus(filteredSubmissions, 'avaliada')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
