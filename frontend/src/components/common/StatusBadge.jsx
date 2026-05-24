// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  // Student status
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  inativo: { label: 'Inativo', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  transferido: { label: 'Transferido', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  formado: { label: 'Formado', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  evadido: { label: 'Evadido', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },

  // Payment status
  pago: { label: 'Pago', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  atrasado: { label: 'Atrasado', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  cancelado: { label: 'Cancelado', color: 'bg-slate-100 text-slate-700 border-slate-200' },

  // Attendance status
  presente: { label: 'Presente', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ausente: { label: 'Ausente', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  justificado: { label: 'Justificado', color: 'bg-amber-100 text-amber-700 border-amber-200' },

  // Assignment status
  publicado: { label: 'Publicado', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  entregue: { label: 'Entregue', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  avaliada: { label: 'Avaliada', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  publicada: { label: 'Publicada', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  enviada: { label: 'Enviado', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  agendado: { label: 'Agendado', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  agendada: { label: 'Agendado', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  rascunho: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  encerrada: { label: 'Encerrada', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  concluido: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  em_progresso: { label: 'Em Progresso', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  pausado: { label: 'Pausado', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  pausada: { label: 'Pausada', color: 'bg-amber-100 text-amber-700 border-amber-200' },

  // General
  aberta: { label: 'Aberta', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  resolvida: { label: 'Resolvida', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { label: status, color: 'bg-slate-100 text-slate-700' };

  return (
    <Badge variant="outline" className={cn(config.color, className)}>
      {config.label}
    </Badge>
  );
}
