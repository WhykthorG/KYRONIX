import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, Calendar, MapPin, Building, CreditCard, Clock, UserCheck, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProfileCard({ profile, profileConfig, statusConfig, onClose, onApprove, onSuspend }) {
  if (!profile) return null;

  const pCfg = profileConfig[profile.profile_type] || profileConfig['aluno'];
  const sCfg = statusConfig[profile.status] || statusConfig['pendente'];
  const PIcon = pCfg?.icon || UserCheck;
  const SIcon = sCfg?.icon || Clock;

  const formatDate = (ds) => {
    if (!ds) return '—';
    try {
      if (ds.includes('T')) return new Date(ds).toLocaleDateString();
      const [y, m, d] = ds.split('-');
      return `${d}/${m}/${y}`;
    } catch { return ds; }
  };

  const formatAddress = (address) => {
    if (!address) return '—';
    if (typeof address === 'string') return address;

    if (typeof address === 'object') {
      const parts = [
        address.rua,
        address.numero,
        address.bairro,
        address.cidade,
        address.estado,
        address.cep,
      ]
        .filter((value) => typeof value === 'string' || typeof value === 'number')
        .map((value) => String(value).trim())
        .filter(Boolean);

      return parts.length > 0 ? parts.join(', ') : JSON.stringify(address);
    }

    return String(address);
  };

  const formatTextValue = (value) => {
    if (!value) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        {/* Header Cover */}
        <div className={cn("h-32 w-full", pCfg.color.replace('text-', 'bg-').replace('100', '500'))}></div>
        
        <div className="px-6 pb-6 relative -mt-12">
          {/* Avatar & Badges */}
          <div className="flex justify-between items-end mb-4">
            <Avatar className="w-24 h-24 ring-4 ring-white shadow-md">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-2xl font-bold">
                {profile.full_name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-2 mb-2">
              <Badge variant="outline" className={cn('gap-1.5 font-medium', pCfg.color)}>
                <PIcon className="w-3.5 h-3.5" /> {pCfg.label}
              </Badge>
              <Badge variant="outline" className={cn('gap-1 font-medium', sCfg.color)}>
                <SIcon className="w-3.5 h-3.5" /> {sCfg.label}
              </Badge>
            </div>
          </div>

          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold text-slate-900">{profile.full_name}</DialogTitle>
            <p className="text-slate-500">{profile.user_email}</p>
          </DialogHeader>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Telefone</p>
                <p className="font-medium text-slate-800">{profile.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
              <CreditCard className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Documento / CPF</p>
                <p className="font-medium text-slate-800">{profile.document_id || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Nascimento</p>
                <p className="font-medium text-slate-800">{formatDate(profile.birth_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
              <Building className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Departamento</p>
                <p className="font-medium text-slate-800">{profile.department || '—'}</p>
              </div>
            </div>
            <div className="md:col-span-2 flex items-start gap-3 p-3 rounded-xl bg-slate-50">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Endereço</p>
                <p className="font-medium text-slate-800">{formatAddress(profile.address)}</p>
              </div>
            </div>
            {profile.notes && (
              <div className="md:col-span-2 p-3 rounded-xl bg-slate-100 border border-slate-200">
                <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Observações</p>
                <p className="text-slate-700 whitespace-pre-wrap">{formatTextValue(profile.notes)}</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            {profile.status === 'pendente' && (
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onApprove(profile)}>
                <UserCheck className="w-4 h-4 mr-2" /> Aprovar Acesso
              </Button>
            )}
            {profile.status === 'ativo' && (
              <Button variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => onSuspend(profile)}>
                <UserX className="w-4 h-4 mr-2" /> Suspender
              </Button>
            )}
            {profile.status === 'inativo' && (
              <Button variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => onApprove(profile)}>
                <UserCheck className="w-4 h-4 mr-2" /> Reativar
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
