// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
export const SYSTEM_EXPORT_FORMATS = Object.freeze({
  XLSX: 'xlsx',
  CSV: 'csv',
});

export const SYSTEM_EXPORT_BATCH_SIZE = 250;

export const SYSTEM_EXPORT_DATASETS = Object.freeze([
  { key: 'app_settings', label: 'Configuracoes do sistema', tableName: 'app_settings' },
  { key: 'user_profiles', label: 'Perfis e acessos', tableName: 'user_profiles' },
  { key: 'students', label: 'Alunos', tableName: 'students' },
  { key: 'teachers', label: 'Professores', tableName: 'teachers' },
  { key: 'classes', label: 'Turmas', tableName: 'classes' },
  { key: 'subjects', label: 'Materias', tableName: 'subjects' },
  { key: 'schedules', label: 'Horarios', tableName: 'schedules' },
  { key: 'events', label: 'Eventos', tableName: 'events' },
  { key: 'teacher_calendar_events', label: 'Calendario docente', tableName: 'teacher_calendar_events' },
  { key: 'messages', label: 'Comunicados', tableName: 'messages' },
  { key: 'direct_messages', label: 'Mensagens diretas', tableName: 'direct_messages' },
  { key: 'assignments', label: 'Atividades', tableName: 'assignments' },
  { key: 'submissions', label: 'Entregas', tableName: 'submissions' },
  { key: 'assignment_views', label: 'Visualizacoes de atividades', tableName: 'assignment_views' },
  { key: 'grades', label: 'Notas', tableName: 'grades' },
  { key: 'attendance', label: 'Frequencia', tableName: 'attendance' },
  { key: 'class_diary', label: 'Diario de classe', tableName: 'class_diary' },
  { key: 'lesson_plans', label: 'Planos de aula', tableName: 'lesson_plans' },
  { key: 'library_items', label: 'Biblioteca acervo', tableName: 'library_items' },
  { key: 'library_loans', label: 'Biblioteca emprestimos', tableName: 'library_loans' },
  { key: 'goals', label: 'Metas', tableName: 'goals' },
  { key: 'goal_tasks', label: 'Tarefas de metas', tableName: 'goal_tasks' },
  { key: 'occurrences', label: 'Ocorrencias', tableName: 'occurrences' },
  { key: 'homework', label: 'Licao de casa', tableName: 'homework' },
  { key: 'homework_completions', label: 'Conclusoes de licao', tableName: 'homework_completions' },
  { key: 'internship_companies', label: 'Empresas conveniadas', tableName: 'internship_companies' },
  { key: 'internship_supervisors', label: 'Supervisores de estagio', tableName: 'internship_supervisors' },
  { key: 'internships', label: 'Estagios', tableName: 'internships' },
  { key: 'internship_diary', label: 'Diario de estagio', tableName: 'internship_diary' },
  { key: 'internship_evaluations', label: 'Avaliacoes de estagio', tableName: 'internship_evaluations' },
  { key: 'tcc_projects', label: 'Projetos TCC', tableName: 'tcc_projects' },
  { key: 'tcc_members', label: 'Membros TCC', tableName: 'tcc_members' },
  { key: 'tcc_deliveries', label: 'Entregas TCC', tableName: 'tcc_deliveries' },
  { key: 'tcc_bancas', label: 'Bancas TCC', tableName: 'tcc_bancas' },
  { key: 'tcc_orientations', label: 'Orientacoes TCC', tableName: 'tcc_orientations' },
  { key: 'laboratories', label: 'Laboratorios', tableName: 'laboratories' },
  { key: 'lab_reservations', label: 'Reservas de laboratorio', tableName: 'lab_reservations' },
  { key: 'lab_equipment', label: 'Equipamentos', tableName: 'lab_equipment' },
  { key: 'lab_material_loans', label: 'Emprestimos de materiais', tableName: 'lab_material_loans' },
  { key: 'lab_usage_logs', label: 'Historico de utilizacao', tableName: 'lab_usage_logs' },
  { key: 'courses', label: 'Cursos', tableName: 'courses' },
  { key: 'series', label: 'Series', tableName: 'series' },
  { key: 'class_series', label: 'Turma-Serie', tableName: 'class_series' },
  { key: 'certificates', label: 'Certificados', tableName: 'certificates' },
  { key: 'second_chances', label: 'Segundas chamadas', tableName: 'second_chances' },
  { key: 'class_councils', label: 'Conselhos de classe', tableName: 'class_councils' },
  { key: 'council_decisions', label: 'Decisoes do conselho', tableName: 'council_decisions' },
]);

export const DEFAULT_CSV_EXPORT_DATASET = 'students';

function padDateSegment(value) {
  return String(value).padStart(2, '0');
}

export function getSystemExportDataset(datasetKey) {
  return SYSTEM_EXPORT_DATASETS.find((dataset) => dataset.key === datasetKey) ?? null;
}

export function listSystemExportDatasets() {
  return [...SYSTEM_EXPORT_DATASETS];
}

export function buildSystemExportTimestamp(now = new Date()) {
  return [
    now.getFullYear(),
    padDateSegment(now.getMonth() + 1),
    padDateSegment(now.getDate()),
  ].join('') + '-' + [
    padDateSegment(now.getHours()),
    padDateSegment(now.getMinutes()),
    padDateSegment(now.getSeconds()),
  ].join('');
}

export function buildSystemExportFilename({
  format = SYSTEM_EXPORT_FORMATS.XLSX,
  datasetKey = null,
  now = new Date(),
} = {}) {
  const safeFormat = format === SYSTEM_EXPORT_FORMATS.CSV
    ? SYSTEM_EXPORT_FORMATS.CSV
    : SYSTEM_EXPORT_FORMATS.XLSX;
  const dataset = datasetKey ? getSystemExportDataset(datasetKey) : null;
  const baseName = dataset ? `backup-${dataset.key}` : 'backup-sistema-completo';
  return `${baseName}-${buildSystemExportTimestamp(now)}.${safeFormat}`;
}

export function parseContentDispositionFilename(value) {
  if (!value || typeof value !== 'string') return null;

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = value.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return null;
}
