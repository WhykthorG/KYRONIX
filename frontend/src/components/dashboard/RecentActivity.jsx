import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GraduationCap, ClipboardList } from 'lucide-react';
import StatePanel from '@/components/common/StatePanel';

export default function RecentActivity({ students = [], grades = [] }) {
  // Build activity list from real data
  const activities = [];

  // Recent students enrolled
  students
    .filter(s => s.enrollment_date)
    .sort((a, b) => new Date(b.enrollment_date) - new Date(a.enrollment_date))
    .slice(0, 3)
    .forEach(s => {
      activities.push({
        id: `s-${s.id}`,
        type: 'matricula',
        title: 'Aluno matriculado',
        description: `${s.full_name}${s.current_grade ? ` - ${s.current_grade}` : ''}`,
        time: s.enrollment_date,
      });
    });

  // Recent grades launched
  grades
    .filter(g => g.evaluation_date)
    .sort((a, b) => new Date(b.evaluation_date) - new Date(a.evaluation_date))
    .slice(0, 3)
    .forEach(g => {
      activities.push({
        id: `g-${g.id}`,
        type: 'nota',
        title: 'Nota lançada',
        description: `${g.evaluation_name || 'Avaliação'} - Nota: ${g.score ?? '-'}`,
        time: g.evaluation_date,
      });
    });

  // Sort all activities by time desc and take top 5
  activities.sort((a, b) => new Date(b.time) - new Date(a.time));
  const display = activities.slice(0, 5);

  const colorMap = {
    matricula: 'bg-[hsl(var(--feedback-success-bg))] text-[hsl(var(--feedback-success-fg))]',
    nota: 'bg-[hsl(var(--feedback-info-bg))] text-[hsl(var(--feedback-info-fg))]',
  };

  const IconMap = {
    matricula: GraduationCap,
    nota: ClipboardList,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Atividades Recentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {display.length === 0 ? (
          <StatePanel
            compact
            variant="empty"
            title="Nenhuma atividade recente"
            description="Quando alunos, notas e outros eventos forem atualizados, eles aparecerão aqui."
          />
        ) : (
          display.map((activity) => {
            const Icon = IconMap[activity.type] || GraduationCap;
            return (
              <div key={activity.id} className="app-list-item">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorMap[activity.type] || 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{activity.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(activity.time), "dd/MM", { locale: ptBR })}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
