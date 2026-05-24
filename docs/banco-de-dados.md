# Banco de Dados e Seguranca

## Fonte principal

- [supabase/schema.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/schema.sql)

## Tabelas principais

| Grupo | Tabelas |
|---|---|
| Identidade | `user_profiles` |
| Academico | `students`, `teachers`, `subjects`, `classes`, `schedules` |
| Avaliacao | `grades`, `attendance`, `assignments`, `submissions`, `class_diary`, `lesson_plans` |
| Comunicacao | `messages`, `direct_messages` |
| Calendario | `events`, `teacher_calendar_events` |
| Apoio | `library_items`, `library_loans`, `goals`, `goal_tasks`, `occurrences`, `homework`, `homework_completions` |

## Relacoes de negocio mais importantes

- `students.current_class_id -> classes.id`
- `attendance.student_id -> students.id`
- `attendance.class_id -> classes.id`
- `grades.student_id -> students.id`
- `grades.subject_id -> subjects.id`
- `grades.class_id -> classes.id`
- `assignments.class_id -> classes.id`
- `submissions.assignment_id -> assignments.id`
- `teacher_calendar_events.teacher_id -> teachers.id`
- `goals.student_id -> students.id`
- `goal_tasks.goal_id -> goals.id`

## RLS

O schema ativa `ROW LEVEL SECURITY` em praticamente todas as tabelas de negocio. O helper central e a funcao `auth_profile_type()`, que resolve o perfil do usuario atual via `auth.jwt() ->> 'email'`.

Regras gerais:

- administracao e coordenacao possuem leitura e escrita amplas;
- professor possui acesso a operacoes pedagogicas;
- aluno normalmente le apenas seus proprios dados;
- tabelas publicas do contexto escolar, como `subjects`, `classes` e `events`, sao legiveis por usuarios autenticados.

## Permissoes por area

### Perfis

- `user_profiles`: leitura do proprio perfil; leitura ampla para gestao; alteracao ampla para admin/coordenador.

### Academico

- `students`: leitura por equipe; leitura propria do aluno; escrita por gestao.
- `teachers`: leitura por equipe; escrita por administracao/coordenacao.
- `classes` e `subjects`: leitura por autenticados; escrita por papeis administrativos definidos no schema.

### Pedagogico

- `grades`: leitura por equipe e pelo proprio aluno; escrita por professor/coordenacao/administracao.
- `attendance`: leitura por equipe e pelo proprio aluno; escrita pedagogica.
- `assignments`: leitura de publicadas; escrita por equipe pedagogica.
- `submissions`: aluno gerencia as proprias; professor corrige.
- `class_diary` e `lesson_plans`: gerenciados por equipe pedagogica.

### Comunicacao

- `messages`: endurecido por [supabase/migration_permissions_hardening.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/migration_permissions_hardening.sql) para leitura por audiencia.
- `direct_messages`: leitura por remetente/destinatario; update restrito ao destinatario apenas para marcar leitura.

### Objetivos e tarefas

- `goals`: aluno gerencia as proprias metas; professor/coordenacao/admin podem ler.
- `goal_tasks`: a migration complementar adiciona politica para o aluno gerenciar suas tarefas.

## Migrations complementares

### [migration_improvements.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/migration_improvements.sql)

Adiciona:

- indices compostos;
- RPC `dashboard_summary()`;
- materialized view `mv_student_report_card`;
- funcao `refresh_report_card()`;
- campo `user_profiles.is_first_login`;
- RPC `get_student_report_card(UUID)`;
- policy faltante para `goal_tasks`.

### [migration_permissions_hardening.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/migration_permissions_hardening.sql)

Fortalece:

- leitura por audiencia em `messages`;
- insert/update/delete com escopo correto;
- controle fino de `direct_messages`.

### [fix_coordinator_fk.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/fix_coordinator_fk.sql)

Remove a FK de `classes.coordinator_id -> teachers.id`, assumindo que coordenadores possam existir somente em `user_profiles`.

## Inconsistencias conhecidas

### Policies de `payments`

As referencias residuais a policies de `payments` foram removidas do schema principal. Isso evita falha em provisionamento limpo de banco.

### Status de perfil

O frontend usa status como `suspenso` em [src/pages/UserManagement.jsx](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/src/pages/UserManagement.jsx), enquanto o `CHECK` de `user_profiles.status` no schema lista `ativo`, `inativo` e `pendente`. Se `suspenso` for persistido no banco, vale alinhar schema e frontend em uma futura correção.

## Seeds e apoio

- [supabase/sample_data.sql](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/supabase/sample_data.sql)
- [scripts/create_test_profiles.js](/C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-2/scripts/create_test_profiles.js)

Esses arquivos servem para popular ambientes locais e demonstrativos.
