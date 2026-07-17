// Exportação de Grade Horária — EduGest
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import { getWeekDayLabel } from '@shared/contracts/schedulePlanner';

const WEEK_DAYS = [1, 2, 3, 4, 5];

export function generateSchedulePdf({
  entries = [],
  shifts = [],
  classes = [],
  selectedClassId = null,
  title = 'Grade Horária',
  filename = 'grade-horaria.pdf',
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, margin + 10);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, margin, margin + 18);

  // Filter entries by class
  const filtered = selectedClassId
    ? entries.filter((e) => e.class_id === selectedClassId)
    : entries;

  // Group by class
  const byClass = new Map();
  filtered.forEach((entry) => {
    const classId = entry.class_id || 'sem_turma';
    if (!byClass.has(classId)) byClass.set(classId, []);
    byClass.get(classId).push(entry);
  });

  let y = margin + 28;

  // For each class, draw a table
  byClass.forEach((classEntries, classId) => {
    const className = classes.find((c) => c.id === classId)?.name || classId;

    // Check if we need a new page
    if (y + 60 > pageHeight - margin) {
      doc.addPage();
      y = margin + 10;
    }

    // Class header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Turma: ${className}`, margin, y);
    y += 8;

    // Table header
    const colWidth = (pageWidth - margin * 2) / (WEEK_DAYS.length + 1);
    const startX = margin;

    doc.setFillColor(240, 240, 240);
    doc.rect(startX, y, pageWidth - margin * 2, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    doc.text('Aula', startX + 2, y + 5.5);
    WEEK_DAYS.forEach((day, i) => {
      doc.text(getWeekDayLabel(day), startX + colWidth * (i + 1) + 2, y + 5.5);
    });
    y += 8;

    // Find max lessons
    const maxLessons = Math.max(...shifts.map((s) => Number(s.lesson_count || 0)), 1);

    // Table rows
    for (let lesson = 1; lesson <= maxLessons; lesson++) {
      doc.setDrawColor(200, 200, 200);
      doc.rect(startX, y, pageWidth - margin * 2, 10);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`${lesson}ª`, startX + 2, y + 6);

      WEEK_DAYS.forEach((day, i) => {
        const entry = classEntries.find((e) => e.day_of_week === day && e.lesson_index === lesson);
        const cellX = startX + colWidth * (i + 1);

        doc.setDrawColor(200, 200, 200);
        doc.rect(cellX, y, colWidth, 10);

        if (entry) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          doc.text(entry.subject?.name || '—', cellX + 2, y + 4);
          doc.setFont('helvetica', 'normal');
          doc.text(entry.teacher?.full_name || '—', cellX + 2, y + 7.5);
        }
      });

      y += 10;
    }

    y += 10;
  });

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('EduGest - Sistema de Gestão Escolar', margin, pageHeight - 10);

  doc.save(filename);
}

export function generateScheduleExcel({
  entries = [],
  shifts = [],
  classes = [],
  selectedClassId = null,
  filename = 'grade-horaria.xlsx',
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EduGest';
  workbook.created = new Date();

  const filtered = selectedClassId
    ? entries.filter((e) => e.class_id === selectedClassId)
    : entries;

  // Group by class
  const byClass = new Map();
  filtered.forEach((entry) => {
    const classId = entry.class_id || 'sem_turma';
    if (!byClass.has(classId)) byClass.set(classId, []);
    byClass.get(classId).push(entry);
  });

  byClass.forEach((classEntries, classId) => {
    const className = classes.find((c) => c.id === classId)?.name || classId;
    const sheetName = className.slice(0, 31).replace(/[\\/*?:[\]]/g, '');
    const sheet = workbook.addWorksheet(sheetName);

    // Headers
    const headers = ['Aula', ...WEEK_DAYS.map((d) => getWeekDayLabel(d))];
    sheet.addRow(headers);

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Find max lessons
    const maxLessons = Math.max(...shifts.map((s) => Number(s.lesson_count || 0)), 1);

    // Data rows
    for (let lesson = 1; lesson <= maxLessons; lesson++) {
      const row = [`${lesson}ª Aula`];
      WEEK_DAYS.forEach((day) => {
        const entry = classEntries.find((e) => e.day_of_week === day && e.lesson_index === lesson);
        row.push(entry ? `${entry.subject?.name || '—'}\n${entry.teacher?.full_name || '—'}` : '');
      });
      sheet.addRow(row);
    }

    // Auto-fit columns
    sheet.columns.forEach((column) => {
      column.width = 20;
    });
  });

  return workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

export function generateScheduleCsv({
  entries = [],
  classes = [],
  filename = 'grade-horaria.csv',
}) {
  const headers = ['Turma', 'Dia', 'Aula', 'Disciplina', 'Professor', 'Ambiente'];
  const rows = entries.map((entry) => {
    const className = classes.find((c) => c.id === entry.class_id)?.name || entry.class_id;
    return [
      className,
      getWeekDayLabel(entry.day_of_week),
      `${entry.lesson_index}ª`,
      entry.subject?.name || '',
      entry.teacher?.full_name || '',
      entry.environment?.name || '',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateScheduleJson({
  entries = [],
  classes = [],
  shifts = [],
  filename = 'grade-horaria.json',
}) {
  const data = {
    generatedAt: new Date().toISOString(),
    entries: entries.map((entry) => ({
      className: classes.find((c) => c.id === entry.class_id)?.name || entry.class_id,
      dayOfWeek: entry.day_of_week,
      dayLabel: getWeekDayLabel(entry.day_of_week),
      lessonIndex: entry.lesson_index,
      subject: entry.subject?.name || null,
      teacher: entry.teacher?.full_name || null,
      environment: entry.environment?.name || null,
      shift: entry.shift_id,
      status: entry.status,
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
