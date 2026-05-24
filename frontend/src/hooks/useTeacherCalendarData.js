// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
import { useCallback, useMemo, useReducer } from 'react';

import { toast } from 'sonner';

import {
  AssignmentApi,
  ClassApi,
  DiaryApi,
  EventApi,
  TeacherApi,
  TeacherCalendarApi,
  UserProfileApi,
} from '@/services/supabaseApi';
import { buildCalendarFilename, buildIcsCalendar } from '@/lib/calendarExport';

const initialState = {
  loading: true,
  syncing: false,
  exporting: false,
  teacher: null,
  events: [],
  schoolEvents: [],
  classes: [],
  assignments: [],
  diaryEntries: [],
};

function teacherCalendarReducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return {
        ...state,
        loading: true,
      };
    case 'LOAD_SUCCESS':
      return {
        ...state,
        loading: false,
        teacher: action.payload.teacher,
        events: action.payload.events,
        schoolEvents: action.payload.schoolEvents,
        classes: action.payload.classes,
        assignments: action.payload.assignments,
        diaryEntries: action.payload.diaryEntries,
      };
    case 'LOAD_EMPTY':
      return {
        ...state,
        loading: false,
        teacher: null,
        events: [],
        schoolEvents: [],
        classes: [],
        assignments: [],
        diaryEntries: [],
      };
    case 'SYNC_START':
      return {
        ...state,
        syncing: true,
      };
    case 'SYNC_END':
      return {
        ...state,
        syncing: false,
      };
    case 'EXPORT_START':
      return {
        ...state,
        exporting: true,
      };
    case 'EXPORT_END':
      return {
        ...state,
        exporting: false,
      };
    default:
      return state;
  }
}

export function useTeacherCalendarData({ authUser, filterTypes, eventTypes }) {
  const [state, dispatch] = useReducer(teacherCalendarReducer, initialState);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      const currentAuthUser = authUser;
      if (!currentAuthUser) {
        dispatch({ type: 'LOAD_EMPTY' });
        return false;
      }

      dispatch({ type: 'LOAD_START' });

      const currentUser = { email: currentAuthUser.email, id: currentAuthUser.id };
      const teacherData = await TeacherApi.filter({ email: currentUser.email });

      if (teacherData.length === 0) {
        const profiles = await UserProfileApi.filter({ user_email: currentUser.email });
        const profile = profiles[0];
        const isAdminOrCoord = profile && ['administrador', 'coordenador'].includes(profile.profile_type);

        if (!isAdminOrCoord) {
          dispatch({ type: 'LOAD_EMPTY' });
          return false;
        }

        const [generalEvents, classesData, assignmentsData, diaryData] = await Promise.all([
          EventApi.list('-start_date', 100),
          ClassApi.list(),
          AssignmentApi.list(),
          DiaryApi.list('-date', 100),
        ]);

        dispatch({
          type: 'LOAD_SUCCESS',
          payload: {
            teacher: { id: profile.id, full_name: profile.full_name, email: currentUser.email },
            events: [],
            schoolEvents: generalEvents,
            classes: classesData,
            assignments: assignmentsData,
            diaryEntries: diaryData,
          },
        });
        return true;
      }

      const teacher = teacherData[0];
      const [
        teacherEvents,
        generalEvents,
        classesData,
        assignmentsData,
        diaryData,
      ] = await Promise.all([
        TeacherCalendarApi.filter({ teacher_id: teacher.id }),
        EventApi.list('-start_date', 100),
        ClassApi.filter({ teacher_ids: teacher.id }),
        AssignmentApi.filter({ teacher_id: teacher.id }),
        DiaryApi.filter({ teacher_id: teacher.id }),
      ]);

      dispatch({
        type: 'LOAD_SUCCESS',
        payload: {
          teacher,
          events: teacherEvents,
          schoolEvents: generalEvents,
          classes: classesData,
          assignments: assignmentsData,
          diaryEntries: diaryData,
        },
      });
      return true;
    } catch (error) {
      console.error('Erro ao carregar calendário:', error);
      if (!silent) {
        toast.error('Nao foi possivel carregar o calendario.');
      }
      dispatch({ type: 'LOAD_EMPTY' });
      return false;
    }
  }, [authUser]);

  const allEvents = useMemo(() => {
    const consolidated = [];

    state.events.forEach((eventItem) => {
      if (filterTypes.length === 0 || filterTypes.includes(eventItem.event_type)) {
        consolidated.push({
          ...eventItem,
          source: 'teacher',
          start: new Date(eventItem.start_datetime),
          end: new Date(eventItem.end_datetime),
        });
      }
    });

    if (filterTypes.length === 0 || filterTypes.includes('escolar')) {
      state.schoolEvents.forEach((eventItem) => {
        consolidated.push({
          ...eventItem,
          source: 'school',
          start: new Date(eventItem.start_date),
          end: new Date(eventItem.end_date || eventItem.start_date),
        });
      });
    }

    if (filterTypes.length === 0 || filterTypes.includes('aula')) {
      state.diaryEntries.forEach((entry) => {
        consolidated.push({
          ...entry,
          title: `Aula: ${state.classes.find((schoolClass) => schoolClass.id === entry.class_id)?.name || 'Turma'}`,
          source: 'diary',
          type: 'aula',
          start: new Date(entry.date),
          end: new Date(entry.date),
        });
      });
    }

    if (filterTypes.length === 0 || filterTypes.includes('atividade')) {
      state.assignments.forEach((assignment) => {
        consolidated.push({
          ...assignment,
          title: `Entrega: ${assignment.title}`,
          source: 'assignment',
          type: 'atividade',
          start: new Date(assignment.due_date),
          end: new Date(assignment.due_date),
        });
      });
    }

    return consolidated;
  }, [filterTypes, state.assignments, state.classes, state.diaryEntries, state.events, state.schoolEvents]);

  const handleSync = useCallback(async () => {
    if (state.syncing) return;

    dispatch({ type: 'SYNC_START' });
    try {
      const synced = await loadData({ silent: true });
      if (!synced) {
        toast.error('Nao foi possivel sincronizar o calendario agora.');
        return;
      }

      toast.success('Calendario sincronizado com os dados mais recentes.');
    } finally {
      dispatch({ type: 'SYNC_END' });
    }
  }, [loadData, state.syncing]);

  const handleExport = useCallback(() => {
    if (state.exporting) return;
    if (allEvents.length === 0) {
      toast.info('Nao ha eventos para exportar no filtro atual.');
      return;
    }

    dispatch({ type: 'EXPORT_START' });

    try {
      const entries = allEvents.map((eventItem) => ({
        id: `${eventItem.source}-${eventItem.id ?? eventItem.title}`,
        title: eventItem.title,
        description: [
          eventItem.description,
          eventItem.content,
          eventItem.objectives,
          eventItem.notes,
        ].filter(Boolean).join('\n\n'),
        location: eventItem.location,
        url: eventItem.meeting_url,
        start: eventItem.start,
        end: eventItem.end,
        allDay: eventItem.all_day || ['school', 'diary', 'assignment'].includes(eventItem.source),
        categories: [
          eventItem.source === 'teacher'
            ? eventTypes[eventItem.event_type]?.label
            : eventItem.source === 'school'
              ? 'Calendario Escolar'
              : eventItem.source === 'diary'
                ? 'Aula'
                : 'Atividade',
        ],
      }));

      const file = buildIcsCalendar(entries, {
        calendarName: `Calendario de ${state.teacher?.full_name || 'Professor'}`,
      });
      const blob = new Blob([file], { type: 'text/calendar;charset=utf-8' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = buildCalendarFilename(`calendario-${state.teacher?.full_name || 'professor'}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success(`Calendario exportado com ${entries.length} evento(s).`);
    } catch (error) {
      console.error('Erro ao exportar calendario:', error);
      toast.error('Nao foi possivel exportar o calendario.');
    } finally {
      dispatch({ type: 'EXPORT_END' });
    }
  }, [allEvents, eventTypes, state.exporting, state.teacher]);

  return {
    ...state,
    allEvents,
    loadData,
    handleSync,
    handleExport,
  };
}
