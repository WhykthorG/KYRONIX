// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
/**
 * src/lib/appManifest.js
 * ─────────────────────────────────────────────────────────────────────────────
 * FONTE CANÔNICA de metadados de aplicativos do sistema.
 *
 * Substitui e unifica:
 *   - ALL_APPS (Desktop.jsx)             — catálogo de ícones e cores
 *   - PAGE_TO_DESKTOP_APP (App.jsx)      — mapeamento página → appId
 *   - appRegistry.js                     — lazy imports
 *   — busca global: RPC search_workspace + canAccessPage
 *
 * Todo código que precise de \"quais apps existem\" deve importar daqui.
 */

import {
  LayoutDashboard, GraduationCap, Users, School, BookOpen,
  ClipboardList, Clock, FileText, Calendar, MessageSquare,
  Library, BarChart3, Settings, Target, Shield, BookMarked,
  PhoneCall,
  AlertTriangle, WandSparkles, Briefcase, Building2, FlaskConical, Award, CheckCircle
} from 'lucide-react';
import { PERMISSIONS } from '@shared/contracts/access';

/**
 * @typedef {Object} WindowConfig
 * @property {'singleton'|'record'} mode
 * @property {{ width: number, height: number }} [defaultSize]
 */

/**
 * @typedef {Object} AppManifestEntry
 * @property {string}   id             — identificador único kebab-case
 * @property {string}   page           — chave no appRegistry / nome da página JSX
 * @property {string}   title          — rótulo exibido na UI
 * @property {any}      icon           — componente Lucide
 * @property {string}   iconColor      — cor do ícone (hex)
 * @property {string}   bgColor        — cor de fundo do ícone (hex)
 * @property {string[]} permissions    — permissões necessárias (OR) para acessar
 * @property {() => Promise<any>} load — dynamic import da página
 * @property {WindowConfig} window     — comportamento da janela
 * @property {{ enabled: boolean }} search — aparece na busca global?
 */

/** @type {Record<string, AppManifestEntry>} */
export const appManifest = {
  dashboard: {
    id: 'dashboard',
    page: 'Dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    iconColor: '#6366f1',
    bgColor: '#1e1b4b',
    permissions: [PERMISSIONS.DASHBOARD_VIEW],
    load: () => import('@/pages/Dashboard'),
    window: { mode: 'singleton', defaultSize: { width: 1200, height: 760 } },
    search: { enabled: false },
  },
  students: {
    id: 'students',
    page: 'Students',
    title: 'Alunos',
    icon: GraduationCap,
    iconColor: '#10b981',
    bgColor: '#064e3b',
    permissions: [PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ_SELF],
    load: () => import('@/pages/Students'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  teachers: {
    id: 'teachers',
    page: 'Teachers',
    title: 'Professores',
    icon: Users,
    iconColor: '#f59e0b',
    bgColor: '#451a03',
    permissions: [PERMISSIONS.TEACHERS_READ],
    load: () => import('@/pages/Teachers'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  classes: {
    id: 'classes',
    page: 'Classes',
    title: 'Turmas',
    icon: School,
    iconColor: '#3b82f6',
    bgColor: '#1e3a5f',
    permissions: [PERMISSIONS.CLASSES_READ],
    load: () => import('@/pages/Classes'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  subjects: {
    id: 'subjects',
    page: 'Subjects',
    title: 'Disciplinas',
    icon: BookOpen,
    iconColor: '#8b5cf6',
    bgColor: '#312e81',
    permissions: [PERMISSIONS.SUBJECTS_READ],
    load: () => import('@/pages/Subjects'),
    window: { mode: 'singleton', defaultSize: { width: 1000, height: 680 } },
    search: { enabled: true },
  },
  grades: {
    id: 'grades',
    page: 'Grades',
    title: 'Notas',
    icon: ClipboardList,
    iconColor: '#ec4899',
    bgColor: '#500724',
    permissions: [PERMISSIONS.GRADES_READ],
    load: () => import('@/pages/Grades'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  attendance: {
    id: 'attendance',
    page: 'Attendance',
    title: 'Chamada',
    icon: Clock,
    iconColor: '#06b6d4',
    bgColor: '#083344',
    permissions: [PERMISSIONS.ATTENDANCE_READ],
    load: () => import('@/pages/Attendance'),
    window: { mode: 'singleton', defaultSize: { width: 1000, height: 680 } },
    search: { enabled: false },
  },
  assignments: {
    id: 'assignments',
    page: 'Assignments',
    title: 'Atividades',
    icon: FileText,
    iconColor: '#f97316',
    bgColor: '#431407',
    permissions: [PERMISSIONS.ASSIGNMENTS_READ],
    load: () => import('@/pages/Assignments'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  schoolcalendar: {
    id: 'schoolcalendar',
    page: 'SchoolCalendar',
    title: 'Cal. Escolar',
    icon: Calendar,
    iconColor: '#84cc16',
    bgColor: '#1a2e05',
    permissions: [PERMISSIONS.SCHOOL_CALENDAR_VIEW],
    load: () => import('@/pages/SchoolCalendar'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  teachercalendar: {
    id: 'teachercalendar',
    page: 'TeacherCalendar',
    title: 'Cal. Professor',
    icon: Calendar,
    iconColor: '#a3e635',
    bgColor: '#1a2e05',
    permissions: [PERMISSIONS.TEACHER_CALENDAR_VIEW],
    load: () => import('@/pages/TeacherCalendar'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: false },
  },
  scheduleplanner: {
    id: 'scheduleplanner',
    page: 'SchedulePlanner',
    title: 'Horários',
    icon: WandSparkles,
    iconColor: '#0f766e',
    bgColor: '#042f2e',
    permissions: [PERMISSIONS.SCHEDULES_MANAGE, PERMISSIONS.SCHEDULES_RESPOND],
    load: () => import('@/pages/SchedulePlanner'),
    window: { mode: 'singleton', defaultSize: { width: 1320, height: 820 } },
    search: { enabled: true },
  },
  messages: {
    id: 'messages',
    page: 'Messages',
    title: 'Comunicados',
    icon: MessageSquare,
    iconColor: '#22d3ee',
    bgColor: '#0c2233',
    permissions: [PERMISSIONS.MESSAGES_READ],
    load: () => import('@/pages/Messages'),
    window: { mode: 'singleton', defaultSize: { width: 1000, height: 680 } },
    search: { enabled: true },
  },
  calls: {
    id: 'calls',
    page: 'Calls',
    title: 'Ligações',
    icon: PhoneCall,
    iconColor: '#38bdf8',
    bgColor: '#082f49',
    permissions: [PERMISSIONS.CALLS_USE],
    load: () => import('@/pages/Calls'),
    window: { mode: 'singleton', defaultSize: { width: 1480, height: 900 } },
    search: { enabled: true },
  },
  library: {
    id: 'library',
    page: 'LibraryPage',
    title: 'Biblioteca',
    icon: Library,
    iconColor: '#a78bfa',
    bgColor: '#1e0a4b',
    permissions: [PERMISSIONS.LIBRARY_READ],
    load: () => import('@/pages/LibraryPage'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  reports: {
    id: 'reports',
    page: 'Reports',
    title: 'Relatórios',
    icon: BarChart3,
    iconColor: '#fb923c',
    bgColor: '#431407',
    permissions: [PERMISSIONS.REPORTS_VIEW],
    load: () => import('@/pages/Reports'),
    window: { mode: 'singleton', defaultSize: { width: 1200, height: 760 } },
    search: { enabled: false },
  },
  occurrences: {
    id: 'occurrences',
    page: 'Occurrences',
    title: 'Ocorrências',
    icon: AlertTriangle,
    iconColor: '#ef4444',
    bgColor: '#431407',
    permissions: [PERMISSIONS.OCCURRENCES_READ],
    load: () => import('@/pages/Occurrences'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  diary: {
    id: 'diary',
    page: 'Diary',
    title: 'Diário',
    icon: BookMarked,
    iconColor: '#34d399',
    bgColor: '#022c22',
    permissions: [PERMISSIONS.DIARY_WRITE],
    load: () => import('@/pages/Diary'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: false },
  },
  goals: {
    id: 'goals',
    page: 'StudentGoals',
    title: 'Metas',
    icon: Target,
    iconColor: '#f472b6',
    bgColor: '#500724',
    permissions: [PERMISSIONS.GOALS_MANAGE_SELF],
    load: () => import('@/pages/StudentGoals'),
    window: { mode: 'singleton', defaultSize: { width: 900, height: 640 } },
    search: { enabled: false },
  },
  guardianportal: {
    id: 'guardianportal',
    page: 'GuardianPortal',
    title: 'Portal Resp.',
    icon: Users,
    iconColor: '#38bdf8',
    bgColor: '#082f49',
    permissions: [PERMISSIONS.GUARDIAN_PORTAL_VIEW],
    load: () => import('@/pages/GuardianPortal'),
    window: { mode: 'singleton', defaultSize: { width: 1000, height: 680 } },
    search: { enabled: false },
  },
  teacherportal: {
    id: 'teacherportal',
    page: 'TeacherPortal',
    title: 'Portal Prof.',
    icon: Users,
    iconColor: '#fde68a',
    bgColor: '#3b1c08',
    permissions: [PERMISSIONS.TEACHER_PORTAL_VIEW],
    load: () => import('@/pages/TeacherPortal'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: false },
  },
  academicrecord: {
    id: 'academicrecord',
    page: 'AcademicRecord',
    title: 'Reg. Acadêmico',
    icon: ClipboardList,
    iconColor: '#67e8f9',
    bgColor: '#0c2233',
    permissions: [PERMISSIONS.ACADEMIC_RECORD_VIEW],
    load: () => import('@/pages/AcademicRecord'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: false },
  },
  teacherhomework: {
    id: 'teacherhomework',
    page: 'TeacherHomework',
    title: 'Tarefas Prof.',
    icon: BookMarked,
    iconColor: '#fcd34d',
    bgColor: '#3b2000',
    permissions: [PERMISSIONS.ASSIGNMENTS_WRITE],
    load: () => import('@/pages/TeacherHomework'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: false },
  },
  studenthomework: {
    id: 'studenthomework',
    page: 'StudentHomework',
    title: 'Minhas Tarefas',
    icon: BookMarked,
    iconColor: '#86efac',
    bgColor: '#052e1d',
    permissions: [PERMISSIONS.ASSIGNMENTS_READ],
    load: () => import('@/pages/StudentHomework'),
    window: { mode: 'singleton', defaultSize: { width: 1000, height: 680 } },
    search: { enabled: false },
  },
  registration: {
    id: 'registration',
    page: 'Registration',
    title: 'Cadastro',
    icon: GraduationCap,
    iconColor: '#6ee7b7',
    bgColor: '#064e3b',
    permissions: [PERMISSIONS.STUDENT_ENROLLMENT],
    load: () => import('@/pages/Registration'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: false },
  },
  users: {
    id: 'users',
    page: 'UserManagement',
    title: 'Usuários',
    icon: Shield,
    iconColor: '#fbbf24',
    bgColor: '#451a03',
    permissions: [PERMISSIONS.USERS_MANAGE],
    load: () => import('@/pages/UserManagement'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  settings: {
    id: 'settings',
    page: 'SettingsPage',
    title: 'Configurações',
    icon: Settings,
    iconColor: '#94a3b8',
    bgColor: '#1e293b',
    permissions: [PERMISSIONS.SETTINGS_READ],
    load: () => import('@/pages/SettingsPage'),
    window: { mode: 'singleton', defaultSize: { width: 900, height: 640 } },
    search: { enabled: false },
  },
  internships: {
    id: 'internships',
    page: 'Internships',
    title: 'Estágios',
    icon: Briefcase,
    iconColor: '#0ea5e9',
    bgColor: '#0c4a6e',
    permissions: [PERMISSIONS.INTERNSHIPS_READ],
    load: () => import('@/pages/Internships'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  internship_companies: {
    id: 'internship_companies',
    page: 'InternshipCompanies',
    title: 'Empresas Conveniadas',
    icon: Building2,
    iconColor: '#10b981',
    bgColor: '#064e3b',
    permissions: [PERMISSIONS.INTERNSHIP_COMPANIES_READ],
    load: () => import('@/pages/InternshipCompanies'),
    window: { mode: 'singleton', defaultSize: { width: 1000, height: 650 } },
    search: { enabled: true },
  },
  tcc_projects: {
    id: 'tcc_projects',
    page: 'TCCProjects',
    title: 'TCC / Projeto Integrador',
    icon: GraduationCap,
    iconColor: '#8b5cf6',
    bgColor: '#4c1d95',
    permissions: [PERMISSIONS.TCC_READ],
    load: () => import('@/pages/TCCProjects'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  laboratories: {
    id: 'laboratories',
    page: 'Laboratories',
    title: 'Laboratórios',
    icon: FlaskConical,
    iconColor: '#06b6d4',
    bgColor: '#164e63',
    permissions: [PERMISSIONS.LABORATORIES_READ],
    load: () => import('@/pages/Laboratories'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  assessments_improvements: {
    id: 'assessments_improvements',
    page: 'AssessmentsImprovements',
    title: 'Avaliações e Conselho',
    icon: ClipboardList,
    iconColor: '#f59e0b',
    bgColor: '#78350f',
    permissions: [PERMISSIONS.GRADES_READ],
    load: () => import('@/pages/AssessmentsImprovements'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
  courses: {
    id: 'courses',
    page: 'Courses',
    title: 'Cursos e Séries',
    icon: GraduationCap,
    iconColor: '#6366f1',
    bgColor: '#312e81',
    permissions: [PERMISSIONS.COURSES_READ],
    load: () => import('@/pages/Courses'),
    window: { mode: 'singleton', defaultSize: { width: 1000, height: 650 } },
    search: { enabled: true },
  },
  certificates: {
    id: 'certificates',
    page: 'Certificates',
    title: 'Certificados',
    icon: Award,
    iconColor: '#eab308',
    bgColor: '#713f12',
    permissions: [PERMISSIONS.CERTIFICATES_READ],
    load: () => import('@/pages/Certificates'),
    window: { mode: 'singleton', defaultSize: { width: 1000, height: 650 } },
    search: { enabled: true },
  },
  student_internship: {
    id: 'student_internship',
    page: 'StudentInternship',
    title: 'Meu Estágio',
    icon: Briefcase,
    iconColor: '#0ea5e9',
    bgColor: '#0c4a6e',
    permissions: [PERMISSIONS.INTERNSHIPS_READ_SELF],
    load: () => import('@/pages/StudentInternship'),
    window: { mode: 'singleton', defaultSize: { width: 900, height: 600 } },
    search: { enabled: false },
  },
  student_tcc: {
    id: 'student_tcc',
    page: 'StudentTCC',
    title: 'Meu TCC',
    icon: BookOpen,
    iconColor: '#8b5cf6',
    bgColor: '#4c1d95',
    permissions: [PERMISSIONS.TCC_READ_SELF],
    load: () => import('@/pages/StudentTCC'),
    window: { mode: 'singleton', defaultSize: { width: 900, height: 600 } },
    search: { enabled: false },
  },
  student_schedule: {
    id: 'student_schedule',
    page: 'StudentSchedule',
    title: 'Minha Grade',
    icon: Calendar,
    iconColor: '#10b981',
    bgColor: '#064e3b',
    permissions: [PERMISSIONS.STUDENTS_READ_SELF],
    load: () => import('@/pages/StudentSchedule'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: false },
  },
  student_attendance: {
    id: 'student_attendance',
    page: 'StudentAttendance',
    title: 'Minha Frequência',
    icon: CheckCircle,
    iconColor: '#22c55e',
    bgColor: '#14532d',
    permissions: [PERMISSIONS.STUDENTS_READ_SELF],
    load: () => import('@/pages/StudentAttendance'),
    window: { mode: 'singleton', defaultSize: { width: 900, height: 600 } },
    search: { enabled: false },
  },
  exam_calendar: {
    id: 'exam_calendar',
    page: 'ExamCalendar',
    title: 'Calendário de Provas',
    icon: FileText,
    iconColor: '#ef4444',
    bgColor: '#7f1d1d',
    permissions: [PERMISSIONS.GRADES_READ],
    load: () => import('@/pages/ExamCalendar'),
    window: { mode: 'singleton', defaultSize: { width: 1100, height: 700 } },
    search: { enabled: true },
  },
};

// ─── Helpers derivados ────────────────────────────────────────────────────────

/** Array ordenado de todas as entradas do manifesto */
export const ALL_APP_ENTRIES = Object.values(appManifest);

/**
 * Retorna um app pelo seu ID.
 * @param {string} id
 * @returns {AppManifestEntry | undefined}
 */
export function getAppById(id) {
  return appManifest[id];
}

/**
 * Retorna um app pelo nome da página (page key).
 * @param {string} pageName
 * @returns {AppManifestEntry | undefined}
 */
export function getAppByPage(pageName) {
  return ALL_APP_ENTRIES.find(app => app.page === pageName);
}

/**
 * Filtra os apps acessíveis para um dado perfil usando a função canAccessPage.
 * @param {string} profileType
 * @param {(profileType: string, pageName: string) => boolean} canAccessFn
 * @returns {AppManifestEntry[]}
 */
export function getAppsForProfile(profileType, canAccessFn) {
  if (!profileType || !canAccessFn) return [];
  return ALL_APP_ENTRIES.filter((app) => (
    (Array.isArray(app.permissions) && app.permissions.length === 0)
    || canAccessFn(profileType, app.page)
  ));
}

/**
 * Retorna apps habilitados para busca global e acessíveis ao perfil atual.
 * @param {string} profileType
 * @param {(profileType: string, pageName: string) => boolean} canAccessFn
 * @returns {AppManifestEntry[]}
 */
export function getSearchableAppsForProfile(profileType, canAccessFn) {
  return getAppsForProfile(profileType, canAccessFn).filter(app => app.search?.enabled);
}

/**
 * Constante tipada de IDs (evita typos em strings espalhadas pelo código).
 */
export const APP_IDS = Object.freeze(
  Object.fromEntries(ALL_APP_ENTRIES.map(app => [app.id.toUpperCase().replace(/-/g, '_'), app.id]))
);
