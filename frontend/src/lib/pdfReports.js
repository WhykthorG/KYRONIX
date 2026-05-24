// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
import { jsPDF } from 'jspdf';

import {
  buildAttendanceSummary,
  normalizePdfLayoutOptions,
  sanitizePdfFilename,
} from '@shared/contracts/pdfReports';

const PAGE_MARGIN_X = 14;
const HEADER_HEIGHT = 22;
const FOOTER_HEIGHT = 10;
const TOP_MARGIN = 16;
const BOTTOM_MARGIN = 14;
const SECTION_GAP = 6;
const TABLE_CELL_PADDING_X = 2.4;
const TABLE_CELL_PADDING_Y = 2.2;

function formatDate(value) {
  if (!value) return '-';

  const date = typeof value === 'string'
    ? new Date(`${value}T12:00:00`)
    : value;

  if (Number.isNaN(date?.getTime?.())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function createPdfDocument({ reportTitle, reportSubtitle = '', layoutOptions = {} }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const layout = normalizePdfLayoutOptions(layoutOptions);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentLeft = PAGE_MARGIN_X;
  const contentWidth = pageWidth - (PAGE_MARGIN_X * 2);
  const contentTop = TOP_MARGIN + HEADER_HEIGHT;
  const contentBottom = pageHeight - (BOTTOM_MARGIN + FOOTER_HEIGHT);
  let cursorY = contentTop;

  doc.setProperties({
    title: reportTitle,
    subject: reportSubtitle || reportTitle,
    creator: 'EduGest',
  });

  const drawPageChrome = () => {
    const { pageNumber } = doc.getCurrentPageInfo();

    doc.setDrawColor(226, 232, 240);
    doc.line(contentLeft, TOP_MARGIN + HEADER_HEIGHT - 4, contentLeft + contentWidth, TOP_MARGIN + HEADER_HEIGHT - 4);
    doc.line(contentLeft, pageHeight - BOTTOM_MARGIN - FOOTER_HEIGHT + 2, contentLeft + contentWidth, pageHeight - BOTTOM_MARGIN - FOOTER_HEIGHT + 2);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(layout.headerTitle, contentLeft, TOP_MARGIN);

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (layout.headerSubtitle) {
      doc.text(layout.headerSubtitle, contentLeft, TOP_MARGIN + 5.5);
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(reportTitle, contentLeft, TOP_MARGIN + 12.5);

    if (reportSubtitle) {
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(reportSubtitle, contentLeft, TOP_MARGIN + 17);
    }

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(layout.footerLeft, contentLeft, pageHeight - BOTTOM_MARGIN);

    const footerRight = [
      layout.footerRight,
      `Pagina ${pageNumber}`,
    ].filter(Boolean).join('  |  ');

    doc.text(footerRight, contentLeft + contentWidth, pageHeight - BOTTOM_MARGIN, { align: 'right' });
  };

  const addPage = () => {
    doc.addPage();
    drawPageChrome();
    cursorY = contentTop;
  };

  const ensureSpace = (height, onPageAdd) => {
    if (cursorY + height <= contentBottom) return;
    addPage();
    if (typeof onPageAdd === 'function') onPageAdd();
  };

  const writeParagraph = (text, options = {}) => {
    const {
      fontSize = 10,
      fontStyle = 'normal',
      color = [15, 23, 42],
      gapAfter = 4,
      maxWidth = contentWidth,
    } = options;

    const value = String(text || '').trim();
    if (!value) return;

    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);

    const lines = doc.splitTextToSize(value, maxWidth);
    const height = doc.getTextDimensions(lines).h;
    ensureSpace(height + gapAfter);
    doc.text(lines, contentLeft, cursorY);
    cursorY += height + gapAfter;
  };

  const writeSectionTitle = (text) => {
    writeParagraph(text, {
      fontSize: 11.5,
      fontStyle: 'bold',
      color: [30, 41, 59],
      gapAfter: 3,
    });
  };

  const writeInfoGrid = (items, columns = 2) => {
    const validItems = items.filter((item) => item?.label);
    if (!validItems.length) return;

    const gap = 4;
    const columnCount = Math.max(1, columns);
    const boxWidth = (contentWidth - (gap * (columnCount - 1))) / columnCount;
    const rowHeight = 14;

    for (let index = 0; index < validItems.length; index += columnCount) {
      const rowItems = validItems.slice(index, index + columnCount);
      ensureSpace(rowHeight + 2);

      rowItems.forEach((item, rowIndex) => {
        const x = contentLeft + ((boxWidth + gap) * rowIndex);

        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, cursorY, boxWidth, rowHeight, 1.8, 1.8, 'FD');

        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(String(item.label), x + 2.5, cursorY + 4.6);

        const value = String(item.value ?? '-');
        const lines = doc.splitTextToSize(value, boxWidth - 5);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(lines, x + 2.5, cursorY + 10.1);
      });

      cursorY += rowHeight + 3;
    }

    cursorY += 1;
  };

  const renderTable = ({ columns, rows, emptyMessage = 'Nenhum registro encontrado.' }) => {
    if (!rows.length) {
      writeParagraph(emptyMessage, { color: [100, 116, 139] });
      return;
    }

    const widths = columns.map((column) => column.width);
    const xPositions = [];
    let currentX = contentLeft;

    widths.forEach((width) => {
      xPositions.push(currentX);
      currentX += width;
    });

    const drawHeader = () => {
      const headerHeight = 8.5;
      ensureSpace(headerHeight + 1);

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(contentLeft, cursorY, contentWidth, headerHeight, 'FD');

      columns.forEach((column, index) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.8);
        doc.setTextColor(51, 65, 85);
        doc.text(column.label, xPositions[index] + TABLE_CELL_PADDING_X, cursorY + 5.4);
      });

      cursorY += headerHeight;
    };

    drawHeader();

    rows.forEach((row) => {
      const cellLines = columns.map((column) => {
        const rawValue = typeof column.render === 'function'
          ? column.render(row)
          : row[column.key];
        const value = String(rawValue ?? '-');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        return doc.splitTextToSize(value, column.width - (TABLE_CELL_PADDING_X * 2));
      });

      const contentHeight = Math.max(...cellLines.map((lines) => doc.getTextDimensions(lines).h));
      const rowHeight = Math.max(8, contentHeight + (TABLE_CELL_PADDING_Y * 2));

      if (cursorY + rowHeight > contentBottom) {
        addPage();
        drawHeader();
      }

      columns.forEach((column, index) => {
        const x = xPositions[index];
        const textX = column.align === 'right'
          ? x + column.width - TABLE_CELL_PADDING_X
          : column.align === 'center'
            ? x + (column.width / 2)
            : x + TABLE_CELL_PADDING_X;

        doc.setDrawColor(226, 232, 240);
        doc.rect(x, cursorY, column.width, rowHeight);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        doc.setTextColor(15, 23, 42);
        doc.text(cellLines[index], textX, cursorY + 4.8, {
          align: column.align || 'left',
          maxWidth: column.width - (TABLE_CELL_PADDING_X * 2),
        });
      });

      cursorY += rowHeight;
    });

    cursorY += SECTION_GAP;
  };

  drawPageChrome();

  return {
    doc,
    contentWidth,
    writeParagraph,
    writeSectionTitle,
    writeInfoGrid,
    renderTable,
    save(filename) {
      doc.save(filename);
    },
  };
}

export function generateEntityRecordsPdf({
  reportTitle,
  reportSubtitle = '',
  metadata = [],
  columns = [],
  rows = [],
  layoutOptions = {},
  filename = 'relatorio-registros.pdf',
}) {
  const pdf = createPdfDocument({ reportTitle, reportSubtitle, layoutOptions });

  if (metadata.length > 0) {
    pdf.writeInfoGrid(metadata, Math.min(3, metadata.length));
  }

  pdf.writeSectionTitle('Registros');
  pdf.renderTable({ columns, rows });
  pdf.save(filename);
}

export function generateStudentReportCardPdf({
  model,
  generatedAt = new Date(),
  layoutOptions = {},
  filename,
}) {
  const pdf = createPdfDocument({
    reportTitle: 'Boletim escolar',
    reportSubtitle: `Aluno: ${model.studentName}`,
    layoutOptions,
  });

  pdf.writeInfoGrid([
    { label: 'Aluno', value: model.studentName },
    { label: 'Matricula', value: model.registrationNumber },
    { label: 'Turma', value: model.className },
    { label: 'Media geral', value: model.overallAverage },
    { label: 'Emitido em', value: generatedAt.toLocaleString('pt-BR') },
  ], 2);

  pdf.writeSectionTitle('Resumo de frequencia');
  pdf.writeInfoGrid([
    { label: 'Aulas registradas', value: model.attendanceSummary.total },
    { label: 'Presencas', value: model.attendanceSummary.present },
    { label: 'Faltas', value: model.attendanceSummary.absent },
    { label: 'Justificadas', value: model.attendanceSummary.justified },
    { label: 'Atrasos', value: model.attendanceSummary.late },
    { label: 'Taxa de frequencia', value: `${model.attendanceSummary.rate}%` },
  ], 3);

  pdf.writeSectionTitle('Desempenho por disciplina');
  pdf.renderTable({
    columns: [
      { label: 'Disciplina', key: 'subjectName', width: 52 },
      { label: '1B', key: 'b1', width: 16, align: 'center' },
      { label: '2B', key: 'b2', width: 16, align: 'center' },
      { label: '3B', key: 'b3', width: 16, align: 'center' },
      { label: '4B', key: 'b4', width: 16, align: 'center' },
      { label: 'Media', key: 'average', width: 22, align: 'center' },
      { label: 'Situacao', key: 'situation', width: 44, align: 'center' },
    ],
    rows: model.rows,
    emptyMessage: 'Nenhuma nota publicada para este aluno.',
  });

  pdf.save(filename || `${sanitizePdfFilename(`boletim-${model.studentName}`)}.pdf`);
}

export function generateGuardianMonthlyStudentReportPdf({
  model,
  generatedAt = new Date(),
  layoutOptions = {},
  filename,
}) {
  const pdf = createPdfDocument({
    reportTitle: 'Relatorio mensal do aluno',
    reportSubtitle: `${model.studentName} — Referencia: ${model.monthLabel}`,
    layoutOptions,
  });

  pdf.writeInfoGrid([
    { label: 'Aluno', value: model.studentName },
    { label: 'Matricula', value: model.registrationNumber },
    { label: 'Turma', value: model.className },
    { label: 'Mes', value: model.monthLabel },
    { label: 'Media geral', value: model.overallAverage },
    { label: 'Emitido em', value: generatedAt.toLocaleString('pt-BR') },
  ], 2);

  pdf.writeSectionTitle('Resumo de frequencia (periodo)');
  pdf.writeInfoGrid([
    { label: 'Registros', value: model.attendanceSummary.total },
    { label: 'Presencas', value: model.attendanceSummary.present },
    { label: 'Faltas', value: model.attendanceSummary.absent },
    { label: 'Justificadas', value: model.attendanceSummary.justified },
    { label: 'Atrasos', value: model.attendanceSummary.late },
    { label: 'Taxa de frequencia', value: `${model.attendanceSummary.rate}%` },
  ], 3);

  pdf.writeSectionTitle('Desempenho por disciplina');
  pdf.renderTable({
    columns: [
      { label: 'Disciplina', key: 'subjectName', width: 52 },
      { label: '1B', key: 'b1', width: 16, align: 'center' },
      { label: '2B', key: 'b2', width: 16, align: 'center' },
      { label: '3B', key: 'b3', width: 16, align: 'center' },
      { label: '4B', key: 'b4', width: 16, align: 'center' },
      { label: 'Media', key: 'average', width: 22, align: 'center' },
      { label: 'Situacao', key: 'situation', width: 44, align: 'center' },
    ],
    rows: model.rows,
    emptyMessage: 'Nenhuma nota publicada para este aluno no periodo.',
  });

  if (model.occurrences?.length > 0) {
    pdf.writeSectionTitle('Ocorrencias do periodo');
    pdf.renderTable({
      columns: [
        { label: 'Data', key: 'date', width: 26, align: 'center' },
        { label: 'Titulo', key: 'title', width: 48 },
        { label: 'Detalhe', key: 'detail', width: 100 },
      ],
      rows: model.occurrences,
      emptyMessage: 'Nenhuma ocorrencia registrada.',
    });
  }

  pdf.save(
    filename
    || `${sanitizePdfFilename(`relatorio-mensal-${model.studentName}-${model.monthLabel}`)}.pdf`,
  );
}

export function generateAttendanceListPdf({
  className,
  date,
  rows,
  generatedAt = new Date(),
  layoutOptions = {},
  filename,
}) {
  const missing = rows.filter((row) => row.status === 'nao_registrado').length;
  const summary = buildAttendanceSummary(
    rows
      .filter((row) => row.status !== 'nao_registrado')
      .map((row) => ({ status: row.status })),
  );
  const pdf = createPdfDocument({
    reportTitle: 'Lista de presenca',
    reportSubtitle: `${className} - ${formatDate(date)}`,
    layoutOptions,
  });

  pdf.writeInfoGrid([
    { label: 'Turma', value: className },
    { label: 'Data', value: formatDate(date) },
    { label: 'Emitido em', value: generatedAt.toLocaleString('pt-BR') },
    { label: 'Total de alunos', value: rows.length },
  ], 2);

  pdf.writeSectionTitle('Resumo da chamada');
  pdf.writeInfoGrid([
    { label: 'Presencas', value: summary.present },
    { label: 'Faltas', value: summary.absent },
    { label: 'Justificadas', value: summary.justified },
    { label: 'Atrasos', value: summary.late },
    { label: 'Nao registrados', value: missing },
  ], 3);

  pdf.writeSectionTitle('Relacao nominal');
  pdf.renderTable({
    columns: [
      { label: '#', key: 'index', width: 12, align: 'center' },
      { label: 'Aluno', key: 'studentName', width: 90 },
      { label: 'Matricula', key: 'registrationNumber', width: 34, align: 'center' },
      { label: 'Situacao', key: 'statusLabel', width: 46, align: 'center' },
    ],
    rows,
    emptyMessage: 'Nenhum aluno encontrado para esta turma.',
  });

  pdf.save(filename || `${sanitizePdfFilename(`lista-presenca-${className}-${date}`)}.pdf`);
}
