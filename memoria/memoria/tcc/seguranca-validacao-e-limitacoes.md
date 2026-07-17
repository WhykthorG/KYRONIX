<!-- Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r. -->
# Seguranca, Validacao e Limitacoes

## Seguranca aplicada

Os principais mecanismos usados no projeto sao:

- autenticacao por sessao via Supabase Auth;
- controle de perfil com `user_profiles`;
- Row Level Security no PostgreSQL;
- separacao recente das operacoes administrativas de Auth em endpoints serverless.

## Validacao funcional

O sistema foi estruturado para operar por perfis distintos:

- administracao e gestao;
- secretaria;
- professores;
- alunos.

Foram implementados modulos para:

- cadastro e consulta de dados;
- operacoes pedagogicas;
- comunicacao interna;
- calendario e biblioteca;
- acompanhamento individual do aluno.

## Limitacoes atuais

- ainda existem inconsistencias entre algumas permissoes visuais e regras reais no banco;
- o fluxo de reset de senha nao esta completamente fechado no roteamento da aplicacao;
- o lint global do projeto ainda apresenta muitos problemas estruturais;
- ha fluxos que ainda dependem de maior atomicidade server-side;
- parte da UX depende de `window.history.back`, o que pode gerar navegacao inconsistente em alguns cenarios.

## Ameacas e riscos tecnicos

- divergencia entre estado de perfil no frontend e `CHECK` do banco;
- falhas parciais em operacoes compostas de cadastro;
- manutencao mais dificil devido ao volume atual de alertas de qualidade;
- dependencia do correto alinhamento entre migrations e schema principal.

## Melhorias futuras

- alinhar integralmente UI, schema e RLS;
- criar fluxo completo e dedicado para recuperacao de senha;
- consolidar operacoes compostas em RPCs ou handlers transacionais;
- sanear o lint global e impor validacao em CI;
- ampliar testes automatizados por modulo critico.
