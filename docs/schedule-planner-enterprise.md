<!-- ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ. -->
# Schedule Planner Enterprise

## Visão geral
O módulo de horários é composto por:
- UI em `src/pages/SchedulePlanner.jsx`
- contratos em `src/lib/contracts/schedulePlanner.js`
- motor heurístico em `src/lib/scheduling/engine.js`
- backend administrativo em `api/admin/schedule-planner/*`
- serviços de suporte em `server/schedule-planner/*`

## Fluxo
1. Criar planejamento.
2. Estruturar turnos, ambientes e matriz curricular.
3. Enviar questionários de disponibilidade.
4. Responder disponibilidade e preferências.
5. Gerar grade.
6. Registrar conflitos, sugestões, versões e auditoria.
7. Publicar a versão ativa.

## Regras de negócio
- HARD: indisponibilidade, conflito de professor, turma e ambiente, limite diário.
- SOFT: evitar janelas, preferir geminação, balancear carga, continuidade e distribuição.

## Endpoints
- `POST /api/admin/schedule-planner/settings`
- `POST /api/admin/schedule-planner/structures`
- `POST /api/admin/schedule-planner/questionnaires`
- `POST /api/admin/schedule-planner/generate`
- `GET /api/admin/schedule-planner/generations/:id`
- `GET /api/admin/schedule-planner/conflicts`
- `GET /api/admin/schedule-planner/suggestions`
- `POST /api/admin/schedule-planner/suggestions/:id`
- `GET /api/admin/schedule-planner/versions`
- `POST /api/admin/schedule-planner/versions/:id`
- `POST /api/admin/schedule-planner/publish`
- `POST /api/admin/schedule-planner/manual-edits`
- `GET /api/admin/schedule-planner/audit-log`

## Estratégia de teste
- Unit: score, validação, conflito, sugestão.
- Integração: geração, publicação, restauração, edição manual.
- Permissão: manage, view, publish, audit e respond.
