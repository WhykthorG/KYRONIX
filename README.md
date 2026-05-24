<!-- ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ. -->
# Project WG

Sistema escolar em React + Vite com Supabase para autenticação, banco, storage e APIs administrativas.

## Estrutura

```text
meu-projeto/
  frontend/
    src/
    public/
    package.json
    vite.config.js
  backend/
    src/
      routes/
      services/
      database/
      middlewares/
      controllers/
      models/
      server.js
    package.json
    .env
  shared/
    src/
    package.json
  infra/
  archive/
```

## Stack

- Frontend: React 18, React Router, TanStack Query, Tailwind/shadcn
- Backend serverless: rotas em `api/` e proxy de Supabase para fluxos sensíveis
- Banco e auth: Supabase
- Storage privado: bucket `project-wg-files`

## Requisitos

- Node.js 20+
- npm
- Projeto Supabase configurado

## Ambiente

Copie `.env.example` para `.env.local` e preencha:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_STORAGE_BUCKET` se quiser sobrescrever o bucket padrão
- `VITE_TURN_URLS`, `VITE_TURN_USERNAME` e `VITE_TURN_CREDENTIAL` se quiser sobrescrever o fallback TURN embutido no frontend
  - O fallback versionado usa Metered.ca e expõe essas credenciais no bundle do cliente
  - Para produção, prefira sobrescrever com suas próprias credenciais TURN/TURNS
- `VITE_WEBRTC_ICE_SERVERS` se quiser sobrescrever toda a configuração ICE em JSON
  - Essa opção tem precedência sobre `VITE_TURN_*` e sobre o fallback embutido
- `VITE_ADMIN_API_BASE_URL` apenas se o frontend não usar `/api/admin`

## Scripts

- `npm run dev`: sobe o frontend Vite com middleware local para `/api`
- `npm run build`: gera o build do frontend em `frontend/dist`
- `npm run preview`: serve o build localmente
- `npm test`: executa a suíte de contratos/integracão em `tests/`
- `npm run cypress:open`: abre o Cypress em modo interativo
- `npm run cypress:run`: executa a suíte Cypress em modo headless
- `npm run cypress:run:conscious`: executa a suíte consciente focada em login, permissões e desktop por perfil
- `npm run test:e2e`: alias para o Cypress headless
- `npm run test:e2e:conscious`: alias para a suíte Cypress consciente
- `npm run lint`: valida o código com ESLint

## Cypress

Os testes e2e usam contas de teste por ambiente. Antes de rodar a suíte, garanta que o backend esteja disponível e, se necessário, resete os usuários de autenticação:

1. `npm run reset:test:auth`
2. `npm run dev`
3. `npm run cypress:open` ou `npm run cypress:run`

Para a automação consciente por perfis, rode:

1. `npm run reset:test:auth`
2. `npm run dev`
3. `npm run cypress:run:conscious`

Essa suíte valida:

- proteção básica do login
- visibilidade exata dos apps do desktop por perfil
- abertura não destrutiva de módulos críticos para administrador, professor, aluno, coordenador e secretário
- encerramento de sessão via menu iniciar

Credenciais padrão usadas pelos testes:

- `admin@escola.com`
- `maria.santos@escola.com`
- `lucas.silva@aluno.escola.com`
- `coordenador@escola.com`
- `secretario@escola.com`

Senha padrão:

- `Teste@12345`

## Migrações Supabase

Os arquivos canônicos para provisionamento incremental estão em `supabase/`.

Ordem mínima recomendada para um banco novo:

1. `supabase/migration_security_baseline.sql`
2. `supabase/migration_rbac_permissions.sql`
3. `supabase/migration_guardian_portal_mvp.sql`
4. `supabase/migration_storage_secure_files.sql`
5. `supabase/migration_search_workspace_rpc.sql`
6. `supabase/migration_messages_student_policy.sql`
7. `supabase/migration_enrollment_transaction.sql`
8. `supabase/migration_permissions_hardening.sql`
9. `supabase/migration_app_settings.sql`
10. `supabase/migration_notifications_base.sql`
11. `supabase/migration_audit_logs.sql`
12. `supabase/migration_audit_logs_action_fix.sql`
13. `supabase/migration_fix_audit_logs_action_check.sql`
14. `supabase/migration_grades_gradebook.sql`
15. Regerar ou revisar `supabase/schema.sql` se o banco-base precisar refletir todas as mudanças acumuladas

## Baseline e arquivos legados

- `supabase/schema.sql` é o snapshot base mais próximo do estado atual do banco.
- `supabase/completo.sql`, `supabase/a_junção` e `supabase/globalSearcRCP` devem ser tratados como artefatos legados de consolidação/manual backup, não como fonte primária para novos ambientes.
- Se algum ambiente ainda depender desses arquivos legados, a recomendação é migrar para os arquivos `migration_*.sql`.

## Áreas principais

- `frontend/src/pages/`: telas do sistema
- `shared/src/contracts/`: contratos compartilhados entre frontend, backend e testes
- `backend/src/routes/`: endpoints serverless preservando `/api/*`
- `backend/src/services/`, `backend/src/database/`, `backend/src/middlewares/`: helpers server-side
- `infra/`: Docker, Nginx, Vercel e funções Netlify
- `archive/`: artefatos legados, logs e backups fora do fluxo principal
- `tests/`: contratos críticos de segurança, storage, matrícula, mensagens e exportação

## Observações operacionais

- O fluxo de redefinição de senha usa `redirectTo=/reset-password`.
- Anexos de matrícula e submissões usam referências canônicas com `file_path`, `file_name` e `bucket`.
- O bucket deve permanecer privado; acesso de leitura/escrita é controlado por RLS e policies de `storage.objects`.
- Chamadas 1:1 fora da rede local agora usam um fallback TURN Metered embutido no frontend quando nenhuma variável WebRTC é definida.
- `VITE_WEBRTC_ICE_SERVERS` sobrescreve tudo; `VITE_TURN_URLS`, `VITE_TURN_USERNAME` e `VITE_TURN_CREDENTIAL` sobrescrevem apenas o fallback embutido.
- Como o fallback fica no bundle do cliente, as credenciais embutidas devem ser tratadas como expostas e substituídas em produção sempre que possível.
