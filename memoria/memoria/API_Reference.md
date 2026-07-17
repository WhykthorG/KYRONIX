# API_Reference

## Descrição
Referência da API do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Endpoints administrativos

| Endpoint | Metodo | Finalidade |
|---|---|---|
| `/api/admin/users` | `GET` | localizar usuario por email |
| `/api/admin/users` | `POST` | criar usuario |
| `/api/admin/users/[userId]` | `PUT` | redefinir senha |
| `/api/admin/users/[userId]` | `DELETE` | excluir usuario |
| `/api/admin/profiles` | `POST` | criar perfil administrativo |
| `/api/admin/enrollments` | `POST` | matricular aluno |
| `/api/admin/system-export` | `GET` | exportar dados (xlsx/csv) |

## Endpoints de seguranca

| Endpoint | Metodo | Finalidade |
|---|---|---|
| `/api/security/supabase/*` | `*` | proxy serverless para Supabase |
| `/api/audit/events` | `POST` | registro de auditoria |
| `/api/observability/events` | `POST` | eventos de observabilidade |

## Endpoints de dominio

| Endpoint | Metodo | Finalidade |
|---|---|---|
| `/api/guardian/monthly-report` | `GET` | relatorio mensal do responsavel |
| `/api/guardian/documents` | `GET` | documentos do aluno |
| `/api/messages/index.js` | `*` | mensagens e comunicados |
| `/api/notifications/*` | `*` | notificacoes |
| `/api/admin/schedule-planner/*` | `*` | planejamento de horarios |

## Ver Também
- [[arquitetura]] — Arquitetura do sistema
- [[Seguranca]] — Segurança e proxy
