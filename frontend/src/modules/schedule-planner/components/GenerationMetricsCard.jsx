// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function GenerationMetricsCard({ metrics = {} }) {
  const items = [
    ['Score final', metrics.final_score ?? 0],
    ['Conflitos', metrics.conflict_score ?? 0],
    ['Preferências', metrics.teacher_preference_score ?? 0],
    ['Carga', metrics.workload_balance_score ?? 0],
    ['Continuidade', metrics.continuity_score ?? 0],
    ['Salas', metrics.room_utilization_score ?? 0],
  ];

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>Métricas de qualidade</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
