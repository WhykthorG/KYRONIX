// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { HomeworkApi, HomeworkCompletionApi, ClassApi, SubjectApi, StudentApi } from '@/services/supabaseApi';
import PageHeader from '@/components/common/PageHeader';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookMarked, Calendar, Clock, Users, Edit, Trash2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";

function DueBadge({ dueDate, status }) {
  if (status !== 'ativa') return null;
  const due = new Date(dueDate + 'T23:59:59');
  if (isPast(due)) return <Badge className="bg-rose-100 text-rose-700 border border-rose-200" variant={undefined}>Vencida</Badge>;
  if (isToday(due)) return <Badge className="bg-amber-100 text-amber-700 border border-amber-200" variant={undefined}>Hoje</Badge>;
  const days = differenceInDays(due, new Date());
  if (days <= 2) return <Badge className="bg-orange-100 text-orange-700 border border-orange-200" variant={undefined}>Em {days}d</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200" variant={undefined}>{format(due, 'dd/MM', { locale: ptBR })}</Badge>;
}

export default function TeacherHomework() {
  const { user: authUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [selectedHW, setSelectedHW] = useState(null);
  const [formData, setFormData] = useState({});
  const [activeTab, setActiveTab] = useState('ativas');
  const queryClient = useQueryClient();

  const { data: homework = [], isLoading } = useQuery({
    queryKey: ['homework'],
    queryFn: () => HomeworkApi.list('-created_at'),
  });

  const { data: completions = [] } = useQuery({
    queryKey: ['homework-completions'],
    queryFn: () => HomeworkCompletionApi.list(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => SubjectApi.list(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-active'],
    queryFn: () => StudentApi.filter({ enrollment_status: 'ativo' }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => HomeworkApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['homework'] }); setShowForm(false); setFormData({}); toast.success('Tarefa de casa criada!'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => HomeworkApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['homework'] }); setShowForm(false); setFormData({}); setSelectedHW(null); toast.success('Tarefa atualizada!'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => HomeworkApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['homework'] }); toast.success('Tarefa removida!'); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData, teacher_id: authUser?.email || '', teacher_name: authUser?.user_metadata?.full_name || authUser?.email || '', status: 'ativa' };
    if (selectedHW) { updateMutation.mutate({ id: selectedHW.id, data: { ...payload, status: selectedHW.status } }); }
    else { createMutation.mutate(payload); }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleEdit = (hw) => { setSelectedHW(hw); setFormData(hw); setShowForm(true); };
  const getClassName = (id) => classes.find(c => c.id === id)?.name || '—';
  const getSubjectName = (id) => subjects.find(s => s.id === id)?.name || '—';
  const getCompletionStats = (hwId, classId) => {
    const classStudents = students.filter(s => s.current_class_id === classId);
    const done = completions.filter(c => c.homework_id === hwId && c.status === 'concluido').length;
    return { total: classStudents.length, done };
  };

  const filtered = homework.filter(hw =>
    activeTab === 'ativas' ? hw.status === 'ativa' :
    activeTab === 'encerradas' ? hw.status !== 'ativa' : true
  );

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/TeacherPortal"
        backLabel="Portal do Professor" title="Tarefas de Casa" subtitle="Registre e acompanhe as tarefas dos alunos"
        action={() => { setSelectedHW(null); setFormData({}); setShowForm(true); } } actionLabel="Nova Tarefa" backAction={undefined} children={undefined} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ativas">Ativas ({homework.filter(h => h.status === 'ativa').length})</TabsTrigger>
          <TabsTrigger value="encerradas">Encerradas</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-slate-500">
          <BookMarked className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="font-medium">Nenhuma tarefa encontrada</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(hw => {
            const stats = getCompletionStats(hw.id, hw.class_id);
            const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
            return (
              <Card key={hw.id} className={cn("hover:shadow-lg transition-shadow", hw.status !== 'ativa' && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{getSubjectName(hw.subject_id)}</span>
                    <DueBadge dueDate={hw.due_date} status={hw.status} />
                  </div>
                  <CardTitle className="text-base mt-2 leading-tight">{hw.title}</CardTitle>
                  {hw.description && <p className="text-sm text-slate-500 line-clamp-2 mt-1">{hw.description}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="flex items-center gap-1"><Users className="w-4 h-4" /><span>{getClassName(hw.class_id)}</span></div>
                    {hw.estimated_minutes && <div className="flex items-center gap-1"><Clock className="w-4 h-4" /><span>~{hw.estimated_minutes}min</span></div>}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    <Calendar className="w-4 h-4" />
                    <span>Entrega: {format(new Date(hw.due_date + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}</span>
                  </div>
                  {stats.total > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />{stats.done}/{stats.total} concluíram</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(hw)} aria-label={`Editar tarefa ${hw.title}`} data-tooltip={`Editar tarefa ${hw.title}`}><Edit className="w-4 h-4 text-slate-500" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (hw.status === 'ativa') updateMutation.mutate({ id: hw.id, data: { ...hw, status: 'encerrada' } }); }}
                      aria-label={`Encerrar tarefa ${hw.title}`}
                      data-tooltip={`Encerrar tarefa ${hw.title}`}
                      disabled={hw.status !== 'ativa'} className="text-amber-500 hover:text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm('Excluir esta tarefa?')) deleteMutation.mutate(hw.id); }} aria-label={`Excluir tarefa ${hw.title}`} data-tooltip={`Excluir tarefa ${hw.title}`}>
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader className={undefined}><DialogTitle>{selectedHW ? 'Editar Tarefa' : 'Nova Tarefa de Casa'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Título *</Label><Input value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Exercícios pág. 45-48" required /></div>
            <div><Label>Descrição / Instruções</Label><Textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Descreva o que o aluno deve fazer..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Turma *</Label>
                <Select value={formData.class_id || ''} onValueChange={v => setFormData({ ...formData, class_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Disciplina *</Label>
                <Select value={formData.subject_id || ''} onValueChange={v => setFormData({ ...formData, subject_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data de Entrega *</Label><Input type="date" value={formData.due_date || ''} onChange={e => setFormData({ ...formData, due_date: e.target.value })} required /></div>
              <div><Label>Tempo estimado (min)</Label><Input type="number" min="5" step="5" value={formData.estimated_minutes || ''} onChange={e => setFormData({ ...formData, estimated_minutes: Number(e.target.value) })} placeholder="Ex: 30" /></div>
            </div>
            <DialogFooter className={undefined}>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={isSaving}>
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> Salvando...</> : (selectedHW ? 'Salvar Alterações' : 'Criar Tarefa')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
