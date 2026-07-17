<!-- Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r. -->
# Resumo Executivo

## O que e o KYRONIX S.E.N.O

KYRONIX S.E.N.O e um sistema integrado de gestao escolar que centraliza processos academicos, administrativos e de comunicacao em uma unica plataforma web. A aplicacao foi desenhada para operar sem backend tradicional, usando Supabase para autenticacao, banco de dados e armazenamento de arquivos.

## Problema que o sistema resolve

Antes de uma plataforma unificada, escolas tendem a operar com informacoes fragmentadas em planilhas, documentos isolados e comunicacao descentralizada. Isso gera retrabalho, baixa rastreabilidade e dificuldade de acesso por perfil.

O sistema foi desenhado para reduzir esses problemas por meio de:

- cadastro centralizado de alunos, professores, turmas e disciplinas;
- controle de notas, frequencia e atividades;
- comunicacao institucional segmentada;
- biblioteca, calendario e diario de classe;
- separacao de acesso por perfil de usuario.

## Beneficios esperados

- maior organizacao academica e administrativa;
- reducao de retrabalho e duplicidade de informacao;
- acesso controlado por perfil;
- melhor visibilidade da rotina escolar;
- base digital para relatorios, acompanhamentos e tomada de decisao.

## Perfis atendidos

- `administrador`
- `coordenador`
- `secretario`
- `professor`
- `aluno`

## Principais modulos

- dashboard institucional
- alunos
- professores
- turmas
- disciplinas
- notas
- frequencia
- atividades
- calendario escolar
- agenda do professor
- comunicados
- biblioteca
- relatorios
- diario de classe
- metas do aluno
- gestao de usuarios

## Visao executiva da arquitetura

```text
Frontend React
  -> Supabase Auth
  -> Supabase Database com RLS
  -> Supabase Storage
```

## Estado atual do projeto

- a base funcional do sistema esta implementada;
- a documentacao foi estruturada para uso executivo, operacional e academico;
- a camada administrativa de Auth ja foi isolada do frontend;
- ainda existem inconsistencias funcionais e tecnicas que exigem ajuste antes de considerar o sistema pronto para producao institucional ampla.

## Riscos de gestao a acompanhar

- alinhamento entre regras visuais de acesso e permissoes reais no banco;
- conclusao do fluxo completo de recuperacao de senha;
- padronizacao de estados de usuario no frontend e no schema;
- melhoria da qualidade estrutural do codigo, incluindo lint global.
