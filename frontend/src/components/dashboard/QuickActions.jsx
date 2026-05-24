import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  UserPlus, FileText, MessageSquare, Calendar,
  ClipboardList, BookOpen, Clock
} from 'lucide-react';
import { cn } from "@/lib/utils";

const actions = [
  { name: 'Novo Aluno', icon: UserPlus, appId: 'registration', route: '/Registration', appProps: { initialModeProp: 'matricula' }, color: 'bg-[hsl(var(--feedback-info-bg))] text-[hsl(var(--feedback-info-fg))]' },
  { name: 'Lançar Notas', icon: ClipboardList, appId: 'grades', route: '/Grades', color: 'bg-[hsl(var(--feedback-success-bg))] text-[hsl(var(--feedback-success-fg))]' },
  { name: 'Chamada', icon: Clock, appId: 'attendance', route: '/Attendance', color: 'bg-[hsl(var(--accent))] text-primary' },
  { name: 'Nova Atividade', icon: FileText, appId: 'assignments', route: '/Assignments', color: 'bg-[hsl(var(--chart-4)/0.16)] text-[hsl(var(--chart-4))]' },
  { name: 'Comunicado', icon: MessageSquare, appId: 'messages', route: '/Messages', color: 'bg-[hsl(var(--feedback-warning-bg))] text-[hsl(var(--feedback-warning-fg))]' },
  { name: 'Biblioteca', icon: BookOpen, appId: 'library', route: '/LibraryPage', color: 'bg-[hsl(var(--chart-5)/0.14)] text-[hsl(var(--chart-5))]' },
  { name: 'Calendário', icon: Calendar, appId: 'schoolcalendar', route: '/SchoolCalendar', color: 'bg-[hsl(var(--feedback-danger-bg))] text-[hsl(var(--feedback-danger-fg))]' },
];

export default function QuickActions({ openApp }) {
  const navigate = useNavigate();

  const handleAction = (action) => {
    if (openApp) {
      openApp(action.appId, action.appProps);
      return;
    }

    navigate('/Desktop', {
      state: {
        desktopOpenAppId: action.appId,
        desktopOpenAppProps: action.appProps || undefined,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {actions.map((action) => (
            <button
              key={action.name}
              type="button"
              onClick={() => handleAction(action)}
              className="group flex min-h-[124px] flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)+2px)] border border-border/75 bg-card/70 p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/45"
            >
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105",
                action.color
              )}>
                <action.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold leading-5 text-foreground">{action.name}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
