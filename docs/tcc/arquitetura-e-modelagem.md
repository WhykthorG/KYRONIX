# Arquitetura e Modelagem

## Arquitetura adotada

O sistema segue arquitetura de SPA com frontend em React e servicos gerenciados pelo Supabase.

```text
Cliente React
  -> Autenticacao no Supabase Auth
  -> Operacoes de dados no PostgreSQL
  -> Upload e consulta de arquivos no Storage
```

## Componentes principais

- frontend React com Vite
- roteamento com React Router
- gerenciamento de dados remotos com React Query
- camada de acesso padronizada via `supabaseApi`
- autenticacao e sessao via `AuthContext`
- handlers serverless para operacoes administrativas de Auth

## Modelagem de dados

O modelo contempla entidades nucleares do dominio escolar:

- `user_profiles`
- `students`
- `teachers`
- `subjects`
- `classes`
- `grades`
- `attendance`
- `assignments`
- `submissions`
- `messages`
- `events`
- `library_items`
- `library_loans`
- `goals`
- `goal_tasks`

## Relacoes relevantes

- um aluno pode pertencer a uma turma;
- uma turma agrega disciplinas e professores;
- notas e frequencia vinculam aluno, turma e disciplina;
- atividades podem gerar submissões;
- metas e tarefas pertencem ao aluno;
- comunicados podem ser segmentados por audiencia.

## Controle de acesso

O projeto combina duas camadas:

- controle visual no frontend por perfil;
- controle real no banco por RLS.

Essa escolha reduz a dependencia de validacoes apenas no cliente e fortalece a seguranca do dado.

## Decisoes tecnicas relevantes

- uso de Supabase para reduzir infraestrutura propria;
- uso de SPA para simplificar distribuicao;
- uso de lazy loading nas paginas para reduzir custo inicial de carregamento;
- uso de handlers serverless para operacoes administrativas sensiveis.
