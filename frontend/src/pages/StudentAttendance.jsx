import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { AttendanceApi, SubjectApi } from '@/services/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  presente: { label: 'Presente', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ausente: { label: 'Ausente', icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-50' },
  justificado: { label: 'Justificado', icon: FileText, color: 'text-amber-500', bg: 'bg-amber-50' },
  atrasado: { label: 'Atrasado', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
};

export default function StudentAttendance() {
  const { user } = useAuth();

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['attendance-student', user?.id],
    queryFn: () => AttendanceApi.filter({ student_id: user?.id }, '-date', 200),
    enabled: !!user?.id,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => SubjectApi.list('name'),
  });

  const subjectsById = useMemo(() => {
    const map = new Map();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const stats = useMemo(() => {
    const total = attendance.length || 1;
    const present = attendance.filter((a) => a.status === 'presente').length;
    const absent = attendance.filter((a) => a.status === 'ausente').length;
    const justified = attendance.filter((a) => a.status === 'justificado').length;
    const late = attendance.filter((a) => a.status === 'atrasado').length;
    const rate = Math.round(((present + late) / total) * 100);

    return { total: attendance.length, present, absent, justified, late, rate };
  }, [attendance]);

  const recentAttendance = useMemo(() => {
    return attendance.slice(0, 20);
  }, [attendance]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Minha Frequência" subtitle="Carregando..." backTo="/Desktop" backLabel="Voltar" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse border-white/10 bg-slate-950/70">
              <CardContent className="p-6 h-24" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha Frequência"
        subtitle={`${attendance.length} registro(s) de frequência`}
        backTo="/Desktop"
        backLabel="Voltar"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Total</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Presenças</p>
            <p className="text-2xl font-semibold text-emerald-400">{stats.present}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Faltas</p>
            <p className="text-2xl font-semibold text-rose-400">{stats.absent}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Justificadas</p>
            <p className="text-2xl font-semibold text-amber-400">{stats.justified}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Taxa de Presença</p>
            <p className="text-2xl font-semibold text-blue-400">{stats.rate}%</p>
          </CardContent>
        </Card>
      </div>

      {stats.rate < 75 && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <p className="font-medium text-amber-500">Atenção: Frequência baixa</p>
              <p className="text-sm text-amber-500/70">
                Sua taxa de presença está abaixo de 75%. Regularize suas faltas.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-white/10 bg-slate-950/70 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Histórico de Frequência
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAttendance.length > 0 ? (
            <div className="space-y-2">
              {recentAttendance.map((record) => {
                const config = STATUS_CONFIG[record.status] || STATUS_CONFIG.presente;
                const Icon = config.icon;
                const subject = subjectsById.get(record.subject_id);

                return (
                  <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", config.bg)}>
                        <Icon className={cn("w-4 h-4", config.color)} />
                      </div>
                      <div>
                        <p className="font-medium">{subject?.name || 'Disciplina'}</p>
                        <p className="text-sm text-white/50">
                          {format(new Date(record.date), "dd/MM/yyyy", { locale: ptBR })}
                          {record.lesson_number && ` - Aula ${record.lesson_number}`}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-white/30">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum registro de frequência encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
