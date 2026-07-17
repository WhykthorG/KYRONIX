import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, BookOpen, MapPin } from 'lucide-react';
import { ScheduleEntryApi, ClassApi, SubjectApi } from '@/services/supabaseApi';
import { useAuth } from '@/lib/AuthContext';

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const TIME_SLOTS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

export default function StudentSchedule() {
  const { user } = useAuth();

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['student-classes', user?.id],
    queryFn: () => ClassApi.list(),
    enabled: !!user?.id,
  });

  const studentClasses = useMemo(() => {
    return classes.filter((c) =>
      c.students?.some((s) => s.id === user?.id) ||
      c.student_ids?.includes(user?.id)
    );
  }, [classes, user?.id]);

  const { data: allSchedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => ScheduleEntryApi.list(),
  });

  const studentSchedules = useMemo(() => {
    return allSchedules.filter((s) =>
      studentClasses.some((c) => c.id === s.class_id)
    );
  }, [allSchedules, studentClasses]);

  const scheduleByDay = useMemo(() => {
    const grouped = {};
    for (let day = 0; day < 7; day++) {
      grouped[day] = [];
    }
    for (const schedule of studentSchedules) {
      const day = schedule.day_of_week ?? new Date(schedule.date).getDay();
      if (grouped[day]) {
        grouped[day].push(schedule);
      }
    }
    for (const day of Object.keys(grouped)) {
      grouped[day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    }
    return grouped;
  }, [studentSchedules]);

  const today = new Date().getDay();

  if (loadingClasses || loadingSchedules) {
    return (
      <div className="space-y-6">
        <PageHeader title="Minha Grade de Horários" subtitle="Carregando..." backTo="/Desktop" backLabel="Voltar" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse border-white/10 bg-slate-950/70">
              <CardContent className="p-6 h-24" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha Grade de Horários"
        subtitle={`${studentSchedules.length} aula(s) na semana`}
        backTo="/Desktop"
        backLabel="Voltar"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DAYS_OF_WEEK.map((dayName, dayIndex) => (
          <Card key={dayIndex} className={`border-white/10 bg-slate-950/70 text-white ${dayIndex === today ? 'ring-2 ring-indigo-400' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {dayName}
                {dayIndex === today && <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded">Hoje</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scheduleByDay[dayIndex]?.length > 0 ? (
                <div className="space-y-2">
                  {scheduleByDay[dayIndex].map((schedule, idx) => (
                    <div key={idx} className="p-2 rounded bg-white/5 text-sm">
                      <div className="flex items-center gap-2 text-white/70">
                        <Clock className="w-3 h-3" />
                        <span>{schedule.start_time || '—'} - {schedule.end_time || '—'}</span>
                      </div>
                      <p className="font-medium mt-1">{schedule.subject?.name || schedule.subject_name || 'Disciplina'}</p>
                      {schedule.room && (
                        <div className="flex items-center gap-1 text-xs text-white/50 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{schedule.room}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/30 text-center py-4">Sem aulas</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {studentSchedules.length === 0 && (
        <div className="text-center py-12 text-white/50">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma aula encontrada na sua grade de horários</p>
        </div>
      )}
    </div>
  );
}
