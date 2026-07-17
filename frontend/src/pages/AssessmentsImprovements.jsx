import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Edit, Trash2, RotateCcw, Users, Plus, Search, Calendar, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { SecondChanceApi, ClassCouncilApi, ClassApi, SubjectApi, UserProfileApi } from '@/services/supabaseApi';
import {
  SECOND_CHANCE_STATUSES, SECOND_CHANCE_STATUS_LABELS,
  COUNCIL_STATUSES, COUNCIL_STATUS_LABELS,
  COUNCIL_DECISION_TYPES, COUNCIL_DECISION_LABELS,
} from '@shared/contracts/assessment';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const EMPTY_SECOND_CHANCE = {
  student_id: '',
  subject_id: '',
  class_id: '',
  teacher_id: '',
  bimester: 1,
  year: new Date().getFullYear(),
  scheduled_date: '',
  scheduled_time: '',
  location: '',
  status: 'pendente',
  max_score: 10,
  weight: 1,
  notes: '',
  justification: '',
};

const EMPTY_COUNCIL = {
  class_id: '',
  academic_year: new Date().getFullYear(),
  bimester: 1,
  scheduled_date: '',
  scheduled_time: '',
  location: '',
  status: 'agendado',
  coordinator_id: '',
  agenda: '',
  minutes: '',
};

export default function AssessmentsImprovements({ globalSearch }) {
  const [activeTab, setActiveTab] = useState('second-chances');
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_SECOND_CHANCE);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: secondChances = [], isLoading: loadingSC } = useQuery({
    queryKey: ['second-chances'],
    queryFn: () => SecondChanceApi.list('-scheduled_date'),
  });

  const { data: councils = [], isLoading: loadingCouncils } = useQuery({
    queryKey: ['class-councils'],
    queryFn: () => ClassCouncilApi.list('-scheduled_date'),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list('name'),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => SubjectApi.list('name'),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-list'],
    queryFn: () => UserProfileApi.filter({ profile_type: 'aluno' }, 'full_name', 500),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: () => UserProfileApi.filter({ profile_type: 'professor' }, 'full_name', 500),
  });

  const createSCMutation = useMutation({
    mutationFn: (data) => SecondChanceApi.create(data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['second-chances'] });
      setShowForm(false);
      setFormData(EMPTY_SECOND_CHANCE);
      toast.success('Segunda chamada criada com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao criar segunda chamada.'),
  });

  const updateSCMutation = useMutation({
    mutationFn: ({ id, data }) => SecondChanceApi.update(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['second-chances'] });
      setShowForm(false);
      setSelectedItem(null);
      toast.success('Segunda chamada atualizada com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao atualizar segunda chamada.'),
  });

  const deleteSCMutation = useMutation({
    mutationFn: (id) => SecondChanceApi.delete(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['second-chances'] });
      toast.success('Segunda chamada removida com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover segunda chamada.'),
  });

  const createCouncilMutation = useMutation({
    mutationFn: (data) => ClassCouncilApi.create(data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-councils'] });
      setShowForm(false);
      setFormData(EMPTY_COUNCIL);
      toast.success('Conselho de classe criado com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao criar conselho.'),
  });

  const deleteCouncilMutation = useMutation({
    mutationFn: (id) => ClassCouncilApi.delete(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-councils'] });
      toast.success('Conselho removido com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover conselho.'),
  });

  const isSaving = createSCMutation.isPending || updateSCMutation.isPending || createCouncilMutation.isPending;

  const filteredSC = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return secondChances;
    return secondChances.filter((sc) =>
      sc.student?.name?.toLowerCase().includes(normalizedSearch) ||
      sc.subject?.name?.toLowerCase().includes(normalizedSearch)
    );
  }, [secondChances, search]);

  const filteredCouncils = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return councils;
    return councils.filter((c) =>
      c.class?.name?.toLowerCase().includes(normalizedSearch)
    );
  }, [councils, search]);

  useGlobalSearchNavigation({
    entityKey: 'second_chances',
    globalSearch,
    isReady: !loadingSC,
    onNavigate: ({ query }) => {
      setSearch(query || '');
    },
  });

  const handleNewSecondChance = () => {
    setSelectedItem(null);
    setFormData(EMPTY_SECOND_CHANCE);
    setShowForm(true);
  };

  const handleNewCouncil = () => {
    setSelectedItem(null);
    setFormData(EMPTY_COUNCIL);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeTab === 'second-chances') {
      if (selectedItem) {
        updateSCMutation.mutate({ id: selectedItem.id, data: formData });
      } else {
        createSCMutation.mutate(formData);
      }
    } else {
      createCouncilMutation.mutate(formData);
    }
  };

  const scStats = useMemo(() => ({
    total: secondChances.length,
    pendente: secondChances.filter((sc) => sc.status === 'pendente').length,
    agendada: secondChances.filter((sc) => sc.status === 'agendada').length,
    realizada: secondChances.filter((sc) => sc.status === 'realizada').length,
  }), [secondChances]);

  const councilStats = useMemo(() => ({
    total: councils.length,
    agendado: councils.filter((c) => c.status === 'agendado').length,
    realizado: councils.filter((c) => c.status === 'realizado').length,
  }), [councils]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avaliações e Conselho de Classe"
        subtitle="Segunda chamada, conselhos e decisões acadêmicas"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="second-chances">
            <RotateCcw className="w-4 h-4 mr-2" /> Segunda Chamada
          </TabsTrigger>
          <TabsTrigger value="councils">
            <Users className="w-4 h-4 mr-2" /> Conselho de Classe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="second-chances" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Total</p>
                <p className="text-2xl font-semibold">{scStats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Pendentes</p>
                <p className="text-2xl font-semibold text-amber-400">{scStats.pendente}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Agendadas</p>
                <p className="text-2xl font-semibold text-blue-400">{scStats.agendada}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Realizadas</p>
                <p className="text-2xl font-semibold text-emerald-400">{scStats.realizada}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="app-search-field flex-1 max-w-lg">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por aluno, disciplina..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
            </div>
            <Button onClick={handleNewSecondChance}>
              <Plus className="w-4 h-4 mr-2" /> Nova Segunda Chamada
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSC.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-5 h-5 text-amber-400" />
                      <span className="font-medium">{item.student?.name || 'Aluno'}</span>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="space-y-1 text-sm text-white/70">
                    <p>Disciplina: {item.subject?.name || '—'}</p>
                    <p>Turma: {item.class?.name || '—'}</p>
                    <p>Data: {item.scheduled_date || '—'}</p>
                    {item.original_grade != null && <p>Nota original: {item.original_grade}</p>}
                    {item.new_grade != null && <p>Nova nota: {item.new_grade}</p>}
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(item); setFormData(item); setShowForm(true); }}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'sc', item })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredSC.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/50">
                Nenhuma segunda chamada encontrada.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="councils" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Total</p>
                <p className="text-2xl font-semibold">{councilStats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Agendados</p>
                <p className="text-2xl font-semibold text-blue-400">{councilStats.agendado}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Realizados</p>
                <p className="text-2xl font-semibold text-emerald-400">{councilStats.realizado}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="app-search-field flex-1 max-w-lg">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por turma..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
            </div>
            <Button onClick={handleNewCouncil}>
              <Plus className="w-4 h-4 mr-2" /> Novo Conselho
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCouncils.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-400" />
                      <span className="font-medium">Conselho - {item.class?.name || 'Turma'}</span>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="space-y-1 text-sm text-white/70">
                    <p>Data: {item.scheduled_date}</p>
                    <p>Bimestre: {item.bimester}º</p>
                    <p>Coordenador: {item.coordinator?.name || '—'}</p>
                    <p>Decisões: {item.decisions?.length || 0}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'council', item })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredCouncils.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/50">
                Nenhum conselho de classe encontrado.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeTab === 'second-chances'
                ? (selectedItem ? 'Editar Segunda Chamada' : 'Nova Segunda Chamada')
                : 'Novo Conselho de Classe'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'second-chances' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aluno *</Label>
                    <Select value={formData.student_id} onValueChange={(v) => setFormData({ ...formData, student_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Disciplina *</Label>
                    <Select value={formData.subject_id} onValueChange={(v) => setFormData({ ...formData, subject_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Turma *</Label>
                    <Select value={formData.class_id} onValueChange={(v) => setFormData({ ...formData, class_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bimestre</Label>
                    <Select value={String(formData.bimester)} onValueChange={(v) => setFormData({ ...formData, bimester: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((b) => (
                          <SelectItem key={b} value={String(b)}>{b}º Bimestre</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Data *</Label>
                    <Input type="date" value={formData.scheduled_date} onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Input type="time" value={formData.scheduled_time} onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SECOND_CHANCE_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Justificativa</Label>
                  <Textarea value={formData.justification} onChange={(e) => setFormData({ ...formData, justification: e.target.value })} rows={2} />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Turma *</Label>
                    <Select value={formData.class_id} onValueChange={(v) => setFormData({ ...formData, class_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bimestre</Label>
                    <Select value={String(formData.bimester)} onValueChange={(v) => setFormData({ ...formData, bimester: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((b) => (
                          <SelectItem key={b} value={String(b)}>{b}º Bimestre</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data *</Label>
                    <Input type="date" value={formData.scheduled_date} onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Input type="time" value={formData.scheduled_time} onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Pauta</Label>
                  <Textarea value={formData.agenda} onChange={(e) => setFormData({ ...formData, agenda: e.target.value })} rows={3} placeholder="Descreva a pauta do conselho..." />
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={isSaving}>
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja excluir este registro?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => {
              if (deleteTarget?.type === 'sc') {
                deleteSCMutation.mutate(deleteTarget.item.id);
              } else {
                deleteCouncilMutation.mutate(deleteTarget.item.id);
              }
              setDeleteTarget(null);
            }}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
