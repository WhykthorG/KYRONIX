import React, { useDeferredValue, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import { Button } from "@/components/ui/button";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2, BookOpen, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SubjectApi } from '@/services/supabaseApi';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const normalizeOptionalText = (value) => {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionalInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
};

const buildSubjectPayload = (data = {}) => ({
  code: normalizeOptionalText(data.code),
  name: normalizeOptionalText(data.name) ?? '',
  description: normalizeOptionalText(data.description),
  area: normalizeOptionalText(data.area),
  grade_level: normalizeOptionalText(data.grade_level),
  weekly_hours: normalizeOptionalInteger(data.weekly_hours),
  total_hours: normalizeOptionalInteger(data.total_hours),
  syllabus: normalizeOptionalText(data.syllabus),
  objectives: normalizeOptionalText(data.objectives),
  competencies: normalizeOptionalText(data.competencies),
  bibliography: normalizeOptionalText(data.bibliography),
  is_mandatory: data.is_mandatory !== false,
  is_active: data.is_active !== false,
});

export default function Subjects({ globalSearch }) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [showForm, setShowForm] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [highlightedSubjectId, setHighlightedSubjectId] = useState(null);
  const [formData, setFormData] = useState({});
  
  const queryClient = useQueryClient();

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => SubjectApi.list('-created_at'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => SubjectApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setShowForm(false);
      setFormData({});
      toast.success('Disciplina cadastrada com sucesso!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao cadastrar disciplina.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => SubjectApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setShowForm(false);
      setFormData({});
      setSelectedSubject(null);
      toast.success('Disciplina atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao atualizar disciplina.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => SubjectApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Disciplina removida com sucesso!');
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao remover disciplina.');
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = buildSubjectPayload(formData);

    if (selectedSubject) {
      updateMutation.mutate({ id: selectedSubject.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (subject) => {
    setSelectedSubject(subject);
    setFormData(subject);
    setShowForm(true);
  };

  const filteredSubjects = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return subjects.filter((subject) =>
      subject.name?.toLowerCase().includes(normalizedSearch) ||
      subject.code?.toLowerCase().includes(normalizedSearch)
    );
  }, [deferredSearch, subjects]);

  useGlobalSearchNavigation({
    entityKey: 'subjects',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      setShowForm(false);
      setSelectedSubject(null);
      setSearch(query || '');
      setHighlightedSubjectId(recordId || null);
    },
  });

  const areaColors = {
    linguagens: 'bg-blue-100 text-blue-700 border-blue-200',
    matematica: 'bg-purple-100 text-purple-700 border-purple-200',
    ciencias_natureza: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    ciencias_humanas: 'bg-amber-100 text-amber-700 border-amber-200',
    tecnico: 'bg-rose-100 text-rose-700 border-rose-200',
    diversificada: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const areaLabels = {
    linguagens: 'Linguagens',
    matematica: 'Matemática',
    ciencias_natureza: 'Ciências da Natureza',
    ciencias_humanas: 'Ciências Humanas',
    tecnico: 'Técnico',
    diversificada: 'Diversificada',
  };

  const columns = [
    {
      key: 'code',
      label: 'Código',
      render: (row) => (
        <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Disciplina',
      render: (row) => (
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'area',
      label: 'Área',
      render: (row) => (
        <Badge variant="outline" className={areaColors[row.area]}>
          {areaLabels[row.area] || row.area}
        </Badge>
      ),
    },
    {
      key: 'grade_level',
      label: 'Série',
      render: (row) => <span className="text-slate-600">{row.grade_level || '-'}</span>,
    },
    {
      key: 'weekly_hours',
      label: 'Carga Horária',
      render: (row) => (
        <div className="flex items-center gap-1 text-slate-600">
          <Clock className="w-4 h-4" />
          <span>{row.weekly_hours || 0}h/semana</span>
        </div>
      ),
    },
    {
      key: 'is_mandatory',
      label: 'Obrigatória',
      render: (row) => (
        <Badge variant={row.is_mandatory !== false ? 'default' : 'secondary'}>
          {row.is_mandatory !== false ? 'Sim' : 'Não'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(row)} aria-label={`Editar disciplina ${row.name}`} data-tooltip={`Editar disciplina ${row.name}`}>
            <Edit className="w-4 h-4 text-slate-500" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (confirm('Tem certeza que deseja excluir esta disciplina?')) {
                deleteMutation.mutate(row.id);
              }
            }}
            aria-label={`Excluir disciplina ${row.name}`}
            data-tooltip={`Excluir disciplina ${row.name}`}
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
          backTo="/Dashboard"
          backLabel="Dashboard"
        title="Disciplinas"
        subtitle={`${subjects.length} disciplinas cadastradas`}
        action={() => { setSelectedSubject(null); setFormData({}); setShowForm(true); }}
        actionLabel="Nova Disciplina"
      />

      <DataTable
        columns={columns}
        data={filteredSubjects}
        isLoading={isLoading}
        searchPlaceholder="Buscar por nome ou código..."
        searchValue={search}
        onSearchChange={setSearch}
        highlightedRowId={highlightedSubjectId}
        emptyMessage="Nenhuma disciplina encontrada"
      />

      {/* Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedSubject ? 'Editar Disciplina' : 'Nova Disciplina'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Preencha os dados acadêmicos da disciplina antes de salvar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input
                  placeholder="Ex: MAT001"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input
                  placeholder="Ex: Matemática"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Área do Conhecimento</Label>
                <Select
                  value={formData.area || ''}
                  onValueChange={(value) => setFormData({ ...formData, area: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linguagens">Linguagens</SelectItem>
                    <SelectItem value="matematica">Matemática</SelectItem>
                    <SelectItem value="ciencias_natureza">Ciências da Natureza</SelectItem>
                    <SelectItem value="ciencias_humanas">Ciências Humanas</SelectItem>
                    <SelectItem value="tecnico">Técnico</SelectItem>
                    <SelectItem value="diversificada">Diversificada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Série/Ano</Label>
                <Input
                  placeholder="Ex: 9º Ano"
                  value={formData.grade_level || ''}
                  onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Carga Horária Semanal</Label>
                <Input
                  type="number"
                  placeholder="Horas/semana"
                  value={formData.weekly_hours ?? ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    weekly_hours: e.target.value === '' ? null : Number(e.target.value),
                  })}
                />
              </div>
              <div>
                <Label>Carga Horária Total (Anual)</Label>
                <Input
                  type="number"
                  placeholder="Horas/ano"
                  value={formData.total_hours ?? ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    total_hours: e.target.value === '' ? null : Number(e.target.value),
                  })}
                />
              </div>
            </div>
            <div>
              <Label>Ementa</Label>
              <Textarea
                placeholder="Descrição da disciplina..."
                value={formData.syllabus || ''}
                onChange={(e) => setFormData({ ...formData, syllabus: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_mandatory !== false}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked })}
                  aria-label="Disciplina obrigatória"
                  data-tooltip="Disciplina obrigatória"
                />
                <Label>Disciplina obrigatória</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active !== false}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  aria-label="Disciplina ativa"
                  data-tooltip="Disciplina ativa"
                />
                <Label>Ativa</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={isSaving}>
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : (selectedSubject ? 'Salvar Alterações' : 'Cadastrar Disciplina')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
