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
import { Loader2, Edit, Trash2, FlaskConical, Plus, Search, Calendar, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { LaboratoryApi, LabReservationApi, LabEquipmentApi } from '@/services/supabaseApi';
import { LAB_STATUSES, LAB_STATUS_LABELS } from '@shared/contracts/laboratory';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const EMPTY_FORM = {
  name: '',
  code: '',
  location: '',
  capacity: 0,
  description: '',
  resources: '',
  status: 'disponivel',
  rules: '',
};

export default function Laboratories({ globalSearch }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [showDetails, setShowDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('labs');
  const queryClient = useQueryClient();

  const { data: laboratories = [], isLoading } = useQuery({
    queryKey: ['laboratories'],
    queryFn: () => LaboratoryApi.list('name'),
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['lab-reservations'],
    queryFn: () => LabReservationApi.list('-date'),
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ['lab-equipment'],
    queryFn: () => LabEquipmentApi.list('name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => LaboratoryApi.create(data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratories'] });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      toast.success('Laboratório criado com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao criar laboratório.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => LaboratoryApi.update(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratories'] });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      setSelectedItem(null);
      toast.success('Laboratório atualizado com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao atualizar laboratório.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => LaboratoryApi.delete(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laboratories'] });
      toast.success('Laboratório removido com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover laboratório.'),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const filteredLabs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return laboratories;
    return laboratories.filter((l) =>
      l.name?.toLowerCase().includes(normalizedSearch) ||
      l.code?.toLowerCase().includes(normalizedSearch) ||
      l.location?.toLowerCase().includes(normalizedSearch)
    );
  }, [laboratories, search]);

  useGlobalSearchNavigation({
    entityKey: 'laboratories',
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
      code: item.code || '',
      location: item.location || '',
      capacity: item.capacity || 0,
      description: item.description || '',
      resources: item.resources || '',
      status: item.status || 'disponivel',
      rules: item.rules || '',
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
    total: laboratories.length,
    disponivel: laboratories.filter((l) => l.status === 'disponivel').length,
    em_uso: laboratories.filter((l) => l.status === 'em_uso').length,
    manutencao: laboratories.filter((l) => l.status === 'manutencao').length,
  }), [laboratories]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratórios"
        subtitle={`${laboratories.length} laboratório(s) cadastrado(s)`}
        action={() => { setSelectedItem(null); setFormData(EMPTY_FORM); setShowForm(true); }}
        actionLabel="Novo Laboratório"
        actionIcon={Plus}
      />

      <div className="flex gap-2 border-b pb-2">
        <Button variant={activeTab === 'labs' ? 'default' : 'ghost'} onClick={() => setActiveTab('labs')}>
          <FlaskConical className="w-4 h-4 mr-2" /> Laboratórios
        </Button>
        <Button variant={activeTab === 'reservations' ? 'default' : 'ghost'} onClick={() => setActiveTab('reservations')}>
          <Calendar className="w-4 h-4 mr-2" /> Reservas
        </Button>
        <Button variant={activeTab === 'equipment' ? 'default' : 'ghost'} onClick={() => setActiveTab('equipment')}>
          <Wrench className="w-4 h-4 mr-2" /> Equipamentos
        </Button>
      </div>

      {activeTab === 'labs' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Total</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Disponíveis</p>
                <p className="text-2xl font-semibold text-emerald-400">{stats.disponivel}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Em Uso</p>
                <p className="text-2xl font-semibold text-blue-400">{stats.em_uso}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Manutenção</p>
                <p className="text-2xl font-semibold text-amber-400">{stats.manutencao}</p>
              </CardContent>
            </Card>
          </div>

          <div className="app-search-field max-w-lg">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código, local..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLabs.map((item) => (
              <Card key={item.id} className={cn("hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white",
                highlightedId === item.id && "ring-2 ring-indigo-300 ring-offset-2")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-5 h-5 text-cyan-400" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="space-y-1 text-sm text-white/70">
                    {item.code && <p>Código: {item.code}</p>}
                    {item.location && <p>Local: {item.location}</p>}
                    {item.capacity > 0 && <p>Capacidade: {item.capacity} pessoas</p>}
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <Button variant="ghost" size="icon" onClick={() => setShowDetails(item)}><Search className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredLabs.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/50">
                Nenhum laboratório encontrado.
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'reservations' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="app-search-field flex-1 max-w-lg">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar reserva..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
            </div>
            <Button onClick={() => { setSelectedItem(null); setFormData({}); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Nova Reserva
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reservations.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-400" />
                      <span className="font-medium">{item.title || 'Reserva'}</span>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="space-y-1 text-sm text-white/70">
                    <p>Laboratório: {item.lab?.name || '—'}</p>
                    <p>Data: {item.date}</p>
                    <p>Horário: {item.start_time} - {item.end_time}</p>
                    {item.students_expected > 0 && <p>Alunos: {item.students_expected}</p>}
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'reservation', item })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {reservations.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/50">
                Nenhuma reserva encontrada.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="app-search-field flex-1 max-w-lg">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar equipamento..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
            </div>
            <Button onClick={() => { setSelectedItem(null); setFormData({}); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Novo Equipamento
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipment.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-amber-400" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="space-y-1 text-sm text-white/70">
                    {item.lab && <p>Laboratório: {item.lab.name}</p>}
                    {item.brand && <p>Marca: {item.brand}</p>}
                    {item.model && <p>Modelo: {item.model}</p>}
                    {item.quantity > 1 && <p>Quantidade: {item.quantity}</p>}
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'equipment', item })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {equipment.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/50">
                Nenhum equipamento encontrado.
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar Laboratório' : 'Novo Laboratório'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LAB_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Localização</Label>
                <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Recursos Disponíveis</Label>
              <Textarea value={formData.resources} onChange={(e) => setFormData({ ...formData, resources: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Regras de Uso</Label>
              <Textarea value={formData.rules} onChange={(e) => setFormData({ ...formData, rules: e.target.value })} rows={3} />
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

      <Dialog open={!!deleteTarget} onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja excluir o laboratório <strong>{deleteTarget?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDetails} onOpenChange={(isOpen) => { if (!isOpen) setShowDetails(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Laboratório</DialogTitle>
          </DialogHeader>
          {showDetails && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-muted-foreground">Nome:</span> {showDetails.name}</div>
                <div><span className="text-muted-foreground">Código:</span> {showDetails.code || '—'}</div>
                <div><span className="text-muted-foreground">Local:</span> {showDetails.location || '—'}</div>
                <div><span className="text-muted-foreground">Capacidade:</span> {showDetails.capacity || '—'}</div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={showDetails.status} /></div>
              </div>
              {showDetails.description && (
                <div><span className="text-muted-foreground">Descrição:</span><p className="mt-1">{showDetails.description}</p></div>
              )}
              {showDetails.resources && (
                <div><span className="text-muted-foreground">Recursos:</span><p className="mt-1">{showDetails.resources}</p></div>
              )}
              {showDetails.rules && (
                <div><span className="text-muted-foreground">Regras:</span><p className="mt-1">{showDetails.rules}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
