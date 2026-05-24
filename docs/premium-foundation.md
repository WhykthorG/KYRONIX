<!-- P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV. -->
# Base para recursos premium

## Estado atual
- O milestone 8 nao introduz fila, worker, webhook ativo ou IA operacional.
- Exportacao administrativa e dispatch de notificacoes continuam inline.
- A base nova fica concentrada no contrato `src/lib/contracts/systemEvents.js`, que padroniza eventos, jobs prioritarios e backlog tecnico de IA futura.

## Event map prioritario

| Evento | Origem atual | Consumidor atual | Extensao futura prevista |
| --- | --- | --- | --- |
| `enrollment.created` | `api/admin/enrollments.js` | `server/notificationsServer.js` | webhook para CRM, IA de risco documental |
| `enrollment.document_pending` | `api/admin/enrollments.js` | `server/notificationsServer.js` | checklist externo, IA de follow-up |
| `message.posted` | `api/messages/index.js` | `server/notificationsServer.js` | feed externo, resumo por IA |
| `access.reset` | `api/admin/users/[userId].js` | `server/notificationsServer.js` | sync de identidade, assistente de suporte |
| `system.export.requested` | `api/admin/system-export.js` | `server/systemExportServer.js` | fila de exportacao, webhook de arquivo pronto |
| `system.export.completed` | `server/systemExportServer.js` | `api/admin/system-export.js` | verificacao automatica, IA de anomalias |

## Jobs prioritarios

### `notification.dispatch`
- Modo atual: `inline`
- Fila futura prevista: `notifications`
- Entrada canonica: evento de dominio vindo de matricula, documento pendente, comunicado ou redefinicao de acesso
- Saida atual: persistencia em `notifications` e tentativa best effort de e-mail
- Proxima evolucao segura: trocar a execucao inline por enqueue sem mudar o payload do produtor

### `system.export.generation`
- Modo atual: `inline`
- Fila futura prevista: `exports`
- Entrada canonica: requisicao autenticada de exportacao com dataset, formato e solicitante
- Saida atual: arquivo gerado em memoria com manifesto e metadados de job
- Proxima evolucao segura: mover geracao pesada para worker/fila e manter a API apenas como disparo e entrega assinada

## Pontos de extensao
- Filas: os metadados de job ja carregam `jobType`, `eventType`, `queue`, `executionMode` e `idempotencyKey`, suficientes para trocar inline por enfileirado sem redesenhar os produtores.
- Webhooks: os eventos de dominio priorizados ja possuem nomes canonicos e fronteiras claras de origem, evitando acoplamento direto entre endpoint e integracao externa.
- IA futura: o backlog tecnico abaixo se apoia apenas em eventos e dados que o sistema ja produz hoje; nao depende de reabrir regras de permissao ou storage.
- Download administrativo: a rota de exportacao expõe o contrato de job tambem por headers HTTP (`X-System-Job-*`), e o client administrativo ja reidrata esse metadado para futura correlacao/polling sem mudar o payload binario do arquivo.
- JSON administrativo e notificacoes: os fluxos HTTP sincronos que disparam `notification.dispatch` agora reutilizam o mesmo contrato `X-System-Job-*`, permitindo futura correlacao/polling sem depender apenas do corpo JSON.
- Correlacao/idempotencia: exportacoes e dispatches agora aceitam `request_id`/`trace_id` quando disponiveis para evitar colisao entre acoes repetidas sobre o mesmo registro na futura camada de fila.

## Backlog tecnico de IA futura
- `ai.message-summary`: resumir comunicados e gerar destaque curto apos `message.posted`
- `ai.enrollment-risk-review`: classificar urgencia de matriculas sem anexos apos `enrollment.document_pending`
- `ai.export-anomaly-scan`: verificar inconsistencias e montar resumo tecnico apos `system.export.completed`
