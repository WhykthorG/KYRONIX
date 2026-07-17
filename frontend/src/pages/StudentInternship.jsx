import React from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Building2, Clock, Calendar, FileText, CheckCircle } from 'lucide-react';
import { InternshipApi } from '@/services/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import { INTERNSHIP_STATUS_LABELS } from '@shared/contracts/internship';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function StudentInternship() {
  const { user } = useAuth();

  const { data: internships = [], isLoading } = useQuery({
    queryKey: ['internships-student', user?.id],
    queryFn: () => InternshipApi.filter({ student_id: user?.id }, '-created_at'),
    enabled: !!user?.id,
  });

  const activeInternship = internships.find((i) => i.status === 'em_andamento');
  const completedInternships = internships.filter((i) => i.status === 'concluido');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Meu Estágio" subtitle="Carregando..." backTo="/Desktop" backLabel="Voltar" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse border-white/10 bg-slate-950/70">
              <CardContent className="p-6 h-32" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meu Estágio"
        subtitle={`${internships.length} estágio(s) registrado(s)`}
        backTo="/Desktop"
        backLabel="Voltar"
      />

      {activeInternship ? (
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-400" />
              Estágio em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-white/45">Empresa</p>
                <p className="font-medium">{activeInternship.company?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/45">Status</p>
                <StatusBadge status={activeInternship.status} />
              </div>
              <div>
                <p className="text-xs text-white/45">Início</p>
                <p className="font-medium">{activeInternship.start_date || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/45">Previsão Término</p>
                <p className="font-medium">{activeInternship.end_date || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/45">Horas Cumpridas</p>
                <p className="text-2xl font-bold text-blue-400">
                  {activeInternship.hours_completed || 0}/{activeInternship.hours_required || 0}h
                </p>
                {activeInternship.hours_required > 0 && (
                  <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((activeInternship.hours_completed || 0) / activeInternship.hours_required) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-white/45">Descrição</p>
                <p className="text-sm text-white/70">{activeInternship.description || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-8 text-center">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-white/30" />
            <p className="text-white/50">Nenhum estágio em andamento</p>
          </CardContent>
        </Card>
      )}

      {completedInternships.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Estágios Concluídos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedInternships.map((internship) => (
              <Card key={internship.id} className="border-white/10 bg-slate-950/70 text-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="font-medium">{internship.company?.name || 'Empresa'}</span>
                    </div>
                    <StatusBadge status={internship.status} />
                  </div>
                  <div className="text-sm text-white/70 space-y-1">
                    <p>{internship.start_date} — {internship.end_date || '—'}</p>
                    <p>{internship.hours_completed || 0}h cumpridas</p>
                    {internship.final_grade != null && (
                      <p className="text-emerald-400">Nota final: {internship.final_grade}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {internships.length === 0 && (
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-8 text-center">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-white/30" />
            <p className="text-white/50">Nenhum estágio registrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
