// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
export const SYSTEM_SETTINGS_ROW_ID = 'system';
export const SYSTEM_SETTINGS_STORAGE_KEY = 'project-wg:system-settings';
export const SYSTEM_SETTINGS_UPDATED_EVENT = 'project-wg:system-settings-updated';

export const DEFAULT_SYSTEM_SETTINGS = Object.freeze({
  schoolName: 'KYRONIX S.E.N.O Escola',
  schoolEmail: 'contato@projectwg.com.br',
  schoolPhone: '(11) 99999-9999',
  schoolAddress: 'Rua da Educacao, 123 - Centro',
  notifyNewEnrollment: true,
  notifyDocumentPending: true,
  notifyMessagePosted: true,
  notifyAccessReset: true,
  notifyPaymentDue: true,
  notifyGradePosted: true,
  notifyAttendanceIssue: true,
  allowStudentPhotoUpload: true,
  requireGuardianApproval: false,
  enableTooltips: true,
  primaryColor: '#6366f1',
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
});

function normalizeString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function normalizeSystemSettings(settings = {}) {
  return {
    schoolName: normalizeString(settings.schoolName, DEFAULT_SYSTEM_SETTINGS.schoolName),
    schoolEmail: normalizeString(settings.schoolEmail, DEFAULT_SYSTEM_SETTINGS.schoolEmail),
    schoolPhone: normalizeString(settings.schoolPhone, DEFAULT_SYSTEM_SETTINGS.schoolPhone),
    schoolAddress: normalizeString(settings.schoolAddress, DEFAULT_SYSTEM_SETTINGS.schoolAddress),
    notifyNewEnrollment: settings.notifyNewEnrollment ?? DEFAULT_SYSTEM_SETTINGS.notifyNewEnrollment,
    notifyDocumentPending: settings.notifyDocumentPending ?? DEFAULT_SYSTEM_SETTINGS.notifyDocumentPending,
    notifyMessagePosted: settings.notifyMessagePosted ?? DEFAULT_SYSTEM_SETTINGS.notifyMessagePosted,
    notifyAccessReset: settings.notifyAccessReset ?? DEFAULT_SYSTEM_SETTINGS.notifyAccessReset,
    notifyPaymentDue: settings.notifyPaymentDue ?? DEFAULT_SYSTEM_SETTINGS.notifyPaymentDue,
    notifyGradePosted: settings.notifyGradePosted ?? DEFAULT_SYSTEM_SETTINGS.notifyGradePosted,
    notifyAttendanceIssue: settings.notifyAttendanceIssue ?? DEFAULT_SYSTEM_SETTINGS.notifyAttendanceIssue,
    allowStudentPhotoUpload: settings.allowStudentPhotoUpload ?? DEFAULT_SYSTEM_SETTINGS.allowStudentPhotoUpload,
    requireGuardianApproval: settings.requireGuardianApproval ?? DEFAULT_SYSTEM_SETTINGS.requireGuardianApproval,
    enableTooltips: settings.enableTooltips ?? DEFAULT_SYSTEM_SETTINGS.enableTooltips,
    primaryColor: normalizeString(settings.primaryColor, DEFAULT_SYSTEM_SETTINGS.primaryColor),
    language: normalizeString(settings.language, DEFAULT_SYSTEM_SETTINGS.language),
    timezone: normalizeString(settings.timezone, DEFAULT_SYSTEM_SETTINGS.timezone),
  };
}

export function mapSystemSettingsRecord(record = {}) {
  return normalizeSystemSettings({
    schoolName: record.school_name,
    schoolEmail: record.school_email,
    schoolPhone: record.school_phone,
    schoolAddress: record.school_address,
    notifyNewEnrollment: record.notify_new_enrollment,
    notifyDocumentPending: record.notify_document_pending,
    notifyMessagePosted: record.notify_message_posted,
    notifyAccessReset: record.notify_access_reset,
    notifyPaymentDue: record.notify_payment_due,
    notifyGradePosted: record.notify_grade_posted,
    notifyAttendanceIssue: record.notify_attendance_issue,
    allowStudentPhotoUpload: record.allow_student_photo_upload,
    requireGuardianApproval: record.require_guardian_approval,
    enableTooltips: record.enable_tooltips,
    primaryColor: record.primary_color,
    language: record.language,
    timezone: record.timezone,
  });
}

export function buildSystemSettingsRecord(settings = {}) {
  const normalized = normalizeSystemSettings(settings);
  return {
    id: SYSTEM_SETTINGS_ROW_ID,
    school_name: normalized.schoolName,
    school_email: normalized.schoolEmail,
    school_phone: normalized.schoolPhone,
    school_address: normalized.schoolAddress,
    notify_new_enrollment: normalized.notifyNewEnrollment,
    notify_document_pending: normalized.notifyDocumentPending,
    notify_message_posted: normalized.notifyMessagePosted,
    notify_access_reset: normalized.notifyAccessReset,
    notify_payment_due: normalized.notifyPaymentDue,
    notify_grade_posted: normalized.notifyGradePosted,
    notify_attendance_issue: normalized.notifyAttendanceIssue,
    allow_student_photo_upload: normalized.allowStudentPhotoUpload,
    require_guardian_approval: normalized.requireGuardianApproval,
    enable_tooltips: normalized.enableTooltips,
    primary_color: normalized.primaryColor,
    language: normalized.language,
    timezone: normalized.timezone,
  };
}

export function isSettingsRecordMissing(error) {
  return error?.code === 'PGRST116';
}

export function isSettingsTableUnavailable(error) {
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /app_settings/i.test(error?.message || '');
}

export function readSystemSettingsFromStorage(storage = globalThis?.localStorage) {
  if (!storage?.getItem) return { ...DEFAULT_SYSTEM_SETTINGS };

  try {
    const raw = storage.getItem(SYSTEM_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SYSTEM_SETTINGS };
    return normalizeSystemSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }
}

function dispatchSystemSettingsUpdate(settings) {
  if (!globalThis?.dispatchEvent || typeof globalThis.CustomEvent !== 'function') return;

  globalThis.dispatchEvent(
    new globalThis.CustomEvent(SYSTEM_SETTINGS_UPDATED_EVENT, {
      detail: settings,
    }),
  );
}

export function writeSystemSettingsToStorage(settings, storage = globalThis?.localStorage) {
  const normalized = normalizeSystemSettings(settings);

  if (!storage?.setItem) {
    dispatchSystemSettingsUpdate(normalized);
    return normalized;
  }

  storage.setItem(SYSTEM_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  dispatchSystemSettingsUpdate(normalized);
  return normalized;
}
