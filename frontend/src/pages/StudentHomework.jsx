import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { StudentApi, SubjectApi, HomeworkApi, HomeworkCompletionApi } from '@/services/supabaseApi';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BookMarked,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  PartyPopper,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { canAccessDashboard } from '@shared/contracts/access';
import PageHeader from '@/components/common/PageHeader';
import StatePanel from '@/components/common/StatePanel';


function UrgencyBadge({ dueDate }) {
  const due = new Date(dueDate + 'T23:59:59');
  if (isPast(due)) return <Badge className="bg-rose-100 text-rose-700 border border-rose-200 text-xs">Vencida</Badge>;
  if (isToday(due)) return <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">Hoje!</Badge>;
  const days = differenceInDays(due, new Date());
  if (days <= 2) return <Badge className="bg-orange-100 text-orange-700 border border-orange-200 text-xs">Em {days}d</Badge>;
  return <Badge className="bg-slate-100 text-slate-600 border text-xs">{format(due, "dd/MM", { locale: ptBR })}</Badge>;
}

export default function StudentHomework() {
  const { user: authUser } = useAuth();
  const { profileType } = usePermissions();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('pendentes');
  const queryClient = useQueryClient();
  const canSeeDashboard = canAccessDashboard(profileType);
  const cameFromDashboard = Boolean(
    location.state?.fromDashboard || sessionStorage.getItem('route_previous') === '/Dashboard'
  );
  const showDashboardBack = canSeeDashboard && cameFromDashboard;

  const { data: myStudentRecord } = useQuery({
    queryKey: ['my-student', authUser?.email],
    queryFn: () => StudentApi.filter({ email: authUser.email }),
    enabled: !!authUser?.email,
    select: (data) => data[0],
  });

  const studentId = myStudentRecord?.id;
  const classId = myStudentRecord?.current_class_id;

  const { data: homework = [], isLoading: loadingHW } = useQuery({
    queryKey: ['homework-class', classId],
    queryFn: () => HomeworkApi.filter({ class_id: classId, status: 'ativa' }),
    enabled: !!classId,
  });

  const { data: myCompletions = [], isLoading: loadingComp } = useQuery({
    queryKey: ['my-completions', studentId],
    queryFn: () => HomeworkCompletionApi.filter({ student_id: studentId }),
    enabled: !!studentId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => SubjectApi.list(),
  });

  const completionMutation = useMutation({
    mutationFn: async ({ homeworkId, done }) => {
      const existing = myCompletions.find(c => c.homework_id === homeworkId);
      if (existing) {
        return HomeworkCompletionApi.update(existing.id, {
          status: done ? 'concluido' : 'pendente',
          completed_at: done ? new Date().toISOString() : null,
        });
      }
      return HomeworkCompletionApi.create({
        homework_id: homeworkId,
        student_id: studentId,
        student_email: authUser?.email,
        status: done ? 'concluido' : 'pendente',
        completed_at: done ? new Date().toISOString() : null,
      });
    },
    onSuccess: (_, { done }) => {
      queryClient.invalidateQueries({ queryKey: ['my-completions'] });
      if (done) toast.success('Tarefa marcada como concluída!');
      else toast.info('Tarefa desmarcada.');
    },
  });

  const getSubjectName = (id) => subjects.find(s => s.id === id)?.name || '—';
  const isDone = (hwId) => myCompletions.find(c => c.homework_id === hwId)?.status === 'concluido';

  const pending = homework.filter(hw => !isDone(hw.id));
  const done = homework.filter(hw => isDone(hw.id));
  const sortedPending = useMemo(() => [...pending].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)), [pending]);
  const isLoading = loadingHW || loadingComp;

  if (!myStudentRecord) {
    return (
      isLoading ? (
        <StatePanel
          variant="loading"
          title="Carregando tarefas"
          description="Estamos buscando o seu vínculo de aluno e as tarefas disponíveis."
        />
      ) : (
        <StatePanel
          variant="empty"
          icon={BookMarked}
          title="Perfil de aluno não encontrado"
          description="Não localizamos um cadastro de aluno vinculado ao seu acesso. Verifique seu cadastro com a secretaria."
        />
      )
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas Tarefas de Casa"
        subtitle={pending.length === 0
          ? 'Nenhuma tarefa pendente no momento.'
          : `${pending.length} tarefa${pending.length > 1 ? 's' : ''} pendente${pending.length > 1 ? 's' : ''} aguardando conclusão.`
        }
        backTo={showDashboardBack ? '/Dashboard' : undefined}
      />

      <div className="app-metric-grid">
        <Card className="p-4"><p className="mb-1 text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold text-foreground">{homework.length}</p></Card>
        <Card className="p-4 border-[hsl(var(--feedback-warning-fg)/0.14)] bg-[hsl(var(--feedback-warning-bg))]"><p className="mb-1 text-xs text-[hsl(var(--feedback-warning-fg))]">Pendentes</p><p className="text-2xl font-bold text-[hsl(var(--feedback-warning-fg))]">{pending.length}</p></Card>
        <Card className="p-4 border-[hsl(var(--feedback-success-fg)/0.14)] bg-[hsl(var(--feedback-success-bg))]"><p className="mb-1 text-xs text-[hsl(var(--feedback-success-fg))]">Concluídas</p><p className="text-2xl font-bold text-[hsl(var(--feedback-success-fg))]">{done.length}</p></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes {pending.length > 0 && <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas ({done.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          {isLoading ? (
            <StatePanel compact variant="loading" title="Atualizando tarefas pendentes" description="As atividades mais recentes aparecerão aqui." />
          ) : sortedPending.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <StatePanel
                compact
                variant="success"
                icon={PartyPopper}
                title="Tudo em dia"
                description="Você não tem tarefas pendentes no momento."
              />
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {sortedPending.map(hw => (
                <HomeworkCard key={hw.id} hw={hw} done={false} subjectName={getSubjectName(hw.subject_id)}
                  onToggle={(d) => completionMutation.mutate({ homeworkId: hw.id, done: d })}
                  isPending={completionMutation.isPending} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="concluidas" className="mt-4">
          {done.length === 0 ? (
            <Card><CardContent className="py-12"><StatePanel compact variant="empty" title="Nenhuma tarefa concluída" description="Quando você marcar atividades como concluídas, elas aparecerão nesta aba." /></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {done.map(hw => (
                <HomeworkCard key={hw.id} hw={hw} done={true} subjectName={getSubjectName(hw.subject_id)}
                  onToggle={(d) => completionMutation.mutate({ homeworkId: hw.id, done: d })}
                  isPending={completionMutation.isPending} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HomeworkCard({ hw, done, subjectName, onToggle, isPending }) {
  return (
    <Card className={cn("transition-all hover:shadow-md", done && "opacity-60")}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-4">
          <button onClick={() => onToggle(!done)} disabled={isPending} className="mt-0.5 flex-shrink-0" aria-label={done ? 'Marcar tarefa como pendente' : 'Marcar tarefa como concluída'} data-tooltip={done ? 'Marcar tarefa como pendente' : 'Marcar tarefa como concluída'}>
            {done ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6 text-slate-300 hover:text-indigo-400 transition-colors" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-2 mb-1">
              <h3 className={cn("font-semibold text-slate-800", done && "line-through text-slate-400")}>{hw.title}</h3>
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{subjectName}</span>
              <UrgencyBadge dueDate={hw.due_date} />
            </div>
            {hw.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{hw.description}</p>}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Entrega: {format(new Date(hw.due_date + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}</span>
              {hw.estimated_minutes && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />~{hw.estimated_minutes}min</span>}
              {hw.teacher_name && <span>{hw.teacher_name}</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
