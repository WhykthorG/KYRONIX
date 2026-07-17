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
import { Loader2, Edit, Trash2, Award, Plus, Search, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { CertificateApi, UserProfileApi } from '@/services/supabaseApi';
import {
  CERTIFICATE_TYPES, CERTIFICATE_TYPE_LABELS,
  CERTIFICATE_STATUSES, CERTIFICATE_STATUS_LABELS,
} from '@shared/contracts/certificate';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const EMPTY_FORM = {
  student_id: '',
  type: 'declaracao',
  title: '',
  description: '',
  issue_date: new Date().toISOString().slice(0, 10),
  valid_until: '',
  status: 'emitido',
};

export default function Certificates({ globalSearch }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => CertificateApi.list('-issue_date'),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-list'],
    queryFn: () => UserProfileApi.filter({ profile_type: 'aluno' }, 'full_name', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => CertificateApi.create(data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      toast.success('Certificado emitido com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao emitir certificado.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => CertificateApi.delete(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      toast.success('Certificado removido com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover certificado.'),
  });

  const isSaving = createMutation.isPending;

  const filteredCertificates = useMemo(() => {
    let result = certificates;
    if (typeFilter !== 'all') {
      result = result.filter((c) => c.type === typeFilter);
    }
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch) {
      result = result.filter((c) =>
        c.student?.name?.toLowerCase().includes(normalizedSearch) ||
        c.title?.toLowerCase().includes(normalizedSearch) ||
        c.series_number?.toLowerCase().includes(normalizedSearch)
      );
    }
    return result;
  }, [certificates, search, typeFilter]);

  useGlobalSearchNavigation({
    entityKey: 'certificates',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query }) => {
      setSearch(query || '');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const stats = useMemo(() => ({
    total: certificates.length,
    conclusao: certificates.filter((c) => c.type === 'conclusao').length,
    declaracao: certificates.filter((c) => c.type === 'declaracao').length,
    historico: certificates.filter((c) => c.type === 'historico').length,
  }), [certificates]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificados"
        subtitle={`${certificates.length} certificado(s) emitido(s)`}
        action={() => { setSelectedItem(null); setFormData(EMPTY_FORM); setShowForm(true); }}
        actionLabel="Novo Certificado"
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
            <p className="text-xs uppercase text-white/45">Conclusão</p>
            <p className="text-2xl font-semibold text-emerald-400">{stats.conclusao}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Declarações</p>
            <p className="text-2xl font-semibold text-blue-400">{stats.declaracao}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-white/45">Históricos</p>
            <p className="text-2xl font-semibold text-purple-400">{stats.historico}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="app-search-field flex-1 max-w-lg">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por aluno, título, nº série..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(CERTIFICATE_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCertificates.map((item) => (
          <Card key={item.id} className={cn("hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white",
            highlightedId === item.id && "ring-2 ring-indigo-300 ring-offset-2")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-400" />
                  <span className="font-medium line-clamp-1">{item.title}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="space-y-1 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>{CERTIFICATE_TYPE_LABELS[item.type] || item.type}</span>
                </div>
                <p>Aluno: {item.student?.name || '—'}</p>
                <p>Emitido: {item.issue_date}</p>
                {item.series_number && <p>Nº Série: {item.series_number}</p>}
              </div>
              <div className="flex items-center gap-1 mt-4">
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredCertificates.length === 0 && (
          <div className="col-span-full text-center py-12 text-white/50">
            Nenhum certificado encontrado.
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar Certificado' : 'Novo Certificado'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CERTIFICATE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CERTIFICATE_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Emissão</Label>
                <Input type="date" value={formData.issue_date} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Válido até</Label>
                <Input type="date" value={formData.valid_until} onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={isSaving}>
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Emitindo...</> : 'Emitir'}
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
          <p>Tem certeza que deseja excluir este certificado?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
