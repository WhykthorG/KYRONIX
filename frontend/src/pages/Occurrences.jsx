import React, { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  Loader2,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';
import DataTable from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { OccurrenceApi, StudentApi } from '@/services/supabaseApi';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const OCCURRENCE_TYPES = [
  { value: 'disciplinar', label: 'Disciplinar' },
  { value: 'comportamental', label: 'Comportamental' },
  { value: 'observacao', label: 'Observação' },
  { value: 'elogio', label: 'Elogio' },
  { value: 'outro', label: 'Outro' },
];

const OCCURRENCE_TYPE_LABELS = Object.fromEntries(
  OCCURRENCE_TYPES.map((item) => [item.value, item.label])
);

const SEVERITY_CONFIG = {
  leve: {
    label: 'Leve',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  moderada: {
    label: 'Moderada',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  grave: {
    label: 'Grave',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  critica: {
    label: 'Crítica',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

const STATUS_CONFIG = {
  aberta: {
    label: 'Aberta',
    className: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  em_acompanhamento: {
    label: 'Em acompanhamento',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  resolvida: {
    label: 'Resolvida',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  arquivada: {
    label: 'Arquivada',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

const EMPTY_FORM = {
  student_id: '',
  title: '',
  type: 'disciplinar',
  description: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  severity: 'leve',
  status: 'aberta',
};

const normalizeSearch = (value) => (
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, 'dd/MM/yyyy');
};

const buildOccurrencePayload = (formData) => ({
  student_id: formData.student_id,
  title: formData.title.trim(),
  type: formData.type,
  description: formData.description.trim(),
  date: formData.date,
  severity: formData.severity,
  status: formData.status,
});

function InfoCard({ icon: Icon, label, value, tone = 'default' }) {
  const toneClassName = {
    default: 'bg-white border-border/70 text-foreground',
    info: 'bg-sky-50 border-sky-200 text-sky-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    danger: 'bg-rose-50 border-rose-200 text-rose-700',
  }[tone];

  return (
    <Card className={cn('border shadow-none', toneClassName)}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-2xl bg-black/5 p-3">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Occurrences({ globalSearch }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [detailsOccurrence, setDetailsOccurrence] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [highlightedOccurrenceId, setHighlightedOccurrenceId] = useState(null);

  const { data: occurrences = [], isLoading: isLoadingOccurrences } = useQuery({
    queryKey: ['occurrences'],
    queryFn: () => OccurrenceApi.list('-date', 300),
  });

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: () => StudentApi.list('-created_at', 500),
  });

  const studentsById = useMemo(
    () => Object.fromEntries(students.map((student) => [student.id, student])),
    [students]
  );

  const orderedStudents = useMemo(
    () => [...students].sort((left, right) => (
      String(left.full_name ?? '').localeCompare(String(right.full_name ?? ''), 'pt-BR')
    )),
    [students]
  );

  const createMutation = useMutation({
    mutationFn: (payload) => OccurrenceApi.create(payload),
    onSuccess: (createdOccurrence) => {
      queryClient.invalidateQueries({ queryKey: ['occurrences'] });
      setHighlightedOccurrenceId(createdOccurrence?.id ?? null);
      setShowForm(false);
      setSelectedOccurrence(null);
      setFormData(EMPTY_FORM);
      toast.success('Ocorrência registrada com sucesso.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => OccurrenceApi.update(id, payload),
    onSuccess: (updatedOccurrence) => {
      queryClient.invalidateQueries({ queryKey: ['occurrences'] });
      setHighlightedOccurrenceId(updatedOccurrence?.id ?? null);
      setShowForm(false);
      setSelectedOccurrence(null);
      setFormData(EMPTY_FORM);
      toast.success('Ocorrência atualizada com sucesso.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => OccurrenceApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occurrences'] });
      setHighlightedOccurrenceId(null);
      setDetailsOccurrence(null);
      toast.success('Ocorrência removida com sucesso.');
    },
  });

  const normalizedSearch = normalizeSearch(deferredSearch);
  const isLoading = isLoadingOccurrences || isLoadingStudents;

  const filteredOccurrences = useMemo(() => {
    return occurrences.filter((occurrence) => {
      const student = studentsById[occurrence.student_id];
      const searchText = normalizeSearch([
        occurrence.title,
        occurrence.description,
        occurrence.type,
        occurrence.severity,
        occurrence.status,
        occurrence.date,
        occurrence.reporter_name,
        student?.full_name,
        student?.registration_number,
      ].filter(Boolean).join(' '));

      if (normalizedSearch && !searchText.includes(normalizedSearch)) {
        return false;
      }

      if (severityFilter !== 'all' && occurrence.severity !== severityFilter) {
        return false;
      }

      if (statusFilter !== 'all' && occurrence.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== 'all' && occurrence.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [normalizedSearch, occurrences, severityFilter, statusFilter, studentsById, typeFilter]);

  const openCreateDialog = () => {
    setSelectedOccurrence(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditDialog = (occurrence) => {
    setSelectedOccurrence(occurrence);
    setFormData({
      student_id: occurrence.student_id ?? '',
      title: occurrence.title ?? '',
      type: occurrence.type ?? 'disciplinar',
      description: occurrence.description ?? '',
      date: occurrence.date ?? format(new Date(), 'yyyy-MM-dd'),
      severity: occurrence.severity ?? 'leve',
      status: occurrence.status ?? 'aberta',
    });
    setShowForm(true);
  };

  const handleDelete = (occurrence) => {
    const confirmed = window.confirm(
      `Excluir a ocorrência "${occurrence.title}" de ${studentsById[occurrence.student_id]?.full_name || 'aluno'}?`
    );
    if (!confirmed) return;
    deleteMutation.mutate(occurrence.id);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formData.student_id) {
      toast.error('Selecione um aluno para registrar a ocorrência.');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Informe um título curto para a ocorrência.');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('Descreva a ocorrência para acompanhamento da equipe.');
      return;
    }

    if (!formData.date) {
      toast.error('Informe a data da ocorrência.');
      return;
    }

    const payload = buildOccurrencePayload(formData);

    if (selectedOccurrence) {
      updateMutation.mutate({ id: selectedOccurrence.id, payload });
      return;
    }

    createMutation.mutate({
      ...payload,
      reporter_id: user?.id ?? null,
      reporter_name: user?.user_metadata?.full_name || user?.email || 'Equipe pedagógica',
    });
  };

  const currentStats = useMemo(() => ({
    total: filteredOccurrences.length,
    open: filteredOccurrences.filter((occurrence) => occurrence.status === 'aberta').length,
    critical: filteredOccurrences.filter((occurrence) => ['grave', 'critica'].includes(occurrence.severity)).length,
    resolved: filteredOccurrences.filter((occurrence) => occurrence.status === 'resolvida').length,
  }), [filteredOccurrences]);

  const columns = useMemo(() => ([
    {
      key: 'date',
      label: 'Data',
      render: (occurrence) => (
        <div className="text-sm font-medium text-slate-700">
          {formatDate(occurrence.date)}
        </div>
      ),
    },
    {
      key: 'student',
      label: 'Aluno',
      render: (occurrence) => {
        const student = studentsById[occurrence.student_id];
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">
              {student?.full_name || 'Aluno não encontrado'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {student?.registration_number ? `Matrícula ${student.registration_number}` : 'Sem matrícula'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'title',
      label: 'Ocorrência',
      render: (occurrence) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{occurrence.title}</p>
          <p className="line-clamp-2 text-xs text-slate-500">
            {occurrence.description || 'Sem descrição.'}
          </p>
        </div>
      ),
      className: 'min-w-[280px]',
    },
    {
      key: 'type',
      label: 'Tipo',
      render: (occurrence) => (
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
          {OCCURRENCE_TYPE_LABELS[occurrence.type] || occurrence.type || 'Não informado'}
        </Badge>
      ),
    },
    {
      key: 'severity',
      label: 'Severidade',
      render: (occurrence) => {
        const config = SEVERITY_CONFIG[occurrence.severity];
        return (
          <Badge variant="outline" className={config?.className}>
            {config?.label || occurrence.severity || 'Não informada'}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (occurrence) => {
        const config = STATUS_CONFIG[occurrence.status];
        return (
          <Badge variant="outline" className={config?.className}>
            {config?.label || occurrence.status || 'Sem status'}
          </Badge>
        );
      },
    },
    {
      key: 'reporter_name',
      label: 'Registrado por',
      render: (occurrence) => (
        <div className="text-sm text-slate-600">
          {occurrence.reporter_name || 'Equipe pedagógica'}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[120px] text-right',
      cellClassName: 'text-right',
      render: (occurrence) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              setDetailsOccurrence(occurrence);
            }}
            aria-label={`Ver ocorrência ${occurrence.title}`}
            data-tooltip={`Ver ocorrência ${occurrence.title}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              openEditDialog(occurrence);
            }}
            aria-label={`Editar ocorrência ${occurrence.title}`}
            data-tooltip={`Editar ocorrência ${occurrence.title}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-rose-600 hover:text-rose-700"
            onClick={(event) => {
              event.stopPropagation();
              handleDelete(occurrence);
            }}
            aria-label={`Excluir ocorrência ${occurrence.title}`}
            data-tooltip={`Excluir ocorrência ${occurrence.title}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]), [studentsById]);

  useGlobalSearchNavigation({
    entityKey: 'occurrences',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      setSearch(query || '');
      setSeverityFilter('all');
      setStatusFilter('all');
      setTypeFilter('all');
      setHighlightedOccurrenceId(recordId || null);
      setShowForm(false);
      setSelectedOccurrence(null);
      setDetailsOccurrence(null);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/Dashboard"
        backLabel="Dashboard"
        title="Ocorrências"
        subtitle="Registre e acompanhe ocorrências disciplinares e observações comportamentais dos alunos."
        action={openCreateDialog}
        actionLabel="Nova Ocorrência"
        actionIcon={Plus}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard icon={AlertTriangle} label="Ocorrências visíveis" value={currentStats.total} tone="info" />
        <InfoCard icon={Clock} label="Em aberto" value={currentStats.open} tone="warning" />
        <InfoCard icon={Shield} label="Graves / Críticas" value={currentStats.critical} tone="danger" />
        <InfoCard icon={CheckCircle} label="Resolvidas" value={currentStats.resolved} tone="success" />
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-2 xl:col-span-1">
            <Label>Filtrar por tipo</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {OCCURRENCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Filtrar por severidade</Label>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as severidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as severidades</SelectItem>
                {Object.entries(SEVERITY_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Filtrar por status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setTypeFilter('all');
                setSeverityFilter('all');
                setStatusFilter('all');
                setSearch('');
                setHighlightedOccurrenceId(null);
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredOccurrences}
        isLoading={isLoading}
        searchPlaceholder="Buscar por aluno, ocorrência, descrição, tipo, severidade ou responsável..."
        searchValue={search}
        onSearchChange={setSearch}
        emptyMessage="Nenhuma ocorrência corresponde aos filtros atuais."
        onRowClick={(occurrence) => setDetailsOccurrence(occurrence)}
        highlightedRowId={highlightedOccurrenceId}
      />

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) {
            setSelectedOccurrence(null);
            setFormData(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedOccurrence ? 'Editar ocorrência' : 'Nova ocorrência'}
            </DialogTitle>
            <DialogDescription>
              Registre a situação para acompanhamento da equipe pedagógica.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Aluno</Label>
                <Select
                  value={formData.student_id}
                  onValueChange={(value) => setFormData((current) => ({ ...current, student_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={formData.title}
                  onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Resumo curto da ocorrência"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData((current) => ({ ...current, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCURRENCE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Severidade</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value) => setFormData((current) => ({ ...current, severity: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a severidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((current) => ({ ...current, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                placeholder="Descreva o comportamento, o contexto e os próximos passos."
                rows={6}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setSelectedOccurrence(null);
                  setFormData(EMPTY_FORM);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedOccurrence ? 'Salvar alterações' : 'Registrar ocorrência'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailsOccurrence)}
        onOpenChange={(open) => {
          if (!open) setDetailsOccurrence(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{detailsOccurrence?.title || 'Detalhes da ocorrência'}</DialogTitle>
            <DialogDescription>
              Histórico para acompanhamento pedagógico do aluno.
            </DialogDescription>
          </DialogHeader>

          {detailsOccurrence && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardContent className="space-y-1 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Aluno
                    </p>
                    <p className="font-medium text-slate-900">
                      {studentsById[detailsOccurrence.student_id]?.full_name || 'Aluno não encontrado'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-1 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Data
                    </p>
                    <p className="font-medium text-slate-900">{formatDate(detailsOccurrence.date)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-1 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Severidade
                    </p>
                    <div>
                      <Badge variant="outline" className={SEVERITY_CONFIG[detailsOccurrence.severity]?.className}>
                        {SEVERITY_CONFIG[detailsOccurrence.severity]?.label || detailsOccurrence.severity}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-1 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Status
                    </p>
                    <div>
                      <Badge variant="outline" className={STATUS_CONFIG[detailsOccurrence.status]?.className}>
                        {STATUS_CONFIG[detailsOccurrence.status]?.label || detailsOccurrence.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Tipo
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {OCCURRENCE_TYPE_LABELS[detailsOccurrence.type] || detailsOccurrence.type || 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Registrado por
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {detailsOccurrence.reporter_name || 'Equipe pedagógica'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Atualização
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatDate(detailsOccurrence.updated_at?.slice(0, 10))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Criada em
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {detailsOccurrence.created_at
                          ? format(new Date(detailsOccurrence.created_at), 'dd/MM/yyyy HH:mm')
                          : '-'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="space-y-2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Descrição completa
                  </p>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
                    {detailsOccurrence.description || 'Sem descrição.'}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
