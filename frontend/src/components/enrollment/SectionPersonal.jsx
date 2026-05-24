// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCPF, formatDateInput, formatPhone } from './enrollmentUtils';

export default function SectionPersonal({ data, onChange, errors }) {
  const field = (key, value) => onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RA */}
        <div>
          <Label>RA (Registro Acadêmico)</Label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="Gerado automaticamente"
              value={data.registration_number || ''}
              onChange={(e) => field('registration_number', e.target.value)}
              className="bg-slate-50"
            />
            <Badge variant="outline" className="self-center whitespace-nowrap text-xs text-slate-500">Auto</Badge>
          </div>
        </div>

        {/* CPF */}
        <div>
          <Label>CPF <span className="text-red-500">*</span></Label>
          <Input
            placeholder="000.000.000-00"
            value={data.cpf || ''}
            onChange={(e) => field('cpf', formatCPF(e.target.value))}
            maxLength={14}
            className={`mt-1 ${errors.cpf ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
          />
          {errors.cpf && <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>}
        </div>

        {/* Full Name */}
        <div className="md:col-span-2">
          <Label>Nome Completo <span className="text-red-500">*</span></Label>
          <Input
            placeholder="Nome completo do aluno"
            value={data.full_name || ''}
            onChange={(e) => field('full_name', e.target.value)}
            className={`mt-1 ${errors.full_name ? 'border-red-400' : ''}`}
          />
          {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
        </div>

        {/* Email */}
        <div>
          <Label>E-mail <span className="text-red-500">*</span></Label>
          <Input
            type="email"
            placeholder="aluno@escola.com"
            value={data.email || ''}
            onChange={(e) => field('email', e.target.value)}
            className={`mt-1 ${errors.email ? 'border-red-400' : ''}`}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        {/* Birth Date */}
        <div>
          <Label>Data de Nascimento <span className="text-red-500">*</span></Label>
          <Input
            placeholder="DD/MM/AAAA"
            value={data.birth_date_display || ''}
            onChange={(e) => {
              const formatted = formatDateInput(e.target.value);
              onChange({ ...data, birth_date_display: formatted });
            }}
            className={`mt-1 ${errors.birth_date ? 'border-red-400' : ''}`}
          />
          {errors.birth_date && <p className="text-xs text-red-500 mt-1">{errors.birth_date}</p>}
        </div>

        {/* Gender */}
        <div>
          <Label>Gênero <span className="text-red-500">*</span></Label>
          <Select value={data.gender || ''} onValueChange={(v) => field('gender', v)}>
            <SelectTrigger className={`mt-1 ${errors.gender ? 'border-red-400' : ''}`}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
        </div>

        {/* Marital Status */}
        <div>
          <Label>Estado Civil <span className="text-red-500">*</span></Label>
          <Select value={data.marital_status || ''} onValueChange={(v) => field('marital_status', v)}>
            <SelectTrigger className={`mt-1 ${errors.marital_status ? 'border-red-400' : ''}`}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solteiro">Solteiro(a)</SelectItem>
              <SelectItem value="casado">Casado(a)</SelectItem>
              <SelectItem value="viuvo">Viúvo(a)</SelectItem>
              <SelectItem value="divorciado">Divorciado(a)</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          {errors.marital_status && <p className="text-xs text-red-500 mt-1">{errors.marital_status}</p>}
        </div>

        {/* Nationality */}
        <div>
          <Label>Nacionalidade <span className="text-red-500">*</span></Label>
          <Input
            placeholder="Ex: Brasileira"
            value={data.nationality || ''}
            onChange={(e) => field('nationality', e.target.value)}
            className={`mt-1 ${errors.nationality ? 'border-red-400' : ''}`}
          />
          {errors.nationality && <p className="text-xs text-red-500 mt-1">{errors.nationality}</p>}
        </div>

        {/* Place of Birth */}
        <div>
          <Label>Naturalidade <span className="text-red-500">*</span></Label>
          <Input
            placeholder="Cidade/Estado de nascimento"
            value={data.place_of_birth || ''}
            onChange={(e) => field('place_of_birth', e.target.value)}
            className={`mt-1 ${errors.place_of_birth ? 'border-red-400' : ''}`}
          />
          {errors.place_of_birth && <p className="text-xs text-red-500 mt-1">{errors.place_of_birth}</p>}
        </div>

        {/* Phone */}
        <div>
          <Label>Telefone <span className="text-red-500">*</span></Label>
          <Input
            placeholder="(00) 0000-0000"
            value={data.phone || ''}
            onChange={(e) => field('phone', formatPhone(e.target.value))}
            className={`mt-1 ${errors.phone ? 'border-red-400' : ''}`}
          />
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
        </div>

        {/* Mobile */}
        <div>
          <Label>Celular <span className="text-slate-400 text-xs">(opcional)</span></Label>
          <Input
            placeholder="(00) 00000-0000"
            value={data.mobile_phone || ''}
            onChange={(e) => field('mobile_phone', formatPhone(e.target.value))}
            className={`mt-1 ${errors.mobile_phone ? 'border-red-400' : ''}`}
          />
          {errors.mobile_phone && <p className="text-xs text-red-500 mt-1">{errors.mobile_phone}</p>}
        </div>
      </div>
    </div>
  );
}
