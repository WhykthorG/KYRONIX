// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCPF, formatPhone } from './enrollmentUtils';

export default function SectionGuardian({ data, onChange, errors }) {
  const field = (key, value) => onChange({ ...data, [key]: value });
  const hasGuardian = data.has_guardian !== false; // default: true

  const toggleGuardian = () => {
    const next = !hasGuardian;
    onChange({
      ...data,
      has_guardian: next,
      ...(next ? {} : {
        guardian_name: '', guardian_cpf: '', guardian_relationship: '',
        guardian_phone: '', guardian_mobile: '',
      }),
    });
  };

  return (
    <div className="space-y-5">
      {/* Toggle */}
      <div
        className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={toggleGuardian}
      >
        <div className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${hasGuardian ? 'bg-indigo-600' : 'bg-slate-200'}`}>
          <div className={`w-5 h-5 rounded-full bg-white shadow mt-0.5 transition-transform ${hasGuardian ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </div>
        <div>
          <p className="font-medium text-slate-800 text-sm">Informar responsável</p>
          <p className="text-xs text-slate-500">{hasGuardian ? 'Dados do responsável serão cadastrados' : 'Sem responsável vinculado'}</p>
        </div>
      </div>

      {!hasGuardian && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          ⚠️ Sem responsável vinculado. Esta opção é recomendada apenas para alunos maiores de idade.
        </div>
      )}

      {hasGuardian && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Guardian Name */}
      <div className="md:col-span-2">
        <Label>Nome do Responsável <span className="text-red-500">*</span></Label>
        <Input
          placeholder="Nome completo do responsável"
          value={data.guardian_name || ''}
          onChange={(e) => field('guardian_name', e.target.value)}
          className={`mt-1 ${errors.guardian_name ? 'border-red-400' : ''}`}
        />
        {errors.guardian_name && <p className="text-xs text-red-500 mt-1">{errors.guardian_name}</p>}
      </div>

      {/* Guardian CPF */}
      <div>
        <Label>CPF do Responsável <span className="text-red-500">*</span></Label>
        <Input
          placeholder="000.000.000-00"
          value={data.guardian_cpf || ''}
          onChange={(e) => field('guardian_cpf', formatCPF(e.target.value))}
          maxLength={14}
          className={`mt-1 ${errors.guardian_cpf ? 'border-red-400' : ''}`}
        />
        {errors.guardian_cpf && <p className="text-xs text-red-500 mt-1">{errors.guardian_cpf}</p>}
      </div>

      {/* Relationship */}
      <div>
        <Label>Parentesco <span className="text-red-500">*</span></Label>
        <Select value={data.guardian_relationship || ''} onValueChange={(v) => field('guardian_relationship', v)}>
          <SelectTrigger className={`mt-1 ${errors.guardian_relationship ? 'border-red-400' : ''}`}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pai">Pai</SelectItem>
            <SelectItem value="mae">Mãe</SelectItem>
            <SelectItem value="avo">Avó/Avô</SelectItem>
            <SelectItem value="tio">Tio/Tia</SelectItem>
            <SelectItem value="responsavel_legal">Responsável Legal</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
        {errors.guardian_relationship && <p className="text-xs text-red-500 mt-1">{errors.guardian_relationship}</p>}
      </div>

      {/* Guardian Phone */}
      <div>
        <Label>Telefone do Responsável <span className="text-red-500">*</span></Label>
        <Input
          placeholder="(00) 0000-0000"
          value={data.guardian_phone || ''}
          onChange={(e) => field('guardian_phone', formatPhone(e.target.value))}
          className={`mt-1 ${errors.guardian_phone ? 'border-red-400' : ''}`}
        />
        {errors.guardian_phone && <p className="text-xs text-red-500 mt-1">{errors.guardian_phone}</p>}
      </div>

      {/* Guardian Mobile */}
      <div>
        <Label>Celular do Responsável <span className="text-slate-400 text-xs">(opcional)</span></Label>
        <Input
          placeholder="(00) 00000-0000"
          value={data.guardian_mobile || ''}
          onChange={(e) => field('guardian_mobile', formatPhone(e.target.value))}
          className={`mt-1 ${errors.guardian_mobile ? 'border-red-400' : ''}`}
        />
        {errors.guardian_mobile && <p className="text-xs text-red-500 mt-1">{errors.guardian_mobile}</p>}
      </div>
      </div>}
    </div>
  );
}
