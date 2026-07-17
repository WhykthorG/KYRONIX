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
import { Loader2, Edit, Trash2, GraduationCap, Plus, Search, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { CourseApi, SeriesApi } from '@/services/supabaseApi';
import { COURSE_STATUSES, COURSE_STATUS_LABELS, SERIES_STATUSES, SERIES_STATUS_LABELS } from '@shared/contracts/course';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const EMPTY_COURSE = {
  name: '',
  code: '',
  description: '',
  duration_years: 1,
  total_hours: 0,
  status: 'ativo',
};

const EMPTY_SERIES = {
  course_id: '',
  name: '',
  code: '',
  order_index: 1,
  year: null,
  status: 'ativa',
};

export default function Courses({ globalSearch }) {
  const [activeTab, setActiveTab] = useState('courses');
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_COURSE);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => CourseApi.list('name'),
  });

  const { data: series = [], isLoading: loadingSeries } = useQuery({
    queryKey: ['series'],
    queryFn: () => SeriesApi.list('order_index'),
  });

  const createCourseMutation = useMutation({
    mutationFn: (data) => CourseApi.create(data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setShowForm(false);
      setFormData(EMPTY_COURSE);
      toast.success('Curso criado com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao criar curso.'),
  });

  const updateCourseMutation = useMutation({
    mutationFn: ({ id, data }) => CourseApi.update(id, data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setShowForm(false);
      setSelectedItem(null);
      toast.success('Curso atualizado com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao atualizar curso.'),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: (id) => CourseApi.delete(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Curso removido com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover curso.'),
  });

  const createSeriesMutation = useMutation({
    mutationFn: (data) => SeriesApi.create(data),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setShowForm(false);
      setFormData(EMPTY_SERIES);
      toast.success('Série criada com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao criar série.'),
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: (id) => SeriesApi.delete(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('Série removida com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover série.'),
  });

  const isSaving = createCourseMutation.isPending || updateCourseMutation.isPending || createSeriesMutation.isPending;

  const filteredCourses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return courses;
    return courses.filter((c) =>
      c.name?.toLowerCase().includes(normalizedSearch) ||
      c.code?.toLowerCase().includes(normalizedSearch)
    );
  }, [courses, search]);

  const filteredSeries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return series;
    return series.filter((s) =>
      s.name?.toLowerCase().includes(normalizedSearch) ||
      s.course?.name?.toLowerCase().includes(normalizedSearch)
    );
  }, [series, search]);

  useGlobalSearchNavigation({
    entityKey: 'courses',
    globalSearch,
    isReady: !loadingCourses,
    onNavigate: ({ query }) => {
      setSearch(query || '');
    },
  });

  const handleNewCourse = () => {
    setSelectedItem(null);
    setFormData(EMPTY_COURSE);
    setShowForm(true);
  };

  const handleNewSeries = () => {
    setSelectedItem(null);
    setFormData(EMPTY_SERIES);
    setShowForm(true);
  };

  const handleEditCourse = (item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name || '',
      code: item.code || '',
      description: item.description || '',
      duration_years: item.duration_years || 1,
      total_hours: item.total_hours || 0,
      status: item.status || 'ativo',
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeTab === 'courses') {
      if (selectedItem) {
        updateCourseMutation.mutate({ id: selectedItem.id, data: formData });
      } else {
        createCourseMutation.mutate(formData);
      }
    } else {
      createSeriesMutation.mutate(formData);
    }
  };

  const courseStats = useMemo(() => ({
    total: courses.length,
    ativo: courses.filter((c) => c.status === 'ativo').length,
  }), [courses]);

  const seriesStats = useMemo(() => ({
    total: series.length,
    ativa: series.filter((s) => s.status === 'ativa').length,
  }), [series]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cursos e Séries"
        subtitle={`${courses.length} curso(s), ${series.length} série(s)`}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="courses">
            <GraduationCap className="w-4 h-4 mr-2" /> Cursos
          </TabsTrigger>
          <TabsTrigger value="series">
            <Layers className="w-4 h-4 mr-2" /> Séries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Total</p>
                <p className="text-2xl font-semibold">{courseStats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Ativos</p>
                <p className="text-2xl font-semibold text-emerald-400">{courseStats.ativo}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="app-search-field flex-1 max-w-lg">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, código..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
            </div>
            <Button onClick={handleNewCourse}>
              <Plus className="w-4 h-4 mr-2" /> Novo Curso
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-indigo-400" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="space-y-1 text-sm text-white/70">
                    {item.code && <p>Código: {item.code}</p>}
                    {item.duration_years && <p>Duração: {item.duration_years} ano(s)</p>}
                    {item.total_hours > 0 && <p>Carga horária: {item.total_hours}h</p>}
                    {item.description && <p className="line-clamp-2">{item.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <Button variant="ghost" size="icon" onClick={() => handleEditCourse(item)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'course', item })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredCourses.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/50">
                Nenhum curso encontrado.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="series" className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Total</p>
                <p className="text-2xl font-semibold">{seriesStats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-950/70 text-white">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-white/45">Ativas</p>
                <p className="text-2xl font-semibold text-emerald-400">{seriesStats.ativa}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="app-search-field flex-1 max-w-lg">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, curso..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
            </div>
            <Button onClick={handleNewSeries}>
              <Plus className="w-4 h-4 mr-2" /> Nova Série
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSeries.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow border-white/10 bg-slate-950/70 text-white">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-cyan-400" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="space-y-1 text-sm text-white/70">
                    {item.course && <p>Curso: {item.course.name}</p>}
                    {item.order_index && <p>Ordem: {item.order_index}º</p>}
                    {item.year && <p>Ano: {item.year}</p>}
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'series', item })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredSeries.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/50">
                Nenhuma série encontrada.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeTab === 'courses'
                ? (selectedItem ? 'Editar Curso' : 'Novo Curso')
                : 'Nova Série'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'courses' ? (
              <>
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
                        {Object.entries(COURSE_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duração (anos)</Label>
                    <Input type="number" value={formData.duration_years} onChange={(e) => setFormData({ ...formData, duration_years: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Carga Horária Total</Label>
                    <Input type="number" value={formData.total_hours} onChange={(e) => setFormData({ ...formData, total_hours: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Curso *</Label>
                  <Select value={formData.course_id} onValueChange={(v) => setFormData({ ...formData, course_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                    <Label>Ordem</Label>
                    <Input type="number" value={formData.order_index} onChange={(e) => setFormData({ ...formData, order_index: Number(e.target.value) })} />
                  </div>
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
              if (deleteTarget?.type === 'course') {
                deleteCourseMutation.mutate(deleteTarget.item.id);
              } else {
                deleteSeriesMutation.mutate(deleteTarget.item.id);
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
