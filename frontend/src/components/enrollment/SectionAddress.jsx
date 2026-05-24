import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCEP, BRAZIL_STATES } from './enrollmentUtils';

export default function SectionAddress({ data, onChange, errors }) {
  const addr = data.address || {};
  const field = (key, value) => onChange({ ...data, address: { ...addr, [key]: value } });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Street */}
      <div className="md:col-span-2">
        <Label>Logradouro <span className="text-red-500">*</span></Label>
        <Input
          placeholder="Rua, Avenida, Travessa..."
          value={addr.street || ''}
          onChange={(e) => field('street', e.target.value)}
          className={`mt-1 ${errors['address.street'] ? 'border-red-400' : ''}`}
        />
        {errors['address.street'] && <p className="text-xs text-red-500 mt-1">{errors['address.street']}</p>}
      </div>

      {/* Number */}
      <div>
        <Label>Número <span className="text-red-500">*</span></Label>
        <Input
          placeholder="Nº"
          value={addr.number || ''}
          onChange={(e) => field('number', e.target.value)}
          className={`mt-1 ${errors['address.number'] ? 'border-red-400' : ''}`}
        />
        {errors['address.number'] && <p className="text-xs text-red-500 mt-1">{errors['address.number']}</p>}
      </div>

      {/* Complement */}
      <div>
        <Label>Complemento <span className="text-slate-400 text-xs">(opcional)</span></Label>
        <Input
          placeholder="Apto, Bloco..."
          value={addr.complement || ''}
          onChange={(e) => field('complement', e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Neighborhood */}
      <div>
        <Label>Bairro <span className="text-red-500">*</span></Label>
        <Input
          placeholder="Bairro"
          value={addr.neighborhood || ''}
          onChange={(e) => field('neighborhood', e.target.value)}
          className={`mt-1 ${errors['address.neighborhood'] ? 'border-red-400' : ''}`}
        />
        {errors['address.neighborhood'] && <p className="text-xs text-red-500 mt-1">{errors['address.neighborhood']}</p>}
      </div>

      {/* City */}
      <div>
        <Label>Cidade <span className="text-red-500">*</span></Label>
        <Input
          placeholder="Cidade"
          value={addr.city || ''}
          onChange={(e) => field('city', e.target.value)}
          className={`mt-1 ${errors['address.city'] ? 'border-red-400' : ''}`}
        />
        {errors['address.city'] && <p className="text-xs text-red-500 mt-1">{errors['address.city']}</p>}
      </div>

      {/* State */}
      <div>
        <Label>Estado <span className="text-red-500">*</span></Label>
        <Select value={addr.state || ''} onValueChange={(v) => field('state', v)}>
          <SelectTrigger className={`mt-1 ${errors['address.state'] ? 'border-red-400' : ''}`}>
            <SelectValue placeholder="UF" />
          </SelectTrigger>
          <SelectContent>
            {BRAZIL_STATES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors['address.state'] && <p className="text-xs text-red-500 mt-1">{errors['address.state']}</p>}
      </div>

      {/* Zip Code */}
      <div>
        <Label>CEP <span className="text-red-500">*</span></Label>
        <Input
          placeholder="00000-000"
          value={addr.zip_code || ''}
          onChange={(e) => field('zip_code', formatCEP(e.target.value))}
          className={`mt-1 ${errors['address.zip_code'] ? 'border-red-400' : ''}`}
        />
        {errors['address.zip_code'] && <p className="text-xs text-red-500 mt-1">{errors['address.zip_code']}</p>}
      </div>
    </div>
  );
}