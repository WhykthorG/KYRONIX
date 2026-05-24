// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
import {
  AssignmentApi,
  ClassApi,
  EventApi,
  LibraryItemApi,
  MessageApi,
  OccurrenceApi,
  StudentApi,
  SubjectApi,
  TeacherApi,
  UserProfileApi,
} from '@/services/supabaseApi';
import { canAccessPage } from '@shared/contracts/access';
import { MESSAGE_RECIPIENT_TYPES } from '@shared/contracts/messages';
import { supabase } from '@/lib/supabase';

export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;

const removeDiacritics = (value) => (
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
);

export const normalizeSearchText = (value) => (
  removeDiacritics(value)
    .toLowerCase()
    .trim()
);

export const buildSearchText = (parts) => normalizeSearchText(parts.filter(Boolean).join(' '));

const compactText = (value, maxLength = 120) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
};

const dedupeById = (records) => {
  const seen = new Set();
  return records.filter((record) => {
    if (!record?.id || seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
};

async function fetchVisibleMessages({ profileType, user }) {
  if (!user?.email) return [];

  if (profileType !== 'aluno') {
    return MessageApi.list('-created_at', 150);
  }

  const studentRecords = await StudentApi.filter({ email: user.email }, '-created_at', 1);
  const student = studentRecords[0];

  if (!student?.id) {
    return [];
  }

  const [broadcastMessages, classMessages, directResult] = await Promise.all([
    MessageApi.filter({ recipient_type: MESSAGE_RECIPIENT_TYPES.ALL }, '-created_at', 100),
    student.current_class_id
      ? MessageApi.filter({
          recipient_type: MESSAGE_RECIPIENT_TYPES.CLASS,
          class_id: student.current_class_id,
        }, '-created_at', 100)
      : [],
    supabase
      .from('messages')
      .select('*')
      .eq('recipient_type', MESSAGE_RECIPIENT_TYPES.STUDENT)
      .contains('recipient_ids', [student.id])
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (directResult.error) {
    throw directResult.error;
  }

  return dedupeById([
    ...broadcastMessages,
    ...classMessages,
    ...(directResult.data ?? []),
  ]).sort((left, right) => (
    new Date(right.created_at || right.sent_at || 0).getTime()
    - new Date(left.created_at || left.sent_at || 0).getTime()
  ));
}

export const GLOBAL_SEARCH_ENTITIES = [
  {
    key: 'students',
    label: 'Alunos',
    appId: 'students',
    page: 'Students',
    queryKey: ['global-search', 'students'],
    fetchRecords: () => StudentApi.list('-created_at', 300),
    mapRecord: (student) => ({
      id: student.id,
      title: student.full_name || 'Aluno sem nome',
      subtitle: [
        student.registration_number ? `Matrícula ${student.registration_number}` : null,
        student.email,
        student.current_grade,
      ].filter(Boolean).join(' • '),
      meta: student.enrollment_status || 'aluno',
      tokens: [
        student.full_name,
        student.registration_number,
        student.email,
        student.guardian_name,
        student.current_grade,
        student.shift,
        student.enrollment_status,
      ],
    }),
  },
  {
    key: 'teachers',
    label: 'Professores',
    appId: 'teachers',
    page: 'Teachers',
    queryKey: ['global-search', 'teachers'],
    fetchRecords: () => TeacherApi.list('-created_at', 250),
    mapRecord: (teacher) => ({
      id: teacher.id,
      title: teacher.full_name || 'Professor sem nome',
      subtitle: [
        teacher.email,
        teacher.employee_id ? `Matrícula ${teacher.employee_id}` : null,
      ].filter(Boolean).join(' • '),
      meta: teacher.status || 'professor',
      tokens: [
        teacher.full_name,
        teacher.email,
        teacher.employee_id,
        teacher.degree_area,
        teacher.education_level,
        teacher.status,
      ],
    }),
  },
  {
    key: 'classes',
    label: 'Turmas',
    appId: 'classes',
    page: 'Classes',
    queryKey: ['global-search', 'classes'],
    fetchRecords: () => ClassApi.list('-created_at', 200),
    mapRecord: (classRecord) => ({
      id: classRecord.id,
      title: classRecord.name || 'Turma sem nome',
      subtitle: [
        classRecord.grade_level,
        classRecord.year,
        classRecord.classroom,
      ].filter(Boolean).join(' • '),
      meta: classRecord.status || classRecord.shift || 'turma',
      tokens: [
        classRecord.name,
        classRecord.grade_level,
        classRecord.classroom,
        classRecord.shift,
        classRecord.status,
        classRecord.year,
      ],
    }),
  },
  {
    key: 'subjects',
    label: 'Disciplinas',
    appId: 'subjects',
    page: 'Subjects',
    queryKey: ['global-search', 'subjects'],
    fetchRecords: () => SubjectApi.list('-created_at', 250),
    mapRecord: (subject) => ({
      id: subject.id,
      title: subject.name || 'Disciplina sem nome',
      subtitle: [
        subject.code,
        subject.grade_level,
      ].filter(Boolean).join(' • '),
      meta: subject.area || (subject.is_active === false ? 'inativa' : 'ativa'),
      tokens: [
        subject.name,
        subject.code,
        subject.area,
        subject.grade_level,
        subject.syllabus,
      ],
    }),
  },
  {
    key: 'assignments',
    label: 'Atividades',
    appId: 'assignments',
    page: 'Assignments',
    queryKey: ['global-search', 'assignments'],
    fetchRecords: ({ profileType }) => (
      profileType === 'aluno'
        ? AssignmentApi.filter({ status: 'publicado' }, '-created_at', 150)
        : AssignmentApi.list('-created_at', 150)
    ),
    mapRecord: (assignment) => ({
      id: assignment.id,
      title: assignment.title || 'Atividade sem título',
      subtitle: compactText(assignment.description || assignment.instructions || '', 96),
      meta: assignment.status || assignment.type || 'atividade',
      tokens: [
        assignment.title,
        assignment.description,
        assignment.instructions,
        assignment.type,
        assignment.status,
      ],
    }),
  },
  {
    key: 'messages',
    label: 'Comunicados',
    appId: 'messages',
    page: 'Messages',
    queryKey: ['global-search', 'messages'],
    fetchRecords: fetchVisibleMessages,
    mapRecord: (message) => ({
      id: message.id,
      title: message.subject || 'Comunicado sem assunto',
      subtitle: compactText(message.content || '', 96),
      meta: message.category || message.priority || 'comunicado',
      tokens: [
        message.subject,
        message.content,
        message.category,
        message.priority,
        message.status,
      ],
    }),
  },
  {
    key: 'occurrences',
    label: 'Ocorrências',
    appId: 'occurrences',
    page: 'Occurrences',
    queryKey: ['global-search', 'occurrences'],
    fetchRecords: () => OccurrenceApi.list('-date', 250),
    mapRecord: (occurrence) => ({
      id: occurrence.id,
      title: occurrence.title || 'Ocorrência sem título',
      subtitle: [
        occurrence.type,
        occurrence.date,
        occurrence.reporter_name,
      ].filter(Boolean).join(' • '),
      meta: occurrence.severity || occurrence.status || 'ocorrência',
      tokens: [
        occurrence.title,
        occurrence.description,
        occurrence.type,
        occurrence.severity,
        occurrence.status,
        occurrence.date,
        occurrence.reporter_name,
      ],
    }),
  },
  {
    key: 'library',
    label: 'Biblioteca',
    appId: 'library',
    page: 'LibraryPage',
    queryKey: ['global-search', 'library'],
    fetchRecords: () => LibraryItemApi.list('-created_at', 250),
    mapRecord: (item) => ({
      id: item.id,
      title: item.title || 'Item sem título',
      subtitle: [
        item.author,
        item.isbn,
      ].filter(Boolean).join(' • '),
      meta: item.type || (item.available_copies > 0 ? 'disponível' : 'indisponível'),
      tokens: [
        item.title,
        item.author,
        item.isbn,
        item.publisher,
        item.description,
        item.location,
        item.type,
      ],
    }),
  },
  {
    key: 'events',
    label: 'Calendário',
    appId: 'schoolcalendar',
    page: 'SchoolCalendar',
    queryKey: ['global-search', 'events'],
    fetchRecords: () => EventApi.list('-start_date', 250),
    mapRecord: (event) => ({
      id: event.id,
      title: event.title || 'Evento sem título',
      subtitle: [
        event.location,
        event.start_date,
      ].filter(Boolean).join(' • '),
      meta: event.type || event.status || 'evento',
      tokens: [
        event.title,
        event.description,
        event.location,
        event.type,
        event.status,
        event.start_date,
      ],
    }),
  },
  {
    key: 'users',
    label: 'Usuários',
    appId: 'users',
    page: 'UserManagement',
    queryKey: ['global-search', 'users'],
    fetchRecords: () => UserProfileApi.list('-created_at', 250),
    mapRecord: (profile) => ({
      id: profile.id,
      title: profile.full_name || 'Usuário sem nome',
      subtitle: [
        profile.user_email,
        profile.department,
      ].filter(Boolean).join(' • '),
      meta: profile.profile_type || profile.status || 'usuário',
      tokens: [
        profile.full_name,
        profile.user_email,
        profile.department,
        profile.profile_type,
        profile.status,
      ],
    }),
  },
];

export const GLOBAL_SEARCH_ENTITIES_BY_KEY = Object.fromEntries(
  GLOBAL_SEARCH_ENTITIES.map(entity => [entity.key, entity])
);

export const getSearchableEntitiesForRole = (profileType) => (
  GLOBAL_SEARCH_ENTITIES.filter((entity) => canAccessPage(profileType, entity.page))
);

export const buildSearchIndexItem = (entity, record) => {
  const mapped = entity.mapRecord(record);
  return {
    ...mapped,
    appId: entity.appId,
    entityKey: entity.key,
    entityLabel: entity.label,
    searchText: buildSearchText([
      mapped.title,
      mapped.subtitle,
      mapped.meta,
      ...(mapped.tokens || []),
    ]),
  };
};

export const rankSearchResult = (item, normalizedQuery) => {
  const title = normalizeSearchText(item.title);
  const subtitle = normalizeSearchText(item.subtitle);

  if (title === normalizedQuery) return 0;
  if (title.startsWith(normalizedQuery)) return 1;
  if (title.includes(normalizedQuery)) return 2;
  if (subtitle.startsWith(normalizedQuery)) return 3;
  if (subtitle.includes(normalizedQuery)) return 4;
  return 5;
};
