// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertCircle, X, Loader2 } from 'lucide-react';
import StatePanel from '@/components/common/StatePanel';

/**
 * BulkImportDialog — CSV/XLSX import using Papa Parse (client-side, no AI extraction).
 * Replaces the old base44.integrations.Core.ExtractDataFromUploadedFile call.
 */
export default function BulkImportDialog({
  open, onOpenChange, label, schema, previewColumns, onImport, isImporting,
}) {
  const [step, setStep] = useState('upload');
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const reset = () => { setStep('upload'); setRows([]); setErrors([]); setLoading(false); };
  const handleClose = (val) => { if (!val) reset(); onOpenChange(val); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErrors([]);

    try {
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'csv') {
        // Lazy-load Papa Parse
        const PapaModule = await import('papaparse');
        const Papa = PapaModule.default || PapaModule;
        await new Promise((resolve) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
              if (result.errors.length) {
                setErrors(result.errors.map((er) => er.message));
              } else {
                const data = result.data.map((row) => {
                  // Normalise keys to match schema property names
                  const out = {};
                  for (const [k, v] of Object.entries(row)) {
                    out[k.trim().toLowerCase().replace(/\s+/g, '_')] = v;
                  }
                  return out;
                });
                setRows(data);
                setStep('preview');
              }
              resolve();
            },
          });
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const ExcelJS = await import('exceljs');
        const ab = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook(); await wb.xlsx.load(ab);
        const ws = wb.worksheets[0];
        const data = []; const headers = []; ws.eachRow((row, rowNumber) => { if (rowNumber === 1) { row.eachCell((cell) => headers.push(cell.value)); } else { const obj = {}; row.eachCell((cell, colNumber) => { obj[headers[colNumber - 1]] = cell.value; }); data.push(obj); } });
        if (!data.length) { setErrors(['Nenhum dado encontrado na planilha.']); }
        else { setRows(data); setStep('preview'); }
      } else {
        setErrors(['Formato não suportado. Use CSV, XLSX ou XLS.']);
      }
    } catch (err) {
      setErrors([err.message ?? 'Erro ao processar o arquivo.']);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleConfirm = async () => { await onImport(rows); setStep('done'); };
  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Importar {label} em Lote
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
            <div
              className="w-full cursor-pointer rounded-[var(--radius-lg)] border-2 border-dashed border-border bg-card/70 p-12 text-center transition-all hover:border-primary/45 hover:bg-accent/45"
              onClick={() => fileRef.current?.click()}
            >
              <Button
                type="button"
                variant="ghost"
                className="p-0 mx-auto w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mb-4 shadow-xl shadow-indigo-500/20 rotate-3 hover:rotate-0 hover:shadow-2xl hover:shadow-indigo-600/30 transition-all duration-200"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-6 h-6" />
              </Button>
              <p className="text-lg font-semibold text-foreground">Clique ou arraste o arquivo aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">Suporta CSV, XLSX ou XLS</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
            {loading && (
              <div className="flex items-center gap-3 font-medium text-primary">
                <Loader2 className="w-5 h-5 animate-spin" /> Processando arquivo…
              </div>
            )}
            {errors.length > 0 && (
              <div className="flex w-full gap-3 rounded-[calc(var(--radius)-4px)] border border-[hsl(var(--feedback-danger-fg)/0.14)] bg-[hsl(var(--feedback-danger-bg))] p-4">
                <AlertCircle className="mt-0.5 w-5 h-5 flex-shrink-0 text-[hsl(var(--feedback-danger-fg))]" />
                <div className="text-sm text-[hsl(var(--feedback-danger-fg))]">{errors.map((er, i) => <p key={i}>{er}</p>)}</div>
              </div>
            )}
            <div className="text-center text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Colunas esperadas:</p>
              <p>{previewColumns.join(', ')}</p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <Badge className="border-0 bg-primary/12 text-primary text-sm">{rows.length} registro(s)</Badge>
              <Button variant="outline" size="sm" onClick={reset}>Trocar arquivo</Button>
            </div>
            <div className="flex-1 overflow-auto rounded-[var(--radius)] border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-accent/65">
                  <tr>
                    {previewColumns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{col}</th>
                    ))}
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-accent/45">
                      {previewColumns.map((col) => (
                        <td key={col} className="max-w-[180px] truncate px-3 py-2 text-foreground">{String(row[col] ?? '—')}</td>
                      ))}
                      <td className="px-3 py-2">
                        <button onClick={() => removeRow(idx)} className="text-muted-foreground hover:text-[hsl(var(--feedback-danger-fg))]" aria-label={`Remover linha ${idx + 1} da importação`} data-tooltip={`Remover linha ${idx + 1} da importação`}><X className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {step === 'done' && (
          <StatePanel
            variant="success"
            title="Importação concluída"
            description={`${rows.length} registro(s) importado(s) com sucesso.`}
          />
        )}

        <DialogFooter className="mt-4">
          {step === 'upload' && <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={isImporting || rows.length === 0}>
                {isImporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando…</> : `Confirmar e Importar ${rows.length} registro(s)`}
              </Button>
            </>
          )}
          {step === 'done' && <Button onClick={() => handleClose(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
