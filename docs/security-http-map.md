<!-- Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r. -->
# Mapa HTTP E Proxy

## Onde o proxy vive

- O proxy de Supabase vive em `backend/src/routes/security/supabase/*`.
- Ele continua exposto ao cliente em `/api/security/supabase/*`.
- O deploy serverless pode ser atendido por `infra/netlify/functions/api.js` ou por outro adaptador compatível.
- O `infra/nginx.conf` deste repositório continua apenas servindo o SPA estatico; ele nao intercepta o proxy.

## Entradas HTTP atuais

### Passam por `/api`

- `api/admin/*`
- `api/audit/events`
- `api/guardian/*`
- `api/messages/index.js`
- `api/notifications/*`
- `api/observability/events`
- `api/security/supabase/*`

### Passam pelo proxy de Supabase

- `auth/v1/*`
- `rest/v1/*`
- `rpc/*`
- `storage/v1/*`

Esses caminhos sao reescritos pelo cliente em `frontend/src/lib/supabase.js` para `api/security/supabase/*`.

### Ainda sao acessos diretos ao Supabase

- Chamadas privilegiadas do backend em `backend/src/services/supabaseAdminServer.js` usando `service_role`.
- Esses acessos ficam restritos aos handlers serverless que ja fazem autenticacao, permissao e auditoria.

## Controles do proxy

- Extracao de IP via `requestSecurity.js`.
- Rate limiting via `security_request_windows`.
- Blocklist via `security_ip_blocks`.
- Auditoria via `security_events`.
- Forward seguro de `Authorization` e headers de auditoria quando existe usuario autenticado.

## Observacao

- Depois dessa mudanca, o frontend nao deve falar direto com o Supabase nos fluxos sensiveis; o caminho passa pelo proxy serverless.
