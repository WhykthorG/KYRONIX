<!-- ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ. -->
# Fluxos Principais

## 1. Autenticacao e resolucao de perfil

```mermaid
flowchart TD
  A[Usuario abre a aplicacao] --> B{Sessao Supabase existe?}
  B -- nao --> C[Tela de Login]
  B -- sim --> D[AuthContext carrega session e user]
  C --> E[Login email/senha ou Google]
  E --> D
  D --> F[usePermissions busca user_profiles por email]
  F --> G{Perfil encontrado?}
  G -- nao --> H[Loading ou acesso limitado]
  G -- sim --> I[App libera Desktop e paginas permitidas]
```

Arquivos envolvidos:

- [src/lib/AuthContext.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/lib/AuthContext.jsx)
- [src/components/hooks/usePermissions.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/hooks/usePermissions.jsx)
- [src/App.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/App.jsx)

## 2. Abertura de modulo no desktop

```mermaid
flowchart LR
  A[Icone / StartMenu / Taskbar] --> B[Desktop.openApp]
  B --> C{Janela ja existe?}
  C -- sim --> D[Reativa e traz para frente]
  C -- nao --> E[Cria nova janela]
  E --> F[Lazy load da pagina]
  F --> G[Usuario interage com o modulo]
```

Arquivos envolvidos:

- [src/pages/Desktop.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/Desktop.jsx)
- [src/components/desktop/Window.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/desktop/Window.jsx)
- [src/lib/appRegistry.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/lib/appRegistry.js)

## 3. Cadastro de usuario

```mermaid
flowchart TD
  A[Gestao de Usuarios ou Cadastro] --> B[Escolha do papel]
  B --> C[Preenchimento do formulario]
  C --> D[Geracao de senha temporaria]
  D --> E[createAuthUser via API serverless]
  E --> F[Insercao em user_profiles]
  F --> G[Exibicao das credenciais]
```

Arquivos envolvidos:

- [src/pages/UserManagement.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/UserManagement.jsx)
- [src/pages/Registration.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/Registration.jsx)
- [src/lib/supabaseAdmin.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/lib/supabaseAdmin.js)
- [api/admin/users.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/api/admin/users.js)

## 4. Matricula de aluno

```mermaid
flowchart TD
  A[Fluxo de matricula] --> B[Dados pessoais]
  B --> C[Endereco]
  C --> D[Dados academicos]
  D --> E[Responsavel]
  E --> F[Anexos]
  F --> G{Criar acesso?}
  G -- sim --> H[Cria auth + user_profile]
  G -- nao --> I[Salva somente student]
  H --> J[Conclusao]
  I --> J
```

Arquivos envolvidos:

- [src/pages/Registration.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/Registration.jsx)
- [src/pages/StudentEnrollment.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/StudentEnrollment.jsx)
- [src/components/enrollment/SectionAttachments.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/enrollment/SectionAttachments.jsx)

## 5. Lancamento de notas e frequencia

```mermaid
flowchart LR
  A[Professor seleciona turma/disciplina] --> B[Carrega alunos]
  B --> C[Edita notas ou presencas]
  C --> D[Salva em grades ou attendance]
  D --> E[React Query invalida caches]
  E --> F[Aluno e equipe visualizam dados permitidos]
```

Arquivos envolvidos:

- [src/pages/Grades.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/Grades.jsx)
- [src/pages/Attendance.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/Attendance.jsx)
- [src/pages/AcademicRecord.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/AcademicRecord.jsx)

## 6. Comunicacao

```mermaid
flowchart TD
  A[Professor ou gestao cria comunicado] --> B[Salva em messages]
  B --> C[RLS filtra pela audiencia]
  C --> D[Destinatarios leem modulo Messages]
  D --> E[Chat usa direct_messages para conversa direta]
```

Arquivos envolvidos:

- [src/pages/Messages.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/Messages.jsx)
- [src/components/chat/ChatHub.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/components/chat/ChatHub.jsx)
- [supabase/migration_permissions_hardening.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/migration_permissions_hardening.sql)
