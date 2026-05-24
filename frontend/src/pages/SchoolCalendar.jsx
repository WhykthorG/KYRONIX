// @ts-ignore
import React, { useState } from 'react';
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
// @ts-ignore
import { Calendar, ChevronLeft, ChevronRight, MapPin, Clock, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { EventApi } from '@/services/supabaseApi';
import { usePermissions } from '@/components/hooks/usePermissions';
import { useGlobalSearchNavigation } from '@/hooks/useGlobalSearchNavigation';

export default function SchoolCalendar({ globalSearch }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const { isStudent } = usePermissions();
  const canCreateEvents = !isStudent;
  // @ts-ignore
  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState({});
  const [search, setSearch] = useState('');
  const [highlightedEventId, setHighlightedEventId] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => EventApi.list('-start_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => EventApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowForm(false);
      setFormData({});
      toast.success('Evento criado com sucesso!');
    },
  });

  const updateMutation = useMutation({
    // @ts-ignore
    mutationFn: ({ id, data }) => EventApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowForm(false);
      setFormData({});
      setSelectedEvent(null);
      toast.success('Evento atualizado com sucesso!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => EventApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento removido com sucesso!');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canCreateEvents) {
      toast.error('Alunos não podem criar eventos no calendário escolar.');
      return;
    }
    if (selectedEvent) {
      // @ts-ignore
      updateMutation.mutate({ id: selectedEvent.id, data: formData });
    } else {
      // @ts-ignore
      createMutation.mutate({ ...formData, status: 'agendado' });
    }
  };

  const handleDateClick = (date) => {
    if (!canCreateEvents) {
      toast.error('Alunos não podem criar eventos no calendário escolar.');
      return;
    }
    setSelectedDate(date);
    setSelectedEvent(null);
    setFormData({ start_date: format(date, "yyyy-MM-dd'T'09:00") });
    setShowForm(true);
  };

  const handleEditEvent = (event) => {
    if (!canCreateEvents) {
      toast.error('Alunos não podem criar ou editar eventos no calendário escolar.');
      return;
    }
    setSelectedEvent(event);
    setFormData(event);
    setShowForm(true);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const normalizedSearch = search.trim().toLowerCase();
  const visibleEvents = events.filter((event) => {
    if (!normalizedSearch) return true;

    return [
      event.title,
      event.description,
      event.location,
      event.type,
      event.status,
      event.start_date,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
  });

  const startDay = monthStart.getDay();
  const emptyDays = Array(startDay).fill(null);

  const getEventsForDay = (date) => {
    return visibleEvents.filter(event => 
      isSameDay(new Date(event.start_date), date)
    );
  };

  const typeColors = {
    aula: 'bg-blue-500',
    prova: 'bg-red-500',
    reuniao: 'bg-purple-500',
    feriado: 'bg-amber-500',
    evento: 'bg-emerald-500',
    recesso: 'bg-orange-500',
    conselho: 'bg-indigo-500',
    outro: 'bg-slate-500',
  };

  const typeLabels = {
    aula: 'Aula',
    prova: 'Prova',
    reuniao: 'Reunião',
    feriado: 'Feriado',
    evento: 'Evento',
    recesso: 'Recesso',
    conselho: 'Conselho',
    outro: 'Outro',
  };

  const upcomingEvents = visibleEvents
    .filter(e => new Date(e.start_date) >= new Date())
    // @ts-ignore
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 5);

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

  return (
    <div className="space-y-6">
      <
// @ts-ignore
      PageHeader
          backTo="/Dashboard"
          backLabel="Dashboard"
        title="Calendário Escolar"
        subtitle="Gerencie eventos e datas importantes"
        action={canCreateEvents ? () => { setSelectedEvent(null); setFormData({}); setShowForm(true); } : undefined}
        actionLabel={canCreateEvents ? "Novo Evento" : undefined}
      />

      <div className="app-search-field max-w-xl">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por evento, local, tipo ou data..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
        />
      </div>

      {!canCreateEvents && (
        <
// @ts-ignore
        Card>
          <
// @ts-ignore
          CardContent>
            <p className="text-sm text-slate-600">Alunos não podem criar ou editar eventos no calendário escolar. A função está disponível apenas para coordenadores, secretários e administradores.</p>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <
// @ts-ignore
        Card className="lg:col-span-2">
          <
// @ts-ignore
          CardHeader className="flex flex-row items-center justify-between">
            <
// @ts-ignore
            CardTitle className="text-lg">
              {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Mês anterior" data-tooltip="Mês anterior">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Próximo mês" data-tooltip="Próximo mês">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <
// @ts-ignore
          CardContent>
            <div className="grid grid-cols-7 gap-1">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
                  {day}
                </div>
              ))}
              {emptyDays.map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}
              {days.map(day => {
                const dayEvents = getEventsForDay(day);
                const isCurrentDay = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    className={cn(
                      "aspect-square p-1 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors",
                      isCurrentDay && "bg-indigo-50 border-indigo-200",
                      !isSameMonth(day, currentMonth) && "opacity-50"
                    )}
                  >
                    <div className={cn(
                      "text-sm font-medium mb-1",
                      isCurrentDay && "text-indigo-600"
                    )}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map(event => (
                        <div
                          key={event.id}
                          onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                          className={cn(
                            "text-xs px-1 py-0.5 rounded truncate text-white",
                            typeColors[event.type] || 'bg-slate-500',
                            highlightedEventId === event.id && "ring-2 ring-white/80"
                          )}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-slate-500 text-center">
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <
// @ts-ignore
        Card>
          <
// @ts-ignore
          CardHeader>
            <
// @ts-ignore
            CardTitle className="text-lg">Próximos Eventos</CardTitle>
          </CardHeader>
          <
// @ts-ignore
          CardContent className="space-y-4">
            {upcomingEvents.length === 0 ? (
              <p className="text-slate-500 text-center py-4">Nenhum evento próximo</p>
            ) : (
              upcomingEvents.map(event => (
                <div 
                  key={event.id} 
                  className={cn(
                    "p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer",
                    highlightedEventId === event.id && "ring-2 ring-indigo-300"
                  )}
                  onClick={() => handleEditEvent(event)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-slate-900 line-clamp-1">{event.title}</h4>
                    <Badge variant="outline" className={cn(
                      "text-xs text-white border-0",
                      typeColors[event.type] || 'bg-slate-500'
                    )}>
                      {typeLabels[event.type]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(event.start_date), "dd/MM", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{format(new Date(event.start_date), "HH:mm")}</span>
                    </div>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                      <MapPin className="w-3 h-3" />
                      <span>{event.location}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <
// @ts-ignore
        DialogContent className="max-w-lg">
          <
// @ts-ignore
          DialogHeader>
            <
// @ts-ignore
            DialogTitle>
              {selectedEvent ? 'Editar Evento' : 'Novo Evento'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <
// @ts-ignore
              Label>Título *</Label>
              <Input
                // @ts-ignore
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div>
              <
// @ts-ignore
              Label>Descrição</Label>
              <Textarea
                // @ts-ignore
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <
// @ts-ignore
                Label>Tipo *</Label>
                <Select
                  // @ts-ignore
                  value={formData.type || ''}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <
// @ts-ignore
                  SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <
// @ts-ignore
                  SelectContent>
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <
// @ts-ignore
                      SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <
// @ts-ignore
                Label>Local</Label>
                <Input
                  // @ts-ignore
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <
// @ts-ignore
                Label>Início *</Label>
                <Input
                  // @ts-ignore
                  type="datetime-local"
                  // @ts-ignore
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <
// @ts-ignore
                Label>Término</Label>
                <Input
                  // @ts-ignore
                  type="datetime-local"
                  // @ts-ignore
                  value={formData.end_date || ''}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  // @ts-ignore
                  checked={formData.all_day || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, all_day: checked })}
                  aria-label="Dia inteiro"
                  data-tooltip="Dia inteiro"
                />
                <
// @ts-ignore
                Label>Dia inteiro</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  // @ts-ignore
                  checked={formData.is_online || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_online: checked })}
                  aria-label="Evento online"
                  data-tooltip="Evento online"
                />
                <
// @ts-ignore
                Label>Online</Label>
              </div>
            </div>
            {formData.
// @ts-ignore
            is_online && (
              <div>
                <
// @ts-ignore
                Label>Link da Reunião</Label>
                <Input
                  // @ts-ignore
                  value={formData.meeting_url || ''}
                  onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}

            <DialogFooter className="gap-2">
              {selectedEvent && (
                <Button 
                  type="button" 
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja excluir este evento?')) {
                      deleteMutation.mutate(selectedEvent.id);
                      setShowForm(false);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createMutation.isPending}>
                {selectedEvent ? 'Salvar Alterações' : 'Criar Evento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
