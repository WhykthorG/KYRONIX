<!-- P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV. -->
# Auditoria de Producao - Resumo Executivo

Baseado no relatorio completo em [auditoria-producao-2026-04-03.md](./auditoria-producao-2026-04-03.md).

## Status atual

O sistema nao esta apto para producao no estado atual.

O projeto tem pontos positivos:
- build funcionando
- testes automatizados passando (`92/92`)
- separacao razoavel entre frontend, backend, contratos e banco
- tentativa visivel de endurecimento recente em RLS e tenant isolation

Os bloqueadores reais de producao hoje estao em:
- autorizacao excessiva
- exposicao de credenciais temporarias
- excesso de privilegios com `service role`
- drift entre frontend, backend e schema
- excesso de dados enviados ao navegador

## Severidade consolidada

- `CRITICO`: 2
- `ALTO`: 2
- `MEDIO`: 5
- `BAIXO`: 1

## Riscos que bloqueiam go-live

### 1. Exportacao completa do sistema para perfis nao administradores

`secretario` e `coordenador` conseguem acessar `system.export`, e a exportacao usa `service role` com `select('*')`.

Impacto:
- vazamento massivo de PII
- exposicao de mensagens privadas
- exportacao ampla de dados academicos e operacionais

Arquivos principais:
- [src/lib/contracts/access.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/contracts/access.js)
- [api/admin/system-export.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/admin/system-export.js)
- [server/systemExportServer.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/server/systemExportServer.js)

### 2. Troca obrigatoria de senha no primeiro acesso nao e garantida

O fluxo depende de `sessionStorage` e de um campo (`is_first_login`) que nao esta alinhado com o baseline principal do banco.

Impacto:
- usuarios podem continuar usando credencial temporaria
- regra critica fica bypassavel
- frontend e banco entram em comportamento divergente

Arquivos principais:
- [src/App.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/App.jsx)
- [supabase/schema.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/schema.sql)
- [supabase/migration_combined_corrected.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql)

### 3. Senhas temporarias sao exibidas e enviadas por e-mail

O sistema mostra a senha temporaria na interface e a inclui no corpo do e-mail de reset.

Impacto:
- comprometimento de conta por screenshot, e-mail ou repasse manual
- fluxo inseguro de onboarding e recuperacao de acesso

Arquivos principais:
- [src/pages/UserManagement.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/UserManagement.jsx)
- [src/pages/Registration.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/Registration.jsx)
- [src/lib/contracts/notifications.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/contracts/notifications.js)

### 4. Erros internos vazam detalhes tecnicos para o cliente

O backend devolve `details`, `postgresCode`, `postgresDetails` e `postgresHint` em alguns erros.

Impacto:
- exposicao de detalhes internos de banco
- aumento da superficie de investigacao para ataque
- menor robustez contratual da API

Arquivos principais:
- [server/supabaseAdminServer.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/server/supabaseAdminServer.js)
- [api/admin/enrollments.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/admin/enrollments.js)

## Riscos relevantes, mas nao bloqueadores imediatos

- Escopo de tenant em notificacoes ainda aceita `tenant_id = NULL`.
- Configuracoes sistemicas caem para `localStorage` quando o backend falha.
- A pagina de configuracoes exibe indicadores de conformidade sem validacao real.
- O frontend rejeita e-mails que nao sejam `@gmail.com`.
- A API generica do browser usa `select('*')` e faz overfetch de dados sensiveis.
- O portal do responsavel depende de `service role` com autorizacao manual.
- Documentacao e schema principal nao refletem integralmente o comportamento esperado pelo app.

## Prioridade de correcao

### Fase 1 - antes de qualquer producao

1. Revogar `system.export` de perfis nao administradores.
2. Remover senha temporaria em texto puro da UI e do e-mail.
3. Implementar enforcement real de primeiro acesso no backend/Auth.
4. Sanitizar respostas de erro publicas.

### Fase 2 - endurecimento necessario

1. Remover fallback de tenant `NULL` nas notificacoes.
2. Reduzir uso de `service role` fora de fluxos administrativos estritos.
3. Substituir `select('*')` por projecoes explicitas.
4. Separar preferencias locais de configuracoes sistemicas reais.

### Fase 3 - estabilizacao e governanca

1. Consolidar um baseline oficial de schema/migrations.
2. Atualizar documentacao tecnica do `TCC-3`.
3. Revisar a suite de testes para garantir que ela valide o estado seguro desejado, e nao o comportamento inseguro atual.

## Decisao recomendada

Recomendacao objetiva: **nao publicar em producao ainda**.

Liberacao so deveria ser considerada apos:
- fechamento de todos os itens `CRITICO`
- fechamento de todos os itens `ALTO`
- validacao manual dos fluxos de exportacao, onboarding, reset de acesso e notificacoes
- revisao final de RLS, service role e minimizacao de dados no frontend

## Maturidade atual

Classificacao: `intermediaria`.

O projeto ja tem base de desenvolvimento consistente, mas ainda nao tem maturidade de seguranca e operacao suficiente para producao real.
