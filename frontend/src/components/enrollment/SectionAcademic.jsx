import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ENTRY_PERIODS } from './enrollmentUtils';

export default function SectionAcademic({ data, onChange, errors, classes }) {
  const field = (key, value) => onChange({ ...data, [key]: value });

  const courseOptions = [...new Set(classes.map(c => c.name).filter(Boolean))];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Course */}
      <div>
        <Label>Curso / Turma <span className="text-red-500">*</span></Label>
        <Select value={data.course || ''} onValueChange={(v) => field('course', v)}>
          <SelectTrigger className={`mt-1 ${errors.course ? 'border-red-400' : ''}`}>
            <SelectValue placeholder="Selecione o curso/turma" />
          </SelectTrigger>
          <SelectContent>
            {courseOptions.length > 0 ? courseOptions.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            )) : (
              <SelectItem value="nenhuma" disabled>Nenhuma turma cadastrada</SelectItem>
            )}
          </SelectContent>
        </Select>
        {errors.course && <p className="text-xs text-red-500 mt-1">{errors.course}</p>}
      </div>

      {/* Entry Period */}
      <div>
        <Label>Período de Ingresso <span className="text-red-500">*</span></Label>
        <Select value={data.entry_period || ''} onValueChange={(v) => field('entry_period', v)}>
          <SelectTrigger className={`mt-1 ${errors.entry_period ? 'border-red-400' : ''}`}>
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            {ENTRY_PERIODS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.entry_period && <p className="text-xs text-red-500 mt-1">{errors.entry_period}</p>}
      </div>

      {/* Entry Method */}
      <div>
        <Label>Forma de Ingresso <span className="text-red-500">*</span></Label>
        <Select value={data.entry_method || ''} onValueChange={(v) => field('entry_method', v)}>
          <SelectTrigger className={`mt-1 ${errors.entry_method ? 'border-red-400' : ''}`}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vestibular">Vestibular</SelectItem>
            <SelectItem value="enem">ENEM</SelectItem>
            <SelectItem value="transferencia">Transferência</SelectItem>
            <SelectItem value="portador_diploma">Portador de Diploma</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
        {errors.entry_method && <p className="text-xs text-red-500 mt-1">{errors.entry_method}</p>}
      </div>

      {/* Notes */}
      <div className="md:col-span-2">
        <Label>Observações <span className="text-slate-400 text-xs">(opcional)</span></Label>
        <Textarea
          placeholder="Observações sobre a matrícula..."
          value={data.notes || ''}
          onChange={(e) => field('notes', e.target.value)}
          className="mt-1 resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}