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
import { Loader2, Edit, Trash2, BookOpen, Plus, Search, Eye, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { TccProjectApi, UserProfileApi } from '@/services/supabaseApi';
import { TCC_STATUSES, TCC_STATUS_LABELS, TCC_PHASES, TCC_PHASE_LABELS } from '@shared/contracts/tcc';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const EMPTY_FORM = {
  title: '',
  theme: '',
  description: '',
  student_ids: [],
  advisor_id: '',
  co_advisor_id: '',
  class_id: '',
  subject_id: '',
  start_date: '',
  expected_end_date: '',
  defense_date: '',
  status: 'pendente',
  phase: 'selecao_tema',
  objectives: '',
  methodology: '',
  keywords: [],
};

export default function TCCProjects({ globalSearch }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDetails, setShowDetails] = useState(null);
  const queryClient = useQueryClient();

  const { data: tccProjects = [], isLoading } = useQuery({
    queryKey: ['tcc-projects'],
    queryFn: () => TccProjectApi.list('-created_at'),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-list'],
    queryFn: () => UserProfileApi.filter({ profile_type: 'aluno' }, 'full_name', 500),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: () => UserProfileApi.filter({ profile_type: 'professor' }, 'full_name', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => TccProjectApi.create(data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tcc-projects'] });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      toast.success('Projeto TCC criado com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao criar projeto TCC.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => TccProjectApi.update(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tcc-projects'] });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      setSelectedItem(null);
      toast.success('Projeto TCC atualizado com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao atualizar projeto TCC.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => TccProjectApi.delete(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tcc-projects'] });
      toast.success('Projeto TCC removido com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover projeto TCC.'),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const filteredProjects = useMemo(() => {
    let result = tccProjects;
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch) {
      result = result.filter((p) =>
        p.title?.toLowerCase().includes(normalizedSearch) ||
        p.theme?.toLowerCase().includes(normalizedSearch) ||
        p.members?.some((m) => m.student?.name?.toLowerCase().includes(normalizedSearch))
      );
    }
    return result;
  }, [tccProjects, search, statusFilter]);

  useGlobalSearchNavigation({
    entityKey: 'tcc_projects',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      setShowForm(false);
      setSelectedItem(null);
      setSearch(query || '');
      setHighlightedId(recordId || null);
    },
  });

  const handleEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      title: item.title || '',
      theme: item.theme || '',
      description: item.description || '',
      student_ids: item.members?.map((m) => m.student_id) || [],
      advisor_id: item.advisor_id || '',
      co_advisor_id: item.co_advisor_id || '',
      class_id: item.class_id || '',
      subject_id: item.subject_id || '',
      start_date: item.start_date || '',
      expected_end_date: item.expected_end_date || '',
      defense_date: item.defense_date || '',
      status: item.status || 'pendente',
      phase: item.phase || 'selecao_tema',
      objectives: item.objectives || '',
      methodology: item.methodology || '',
      keywords: item.keywords || [],
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleStudent = (studentId) => {
    setFormData((prev) => ({
      ...prev,
      student_ids: prev.student_ids.includes(studentId)
        ? prev.student_ids.filter((id) => id !== studentId)
        : [...prev.student_ids, studentId],
    }));
  };

  const stats = useMemo(() => ({
    total: tccProjects.length,
    pendente: tccProjects.filter((p) => p.status === 'pendente').length,
    em_andamento: tccProjects.filter((p) => p.status === 'em_andamento').length,
    aprovado: tccProjects.filter((p) => p.status === 'aprovado').length,
  }), [tccProjects]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="TCC / Projeto Integrador"
        subtitle={`${tccProjects.length} projeto(s) cadastrado(s)`}
        action={() => { setSelectedItem(null); setFormData(EMPTY_FORM); setShowForm(true); }}
        actionLabel="Novo Projeto"
        actionIcon={Plus}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Total</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Pendentes</p>
            <p className="text-2xl font-semibold text-amber-400">{stats.pendente}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Em Andamento</p>
            <p className="text-2xl font-semibold text-blue-400">{stats.em_andamento}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Aprovados</p>
            <p className="text-2xl font-semibold text-emerald-400">{stats.aprovado}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="app-search-field flex-1 max-w-lg">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, tema, aluno..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(TCC_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map((item) => (
          <Card key={item.id} className={cn("hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white",
            highlightedId === item.id && "ring-2 ring-indigo-300 ring-offset-2")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  <span className="font-medium line-clamp-1">{item.title}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="space-y-2 text-sm text-white/70">
                {item.theme && <p className="line-clamp-1">Tema: {item.theme}</p>}
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{item.members?.length || 0} integrante(s)</span>
                </div>
                {item.advisor && <p>Orientador: {item.advisor.name}</p>}
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10">{TCC_PHASE_LABELS[item.phase] || item.phase}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4">
                <Button variant="ghost" size="icon" onClick={() => setShowDetails(item)}><Eye className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredProjects.length === 0 && (
          <div className="col-span-full text-center py-12 text-white/50">
            Nenhum projeto TCC encontrado.
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar Projeto TCC' : 'Novo Projeto TCC'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Tema</Label>
              <Input value={formData.theme} onChange={(e) => setFormData({ ...formData, theme: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orientador</Label>
                <Select value={formData.advisor_id} onValueChange={(v) => setFormData({ ...formData, advisor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Co-orientador</Label>
                <Select value={formData.co_advisor_id} onValueChange={(v) => setFormData({ ...formData, co_advisor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TCC_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fase</Label>
                <Select value={formData.phase} onValueChange={(v) => setFormData({ ...formData, phase: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TCC_PHASE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Previsão Término</Label>
                <Input type="date" value={formData.expected_end_date} onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data Defesa</Label>
                <Input type="date" value={formData.defense_date} onChange={(e) => setFormData({ ...formData, defense_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Integrantes</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {students.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.student_ids.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      className="rounded"
                    />
                    {s.full_name}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Objetivos</Label>
              <Textarea value={formData.objectives} onChange={(e) => setFormData({ ...formData, objectives: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Metodologia</Label>
              <Textarea value={formData.methodology} onChange={(e) => setFormData({ ...formData, methodology: e.target.value })} rows={3} />
            </div>
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
          <p>Tem certeza que deseja excluir o projeto <strong>{deleteTarget?.title}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDetails} onOpenChange={(open) => { if (!open) setShowDetails(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Projeto TCC</DialogTitle>
          </DialogHeader>
          {showDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Título:</span> {showDetails.title}</div>
                <div><span className="text-muted-foreground">Tema:</span> {showDetails.theme || '—'}</div>
                <div><span className="text-muted-foreground">Orientador:</span> {showDetails.advisor?.name || '—'}</div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={showDetails.status} /></div>
                <div><span className="text-muted-foreground">Fase:</span> {TCC_PHASE_LABELS[showDetails.phase]}</div>
                <div><span className="text-muted-foreground">Integrantes:</span> {showDetails.members?.map((m) => m.student?.name).join(', ') || '—'}</div>
                <div><span className="text-muted-foreground">Início:</span> {showDetails.start_date || '—'}</div>
                <div><span className="text-muted-foreground">Previsão:</span> {showDetails.expected_end_date || '—'}</div>
                <div><span className="text-muted-foreground">Defesa:</span> {showDetails.defense_date || '—'}</div>
              </div>
              {showDetails.description && (
                <div><span className="text-muted-foreground text-sm">Descrição:</span><p className="text-sm mt-1">{showDetails.description}</p></div>
              )}
              {showDetails.objectives && (
                <div><span className="text-muted-foreground text-sm">Objetivos:</span><p className="text-sm mt-1">{showDetails.objectives}</p></div>
              )}
              {showDetails.methodology && (
                <div><span className="text-muted-foreground text-sm">Metodologia:</span><p className="text-sm mt-1">{showDetails.methodology}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
