// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Edit, Trash2, Loader2, UserPlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { ClassApi, StudentApi, TeacherApi, UserProfileApi } from '@/services/supabaseApi';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

export default function Classes({ globalSearch }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [formData, setFormData] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [studentToAssignId, setStudentToAssignId] = useState('');
  const [search, setSearch] = useState('');
  const [highlightedClassId, setHighlightedClassId] = useState(null);

  const queryClient = useQueryClient();

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list('-created_at'),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => TeacherApi.list(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => StudentApi.list('-created_at', 500),
  });

  // Fetch coordinators/admins from user_profiles so they appear in the coordinator dropdown
  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: async () => {
      const all = await UserProfileApi.list();
      return all.filter(p => ['coordenador', 'administrador'].includes(p.profile_type));
    },
  });

  // Merge teachers + staff into a unified coordinator list (deduplicated by email)
  const coordinatorOptions = useMemo(() => {
    const map = new Map();
    teachers.forEach(t => map.set(t.email, { id: t.id, full_name: t.full_name, email: t.email, source: 'teacher' }));
    staffProfiles.forEach(p => {
      if (!map.has(p.user_email)) {
        map.set(p.user_email, { id: p.id, full_name: p.full_name, email: p.user_email, source: 'profile' });
      }
    });
    return Array.from(map.values());
  }, [teachers, staffProfiles]);

  const createMutation = useMutation({
    mutationFn: (data) => ClassApi.create(data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setShowForm(false);
      setFormData({});
      toast.success('Turma criada com sucesso!');
    },
    onError: (err) => {
      toast.error(err.message ?? 'Erro ao criar turma.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => ClassApi.update(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setShowForm(false);
      setFormData({});
      setSelectedClass(null);
      toast.success('Turma atualizada com sucesso!');
    },
    onError: (err) => {
      toast.error(err.message ?? 'Erro ao atualizar turma.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => ClassApi.delete(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Turma removida com sucesso!');
    },
    onError: (err) => {
      toast.error(err.message ?? 'Erro ao remover turma.');
    },
  });

  const classStudentCounts = useMemo(() => {
    const counts = new Map();

    students.forEach((student) => {
      if (!student.current_class_id) return;
      counts.set(student.current_class_id, (counts.get(student.current_class_id) || 0) + 1);
    });

    return counts;
  }, [students]);

  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClass?.id) return [];

    return students
      .filter((student) => student.current_class_id === selectedClass.id)
      .sort((left, right) => left.full_name.localeCompare(right.full_name, 'pt-BR'));
  }, [selectedClass, students]);

  const assignableStudents = useMemo(() => {
    if (!selectedClass?.id) return [];

    return students
      .filter((student) => {
        if (student.current_class_id === selectedClass.id) return false;
        if (['formado', 'transferido', 'evadido'].includes(student.enrollment_status)) return false;
        return true;
      })
      .sort((left, right) => left.full_name.localeCompare(right.full_name, 'pt-BR'));
  }, [selectedClass, students]);

  const assignStudentMutation = useMutation({
    mutationFn: async ({ classRecord, studentRecord }) => {
      const previousClassId = studentRecord.current_class_id;
      const currentTargetCount = classStudentCounts.get(classRecord.id) ?? classRecord.current_students ?? 0;
      const updates = [
        StudentApi.update(studentRecord.id, {
          current_class_id: classRecord.id,
          current_grade: classRecord.grade_level || studentRecord.current_grade,
          shift: classRecord.shift || studentRecord.shift,
        }),
        ClassApi.update(classRecord.id, {
          current_students: currentTargetCount + 1,
        }),
      ];

      if (previousClassId && previousClassId !== classRecord.id) {
        const previousClass = classes.find((item) => item.id === previousClassId);
        if (previousClass) {
          const previousCount = classStudentCounts.get(previousClassId) ?? previousClass.current_students ?? 0;
          updates.push(ClassApi.update(previousClassId, {
            current_students: Math.max(previousCount - 1, 0),
          }));
        }
      }

      await Promise.all(updates);
      return { previousClassId };
    },
    retry: false,
    onSuccess: ({ previousClassId }) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setStudentToAssignId('');
      const movedFromAnotherClass = Boolean(previousClassId && previousClassId !== selectedClass?.id);
      toast.success(
        movedFromAnotherClass
          ? 'Aluno remanejado para a turma com sucesso!'
          : 'Aluno adicionado à turma com sucesso!'
      );
    },
    onError: (err) => {
      toast.error(err.message ?? 'Erro ao vincular aluno à turma.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (!payload.coordinator_id) {
      toast.error('Selecione um coordenador para a turma.');
      return;
    }
    if (!payload.start_date) payload.start_date = null;
    if (!payload.end_date) payload.end_date = null;
    if (!payload.classroom) payload.classroom = null;
    // Ensure defaults for NOT NULL columns that have display-only defaults
    if (!payload.year) payload.year = new Date().getFullYear();
    if (!payload.max_students) payload.max_students = 40;
    payload.current_students = selectedClass
      ? (classStudentCounts.get(selectedClass.id) ?? payload.current_students ?? 0)
      : 0;

    if (selectedClass) {
      updateMutation.mutate({ id: selectedClass.id, data: payload });
    } else {
      createMutation.mutate({ ...payload, status: 'ativa', current_students: 0 });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleEdit = (cls) => {
    setSelectedClass(cls);
    setFormData(cls);
    setStudentToAssignId('');
    setShowForm(true);
  };

  const handleAssignStudent = () => {
    if (!selectedClass?.id) return;

    if (!studentToAssignId) {
      toast.error('Selecione um aluno para adicionar à turma.');
      return;
    }

    const classCapacity = selectedClass.max_students || 40;
    const currentCount = classStudentCounts.get(selectedClass.id) ?? selectedClass.current_students ?? 0;
    if (currentCount >= classCapacity) {
      toast.error('A turma já atingiu o limite máximo de alunos.');
      return;
    }

    const studentRecord = assignableStudents.find((student) => student.id === studentToAssignId);
    if (!studentRecord) {
      toast.error('Aluno selecionado não está disponível para esta turma.');
      return;
    }

    assignStudentMutation.mutate({
      classRecord: selectedClass,
      studentRecord,
    });
  };

  const shiftColors = {
    matutino: 'bg-amber-100 text-amber-700 border-amber-200',
    vespertino: 'bg-blue-100 text-blue-700 border-blue-200',
    noturno: 'bg-purple-100 text-purple-700 border-purple-200',
    integral: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  const shiftLabels = {
    matutino: 'Matutino',
    vespertino: 'Vespertino',
    noturno: 'Noturno',
    integral: 'Integral',
  };

  const getCoordinatorName = (id) => {
    const person = coordinatorOptions.find(p => p.id === id);
    return person?.full_name || 'Não definido';
  };

  const filteredClasses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return classes;

    return classes.filter((cls) => (
      cls.name?.toLowerCase().includes(normalizedSearch)
      || cls.grade_level?.toLowerCase().includes(normalizedSearch)
      || String(cls.year || '').includes(normalizedSearch)
      || cls.classroom?.toLowerCase().includes(normalizedSearch)
      || cls.shift?.toLowerCase().includes(normalizedSearch)
      || cls.status?.toLowerCase().includes(normalizedSearch)
      || getCoordinatorName(cls.coordinator_id)?.toLowerCase().includes(normalizedSearch)
    ));
  }, [classes, getCoordinatorName, search]);

  useGlobalSearchNavigation({
    entityKey: 'classes',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      setShowForm(false);
      setSelectedClass(null);
      setSearch(query || '');
      setHighlightedClassId(recordId || null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Turmas"
        subtitle={`${classes.length} turmas cadastradas`}
        action={() => { setSelectedClass(null); setFormData({}); setShowForm(true); }}
        actionLabel="Nova Turma"
      />

      <div className="app-search-field max-w-lg">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por turma, série, sala, ano ou coordenador..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClasses.map((cls) => (
          <Card
            key={cls.id}
            className={cn(
              "hover:shadow-lg transition-shadow",
              highlightedClassId === cls.id && "ring-2 ring-indigo-300 ring-offset-2 ring-offset-white/40"
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{cls.name}</CardTitle>
                  <p className="text-sm text-slate-500">{cls.grade_level} - {cls.year}</p>
                </div>
                <Badge variant="outline" className={shiftColors[cls.shift] || ''}>
                  {shiftLabels[cls.shift] || cls.shift}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{classStudentCounts.get(cls.id) || 0}/{cls.max_students || 40}</span>
                </div>
                {cls.classroom && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{cls.classroom}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500">Coordenador</p>
                <p className="text-sm font-medium">{getCoordinatorName(cls.coordinator_id)}</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <StatusBadge status={cls.status} />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(cls)}
                    aria-label={`Editar turma ${cls.name}`}
                    data-tooltip={`Editar turma ${cls.name}`}
                  >
                    <Edit className="w-4 h-4 text-slate-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDeleteTarget(cls);
                      setDeleteConfirmed(false);
                    }}
                    aria-label={`Excluir turma ${cls.name}`}
                    data-tooltip={`Excluir turma ${cls.name}`}
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredClasses.length === 0 && (
          <div className="col-span-full flex items-center justify-center h-48 text-slate-500">
            Nenhuma turma encontrada para os filtros atuais
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedClass ? 'Editar Turma' : 'Nova Turma'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome da Turma *</Label>
              <Input
                placeholder="Ex: 9º Ano A"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Série/Ano *</Label>
                <Input
                  placeholder="Ex: 9º Ano"
                  value={formData.grade_level || ''}
                  onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Ano Letivo *</Label>
                <Input
                  type="number"
                  placeholder="2024"
                  value={formData.year || new Date().getFullYear()}
                  onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Turno *</Label>
                <Select
                  value={formData.shift || ''}
                  onValueChange={(value) => setFormData({ ...formData, shift: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matutino">Matutino</SelectItem>
                    <SelectItem value="vespertino">Vespertino</SelectItem>
                    <SelectItem value="noturno">Noturno</SelectItem>
                    <SelectItem value="integral">Integral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sala</Label>
                <Input
                  placeholder="Ex: Sala 10"
                  value={formData.classroom || ''}
                  onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Máximo de Alunos</Label>
                <Input
                  type="number"
                  value={formData.max_students || 40}
                  onChange={(e) => setFormData({ ...formData, max_students: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Coordenador *</Label>
                <Select
                  value={formData.coordinator_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, coordinator_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {coordinatorOptions.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de Término</Label>
                <Input
                  type="date"
                  value={formData.end_date || ''}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            {selectedClass && (
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status || 'ativa'}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="encerrada">Encerrada</SelectItem>
                    <SelectItem value="suspensa">Suspensa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedClass && (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Adicionar aluno à turma</h3>
                    <p className="text-xs text-slate-500">
                      Vincula um aluno existente a esta turma e atualiza a ocupação automaticamente.
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-white">
                    {studentsInSelectedClass.length}/{selectedClass.max_students || 40}
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div>
                    <Label>Aluno disponível</Label>
                    <Select value={studentToAssignId} onValueChange={setStudentToAssignId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um aluno para esta turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableStudents.length === 0 && (
                          <SelectItem value="__none__" disabled>Nenhum aluno disponível</SelectItem>
                        )}
                        {assignableStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.full_name}
                            {student.current_class_id ? ' • já em outra turma' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAssignStudent}
                    disabled={!studentToAssignId || assignStudentMutation.isPending}
                  >
                    {assignStudentMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    Adicionar Aluno
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Alunos já vinculados</Label>
                  {studentsInSelectedClass.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum aluno vinculado a esta turma ainda.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {studentsInSelectedClass.map((student) => (
                        <Badge key={student.id} variant="secondary" className="bg-white text-slate-700">
                          {student.full_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={isSaving}>
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : (selectedClass ? 'Salvar Alterações' : 'Criar Turma')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmed(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Turma</DialogTitle>
            <DialogDescription>
              Você está prestes a excluir a turma <strong>{deleteTarget?.name}</strong>. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 py-4">
            <input
              type="checkbox"
              id="confirm-delete"
              checked={deleteConfirmed}
              onChange={(e) => setDeleteConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <label htmlFor="confirm-delete" className="text-sm text-slate-600 cursor-pointer select-none">
              Entendo que esta ação é <strong className="text-rose-600">irreversível</strong> e todos os dados da turma serão apagados permanentemente.
            </label>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmed(false); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteConfirmed || deleteMutation.isPending}
              onClick={() => {
                deleteMutation.mutate(deleteTarget.id, {
                  onSuccess: () => { setDeleteTarget(null); setDeleteConfirmed(false); }
                });
              }}
            >
              {deleteMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...</> : 'Excluir Turma'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
