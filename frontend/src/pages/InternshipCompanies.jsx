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
import { Loader2, Edit, Trash2, Building2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { InternshipCompanyApi } from '@/services/supabaseApi';
import { COMPANY_STATUSES, COMPANY_STATUS_LABELS } from '@shared/contracts/internship';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const EMPTY_FORM = {
  name: '',
  cnpj: '',
  phone: '',
  email: '',
  contact_name: '',
  contact_role: '',
  partnership_date: '',
  status: 'ativa',
  notes: '',
};

export default function InternshipCompanies({ globalSearch }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['internship-companies'],
    queryFn: () => InternshipCompanyApi.list('-created_at'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => InternshipCompanyApi.create(data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internship-companies'] });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      toast.success('Empresa criada com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao criar empresa.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => InternshipCompanyApi.update(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internship-companies'] });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      setSelectedItem(null);
      toast.success('Empresa atualizada com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao atualizar empresa.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => InternshipCompanyApi.delete(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internship-companies'] });
      toast.success('Empresa removida com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover empresa.'),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const filteredCompanies = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return companies;
    return companies.filter((c) =>
      c.name?.toLowerCase().includes(normalizedSearch) ||
      c.cnpj?.includes(normalizedSearch) ||
      c.contact_name?.toLowerCase().includes(normalizedSearch)
    );
  }, [companies, search]);

  useGlobalSearchNavigation({
    entityKey: 'internship_companies',
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
      name: item.name || '',
      cnpj: item.cnpj || '',
      phone: item.phone || '',
      email: item.email || '',
      contact_name: item.contact_name || '',
      contact_role: item.contact_role || '',
      partnership_date: item.partnership_date || '',
      status: item.status || 'ativa',
      notes: item.notes || '',
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas Conveniadas"
        subtitle={`${companies.length} empresa(s) cadastrada(s)`}
        action={() => { setSelectedItem(null); setFormData(EMPTY_FORM); setShowForm(true); }}
        actionLabel="Nova Empresa"
        actionIcon={Plus}
      />

      <div className="app-search-field max-w-lg">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, CNPJ, contato..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCompanies.map((item) => (
          <Card key={item.id} className={cn("hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white",
            highlightedId === item.id && "ring-2 ring-indigo-300 ring-offset-2")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-medium">{item.name}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="space-y-1 text-sm text-white/70">
                {item.cnpj && <p>CNPJ: {item.cnpj}</p>}
                {item.contact_name && <p>Contato: {item.contact_name}</p>}
                {item.email && <p>Email: {item.email}</p>}
                {item.phone && <p>Tel: {item.phone}</p>}
              </div>
              <div className="flex items-center gap-1 mt-4">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredCompanies.length === 0 && (
          <div className="col-span-full text-center py-12 text-white/50">
            Nenhuma empresa encontrada.
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPANY_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Contato</Label>
                <Input value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cargo do Contato</Label>
                <Input value={formData.contact_role} onChange={(e) => setFormData({ ...formData, contact_role: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data de Convênio</Label>
              <Input type="date" value={formData.partnership_date} onChange={(e) => setFormData({ ...formData, partnership_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
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
          <p>Tem certeza que deseja excluir a empresa <strong>{deleteTarget?.name}</strong>?</p>
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
