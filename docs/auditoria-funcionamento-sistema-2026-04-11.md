<!-- P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV. -->
# Auditoria de Funcionamento do Sistema

Data da auditoria: 2026-04-11

## 1. Visão geral da segurança e robustez do sistema
Auditoria estática refeita sobre `src/`, `api/`, `server/`, `supabase/` e `tests/`. O build já havia passado, mas a robustez geral continua comprometida por deriva entre contratos compartilhados, APIs administrativas e a fonte canônica de banco. Na validação local, `npm run lint` falhou e `npm test` havia falhado com 13 regressões funcionais relevantes.

Sem instância Supabase viva nesta auditoria, a análise de banco foi estática. Ainda assim, há evidência suficiente de problemas que hoje atrapalham fluxo administrativo, relatórios, notificações, busca e consistência de deploy.

## 2. Lista completa de problemas encontrados
### Banco canônico divergente e incompleto para o modelo tenant-aware
1. Categoria: Banco de dados / segurança / arquitetura.
2. Severidade: Crítica.
3. Local afetado: [schema.sql](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/supabase/schema.sql:956>), [schema.sql](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/supabase/schema.sql:1352>), [completo.sql](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/supabase/completo.sql:28>), [completo.sql](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/supabase/completo.sql:840>), [completo.sql](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/supabase/completo.sql:864>); arquivos ausentes `supabase/migration_enterprise_data_base.sql` e `supabase/migration_hardening_enterprise.sql`.
4. Descrição detalhada: o `schema.sql` canônico não contém `current_tenant_id()`, `system_events`, `idempotency_keys`, `tenant_id` em `audit_logs`/`observability_logs` nem policies tenant-aware, enquanto `completo.sql` contém esse modelo.
5. Causa raiz técnica: existem múltiplas fontes de verdade SQL e a cadeia de migrations esperada pela suíte não está completa no repositório.
6. Impacto real: ambientes recriados a partir do schema errado sobem sem objetos e políticas que o código e os testes assumem, gerando quebra funcional e comportamento divergente entre ambientes.
7. Risco de exploração ou quebra: alto risco de vazamento cruzado de auditoria/logs e de quebra de features administrativas em deploys novos; em [schema.sql](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/supabase/schema.sql:1352>) a policy de `audit_logs` não filtra tenant.
8. Correção recomendada: eleger uma única fonte de verdade, versionar as migrations faltantes, regenerar `schema.sql` a partir da cadeia real e alinhar policies tenant-aware em todos os objetos sensíveis.
9. Código corrigido, quando possível: não aplicável nesta auditoria; a correção exige consolidação estrutural do SQL.

### Fluxo administrativo para criar responsável está quebrado
1. Categoria: Erro funcional / API administrativa.
2. Severidade: Alta.
3. Local afetado: [api/admin/profiles.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/api/admin/profiles.js:19>), [api/admin/profiles.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/api/admin/profiles.js:39>), [UserManagement.jsx](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/pages/UserManagement.jsx:87>), [UserManagement.jsx](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/pages/UserManagement.jsx:179>), [Registration.jsx](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/pages/Registration.jsx:80>), [Registration.jsx](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/pages/Registration.jsx:596>), [supabaseAdmin.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/supabaseAdmin.js:160>).
4. Descrição detalhada: as telas administrativas oferecem criação de perfil `responsavel` e enviam o fluxo por `createManagedProfile`, mas a API rejeita esse tipo porque `ALLOWED_PROFILE_TYPES` só aceita `professor`, `coordenador`, `secretario` e `administrador`.
5. Causa raiz técnica: a whitelist do endpoint não acompanha os fluxos reais de cadastro exibidos na UI.
6. Impacto real: gestão não consegue criar acessos de responsáveis pelo fluxo previsto, bloqueando onboarding do Portal do Responsável.
7. Risco de exploração ou quebra: quebra direta de operação administrativa; o sistema promete um fluxo que devolve erro 400.
8. Correção recomendada: incluir `responsavel` na whitelist do endpoint ou separar o fluxo por tipo de perfil com validação consistente entre frontend e backend.
9. Código corrigido, quando possível: não aplicável nesta auditoria.

### Preferências de notificação estão fora de contrato e não podem ser geridas corretamente
1. Categoria: Erro funcional / contrato compartilhado.
2. Severidade: Alta.
3. Local afetado: [settings.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/settings.js:27>), [settings.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/settings.js:47>), [settings.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/settings.js:67>), [notifications.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/notifications.js:36>), [notifications.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/notifications.js:109>), [notificationsServer.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/server/notificationsServer.js:353>), [notificationsServer.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/server/notificationsServer.js:373>), [SettingsPage.jsx](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/pages/SettingsPage.jsx:292>), [migration_notifications_base.sql](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/supabase/migration_notifications_base.sql:4>).
4. Descrição detalhada: o banco e o subsistema de notificações suportam `notify_document_pending`, `notify_message_posted` e `notify_access_reset`, mas `settings.js` não mapeia essas chaves e a tela de configurações não as expõe.
5. Causa raiz técnica: o contrato de configurações foi simplificado, mas o contrato de notificações e o schema permaneceram mais amplos.
6. Impacto real: essas notificações ficam efetivamente sem governança; o servidor consulta preferências que nunca são persistidas nem editadas corretamente.
7. Risco de exploração ou quebra: ruído operacional, envio indevido de notificações e impossibilidade de cumprir política funcional definida pela escola.
8. Correção recomendada: alinhar `DEFAULT_SYSTEM_SETTINGS`, `mapSystemSettingsRecord`, `buildSystemSettingsRecord` e a UI de configurações com todas as chaves realmente usadas por `notificationsServer`.
9. Código corrigido, quando possível: não aplicável nesta auditoria.

### Descoberta de funcionalidades e permissões estão descentralizadas e inconsistentes
1. Categoria: Arquitetura / autorização funcional.
2. Severidade: Média.
3. Local afetado: [globalSearch.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/globalSearch.js:97>), [globalSearch.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/globalSearch.js:350>), [access.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/access.js:293>), [appManifest.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/appManifest.js:148>), [appManifest.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/appManifest.js:304>).
4. Descrição detalhada: a busca global ainda filtra por `entity.roles.includes(profileType)` em vez de usar a matriz central `canAccessPage`; no manifesto, há permissões inexistentes como `PERMISSIONS.SCHOOL_CALENDAR_VIEW` e `PERMISSIONS.STUDENT_ENROLLMENT`.
5. Causa raiz técnica: a RBAC foi centralizada em `access.js`, mas consumidores antigos permaneceram com listas locais e nomes obsoletos.
6. Impacto real: a descoberta de telas pode divergir da autorização real; mudanças futuras de permissão não se propagam de forma confiável para busca e catálogo.
7. Risco de exploração ou quebra: usuários podem deixar de encontrar funcionalidades permitidas ou enxergar entradas que já não refletem a regra canônica.
8. Correção recomendada: remover `roles` hardcoded da busca, adicionar referência de página às entidades buscáveis e fazer todos os consumidores derivarem somente de `canAccessPage`/`PERMISSIONS` válidas.
9. Código corrigido, quando possível: não aplicável nesta auditoria.

### Relatório mensal do responsável usa contrato incorreto e gera saída incompleta
1. Categoria: Erro funcional / relatórios.
2. Severidade: Média.
3. Local afetado: [monthly-report.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/api/guardian/monthly-report.js:239>), [monthly-report.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/api/guardian/monthly-report.js:241>), [pdfReports.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/pdfReports.js:151>), [pdfReports.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/pdfReports.js:161>), [pdfReports.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/pdfReports.js:195>), [pdfReports.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/pdfReports.js:212>), [GuardianPortal.jsx](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/pages/GuardianPortal.jsx:210>).
4. Descrição detalhada: a API retorna `classRecord`, mês filtrado e coleções mensais; o builder do PDF ignora `classRecord`, monta `monthLabel` como `03/2026`, reaproveita `rows` de boletim anual e não produz o resumo mensal mais rico esperado pelo fluxo.
5. Causa raiz técnica: o contrato do model do PDF não foi atualizado junto com o payload real da API.
6. Impacto real: o responsável pode baixar um relatório mensal com turma vazia, formatação pobre e informação agregada de forma diferente do esperado.
7. Risco de exploração ou quebra: quebra funcional visível para usuário final e perda de confiança no documento emitido.
8. Correção recomendada: alinhar `buildGuardianMonthlyStudentReportPdfModel` ao payload de `/api/guardian/monthly-report`, consumindo `classRecord`, preservando o mês selecionado e gerando seções mensais explícitas.
9. Código corrigido, quando possível: não aplicável nesta auditoria.

### Shell do desktop e exportação administrativa têm regressões de comportamento
1. Categoria: Frontend / operação administrativa.
2. Severidade: Média.
3. Local afetado: [Desktop.jsx](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/pages/Desktop.jsx:181>), [Desktop.jsx](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/pages/Desktop.jsx:801>), [Desktop.jsx](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/pages/Desktop.jsx:845>), [Desktop.jsx](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/pages/Desktop.jsx:874>), [useUserInactivity.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/hooks/useUserInactivity.js:3>), [systemExport.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/contracts/systemExport.js:8>), [systemExportServer.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/server/systemExportServer.js:192>), [systemExportServer.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/server/systemExportServer.js:273>), [systemExportServer.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/server/systemExportServer.js:323>).
4. Descrição detalhada: o hook de inatividade e o overlay existem, mas a busca global e o menu iniciar não recebem fechamento forçado ao entrar em idle; na exportação completa, o manifesto e `dataset_count` contam todo o catálogo, inclusive datasets indisponíveis.
5. Causa raiz técnica: regressões de contrato de UI/telemetria não acompanhadas pelos consumidores.
6. Impacto real: o modo ocioso não “trava” totalmente a shell e o operador recebe metadados de exportação enganosos sobre o que foi realmente exportado.
7. Risco de exploração ou quebra: UX inconsistente no desktop e diagnóstico administrativo incorreto em exportações.
8. Correção recomendada: propagar `idleModeActive` para busca/menu com fechamento forçado e mudar o manifesto da exportação para refletir datasets efetivamente exportados ou separar claramente indisponíveis de exportados.
9. Código corrigido, quando possível: não aplicável nesta auditoria.

### Ferramentas de validação automatizada estão quebradas
1. Categoria: Qualidade / observabilidade de regressão.
2. Severidade: Baixa.
3. Local afetado: [fix_git_conflicts.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/fix_git_conflicts.js:1>), [auditLog.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/auditLog.js:168>), [auditLog.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/src/lib/auditLog.js:304>), [audit.integration.test.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/tests/audit.integration.test.js:7>), [audit.integration.test.js](</C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova pasta/tests/audit.integration.test.js:193>).
4. Descrição detalhada: `fix_git_conflicts.js` está salvo com escapes literais `\n`, gerando erro de parsing no lint; além disso, o contrato de auditoria perdeu `buildStorageUploadAuditMetadata` e não expõe `actor_tenant_id` no ator.
5. Causa raiz técnica: artefatos utilitários e contratos de auditoria não foram mantidos após refactors recentes.
6. Impacto real: `npm run lint` falha, a suíte de auditoria quebra e o projeto perde capacidade de detectar regressões com confiança.
7. Risco de exploração ou quebra: regressões entram com mais facilidade porque o pipeline local deixa de sinalizar problemas cedo.
8. Correção recomendada: consertar o arquivo inválido, restaurar/exportar os helpers de auditoria esperados e alinhar a estrutura do ator com o contexto tenant-aware pretendido.
9. Código corrigido, quando possível: não aplicável nesta auditoria.

## 3. Resumo por severidade
- Crítica: 1 problema.
- Alta: 2 problemas.
- Média: 3 problemas.
- Baixa: 1 problema.

## 4. Resumo por área analisada
- Banco e migrations: maior concentração de risco; hoje é o principal ponto de quebra estrutural.
- APIs administrativas: fluxo de cadastro e governança de notificações estão inconsistentes com a UI.
- Frontend e contratos compartilhados: busca, shell e relatórios têm regressões de comportamento/contrato.
- Tooling e validação: lint e auditoria automatizada não estão confiáveis.

## 5. Top 10 riscos mais graves
1. Deploy novo subir com `schema.sql` sem isolamento tenant-aware.
2. Leitura cruzada de `audit_logs` em ambiente que use o schema canônico atual.
3. Impossibilidade de criar responsáveis pelo fluxo administrativo previsto.
4. Bloqueio de onboarding do Portal do Responsável.
5. Notificações críticas seguirem ativas por falta de persistência de preferência.
6. Busca global divergir da RBAC canônica e esconder/exibir recursos errados.
7. Relatório mensal do responsável sair com turma vazia ou contrato incompleto.
8. Shell do desktop entrar em idle sem fechar totalmente busca/menu.
9. Exportação administrativa informar contagens enganosas no manifesto/job metadata.
10. Regressões passarem despercebidas porque lint e testes de auditoria estão quebrados.

## 6. Correções prioritárias
1. Consolidar a camada SQL: criar/versionar as migrations enterprise faltantes, regenerar `schema.sql` e eliminar a duplicidade com `completo.sql`.
2. Corrigir imediatamente `api/admin/profiles.js` para aceitar `responsavel` ou alinhar a UI para não oferecer um fluxo que o backend rejeita.
3. Unificar `settings.js`, `notifications.js`, `notificationsServer.js` e `SettingsPage.jsx` nas mesmas chaves de preferência.
4. Fazer busca global e manifesto dependerem apenas de `access.js` e remover constantes de permissão obsoletas.
5. Reescrever o model do PDF mensal do responsável a partir do payload real de `/api/guardian/monthly-report`.
6. Restaurar a confiabilidade da validação local: corrigir `fix_git_conflicts.js`, recuperar os helpers de auditoria faltantes e reexecutar lint/testes.

## 7. Diagnóstico final do projeto
O sistema continua funcional em partes importantes, mas ainda não está coerente como produto integrado. O maior problema não é um bug isolado; é a deriva entre banco, contratos compartilhados e consumidores de frontend/backend. Isso já virou quebra operacional real em cadastro de responsáveis, preferências de notificação e relatórios.

## 8. Nível atual de maturidade do sistema
Maturidade atual: média-baixa para operação controlada e baixa para produção com requisitos mais fortes de robustez, governança e multi-tenant. Antes de nova rodada de expansão funcional, o projeto precisa primeiro recuperar consistência de schema, contratos e validação automatizada.
