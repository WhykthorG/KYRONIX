import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, Clock, Search, Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { EventApi, SubjectApi, ClassApi } from '@/services/supabaseApi';
import { usePermissions } from '@/hooks/usePermissions';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

const EXAM_TYPES = {
  prova: { label: 'Prova', color: 'bg-red-500' },
  prova_final: { label: 'Prova Final', color: 'bg-red-700' },
  recuperacao: { label: 'Recuperação', color: 'bg-orange-500' },
  segunda_chamada: { label: '2ª Chamada', color: 'bg-yellow-500' },
  trabalho: { label: 'Trabalho', color: 'bg-blue-500' },
  projeto: { label: 'Projeto', color: 'bg-purple-500' },
  apresentacao: { label: 'Apresentação', color: 'bg-pink-500' },
  outro: { label: 'Outro', color: 'bg-slate-500' },
};

export default function ExamCalendar({ globalSearch }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const { isStudent } = usePermissions();
  const canCreateEvents = !isStudent;
  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState({});
  const [search, setSearch] = useState('');
  const [highlightedEventId, setHighlightedEventId] = useState(null);

  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => EventApi.list('-start_date'),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => SubjectApi.list('name'),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => ClassApi.list('name'),
  });

  const examEvents = useMemo(() => {
    return events.filter((e) =>
      e.type === 'prova' ||
      e.type === 'prova_final' ||
      e.type === 'recuperacao' ||
      e.type === 'segunda_chamada' ||
      e.title?.toLowerCase().includes('prova') ||
      e.title?.toLowerCase().includes('avaliação') ||
      e.title?.toLowerCase().includes('exame')
    );
  }, [events]);

  const createMutation = useMutation({
    mutationFn: (data) => EventApi.create({ ...data, type: data.examType || 'prova' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowForm(false);
      setFormData({});
      toast.success('Avaliação agendada com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao agendar avaliação.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => EventApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Avaliação removida com sucesso!');
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover avaliação.'),
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const normalizedSearch = search.trim().toLowerCase();
  const visibleEvents = examEvents.filter((event) => {
    if (!normalizedSearch) return true;
    return [
      event.title,
      event.description,
      event.location,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
  });

  const startDay = monthStart.getDay();
  const emptyDays = Array(startDay).fill(null);

  const getEventsForDay = (date) => {
    return visibleEvents.filter(event =>
      isSameDay(new Date(event.start_date), date)
    );
  };

  const handleCreateEvent = (date) => {
    if (!canCreateEvents) {
      toast.error('Alunos não podem criar avaliações.');
      return;
    }
    setSelectedEvent(null);
    setSelectedDate(date);
    setFormData({ start_date: format(date, "yyyy-MM-dd'T'09:00") });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  useGlobalSearchNavigation({
    entityKey: 'events',
    globalSearch,
    isReady: !isLoading,
    onNavigate: ({ query, recordId }) => {
      const matchedEvent = events.find((event) => event.id === recordId) || null;
      setShowForm(false);
      setSelectedEvent(null);
      setSearch(query || '');
      setHighlightedEventId(recordId || null);
      if (matchedEvent?.start_date) {
        setCurrentMonth(new Date(matchedEvent.start_date));
      }
    },
  });

  const upcomingExams = visibleEvents
    .filter(e => new Date(e.start_date) >= new Date())
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/Dashboard"
        backLabel="Dashboard"
        title="Calendário de Avaliações"
        subtitle="Agendamento de provas, trabalhos e avaliações"
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar Grid */}
        <div className="flex-1">
          <Card className="border-white/10 bg-slate-950/70 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>
                  Hoje
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-white/50 py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {emptyDays.map((_, i) => (
                  <div key={`empty-${i}`} className="h-24" />
                ))}
                {days.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const isTodayDate = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "h-24 p-1 rounded-lg border transition-colors cursor-pointer hover:bg-white/5",
                        isTodayDate ? "border-indigo-500 bg-indigo-500/10" : "border-white/10",
                        highlightedEventId && dayEvents.some(e => e.id === highlightedEventId) && "ring-2 ring-indigo-300"
                      )}
                      onClick={() => handleCreateEvent(day)}
                    >
                      <div className={cn(
                        "text-xs font-medium mb-1",
                        isTodayDate ? "text-indigo-400" : "text-white/70"
                      )}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={cn(
                              "text-[10px] px-1 py-0.5 rounded truncate text-white",
                              EXAM_TYPES[event.type]?.color || 'bg-slate-500'
                            )}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-white/50">+{dayEvents.length - 2} mais</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 space-y-4">
          <div className="app-search-field">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar avaliação..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0" />
          </div>

          {/* Legend */}
          <Card className="border-white/10 bg-slate-950/70 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legenda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(EXAM_TYPES).map(([key, { label, color }]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <div className={cn("w-3 h-3 rounded", color)} />
                    <span className="text-white/70">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Exams */}
          <Card className="border-white/10 bg-slate-950/70 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" /> Próximas Avaliações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingExams.length > 0 ? (
                <div className="space-y-3">
                  {upcomingExams.map((exam) => (
                    <div key={exam.id} className="p-2 rounded bg-white/5 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-2 h-2 rounded-full", EXAM_TYPES[exam.type]?.color || 'bg-slate-500')} />
                        <span className="font-medium truncate">{exam.title}</span>
                      </div>
                      <p className="text-xs text-white/50">
                        {format(new Date(exam.start_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/30 text-center py-4">Nenhuma avaliação agendada</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Exam Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agendar Avaliação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Prova de Matemática - Bimestre 1"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Avaliação</Label>
                <Select value={formData.examType || 'prova'} onValueChange={(v) => setFormData({ ...formData, examType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXAM_TYPES).map(([value, { label }]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Disciplina</Label>
                <Select value={formData.subject_id || ''} onValueChange={(v) => setFormData({ ...formData, subject_id: v })}>
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
                <Label>Turma</Label>
                <Select value={formData.class_id || ''} onValueChange={(v) => setFormData({ ...formData, class_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data e Hora *</Label>
                <Input
                  type="datetime-local"
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Sala, laboratório, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição / Observações</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Conteúdo, peso, duração, etc."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                Agendar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
