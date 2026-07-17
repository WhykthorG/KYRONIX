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
import { Loader2, Edit, Trash2, Briefcase, Building2, Plus, Search, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { InternshipApi, InternshipCompanyApi, UserProfileApi } from '@/services/supabaseApi';
import { INTERNSHIP_STATUSES, INTERNSHIP_STATUS_LABELS, getInternshipStatusLabel } from '@shared/contracts/internship';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const EMPTY_FORM = {
  student_id: '',
  company_id: '',
  supervisor_id: '',
  teacher_advisor_id: '',
  class_id: '',
  subject_id: '',
  start_date: '',
  end_date: '',
  status: 'pendente',
  hours_required: 0,
  hours_completed: 0,
  description: '',
  objectives: '',
  activities: '',
};

export default function Internships({ globalSearch }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDetails, setShowDetails] = useState(null);
  const queryClient = useQueryClient();

  const { data: internships = [], isLoading } = useQuery({
    queryKey: ['internships'],
    queryFn: () => InternshipApi.list('-created_at'),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['internship-companies'],
    queryFn: () => InternshipCompanyApi.list('name'),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => UserProfileApi.filter({ profile_type: 'aluno' }, 'full_name', 500),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: () => UserProfileApi.filter({ profile_type: 'professor' }, 'full_name', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => InternshipApi.create(data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internships'] });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      toast.success('Estágio criado com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao criar estágio.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => InternshipApi.update(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internships'] });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      setSelectedItem(null);
      toast.success('Estágio atualizado com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao atualizar estágio.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => InternshipApi.delete(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internships'] });
      toast.success('Estágio removido com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover estágio.'),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const filteredInternships = useMemo(() => {
    let result = internships;
    if (statusFilter !== 'all') {
      result = result.filter((i) => i.status === statusFilter);
    }
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch) {
      result = result.filter((i) =>
        i.student?.full_name?.toLowerCase().includes(normalizedSearch) ||
        i.company?.name?.toLowerCase().includes(normalizedSearch) ||
        i.description?.toLowerCase().includes(normalizedSearch)
      );
    }
    return result;
  }, [internships, search, statusFilter]);

  useGlobalSearchNavigation({
    entityKey: 'internships',
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
      student_id: item.student_id || '',
      company_id: item.company_id || '',
      supervisor_id: item.supervisor_id || '',
      teacher_advisor_id: item.teacher_advisor_id || '',
      class_id: item.class_id || '',
      subject_id: item.subject_id || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      status: item.status || 'pendente',
      hours_required: item.hours_required || 0,
      hours_completed: item.hours_completed || 0,
      description: item.description || '',
      objectives: item.objectives || '',
      activities: item.activities || '',
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

  const stats = useMemo(() => ({
    total: internships.length,
    pendente: internships.filter((i) => i.status === 'pendente').length,
    em_andamento: internships.filter((i) => i.status === 'em_andamento').length,
    concluido: internships.filter((i) => i.status === 'concluido').length,
  }), [internships]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estágios Supervisionados"
        subtitle={`${internships.length} estágio(s) cadastrado(s)`}
        action={() => { setSelectedItem(null); setFormData(EMPTY_FORM); setShowForm(true); }}
        actionLabel="Novo Estágio"
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
            <p className="text-xs uppercase text-white/45">Concluídos</p>
            <p className="text-2xl font-semibold text-emerald-400">{stats.concluido}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="app-search-field flex-1 max-w-lg">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por aluno, empresa..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(INTERNSHIP_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInternships.map((item) => (
          <Card key={item.id} className={cn("hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white",
            highlightedId === item.id && "ring-2 ring-indigo-300 ring-offset-2")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-indigo-400" />
                  <span className="font-medium">{item.student?.full_name || 'Aluno não informado'}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="space-y-2 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span>{item.company?.name || 'Empresa não informada'}</span>
                </div>
                <p>{item.start_date} {item.end_date ? `— ${item.end_date}` : ''}</p>
                <p>{item.hours_completed || 0}/{item.hours_required || 0} horas</p>
                {item.hours_required > 0 && (
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(100, (item.hours_completed / item.hours_required) * 100)}%` }} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 mt-4">
                <Button variant="ghost" size="icon" onClick={() => setShowDetails(item)}><Eye className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredInternships.length === 0 && (
          <div className="col-span-full text-center py-12 text-white/50">
            Nenhum estágio encontrado.
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar Estágio' : 'Novo Estágio'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label>Empresa</Label>
                <Select value={formData.company_id} onValueChange={(v) => setFormData({ ...formData, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Orientador (Professor)</Label>
                <Select value={formData.teacher_advisor_id} onValueChange={(v) => setFormData({ ...formData, teacher_advisor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTERNSHIP_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Horas Necessárias</Label>
                <Input type="number" value={formData.hours_required} onChange={(e) => setFormData({ ...formData, hours_required: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Horas Cumpridas</Label>
                <Input type="number" value={formData.hours_completed} onChange={(e) => setFormData({ ...formData, hours_completed: Number(e.target.value) })} />
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
          <p>Tem certeza que deseja excluir o estágio de <strong>{deleteTarget?.student?.full_name}</strong>?</p>
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
            <DialogTitle>Detalhes do Estágio</DialogTitle>
          </DialogHeader>
          {showDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Aluno:</span> {showDetails.student?.full_name}</div>
                <div><span className="text-muted-foreground">Empresa:</span> {showDetails.company?.name || '—'}</div>
                <div><span className="text-muted-foreground">Orientador:</span> {showDetails.teacher_advisor?.name || '—'}</div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={showDetails.status} /></div>
                <div><span className="text-muted-foreground">Início:</span> {showDetails.start_date}</div>
                <div><span className="text-muted-foreground">Fim:</span> {showDetails.end_date || '—'}</div>
                <div><span className="text-muted-foreground">Horas:</span> {showDetails.hours_completed || 0}/{showDetails.hours_required || 0}</div>
              </div>
              {showDetails.description && (
                <div><span className="text-muted-foreground text-sm">Descrição:</span><p className="text-sm mt-1">{showDetails.description}</p></div>
              )}
              {showDetails.objectives && (
                <div><span className="text-muted-foreground text-sm">Objetivos:</span><p className="text-sm mt-1">{showDetails.objectives}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
