# Documentacao Completa do Sistema EduGest

## 1. Visao geral

O EduGest e um sistema web de gestao escolar construido como SPA em React + Vite, com autenticacao, banco de dados e storage no Supabase. A interface principal usa uma metafora de desktop, na qual os modulos funcionais sao abertos como aplicativos internos com janelas, atalhos e permissao por perfil.

Esta documentacao foi consolidada a partir da implementacao real do repositorio em `frontend/`, `backend/`, `shared/`, `supabase/`, `tests/` e `docs/`, com validacao executada em 2026-03-31 por meio de `npm run build` e `npm test`.

## 2. Escopo e evidencias

### Estado atual confirmado

- Frontend SPA em React 18, Vite 6, React Router e TanStack Query.
- Backend gerenciado no Supabase para Auth, Postgres e Storage.
- Endpoints serverless em `backend/src/routes/admin/*` preservando a interface publica em `/api/admin/*`.
- Schema SQL versionado em `supabase/schema.sql` e migrations complementares.
- Suite de testes de integracao baseada em `node --test`.
- Alternativas de deploy em Vercel e Docker + Nginx.

### Validacoes executadas

- `npm run build`: concluido com sucesso.
- `npm test`: 30 testes passando, 0 falhas.

### Fora do escopo desta consolidacao

- Nao foi executado deploy real em Vercel.
- Nao foi feita conexao a um projeto Supabase real neste turno.
- Nao foi executada automacao de browser para validacao visual ponta a ponta.

## 3. Negocio e produto

O produto cobre operacoes academicas, administrativas e pedagogicas de uma escola em uma unica interface. O foco funcional confirmado no codigo inclui:

- cadastro de alunos, professores, turmas e disciplinas;
- matricula e regularizacao academica;
- notas, frequencia, diario de classe e plano de aula;
- atividades, entregas e licao de casa;
- calendario escolar e agenda docente;
- comunicados institucionais e mensagens diretas;
- biblioteca, metas do aluno, relatorios e configuracoes;
- gestao de usuarios e exportacao administrativa do sistema.

Perfis confirmados no codigo:

- `aluno`
- `professor`
- `coordenador`
- `secretario`
- `administrador`

Documentos relacionados:

- [docs/executivo/README.md](executivo/README.md)
- [docs/executivo/resumo-executivo.md](executivo/resumo-executivo.md)
- [docs/executivo/modulos-e-indicadores.md](executivo/modulos-e-indicadores.md)

## 4. Requisitos e regras funcionais

### Requisitos funcionais confirmados

- O usuario precisa autenticar no Supabase antes de acessar modulos privados.
- O perfil do usuario e resolvido por consulta em `user_profiles`.
- O shell principal carregado por padrao e `Desktop`.
- O acesso a paginas e aplicativos internos depende de `PAGE_ACCESS_RULES` em `frontend/src/App.jsx`.
- A maior parte dos CRUDs de negocio usa a fabrica `createEntityApi` em `frontend/src/api/supabaseApi.js`.
- A criacao e manutencao de usuarios administrativos ocorre por `/api/admin/users`, `/api/admin/users/[userId]` e `/api/admin/profiles`.
- A matricula pode opcionalmente criar acesso de autenticacao do aluno por `/api/admin/enrollments`.
- A exportacao do sistema ocorre por `/api/admin/system-export` com formatos `xlsx` e `csv`.

### Regras de negocio visiveis

- `secretario` nao pode criar perfis administrativos em `/api/admin/profiles`.
- Exportacao `csv` exige dataset especifico.
- Primeiro acesso exige troca de senha antes de limpar a flag `is_first_login`.
- Comunicados e entregas usam normalizacao de contratos para compatibilidade com estados legados.
- O frontend melhora UX com filtros de permissao, mas o enforcement real depende de RLS no banco.

Documentos relacionados:

- [docs/modulos.md](modulos.md)
- [docs/fluxo.md](fluxo.md)
- [docs/rota.md](rota.md)

## 5. UX e UI

### Estado atual confirmado

- A interface principal e desktop-like, com janelas arrastaveis, taskbar e menu iniciar.
- Existe adaptacao para mobile em `frontend/src/components/desktop/MobileShell.jsx`.
- O projeto usa Tailwind CSS, Radix UI e componentes no estilo shadcn/ui.
- Estados globais de carregamento, erro e vazio sao tratados com `StatePanel`, `ErrorBoundary`, `Toaster` e `Sonner`.

### Componentes centrais de experiencia

- `frontend/src/pages/Desktop.jsx`
- `frontend/src/components/desktop/Window.jsx`
- `frontend/src/components/desktop/Taskbar.jsx`
- `frontend/src/components/desktop/StartMenu.jsx`
- `frontend/src/components/common/PageHeader.jsx`
- `frontend/src/components/common/FormFeedback.jsx`

### Observacao

Nao ha neste repositorio uma especificacao formal de design tokens, guideline visual completo ou auditoria de acessibilidade automatizada. Isso deve ser tratado como evolucao de UX, nao como capacidade ja validada.

Documentos relacionados:

- [docs/manuais/README.md](manuais/README.md)
- [docs/manuais/administrador.md](manuais/administrador.md)
- [docs/manuais/coordenador.md](manuais/coordenador.md)
- [docs/manuais/secretario.md](manuais/secretario.md)
- [docs/manuais/professor.md](manuais/professor.md)
- [docs/manuais/aluno.md](manuais/aluno.md)

## 6. Arquitetura

### Visao de alto nivel

```text
Browser
  -> React SPA (Vite)
     -> AuthContext
     -> React Router
     -> TanStack Query
     -> Desktop shell e paginas lazy-loaded
     -> supabase-js
        -> Supabase Auth
        -> Postgres com RLS
        -> Storage

Operacoes privilegiadas
  -> /api/admin/*
     -> backend/src/routes/admin/*
     -> backend/src/services/supabaseAdminServer.js
     -> Supabase service_role
```

### Componentes arquiteturais confirmados

- Bootstrap da aplicacao em `frontend/src/main.jsx`.
- Orquestracao de sessao, rotas e estado global em `frontend/src/App.jsx`.
- Lazy loading de paginas em `frontend/src/lib/appRegistry.js`.
- Cliente publico do Supabase em `frontend/src/lib/supabase.js`.
- Camada generica de dados em `frontend/src/api/supabaseApi.js`.
- Endpoints serverless administrativos em `backend/src/routes/admin/*`, expostos ao cliente como `/api/admin/*`.
- Helpers server-side em `backend/src/services/supabaseAdminServer.js` e `backend/src/services/systemExportServer.js`.

### Decisoes tecnicas relevantes

- Nao existe backend Node tradicional para o dominio principal.
- O bundle frontend fala diretamente com o Supabase usando a anon key.
- Operacoes que exigem `service_role` foram removidas do frontend e encapsuladas em handlers serverless.
- As paginas de negocio sao carregadas sob demanda para reduzir custo inicial de carregamento.

Documento relacionado:

- [docs/arquitetura.md](arquitetura.md)

## 7. Banco de dados e modelagem

### Fonte de verdade

- `supabase/schema.sql`
- `supabase/migration_improvements.sql`
- `supabase/migration_permissions_hardening.sql`
- `supabase/migration_app_settings.sql`
- `supabase/migration_security_baseline.sql`
- `supabase/migration_messages_student_policy.sql`
- `supabase/fix_coordinator_fk.sql`

### Tabelas principais por dominio

| Dominio | Tabelas |
|---|---|
| Identidade | `user_profiles` |
| Academico | `students`, `teachers`, `classes`, `subjects`, `schedules` |
| Pedagogico | `grades`, `attendance`, `assignments`, `submissions`, `class_diary`, `lesson_plans`, `homework`, `homework_completions` |
| Comunicacao | `messages`, `direct_messages` |
| Calendario | `events`, `teacher_calendar_events` |
| Apoio | `library_items`, `library_loans`, `goals`, `goal_tasks`, `occurrences`, `app_settings` |

### Relacoes visiveis de negocio

- `students.current_class_id -> classes.id`
- `attendance.student_id -> students.id`
- `grades.student_id -> students.id`
- `grades.subject_id -> subjects.id`
- `assignments.class_id -> classes.id`
- `submissions.assignment_id -> assignments.id`
- `teacher_calendar_events.teacher_id -> teachers.id`
- `goal_tasks.goal_id -> goals.id`

### Recursos de dados complementares

- View materializada `mv_student_report_card`.
- RPC `dashboard_summary()`.
- RPC `get_student_report_card(UUID)`.
- Funcao `refresh_report_card()`.

Documento relacionado:

- [docs/banco-de-dados.md](banco-de-dados.md)

## 8. Seguranca, autenticacao e autorizacao

### Estado atual confirmado

- Autenticacao via Supabase Auth com email/senha e OAuth Google.
- Sessao gerenciada por `AuthContext`.
- Perfil funcional resolvido por `usePermissions` consultando `user_profiles`.
- Funcao `auth_profile_type()` no banco usada como helper de RLS.
- Operacoes administrativas exigem token bearer valido e papel permitido em `requireAdminRequest`.
- `service_role` aparece apenas em contexto server-side, via `SUPABASE_SERVICE_ROLE_KEY`.

### Controles visiveis

- Restricao de rotas e modulos no frontend em `frontend/src/App.jsx`.
- Validacao do operador administrativo em `backend/src/services/supabaseAdminServer.js`.
- Politicas de leitura e escrita por papel em `supabase/schema.sql` e migrations de hardening.
- Restricao de mensagens diretas e comunicados por audiencia.

### Riscos e alinhamentos pendentes

- Existe divergencia documentada entre o frontend e o schema para o status `suspenso` em `user_profiles`.
- Nao ha evidencia, neste turno, de rate limiting proprio para handlers serverless.
- Nao ha documento legal ou operacional especificando retencao de dados ou resposta a incidentes.

Documentos relacionados:

- [docs/banco-de-dados.md](banco-de-dados.md)
- [docs/tcc/seguranca-validacao-e-limitacoes.md](tcc/seguranca-validacao-e-limitacoes.md)

## 9. APIs e integracoes

### Integracoes confirmadas

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- OAuth Google via Supabase

### API administrativa confirmada

| Endpoint | Metodo | Finalidade |
|---|---|---|
| `/api/admin/users` | `GET` | localizar usuario de autenticacao por email |
| `/api/admin/users` | `POST` | criar usuario de autenticacao |
| `/api/admin/users` | `DELETE` | excluir auth user e/ou perfil |
| `/api/admin/users/[userId]` | `PUT` | redefinir senha |
| `/api/admin/users/[userId]` | `DELETE` | excluir usuario por id |
| `/api/admin/profiles` | `POST` | criar perfil administrativo com `user_profiles` |
| `/api/admin/enrollments` | `POST` | matricular aluno e opcionalmente criar acesso |
| `/api/admin/system-export` | `GET` | exportar dados em `xlsx` ou `csv` |

### Datasets confirmados na exportacao

- `app_settings`
- `user_profiles`
- `students`
- `teachers`
- `classes`
- `subjects`
- `schedules`
- `events`
- `teacher_calendar_events`
- `messages`
- `direct_messages`
- `assignments`
- `submissions`
- `grades`
- `attendance`
- `class_diary`
- `lesson_plans`
- `library_items`
- `library_loans`
- `goals`
- `goal_tasks`
- `occurrences`
- `homework`
- `homework_completions`

### Observacao

Nao ha, no estado atual do repositorio, OpenAPI, Swagger ou colecao Postman versionada como fonte canonica.

## 10. Desenvolvimento

### Stack tecnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 |
| Build | Vite 6 |
| Navegacao | React Router 6 |
| Server state | TanStack Query 5 |
| UI | Tailwind CSS, Radix UI, shadcn/ui |
| Backend gerenciado | Supabase |
| Testes | `node --test` |
| Containerizacao | Docker + Nginx |

### Estrutura principal

```text
frontend/
  src/           SPA React, componentes, paginas e servicos client-side
backend/
  src/routes/    handlers serverless expostos como /api/*
  src/services/  servicos server-side e integracoes privilegiadas
  src/database/  acesso e configuracao de dados server-side
shared/
  src/           contratos e utilitarios puros compartilhados
supabase/        schema, migrations e seeds
tests/           testes de integracao
docs/            documentacao funcional e tecnica
infra/           deploy, functions Netlify e containerizacao
```

### Scripts confirmados

```bash
npm run dev
npm run build
npm run lint
npm test
```

Documento relacionado:

- [docs/setup-operacao.md](setup-operacao.md)

## 11. Testes e qualidade

### Estado atual confirmado

- A suite automatizada cobre contratos e fluxos criticos de autenticacao, mensagens, atividades, notas, matricula, permissao, calendario, configuracoes e exportacao.
- Os testes existentes estao em `tests/*.integration.test.js`.
- A build de producao conclui sem erro no estado atual do repositorio.

### Cobertura funcional visivel

- primeiro acesso e troca de senha;
- publicacao e visibilidade de atividades;
- visibilidade de notas do aluno;
- regularizacao de matricula;
- restricoes de acesso por papel;
- exportacao ICS de calendario;
- mapeamento de configuracoes;
- exportacao `csv` e `xlsx` do sistema.

### Lacunas visiveis

- Nao ha testes end-to-end de browser.
- Nao ha evidencias de testes de performance.
- Nao ha pipeline CI descrita no repositorio.

## 12. DevOps e infraestrutura

### Estado atual confirmado

- Deploy SPA em Vercel com rewrite para `index.html` via `infra/vercel.json`.
- Build multi-stage em `infra/Dockerfile`.
- Publicacao em container Nginx com `gzip`, cache longo para assets e fallback SPA em `infra/nginx.conf`.
- Composicao local em `infra/docker-compose.yml` expondo a app na porta `3000`.

### Variaveis de ambiente confirmadas

| Variavel | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | chave publica do frontend |
| `VITE_APP_NAME` | nome exibido na aplicacao |
| `VITE_STORAGE_BUCKET` | bucket de uploads |
| `VITE_ADMIN_API_BASE_URL` | base da API administrativa em desenvolvimento |
| `SUPABASE_SERVICE_ROLE_KEY` | chave server-side para operacoes privilegiadas |

Documento relacionado:

- [docs/setup-operacao.md](setup-operacao.md)

## 13. Deploy e release

### Processo minimo confirmado

1. Configurar variaveis de ambiente.
2. Provisionar o projeto Supabase e aplicar schema + migrations.
3. Executar `npm run build`.
4. Publicar em Vercel ou construir imagem Docker.

### Recomendacoes operacionais

- Validar `npm test` antes de cada release.
- Confirmar que `SUPABASE_SERVICE_ROLE_KEY` nao esta exposta em ambiente cliente.
- Revisar redirects do OAuth Google no Supabase para cada dominio de deploy.
- Usar checklist de homologacao para cadastro, login, matricula, notas, frequencia, mensagens e exportacao.

## 14. Monitoramento e observabilidade

### Estado atual confirmado

- O repositorio nao apresenta, neste turno, integracao explicita com Sentry, Datadog, Prometheus, OpenTelemetry ou stack dedicada de logs.
- O diagnostico atual depende de mensagens de erro, retorno dos handlers e validacoes pontuais no frontend.

### Recomendado

- Instrumentar erros de frontend e handlers serverless.
- Registrar auditoria de operacoes administrativas sensiveis.
- Definir metricas para login, falha de matricula, exportacao e operacoes de usuario.

## 15. Manutencao e evolucao

### Estado atual confirmado

- O projeto preserva compatibilidade com chamadas legadas por meio de `base44` em `src/api/supabaseApi.js`.
- O codigo usa contratos utilitarios em `src/lib/contracts/*` para estabilizar regras de negocio sensiveis.
- Existe documentacao tecnica e funcional parcial em `docs/`.

### Prioridades de evolucao sugeridas

- alinhar estados de perfil entre frontend e schema;
- formalizar documentacao de API;
- ampliar testes para UI e integracao com ambiente Supabase real;
- definir telemetria e processo de release mais objetivo.

## 16. Operacao e usuario final

### Operacao confirmada por perfil

- `administrador`: gestao ampla, usuarios, relatorios, configuracoes e operacoes privilegiadas.
- `coordenador`: gestao academica, professores, turmas, diario, portal docente e usuarios.
- `secretario`: operacao administrativa e academica, sem criar perfis administrativos.
- `professor`: diario, notas, frequencia, atividades, agenda e portal docente.
- `aluno`: consulta de notas, frequencia, tarefas, metas, calendario, biblioteca e mensagens permitidas.

### Manuais existentes

- [docs/manuais/administrador.md](manuais/administrador.md)
- [docs/manuais/coordenador.md](manuais/coordenador.md)
- [docs/manuais/secretario.md](manuais/secretario.md)
- [docs/manuais/professor.md](manuais/professor.md)
- [docs/manuais/aluno.md](manuais/aluno.md)

## 17. TCC e base academica

O repositorio ja contem material academico voltado a banca e TCC, cobrindo visao de produto, arquitetura, modelagem, seguranca e limitacoes.

Documentos existentes:

- [docs/tcc/README.md](tcc/README.md)
- [docs/tcc/visao-academica.md](tcc/visao-academica.md)
- [docs/tcc/arquitetura-e-modelagem.md](tcc/arquitetura-e-modelagem.md)
- [docs/tcc/seguranca-validacao-e-limitacoes.md](tcc/seguranca-validacao-e-limitacoes.md)

## 18. Legal, limites e navegacao complementar

### Estado atual confirmado

- Nao ha, neste repositorio, politica de privacidade, termos de uso ou SLA formalizados como documentos canonicos.
- Nao ha evidencia suficiente para afirmar adequacao legal completa alem dos controles tecnicos visiveis no codigo.

### Recomendado

- criar politica de privacidade aderente aos dados tratados pelo sistema;
- formalizar termos de uso e responsabilidades por perfil;
- definir politica de backup, retencao e resposta a incidentes.

### Documentacao complementar ja existente

- [docs/README.md](README.md)
- [docs/arquitetura.md](arquitetura.md)
- [docs/setup-operacao.md](setup-operacao.md)
- [docs/banco-de-dados.md](banco-de-dados.md)
- [docs/modulos.md](modulos.md)
- [docs/fluxo.md](fluxo.md)
- [docs/rota.md](rota.md)

## Matriz de rastreabilidade resumida

| Modulo | Perfis principais | Dados centrais | Superficie tecnica |
|---|---|---|---|
| Desktop | todos os perfis autenticados | sessao, preferencias locais | `frontend/src/pages/Desktop.jsx` |
| Gestao de usuarios | coordenador, administrador | `user_profiles` | `frontend/src/pages/UserManagement.jsx`, `backend/src/routes/admin/users/*`, `backend/src/routes/admin/profiles.js` |
| Matricula | coordenador, secretario, administrador | `students`, `user_profiles` | `frontend/src/pages/Registration.jsx`, `frontend/src/pages/StudentEnrollment.jsx`, `backend/src/routes/admin/enrollments.js` |
| Notas | aluno, professor, coordenador, secretario, administrador | `grades` | `frontend/src/pages/Grades.jsx` |
| Frequencia | aluno, professor, coordenador, secretario, administrador | `attendance` | `frontend/src/pages/Attendance.jsx` |
| Atividades | aluno, professor, coordenador, administrador | `assignments`, `submissions` | `frontend/src/pages/Assignments.jsx` |
| Comunicacao | todos os perfis autenticados permitidos | `messages`, `direct_messages` | `frontend/src/pages/Messages.jsx`, `frontend/src/components/chat/*` |
| Exportacao do sistema | coordenador, secretario, administrador | multiplos datasets | `backend/src/routes/admin/system-export.js`, `backend/src/services/systemExportServer.js` |

## Conclusao

O estado atual do repositorio sustenta uma documentacao tecnica confiavel do EduGest como plataforma escolar SPA apoiada em Supabase, com endurecimento de acesso no banco e em handlers administrativos. O documento mestre acima deve ser tratado como porta de entrada canonica, enquanto os demais arquivos em `docs/` funcionam como aprofundamentos por area.
