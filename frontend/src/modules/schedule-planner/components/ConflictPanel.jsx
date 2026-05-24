import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ConflictPanel({ conflicts = [] }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>Conflitos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {conflicts.length === 0 && <p className="text-sm text-slate-500">Nenhum conflito aberto.</p>}
        {conflicts.map((conflict) => (
          <div key={conflict.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{conflict.conflict_type}</Badge>
              <Badge variant="outline">{conflict.severity}</Badge>
            </div>
            <p className="mt-2 font-medium text-amber-950">{conflict.reason_text}</p>
            <p className="mt-1 text-sm text-amber-800">{conflict.impact_summary}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

