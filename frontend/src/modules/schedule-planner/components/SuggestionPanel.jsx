// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SuggestionPanel({ suggestions = [], onApply, onReject, applyingId, rejectingId }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>Sugestões</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.length === 0 && <p className="text-sm text-slate-500">Nenhuma sugestão disponível.</p>}
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{suggestion.suggestion_type}</Badge>
              <Badge variant="outline">{suggestion.status}</Badge>
            </div>
            <p className="mt-2 font-medium text-teal-950">{suggestion.title}</p>
            <p className="mt-1 text-sm text-teal-800">{suggestion.description}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => onApply?.(suggestion)} disabled={applyingId === suggestion.id}>Aplicar</Button>
              <Button size="sm" variant="outline" onClick={() => onReject?.(suggestion)} disabled={rejectingId === suggestion.id}>Rejeitar</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
