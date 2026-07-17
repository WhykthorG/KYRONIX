import React from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, Calendar, FileText, CheckCircle, Clock } from 'lucide-react';
import { TccProjectApi, TccMemberApi } from '@/services/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import { TCC_STATUS_LABELS, TCC_PHASE_LABELS } from '@shared/contracts/tcc';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function StudentTCC() {
  const { user } = useAuth();

  const { data: tccProjects = [], isLoading } = useQuery({
    queryKey: ['tcc-student', user?.id],
    queryFn: async () => {
      const allProjects = await TccProjectApi.list('-created_at');
      return allProjects.filter((p) =>
        p.members?.some((m) => m.student_id === user?.id)
      );
    },
    enabled: !!user?.id,
  });

  const activeTcc = tccProjects.find((t) => t.status === 'em_andamento');
  const completedTcc = tccProjects.filter((t) => t.status === 'aprovado');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Meu TCC" subtitle="Carregando..." backTo="/Desktop" backLabel="Voltar" />
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
        title="Meu TCC / Projeto Integrador"
        subtitle={`${tccProjects.length} projeto(s) registrado(s)`}
        backTo="/Desktop"
        backLabel="Voltar"
      />

      {activeTcc ? (
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-400" />
              Projeto em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-white/45">Título</p>
                <p className="font-medium">{activeTcc.title}</p>
              </div>
              <div>
                <p className="text-xs text-white/45">Tema</p>
                <p className="font-medium">{activeTcc.theme || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/45">Fase</p>
                <p className="font-medium text-purple-400">{TCC_PHASE_LABELS[activeTcc.phase] || activeTcc.phase}</p>
              </div>
              <div>
                <p className="text-xs text-white/45">Orientador</p>
                <p className="font-medium">{activeTcc.advisor?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/45">Previsão Término</p>
                <p className="font-medium">{activeTcc.expected_end_date || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/45">Data Defesa</p>
                <p className="font-medium">{activeTcc.defense_date || '—'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-white/45 mb-2">Integrantes</p>
              <div className="flex flex-wrap gap-2">
                {activeTcc.members?.map((member) => (
                  <span key={member.id} className="px-3 py-1 bg-white/10 rounded-full text-sm">
                    {member.student?.name || 'Aluno'}
                    {member.role === 'lider' && <span className="ml-1 text-purple-400">(Líder)</span>}
                  </span>
                ))}
              </div>
            </div>

            {activeTcc.description && (
              <div>
                <p className="text-xs text-white/45">Descrição</p>
                <p className="text-sm text-white/70">{activeTcc.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-white/30" />
            <p className="text-white/50">Nenhum projeto TCC em andamento</p>
          </CardContent>
        </Card>
      )}

      {completedTcc.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Projetos Concluídos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedTcc.map((tcc) => (
              <Card key={tcc.id} className="border-white/10 bg-slate-950/70 text-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="font-medium">{tcc.title}</span>
                    </div>
                    <StatusBadge status={tcc.status} />
                  </div>
                  <div className="text-sm text-white/70 space-y-1">
                    <p>Tema: {tcc.theme || '—'}</p>
                    <p>Orientador: {tcc.advisor?.name || '—'}</p>
                    {tcc.final_grade != null && (
                      <p className="text-emerald-400">Nota final: {tcc.final_grade}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tccProjects.length === 0 && (
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-white/30" />
            <p className="text-white/50">Nenhum projeto TCC registrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
