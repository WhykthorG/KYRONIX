import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { StudentApi } from '@/services/supabaseApi';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function StudentPerformance({ stats }) {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudents();
  }, [stats]);

  const loadStudents = async () => {
    try {
      const classIds = stats.classes.map(c => c.id);
      const allStudents = [];
      
      for (const classId of classIds) {
        const classStudents = await StudentApi.filter({ 
          current_class_id: classId,
          enrollment_status: 'ativo'
        });
        allStudents.push(...classStudents);
      }
      
      // Calcular métricas para cada aluno
      const studentsWithMetrics = await Promise.all(allStudents.map(async student => {
        const studentGrades = stats.grades.filter(g => g.student_id === student.id);
        const studentAttendance = stats.attendance.filter(a => a.student_id === student.id);
        const studentSubmissions = stats.submissions.filter(s => s.student_id === student.id);
        
        const avgGrade = studentGrades.length > 0
          ? (studentGrades.reduce((sum, g) => sum + (g.score || 0), 0) / studentGrades.length).toFixed(1)
          : 0;
        
        const attendanceRate = studentAttendance.length > 0
          ? ((studentAttendance.filter(a => a.status === 'presente').length / studentAttendance.length) * 100).toFixed(0)
          : 0;
        
        const submissionRate = stats.assignments.length > 0
          ? ((studentSubmissions.length / stats.assignments.length) * 100).toFixed(0)
          : 0;
        
        // Calcular trend (comparar últimas 5 notas com as 5 anteriores)
        const recentGrades = studentGrades.slice(-5);
        const previousGrades = studentGrades.slice(-10, -5);
        const recentAvg = recentGrades.length > 0
          ? recentGrades.reduce((sum, g) => sum + (g.score || 0), 0) / recentGrades.length
          : 0;
        const previousAvg = previousGrades.length > 0
          ? previousGrades.reduce((sum, g) => sum + (g.score || 0), 0) / previousGrades.length
          : recentAvg;
        
        const trend = recentAvg > previousAvg ? 'up' : recentAvg < previousAvg ? 'down' : 'stable';
        
        // Identificar alunos em risco
        const atRisk = avgGrade < 5 || attendanceRate < 75 || submissionRate < 50;
        
        return {
          ...student,
          avgGrade: parseFloat(avgGrade),
          attendanceRate: parseFloat(attendanceRate),
          submissionRate: parseFloat(submissionRate),
          trend,
          atRisk,
          totalGrades: studentGrades.length
        };
      }));
      
      setStudents(studentsWithMetrics);
      setFilteredStudents(studentsWithMetrics);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = students;
    
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedClass) {
      filtered = filtered.filter(s => s.current_class_id === selectedClass);
    }
    
    setFilteredStudents(filtered);
  }, [searchTerm, selectedClass, students]);

  // Top 10 alunos
  const topStudents = [...students]
    .sort((a, b) => b.avgGrade - a.avgGrade)
    .slice(0, 10)
    .map(s => ({
      name: s.full_name.split(' ')[0],
      media: s.avgGrade
    }));

  if (loading) {
    return <div className="p-6">Carregando dados dos alunos...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Alunos por Desempenho</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topStudents}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 10]} />
              <Tooltip />
              <Bar dataKey="media" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle>Desempenho Individual dos Alunos</CardTitle>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar aluno..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todas turmas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas</SelectItem>
                  {stats.classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredStudents.map(student => (
              <div 
                key={student.id} 
                className={`p-4 rounded-lg border ${student.atRisk ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'} hover:shadow-md transition-shadow`}
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={student.photo_url} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
                      {student.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{student.full_name}</h4>
                      {student.atRisk && (
                        <Badge variant="destructive" className="bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Em Risco
                        </Badge>
                      )}
                      {student.trend === 'up' && (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      )}
                      {student.trend === 'down' && (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{student.registration_number}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Média</p>
                      <p className={`text-xl font-bold ${
                        student.avgGrade >= 7 ? 'text-green-600' :
                        student.avgGrade >= 5 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {student.avgGrade.toFixed(1)}
                      </p>
                      <p className="text-xs text-slate-500">({student.totalGrades} notas)</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Presença</p>
                      <p className={`text-xl font-bold ${
                        student.attendanceRate >= 85 ? 'text-green-600' :
                        student.attendanceRate >= 75 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {student.attendanceRate}%
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Entregas</p>
                      <p className={`text-xl font-bold ${
                        student.submissionRate >= 80 ? 'text-green-600' :
                        student.submissionRate >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {student.submissionRate}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredStudents.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                Nenhum aluno encontrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}