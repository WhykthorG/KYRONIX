<!-- ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ. -->
# Arquitetura

## Visao de alto nivel

```text
Browser
  └─ React SPA
     ├─ React Router
     ├─ TanStack Query
     ├─ AuthContext
     ├─ Desktop Shell / paginas lazy-loaded
     └─ supabase-js
         ├─ Auth
         ├─ Postgres
         └─ Storage
```

 O projeto nao possui backend Node tradicional. Toda a aplicacao e servida como bundle estatico, e o frontend conversa com o Supabase por meio de proxy serverless para rotas sensiveis, mantendo o acesso direto apenas nos fluxos que o browser precisa iniciar no proprio Supabase.

## Bootstrap da aplicacao

- [src/main.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/main.jsx): monta a aplicacao.
- [src/App.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/App.jsx): envolve `ErrorBoundary`, `AuthProvider` e `QueryClientProvider`; protege rotas e aplica regras de acesso.
- [src/pages.config.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages.config.js): define pagina principal (`Desktop`) e layout.
- [src/lib/appRegistry.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/lib/appRegistry.js): lazy loading de todas as paginas.

## Autenticacao

- [src/lib/supabase.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/lib/supabase.js): instancia `createClient`.
- [src/lib/AuthContext.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/lib/AuthContext.jsx): mantem `session`, `user`, login, logout, reset e OAuth Google.
- [src/components/hooks/usePermissions.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/hooks/usePermissions.jsx): resolve o perfil do usuario a partir de `user_profiles`.

Fluxo:

1. O usuario autentica no Supabase.
2. O frontend carrega o perfil em `user_profiles`.
3. A app libera paginas conforme `profile_type`.
4. O banco ainda revalida cada operacao via RLS.

## Navegacao e shell visual

O sistema usa uma metafora de desktop:

- [src/pages/Desktop.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/Desktop.jsx): shell principal, atalhos, janelas, taskbar e contexto.
- [src/components/desktop/Window.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/desktop/Window.jsx): janelas arrastaveis/redimensionaveis.
- [src/components/desktop/Taskbar.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/desktop/Taskbar.jsx): apps abertas/fixadas.
- [src/components/desktop/StartMenu.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/desktop/StartMenu.jsx): menu de inicio.
- [src/components/desktop/MobileShell.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/desktop/MobileShell.jsx): adaptacao para mobile.

## Camada de dados

O projeto adotou uma camada simples de CRUD:

- [src/api/supabaseApi.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/api/supabaseApi.js): fabrica `createEntityApi`, com `list`, `get`, `create`, `update`, `delete`, `filter`, `bulkCreate`.
- [src/api/base44Client.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/api/base44Client.js): compatibilidade com o modelo legado `base44.entities.*`.

## Proxy de Supabase

O acesso direto do browser ao Supabase foi centralizado em [src/lib/supabase.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/lib/supabase.js), que agora reescreve os caminhos sensiveis para o proxy serverless em `api/security/supabase/*`.

Esse proxy:

- extrai IP e aplica rate limit via `security_request_windows`;
- bloqueia IPs em `security_ip_blocks`;
- registra eventos em `security_events`;
- preserva `Authorization`, tenant e headers de auditoria;
- encaminha `auth`, `rest`, `rpc` e `storage` para o Supabase real sem mudar o contrato do frontend.

Isso reduz refatoracoes, porque paginas antigas continuam chamando uma API semelhante a do sistema anterior.

## Organizacao de codigo

- `src/pages`: modulos de negocio.
- `src/components/common`: componentes reutilizaveis de pagina e formularios.
- `src/components/ui`: wrappers shadcn/ui.
- `src/components/chat`: chat interno com mensagens diretas.
- `src/components/dashboard`: cards e listas do dashboard.
- `src/components/enrollment`: secoes de matricula.
- `src/components/teacher`: analytics e comunicacao do professor.
- `src/lib`: auth, utils, stores, registry e cliente.

## Persistencia local no navegador

O desktop persiste parte da experiencia em `localStorage`:

- atalhos na area de trabalho;
- itens fixados na taskbar;
- posicao de icones;
- estado de algumas janelas/notificacoes.

Isso melhora UX, mas nao substitui dados de negocio.

## Pontos tecnicos importantes

- O frontend depende de variaveis Vite no build.
- Como nao existe backend proprio, qualquer operacao privilegiada no frontend merece cuidado adicional.
- As operacoes administrativas de Auth foram isoladas em handlers serverless sob `api/admin/*`, com validacao do operador antes de usar a `service_role`.
- O proxy de Supabase vive em `api/security/supabase/*` no deploy serverless; o container Nginx continua apenas servindo o SPA estatico.
