import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function UpcomingEvents({ events = [] }) {
  const getEventColor = (type) => {
    const colors = {
      aula: "bg-[hsl(var(--feedback-info-bg))] text-[hsl(var(--feedback-info-fg))] border-transparent",
      prova: "bg-[hsl(var(--feedback-danger-bg))] text-[hsl(var(--feedback-danger-fg))] border-transparent",
      reuniao: "bg-[hsl(var(--chart-4)/0.16)] text-[hsl(var(--chart-4))] border-transparent",
      evento: "bg-[hsl(var(--feedback-success-bg))] text-[hsl(var(--feedback-success-fg))] border-transparent",
      feriado: "bg-[hsl(var(--feedback-warning-bg))] text-[hsl(var(--feedback-warning-fg))] border-transparent",
    };
    return colors[type] || "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent";
  };

  const defaultEvents = [
    { id: 1, title: 'Reunião de Pais', type: 'reuniao', start_date: new Date(Date.now() + 86400000), location: 'Auditório' },
    { id: 2, title: 'Prova de Matemática - 9º Ano', type: 'prova', start_date: new Date(Date.now() + 172800000), location: 'Sala 10' },
    { id: 3, title: 'Feira de Ciências', type: 'evento', start_date: new Date(Date.now() + 432000000), location: 'Pátio' },
    { id: 4, title: 'Conselho de Classe', type: 'reuniao', start_date: new Date(Date.now() + 604800000), location: 'Sala dos Professores' },
  ];

  const displayEvents = events.length > 0 ? events : defaultEvents;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Próximos Eventos</CardTitle>
        <Calendar className="w-5 h-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {displayEvents.slice(0, 4).map((event) => (
          <div key={event.id} className="app-list-item">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium text-foreground">{event.title}</h4>
              <Badge variant="outline" className={getEventColor(event.type)}>
                {event.type}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{format(new Date(event.start_date), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
              </div>
              {event.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
