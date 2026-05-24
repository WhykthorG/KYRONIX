# Normalizacao Relacional do Banco Escolar

## 1. Diagnostico inicial

### Problemas encontrados

- A modelagem atual mistura entidades relacionais com estruturas multivaloradas em `UUID[]`, `TEXT[]` e `JSONB`, especialmente em `teachers.subject_ids`, `classes.teacher_ids`, `classes.subject_ids`, `messages.recipient_ids`, `messages.read_by`, `events.class_ids`, `teacher_calendar_events.related_student_ids`, `goals.shared_with` e `submissions.group_members`.
- Existem atributos derivados ou redundantes em tabelas operacionais, como `students.current_grade`, `students.shift`, `classes.current_students`, `homework.teacher_name`, `notifications.recipient_name`, `messages.sender_name` e `messages.sender_type`.
- Existem dependencias transitivas e mistura de conceitos em tabelas centrais:
  - `students` armazena dados do aluno, do responsavel, da matricula e do contexto atual de turma.
  - `grades` mistura nota final do aluno com definicao da avaliacao.
  - `library_loans` usa relacionamento polimorfico (`borrower_id` + `borrower_type`), o que enfraquece integridade referencial.
  - `messages` mistura mensagem, publico, canais e leitura no mesmo registro.
- Algumas tabelas de apoio de processo, como `audit_logs`, `observability_logs`, `system_events`, `idempotency_keys` e `user_workspace_state`, sao deliberadamente documentais. Nelas, um grau maior de desnormalizacao faz sentido tecnico.

### Nivel atual de normalizacao

- O schema atual esta em estado misto.
- Parte relevante das tabelas esta em **1NF parcial**, porque usa arrays e JSON para representar conjuntos relacionais.
- Algumas tabelas isoladas ja se aproximam de **3NF**, como `assignment_views`, `guardian_student_links` e `homework_completions`.
- O modelo como um todo **nao esta consistentemente em 3NF/BCNF**, e certamente **nao esta em 4NF/5NF** nas areas com multiplos relacionamentos independentes comprimidos em colunas multivaloradas.

## 2. Normalizacao por etapa

### 1NF

#### Problema

- Violacao de atomicidade em colunas multivaloradas e semanticas compostas:
  - `teachers.subject_ids`
  - `classes.teacher_ids`
  - `classes.subject_ids`
  - `messages.recipient_ids`
  - `messages.channels`
  - `messages.read_by`
  - `events.class_ids`
  - `assignments.allowed_formats`
  - `submissions.group_members`
  - `lesson_plans.tags`
  - `library_items.tags`
  - `goals.shared_with`
  - `teacher_calendar_events.related_student_ids`
- Informacoes do responsavel dentro de `students` representam outra entidade.

#### Correcao

- Criar tabelas associativas para todos os conjuntos multivalorados.
- Separar entidade `guardians` de `students`.
- Separar matricula atual do aluno em `student_enrollments`.
- Substituir atributos textuais redundantes por chaves estrangeiras onde houver entidade correspondente.

### 2NF

#### Problema

- Em tabelas cuja chave natural e composta, havia atributos dependentes de apenas parte do contexto. Exemplo conceitual:
  - A definicao da avaliacao depende da avaliacao, nao de cada aluno individualmente.
  - O professor da oferta curricular depende da turma+disciplina+periodo, nao da linha de horario nem da linha de nota do aluno.

#### Correcao

- Criar `class_offerings` para representar a oferta de uma disciplina em uma turma por periodo.
- Criar `evaluations` para representar a definicao da avaliacao.
- Manter a nota do aluno em `student_evaluation_results`, separada da definicao da avaliacao.

### 3NF

#### Problema

- Dependencias transitivas e atributos derivados:
  - `students.current_grade` e `students.shift` derivam da matricula/turma.
  - `homework.teacher_name` deriva de `teacher_id`.
  - `messages.sender_name` e `messages.sender_type` derivam do perfil remetente.
  - `notifications.recipient_name` pode derivar de `user_profiles`.

#### Correcao

- Remover atributos derivados das tabelas operacionais.
- Centralizar dados de identidade em `user_profiles`, `students`, `teachers` e `guardians`.
- Fazer `homework.teacher_id` referenciar `teachers(id)`.
- Modelar destinatarios, leituras e canais separadamente.

### BCNF

#### Problema

- Em varias tabelas, determinantes de negocio nao eram chaves candidatas completas:
  - `class_id + subject_id + academic_year + semester` determinam uma oferta curricular.
  - `evaluation_id + student_id` determinam um resultado unico.
  - `message_id + recipient_profile_id` determinam uma entrega/recebimento.

#### Correcao

- Introduzir chaves naturais unicas nas tabelas relacionais de interseccao:
  - `class_offerings`
  - `class_enrollments`
  - `student_guardians`
  - `student_evaluation_results`
  - `message_targets`
  - `message_reads`
  - `event_targets`
  - `teacher_calendar_event_students`

### 4NF

#### Problema

- Dependencias multivaloradas independentes estavam compactadas na mesma tabela:
  - Em `messages`, publico, canais e leituras sao conjuntos independentes.
  - Em `classes`, professores e disciplinas sao conjuntos independentes.
  - Em `goals`, compartilhamentos e marcos sao conjuntos independentes.
  - Em `submissions`, membros do grupo e arquivos sao conjuntos independentes.

#### Correcao

- Decompor em relacoes independentes:
  - `messages` + `message_channels` + `message_targets` + `message_reads`
  - `classes` + `class_offerings`
  - `goals` + `goal_shares` + `goal_milestones`
  - `submissions` + `submission_group_members` + `submission_files`

### 5NF

#### Problema

- Algumas relacoes embutiam fatos que, em pratica, sao junturas de fatos menores:
  - associacao entre turma, disciplina e professor
  - associacao entre item de biblioteca, exemplar e emprestimo
  - associacao entre mensagem, alvo e leitura

#### Correcao

- Introduzir relacoes factuais minimas:
  - `class_offerings` como unidade de turma + disciplina + professor + periodo
  - `library_item_copies` e `library_loans` para distinguir obra de exemplar fisico
  - `direct_conversations`, `direct_conversation_participants` e `direct_messages`
- Manter estruturas documentais apenas onde a decomposicao completa nao agrega integridade relacional pratica.

## 3. Estrutura final normalizada

### Tabelas finais

- `user_profiles`
- `students`
- `guardians`
- `student_guardians`
- `teachers`
- `subjects`
- `classes`
- `class_enrollments`
- `teacher_subjects`
- `class_offerings`
- `schedules`
- `evaluations`
- `evaluation_files`
- `evaluation_allowed_formats`
- `student_evaluation_results`
- `submissions`
- `submission_group_members`
- `submission_files`
- `assignment_views`
- `messages`
- `message_channels`
- `message_targets`
- `message_reads`
- `message_files`
- `events`
- `event_targets`
- `class_diary`
- `class_diary_files`
- `lesson_plans`
- `lesson_plan_tags`
- `lesson_plan_files`
- `library_items`
- `library_item_tags`
- `library_item_copies`
- `library_loans`
- `goals`
- `goal_shares`
- `goal_milestones`
- `goal_tasks`
- `occurrences`
- `occurrence_files`
- `notifications`
- `notification_channels`
- `teacher_calendar_events`
- `teacher_calendar_event_students`
- `homework`
- `homework_files`
- `homework_completions`
- `direct_conversations`
- `direct_conversation_participants`
- `direct_messages`
- `app_settings`
- `audit_logs`
- `observability_logs`
- `system_events`
- `idempotency_keys`
- `user_workspace_state`

### Relacionamentos finais

- `students` se relaciona a `classes` por meio de `class_enrollments`.
- `teachers` se relaciona a `subjects` por meio de `teacher_subjects`.
- `classes`, `subjects` e `teachers` se relacionam por meio de `class_offerings`.
- `evaluations` pertence a uma `class_offering`.
- `student_evaluation_results` liga aluno a avaliacao.
- `submissions` liga aluno a avaliacao.
- `messages` se expande em alvos, canais, leituras e anexos.
- `events` se expande em `event_targets`.
- `library_items` se expande em `library_item_copies`, e o emprestimo ocorre por exemplar.
- `goals` se expande em compartilhamentos e marcos.
- `teacher_calendar_events` se expande em alunos relacionados.

## 4. Script SQL final

- O script completo esta em [supabase/normalized_schema_5nf.sql](/c:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/Nova%20pasta/supabase/normalized_schema_5nf.sql).

## 5. Observacoes tecnicas

### Impactos positivos

- Integridade referencial real no lugar de listas em arrays.
- Melhor capacidade de consulta analitica e operacional.
- Menor risco de inconsistencias entre campos redundantes.
- Estrutura mais segura para RLS, especialmente em mensagens, biblioteca e matrizes de relacionamento.
- Evolucao mais simples para novas regras de negocio.

### Possiveis trade-offs de performance

- Mais joins em consultas operacionais.
- Mais tabelas auxiliares para leitura e escrita.
- Necessidade de indices compostos bem planejados.
- Em telas muito frequentes, pode valer manter visoes materializadas ou campos derivados controlados por trigger para leitura rapida.

### Observacao de pragmatismo

- Nao forcei decomposicao total de payloads documentais (`audit_logs.metadata`, `system_events.payload`, `user_workspace_state.state`) porque esses dados nao representam entidades relacionais centrais. A normalizacao total nesses pontos nao agregaria valor pratico ao sistema.
