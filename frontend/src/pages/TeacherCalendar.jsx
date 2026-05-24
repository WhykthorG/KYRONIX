import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/common/PageHeader";
import { 
  Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock, 
  MapPin, Users, Filter, Download, Upload, Trash2, Loader2,
  BookOpen, CheckSquare
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday,
  startOfWeek, addDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import { TeacherCalendarApi } from '@/services/supabaseApi';
import { isAssignmentPublished } from '@shared/contracts/assignments';
import { useTeacherCalendarData } from '@/hooks/useTeacherCalendarData';

const EVENT_TYPES = {
  office_hours: { label: 'Atendimento', color: 'bg-blue-500', icon: Users },
  reuniao_individual: { label: 'Reunião', color: 'bg-purple-500', icon: Users },
  preparacao_aula: { label: 'Prep. Aula', color: 'bg-green-500', icon: BookOpen },
  correcao: { label: 'Correção', color: 'bg-orange-500', icon: CheckSquare },
  evento_pessoal: { label: 'Pessoal', color: 'bg-pink-500', icon: CalendarIcon },
  outro: { label: 'Outro', color: 'bg-slate-500', icon: CalendarIcon }
};

const ALL_CALENDAR_FILTER_TYPES = ['escolar', 'aula', 'atividade', ...Object.keys(EVENT_TYPES)];
const DEFAULT_EVENT_FORM_DATA = {
  title: '',
  description: '',
  event_type: 'office_hours',
  start_datetime: '',
  end_datetime: '',
  all_day: false,
  location: '',
  is_online: false,
  meeting_url: '',
  related_class_id: '',
  visibility: 'privado',
  color: '#6366f1',
  reminder_minutes_before: 15,
};

export default function TeacherCalendar() {
  const { user: authUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filterTypes, setFilterTypes] = useState([]);
  const {
    loading,
    teacher,
    events,
    classes,
    assignments,
    diaryEntries,
    allEvents,
    syncing,
    exporting,
    loadData,
    handleSync,
    handleExport,
  } = useTeacherCalendarData({
    authUser,
    filterTypes,
    eventTypes: EVENT_TYPES,
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveEvent = async (formData) => {
    try {
      if (selectedEvent) {
        await TeacherCalendarApi.update(selectedEvent.id, formData);
        toast.success('Evento atualizado');
      } else {
        await TeacherCalendarApi.create({
          ...formData,
          teacher_id: teacher.id
        });
        toast.success('Evento criado');
      }
      setShowEventDialog(false);
      setSelectedEvent(null);
      loadData();
    } catch (error) {
      toast.error('Erro ao salvar evento');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Deseja remover este evento?')) return;
    
    try {
      await TeacherCalendarApi.delete(eventId);
      toast.success('Evento removido');
      loadData();
    } catch (error) {
      toast.error('Erro ao remover evento');
    }
  };

  if (loading) {
    return <div className="p-6">Carregando calendário...</div>;
  }

  if (!teacher) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h2 className="text-xl font-semibold mb-2">Acesso Necessário</h2>
            <p className="text-slate-600">Esta funcionalidade é exclusiva para professores e coordenadores.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
          backTo="/TeacherPortal"
          backLabel="Portal do Professor"
        title="Calendário do Professor"
        subtitle="Visualização unificada de aulas, eventos e compromissos"
        action={() => {
          setSelectedEvent(null);
          setShowEventDialog(true);
        }}
        actionLabel="Novo Evento"
        actionIcon={Plus}
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || syncing} aria-label="Exportar calendário">
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? 'Exportando...' : 'Exportar'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} aria-label="Sincronizar calendário externo">
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
      </PageHeader>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            setCurrentDate(viewMode === 'month' ? subMonths(currentDate, 1) : addDays(currentDate, -7));
          }} aria-label={viewMode === 'month' ? 'Mês anterior' : 'Semana anterior'} data-tooltip={viewMode === 'month' ? 'Mês anterior' : 'Semana anterior'}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => {
            setCurrentDate(viewMode === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7));
          }} aria-label={viewMode === 'month' ? 'Próximo mês' : 'Próxima semana'} data-tooltip={viewMode === 'month' ? 'Próximo mês' : 'Próxima semana'}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <h2 className="text-xl font-bold ml-4">
            {viewMode === 'month' 
              ? format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
              : `Semana de ${format(startOfWeek(currentDate), "dd MMM", { locale: ptBR })}`
            }
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="day">Dia</SelectItem>
            </SelectContent>
          </Select>

          <FilterDialog 
            filterTypes={filterTypes}
            setFilterTypes={setFilterTypes}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {viewMode === 'month' && (
            <MonthView 
              currentDate={currentDate}
              events={allEvents}
              onDateClick={(date) => {
                setSelectedEvent({ start_datetime: format(date, "yyyy-MM-dd'T'09:00") });
                setShowEventDialog(true);
              }}
              onEventClick={(event) => {
                if (event.source === 'teacher') {
                  setSelectedEvent(event);
                  setShowEventDialog(true);
                }
              }}
            />
          )}
          {viewMode === 'week' && (
            <WeekView 
              currentDate={currentDate}
              events={allEvents}
              onEventClick={(event) => {
                if (event.source === 'teacher') {
                  setSelectedEvent(event);
                  setShowEventDialog(true);
                }
              }}
            />
          )}
          {viewMode === 'day' && (
            <DayView 
              currentDate={currentDate}
              events={allEvents}
              onEventClick={(event) => {
                if (event.source === 'teacher') {
                  setSelectedEvent(event);
                  setShowEventDialog(true);
                }
              }}
            />
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Próximos Eventos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {allEvents
                .filter(e => e.start >= new Date())
                .sort((a, b) => a.start - b.start)
                .slice(0, 5)
                .map((event, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        event.source === 'teacher' ? EVENT_TYPES[event.event_type]?.color :
                        event.source === 'school' ? 'bg-indigo-500' :
                        event.source === 'diary' ? 'bg-blue-500' : 'bg-orange-500'
                      )} />
                      <h4 className="font-semibold text-sm">{event.title}</h4>
                    </div>
                    <p className="text-xs text-slate-600">
                      {format(event.start, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estatísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Eventos Pessoais</span>
                <Badge>{events.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Aulas Agendadas</span>
                <Badge>{diaryEntries.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Atividades Pendentes</span>
                <Badge>{assignments.filter((assignment) => isAssignmentPublished(assignment)).length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EventDialog
        open={showEventDialog}
        onClose={() => {
          setShowEventDialog(false);
          setSelectedEvent(null);
        }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        event={selectedEvent}
        classes={classes}
      />
    </div>
  );
}

function MonthView({ currentDate, events, onDateClick, onEventClick }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = monthStart.getDay();
  const emptyDays = Array(startDay).fill(null);

  const getEventsForDay = (date) => {
    return events.filter(event => isSameDay(event.start, date));
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-7 gap-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-slate-700 py-2">
              {day}
            </div>
          ))}
          {emptyDays.map((_, index) => (
            <div key={`empty-${index}`} className="min-h-24" />
          ))}
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const isCurrentDay = isToday(day);
            return (
              <div
                key={day.toISOString()}
                onClick={() => onDateClick(day)}
                className={cn(
                  "min-h-24 p-2 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors",
                  isCurrentDay && "bg-indigo-50 border-indigo-300"
                )}
              >
                <div className={cn(
                  "text-sm font-medium mb-1",
                  isCurrentDay && "text-indigo-600 font-bold"
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event, idx) => (
                    <div
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      className={cn(
                        "text-xs px-2 py-1 rounded text-white truncate cursor-pointer",
                        event.source === 'teacher' ? EVENT_TYPES[event.event_type]?.color :
                        event.source === 'school' ? 'bg-indigo-500' :
                        event.source === 'diary' ? 'bg-blue-500' : 'bg-orange-500'
                      )}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-slate-500 text-center">
                      +{dayEvents.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekView({ currentDate, events, onEventClick }) {
  const weekStart = startOfWeek(currentDate);
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map(day => {
            const dayEvents = events.filter(e => isSameDay(e.start, day));
            return (
              <div key={day.toISOString()} className="space-y-2">
                <div className={cn(
                  "text-center py-2 rounded-lg",
                  isToday(day) && "bg-indigo-100 text-indigo-700 font-bold"
                )}>
                  <div className="text-xs">{format(day, 'EEE', { locale: ptBR })}</div>
                  <div className="text-lg font-semibold">{format(day, 'd')}</div>
                </div>
                <div className="space-y-2">
                  {dayEvents.map((event, idx) => (
                    <div
                      key={idx}
                      onClick={() => onEventClick(event)}
                      className={cn(
                        "p-2 rounded text-white text-xs cursor-pointer",
                        event.source === 'teacher' ? EVENT_TYPES[event.event_type]?.color :
                        event.source === 'school' ? 'bg-indigo-500' :
                        event.source === 'diary' ? 'bg-blue-500' : 'bg-orange-500'
                      )}
                    >
                      <div className="font-medium">{event.title}</div>
                      <div className="text-xs opacity-90">
                        {format(event.start, 'HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DayView({ currentDate, events, onEventClick }) {
  const dayEvents = events.filter(e => isSameDay(e.start, currentDate));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dayEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Nenhum evento agendado para este dia
          </div>
        ) : (
          dayEvents.map((event, idx) => (
            <div
              key={idx}
              onClick={() => onEventClick(event)}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{event.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {event.location}
                      </div>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-sm text-slate-600 mt-2">{event.description}</p>
                  )}
                </div>
                <Badge variant="outline">
                  {event.source === 'teacher' ? EVENT_TYPES[event.event_type]?.label : 
                   event.source === 'school' ? 'Escolar' :
                   event.source === 'diary' ? 'Aula' : 'Atividade'}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function FilterDialog({ filterTypes, setFilterTypes }) {
  const [open, setOpen] = useState(false);
  const [draftFilterTypes, setDraftFilterTypes] = useState(ALL_CALENDAR_FILTER_TYPES);

  useEffect(() => {
    if (open) {
      setDraftFilterTypes(
        filterTypes.length === 0 ? [...ALL_CALENDAR_FILTER_TYPES] : [...filterTypes]
      );
    }
  }, [filterTypes, open]);

  const toggleFilter = (type) => {
    setDraftFilterTypes((current) => (
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    ));
  };

  const applyFilters = () => {
    if (draftFilterTypes.length === 0 || draftFilterTypes.length === ALL_CALENDAR_FILTER_TYPES.length) {
      setFilterTypes([]);
    } else {
      setFilterTypes(draftFilterTypes);
    }
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Filter className="w-4 h-4 mr-2" />
        Filtros {filterTypes.length > 0 && `(${filterTypes.length})`}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtrar Eventos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Eventos Escolares</span>
              <Switch checked={draftFilterTypes.includes('escolar')}
                      onCheckedChange={() => toggleFilter('escolar')}
                      aria-label="Filtrar eventos escolares"
                      data-tooltip="Filtrar eventos escolares" />
            </div>
            <div className="flex items-center justify-between">
              <span>Aulas</span>
              <Switch checked={draftFilterTypes.includes('aula')}
                      onCheckedChange={() => toggleFilter('aula')}
                      aria-label="Filtrar aulas"
                      data-tooltip="Filtrar aulas" />
            </div>
            <div className="flex items-center justify-between">
              <span>Atividades</span>
              <Switch checked={draftFilterTypes.includes('atividade')}
                      onCheckedChange={() => toggleFilter('atividade')}
                      aria-label="Filtrar atividades"
                      data-tooltip="Filtrar atividades" />
            </div>
            {Object.keys(EVENT_TYPES).map(type => (
              <div key={type} className="flex items-center justify-between">
                <span>{EVENT_TYPES[type].label}</span>
                <Switch checked={draftFilterTypes.includes(type)}
                        onCheckedChange={() => toggleFilter(type)}
                        aria-label={`Filtrar ${EVENT_TYPES[type].label}`}
                        data-tooltip={`Filtrar ${EVENT_TYPES[type].label}`} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setDraftFilterTypes([...ALL_CALENDAR_FILTER_TYPES])}>
              Mostrar Todos
            </Button>
            <Button onClick={applyFilters}>Aplicar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EventDialog({ open, onClose, onSave, onDelete, event, classes }) {
  const [formData, setFormData] = useState(DEFAULT_EVENT_FORM_DATA);

  useEffect(() => {
    if (event) {
      setFormData({
        ...DEFAULT_EVENT_FORM_DATA,
        title: event.title || '',
        description: event.description || '',
        event_type: event.event_type || 'office_hours',
        start_datetime: event.start_datetime || '',
        end_datetime: event.end_datetime || '',
        all_day: event.all_day || false,
        location: event.location || '',
        is_online: event.is_online || false,
        meeting_url: event.meeting_url || '',
        related_class_id: event.related_class_id || '',
        visibility: event.visibility || 'privado',
        color: event.color || '#6366f1',
        reminder_minutes_before: event.reminder_minutes_before || 15
      });
      return;
    }

    setFormData(DEFAULT_EVENT_FORM_DATA);
  }, [event, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event && event.id ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Tipo de Evento *</Label>
            <Select value={formData.event_type} onValueChange={(value) => setFormData({ ...formData, event_type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Data/Hora Início *</Label>
              <Input
                type="datetime-local"
                value={formData.start_datetime}
                onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Data/Hora Fim *</Label>
              <Input
                type="datetime-local"
                value={formData.end_datetime}
                onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Local</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div>
              <Label>Turma Relacionada</Label>
              <Select value={formData.related_class_id} onValueChange={(value) => setFormData({ ...formData, related_class_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Nenhuma</SelectItem>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch 
                checked={formData.is_online}
                onCheckedChange={(checked) => setFormData({ ...formData, is_online: checked })}
                aria-label="Evento online"
                data-tooltip="Evento online"
              />
              <Label>Evento Online</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={formData.all_day}
                onCheckedChange={(checked) => setFormData({ ...formData, all_day: checked })}
                aria-label="Dia inteiro"
                data-tooltip="Dia inteiro"
              />
              <Label>Dia Inteiro</Label>
            </div>
          </div>

          {formData.is_online && (
            <div>
              <Label>Link da Reunião</Label>
              <Input
                type="url"
                value={formData.meeting_url}
                onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                placeholder="https://meet.google.com/..."
              />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Visibilidade</Label>
              <Select value={formData.visibility} onValueChange={(value) => setFormData({ ...formData, visibility: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="privado">Privado</SelectItem>
                  <SelectItem value="turma">Compartilhar com Turma</SelectItem>
                  <SelectItem value="publico">Público</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lembrete (minutos antes)</Label>
              <Input
                type="number"
                value={formData.reminder_minutes_before}
                onChange={(e) => setFormData({ ...formData, reminder_minutes_before: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex justify-between">
            <div className="flex gap-2">
              {event && event.id && (
                <Button type="button" variant="destructive" onClick={() => {
                  onDelete(event.id);
                  onClose();
                }}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
