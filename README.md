<p align="center">
  <img src="frontend/logo.svg" alt="KYRONIX S.E.N.O" width="120" />
</p>

<h1 align="center">KYRONIX S.E.N.O</h1>

<p align="center">
  Sistema de Gestao Escolar Inteligente
</p>

<p align="center">
  <a href="#visao-geral">Visao Geral</a> |
  <a href="#stack-tecnologico">Stack</a> |
  <a href="#funcionalidades">Funcionalidades</a> |
  <a href="#instalacao">Instalacao</a> |
  <a href="#documentacao">Documentacao</a>
</p>

---

## Visao Geral

O **KYRONIX S.E.N.O** e um sistema web completo de gestao escolar construido como uma **Single Page Application (SPA)** com metáfora de desktop. Os modulos funcionais sao abertos como janelas internas com atalhos e barra de tarefas, com controle de acesso baseado no perfil do usuario.

O sistema e voltado para instituicoes de ensino que precisam gerenciar alunos, professores, turmas, notas, frequencia, estagios, TCC, laboratorios, biblioteca e muito mais em uma unica plataforma.

## Stack Tecnologico

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18, Vite 6, React Router v6, TanStack Query v5, Tailwind CSS 3, shadcn/ui, Zustand |
| **Backend** | Node.js serverless (rotas em `backend/src/routes/`) |
| **Banco de Dados** | PostgreSQL via Supabase com Row Level Security (RLS) |
| **Autenticacao** | Supabase Auth (email/senha + OAuth Google) |
| **Armazenamento** | Supabase Storage (bucket privado `project-wg-files`) |
| **Testes** | Node.js test runner (integracao), Cypress 13 (E2E) |
| **Deploy** | Vercel, Docker + Nginx, Netlify |
| **Idioma** | JavaScript (ESM), TypeScript para type-checking |

## Funcionalidades

### Modulos Academicos

| Modulo | Descricao |
|---|---|
| **Dashboard** | KPIs, acoes rapidas, atividade recente, eventos proximos |
| **Alunos** | Cadastro e gestao de alunos |
| **Professores** | Cadastro e gestao de professores |
| **Turmas** | Coordenacao e composicao de turmas |
| **Disciplinas** | Gestao de disciplinas e carga horaria |
| **Notas** | Lancamento e consulta de notas |
| **Frequencia** | Registro e consulta de frequencia |
| **Atividades** | Publicacao e submissao de atividades |

### Planejamento e Horarios

| Modulo | Descricao |
|---|---|
| **Calendario Escolar** | Calendario academico institucional |
| **Calendario do Professor** | Agenda operacional do professor |
| **Planejador de Horarios** | Planejador de horarios enterprise |
| **Calendario de Provas** | Agendamento de provas |

### Comunicacao e Portais

| Modulo | Descricao |
|---|---|
| **Mensagens** | Anuncios institucionais |
| **Chamadas** | Chamadas de video/áudio 1:1 via WebRTC com suporte TURN |
| **Portal do Responsavel** | Visao do responsavel sobre dados do aluno |
| **Portal do Professor** | Visao consolidada do professor |

### Administracao

| Modulo | Descricao |
|---|---|
| **Matricula** | Fluxo de matricula e cadastro de usuarios |
| **Matricula do Aluno** | Wizard de matricula por secoes |
| **Gestao de Usuarios** | Perfis, aprovacoes, credenciais |
| **Relatorios** | Visualizacoes analiticas e relatorios |
| **Configuracoes** | Configuracao visual e operacional |
| **Exportacao do Sistema** | Exportacao de dados em XLSX e CSV |

### Modulos Especializados

| Modulo | Descricao |
|---|---|
| **Biblioteca** | Catalogo e emprestimos da biblioteca |
| **Diario** | Diario de classe e planejamento de aulas |
| **Registro Academico** | Registro academico agregado |
| **Metas do Aluno** | Metas pessoais e tarefas do aluno |
| **Tarefas do Professor** | Tarefas publicadas pelo professor |
| **Tarefas do Aluno** | Acompanhamento de tarefas do aluno |
| **Ocorrencias** | Ocorrencias e incidentes de alunos |
| **Estagios** | Gestao de estagios |
| **Empresas Conveniadas** | Gestao de empresas parceiras |
| **Estagio do Aluno** | Visao individual do estagio do aluno |
| **Projetos TCC** | Gestao de TCC e projetos integradores |
| **TCC do Aluno** | Visao individual do TCC do aluno |
| **Laboratorios** | Gestao de laboratorios |
| **Cursos** | Gestao de cursos e series |
| **Certificados** | Gerenciamento e emissao de certificados |
| **Avaliacoes e Conselho** | Melhorias de avaliacoes e conselho de classe |
| **Horario do Aluno** | Visualizacao do horario do aluno |
| **Frequencia do Aluno** | Visualizacao da frequencia do aluno |

## Perfis de Usuario

| Perfil | Nivel de Acesso |
|---|---|
| **Aluno** | Dados academicos somente leitura, metas pessoais, chat, laboratorios, certificados |
| **Responsavel** | Portal do responsavel com visao do aluno |
| **Professor** | Leitura/escrita completa para notas, frequencia, atividades, diario, chat, estagios, TCC |
| **Secretario** | CRUD de alunos/professores, matricula, biblioteca, horarios, relatorios, auditoria |
| **Coordenador** | Academico completo + gestao de usuarios + perfis admin |
| **Administrador** | Acesso total incluindo exportacao do sistema |

## Instalacao

### Pre-requisitos

- Node.js 20+
- npm
- Projeto Supabase configurado
- Docker Desktop (opcional)

### Passos

1. **Clonar o repositorio**
   ```bash
   git clone https://github.com/WhykthorG/WG.git
   cd WG
   ```

2. **Configurar ambiente**
   ```bash
   cp .env.example .env.local
   ```
   Edite `.env.local` e preencha as variaveis obrigatorias (veja [Variaveis de Ambiente](#variaveis-de-ambiente)).

3. **Instalar dependencias**
   ```bash
   npm install
   ```

4. **Iniciar desenvolvimento**
   ```bash
   npm run dev
   ```
   Acesse em `http://localhost:5173`

5. **Build para producao**
   ```bash
   npm run build
   ```

### Docker

```bash
docker compose up --build
# Acessivel em http://localhost:3000
```

### Provisionamento do Banco (Supabase)

Para um banco novo:

1. Criar projeto no Supabase
2. Criar bucket de storage
3. Aplicar `supabase/schema.sql`
4. Aplicar migracoes na ordem:
   1. `migration_security_baseline.sql`
   2. `migration_rbac_permissions.sql`
   3. `migration_guardian_portal_mvp.sql`
   4. `migration_storage_secure_files.sql`
   5. `migration_search_workspace_rpc.sql`
   6. `migration_messages_student_policy.sql`
   7. `migration_enrollment_transaction.sql`
   8. `migration_permissions_hardening.sql`
   9. `migration_app_settings.sql`
   10. `migration_notifications_base.sql`
   11. `migration_audit_logs.sql`
   12. `migration_audit_logs_action_fix.sql`
   13. `migration_fix_audit_logs_action_check.sql`
   14. `migration_grades_gradebook.sql`
5. Inserir perfis iniciais na tabela `user_profiles`

## Variaveis de Ambiente

### Obrigatorias

| Variavel | Descricao |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave publica/anon do Supabase |

### Opcionais

| Variavel | Descricao | Padrao |
|---|---|---|
| `VITE_APP_NAME` | Nome exibido na aplicacao | `KYRONIX S.E.N.O` |
| `VITE_STORAGE_BUCKET` | Bucket do Supabase Storage | `project-wg-files` |
| `VITE_ADMIN_API_BASE_URL` | URL base da API admin | `/api/admin` |

### WebRTC / TURN

| Variavel | Descricao |
|---|---|
| `VITE_TURN_URLS` | URLs do servidor TURN |
| `VITE_TURN_USERNAME` | Usuario TURN |
| `VITE_TURN_CREDENTIAL` | Credencial TURN |
| `VITE_WEBRTC_ICE_SERVERS` | Configuracao completa ICE em JSON (tem precedencia sobre `VITE_TURN_*`) |

### Backend/Serverless

| Variavel | Descricao |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (NUNCA com prefixo `VITE_`) |

## Scripts Disponiveis

| Script | Descricao |
|---|---|
| `npm run dev` | Inicia o servidor Vite com middleware local para `/api` |
| `npm run build` | Build de producao em `frontend/dist` |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | Verificacao ESLint no `frontend/src` |
| `npm run test` | Executa a suite de testes de integracao (26+ arquivos) |
| `npm run cypress:open` | Abre o Cypress em modo interativo |
| `npm run cypress:run` | Executa Cypress em modo headless |
| `npm run cypress:run:conscious` | Suite consciente (login, permissoes, desktop por perfil) |
| `npm run test:e2e` | Alias para Cypress headless |
| `npm run test:e2e:conscious` | Alias para suite consciente |
| `npm run reset:test:auth` | Reseta usuarios de autenticacao de teste |
| `npm run seed:requested-profiles` | Cria perfis de teste solicitados |
| `npm run test:security-proxy` | Teste de seguranca do proxy |

## Testes E2E (Cypress)

Antes de rodar a suite, garanta que o backend esteja disponivel e resete os usuarios:

```bash
npm run reset:test:auth
npm run dev
npm run cypress:run
```

Para a automacao consciente por perfis:

```bash
npm run reset:test:auth
npm run dev
npm run cypress:run:conscious
```

A suite consciente valida:
- Protecao basica do login
- Visibilidade exata dos apps do desktop por perfil
- Abertura nao destrutiva de modulos criticos por perfil
- Encerramento de sessao via menu iniciar

### Credenciais de Teste

| Email | Perfil |
|---|---|
| `admin@escola.com` | Administrador |
| `maria.santos@escola.com` | Professor |
| `lucas.silva@aluno.escola.com` | Aluno |
| `coordenador@escola.com` | Coordenador |
| `secretario@escola.com` | Secretario |

**Senha:** `Teste@12345`

## Estrutura do Projeto

```
WG/
  frontend/                     # React SPA
    src/
      App.jsx                   # Componente raiz, rotas, auth, permissoes
      main.jsx                  # Bootstrap da aplicacao
      Layout.jsx                # Layout principal
      routes/index.js           # Configuracao de rotas das paginas
      lib/
        appManifest.js          # Registro canonical dos apps (35+ modulos)
        appRegistry.js          # Componentes lazy-loaded
        AuthContext.jsx         # Contexto de autenticacao
        supabase.js             # Cliente Supabase com proxy
      pages/                    # Componentes de pagina (35+ modulos)
      components/
        common/                 # UI compartilhada
        ui/                     # shadcn/ui wrappers (Radix-based)
        desktop/                # Shell do desktop (Window, Taskbar, StartMenu)
        dashboard/              # Cards e listas do dashboard
        chat/                   # Hub e janelas de chat
        enrollment/             # Secoes do formulario de matricula
        teacher/                # Componentes de analise do professor
        usermanagement/         # Componentes de gestao de usuarios
      services/                 # Camada de servicos API
      hooks/                    # Hooks customizados (usePermissions, etc.)
      stores/                   # Zustand stores
      i18n/                     # Configuracao de internacionalizacao

  backend/                      # Handlers serverless
    src/
      server.js                 # Ponto de entrada
      routes/
        admin/                  # Rotas admin (usuarios, perfis, matriculas, exportacao)
        attendance/             # API de frequencia
        audit/                  # API de auditoria
        chat/                   # API de chat
        grades/                 # API de notas
        guardian/               # API do portal do responsavel
        internships/            # API de estagios
        laboratories/           # API de laboratorios
        messages/               # API de mensagens
        notifications/          # API de notificacoes
        security/               # API de seguranca/proxy
        tcc/                    # API de TCC
      services/                 # Helpers server-side
      database/                 # Helpers de banco
      middlewares/               # Middlewares de requisicao

  shared/                       # Contratos e utilitarios compartilhados
    src/
      contracts/                # 25 arquivos de contratos
        access.js               # RBAC, matriz de permissoes por perfil
        assessment.js           # Contratos de avaliacao
        assignments.js          # Contratos de atividades
        attendance.js           # Contratos de frequencia
        auth.js                 # Contratos de autenticacao
        ...                     # Demais contratos
      validators.js             # Validadores compartilhados
      scheduling/               # Utilitarios de agendamento

  supabase/                     # Schema e migracoes (59 arquivos SQL)
    schema.sql                  # Schema unificado (3551 linhas)
    migration_*.sql             # Migracoes incrementais

  infra/                        # Infraestrutura de deploy
    Dockerfile                  # Multi-stage: Node 20 build + Nginx 1.27
    docker-compose.yml          # Configuracao Docker Compose
    nginx.conf                  # SPA routing, gzip, headers de seguranca
    vercel.json                 # Rewrites SPA + cache de assets
    netlify/                    # Funcoes serverless Netlify

  tests/                        # Testes de integracao e contratos (26 arquivos)
  docs/                         # Documentacao abrangente (26 arquivos)
  archive/                      # Artefatos legados
```

## Arquitetura

- **Sem servidor backend tradicional** -- toda a aplicacao e servida como um bundle SPA estatico. Operacoes privilegiadas passam por rotas serverless (`/api/admin/*`) que utilizam a chave `service_role` do Supabase.

- **Proxy Supabase** -- requisitos do navegador ao Supabase sao roteados por um proxy de seguranca (`api/security/supabase/*`) que gerencia rate limiting, bloqueio de IP, logging de auditoria e injecao de header de tenant.

- **Metáfora de Desktop** -- o shell principal (`Desktop.jsx`) fornece um desktop semelhante ao Windows com janelas arrastaveis/redimensionaveis, barra de tarefas, menu iniciar e adaptacao mobile.

- **Lazy Loading** -- todos os 35+ modulos sao carregados via `React.lazy` a partir do `appManifest.js` centralizado.

- **RBAC** -- sistema de permissoes granular com 70+ permissoes definidas em `shared/src/contracts/access.js`, aplicado tanto no frontend (filtragem de UI) quanto no backend (politicas RLS no Supabase).

- **Multi-tenancy** -- coluna `tenant_id` em todas as tabelas principais, resolvida a partir de claims JWT ou headers de requisicao.

## Documentacao

Documentacao completa esta disponivel na pasta `docs/`:

| Arquivo | Descricao |
|---|---|
| `DOCUMENTACAO_COMPLETA_DO_SISTEMA.md` | Documentacao mestra do sistema |
| `arquitetura.md` | Visao geral da arquitetura |
| `banco-de-dados.md` | Documentacao do banco de dados |
| `modulos.md` | Modulos, rotas e responsabilidades |
| `setup-operacao.md` | Guia de configuracao e operacao |
| `fluxo.md` | Documentacao de fluxos de trabalho |
| `rota.md` | Documentacao de rotas |
| `executivo/` | Pacote executivo (resumo, modulos, precificacao) |
| `manuais/` | Manuais por perfil (admin, coord, sec, professor, aluno) |
| `tcc/` | Documentacao academica/TCC |

## Observacoes Operacionais

- O fluxo de redefinicao de senha usa `redirectTo=/reset-password`.
- Anexos de matricula e submissoes usam referencias canonicals com `file_path`, `file_name` e `bucket`.
- O bucket deve permanecer privado; acesso e controlado por RLS e politicas de `storage.objects`.
- Chamadas 1:1 fora da rede local usam fallback TURN embutido quando nenhuma variavel WebRTC e definida.
- `VITE_WEBRTC_ICE_SERVERS` sobrescreve tudo; `VITE_TURN_*` sobrescreve apenas o fallback.
- O fallback fica no bundle do cliente -- credenciais embutidas devem ser substituidas em producao.

## Licenca

Este projeto esta licenciado sob a [GNU General Public License v3 (GPLv3)](LICENSE.md).

---

<p align="center">
  Desenvolvido por <strong>Whyktor GSV</strong>
</p>
