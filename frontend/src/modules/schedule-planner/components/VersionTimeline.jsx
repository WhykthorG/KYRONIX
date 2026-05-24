import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function VersionTimeline({ versions = [], onRestore, onPublish }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle>Versões</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {versions.length === 0 && <p className="text-sm text-slate-500">Nenhuma versão registrada.</p>}
        {versions.map((version) => (
          <div key={version.id} className="rounded-2xl border border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">V{version.version_number}</Badge>
              <Badge variant="outline">{version.origin}</Badge>
              <Badge variant="outline">{version.status}</Badge>
              {version.is_active && <Badge>Ativa</Badge>}
            </div>
            <p className="mt-2 font-medium text-slate-900">{version.title}</p>
            <p className="mt-1 text-sm text-slate-500">Score: {version.score?.quality_score ?? version.quality_score ?? 0}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onRestore?.(version)}>Restaurar</Button>
              <Button size="sm" onClick={() => onPublish?.(version)}>Publicar</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

