# Memória do Projeto

Arquivo de acompanhamento para registrar o que foi feito no repositório, decisões tomadas e próximos passos.

## Como usar

- Registre cada alteração relevante com data.
- Descreva de forma curta o que foi feito e por quê.
- Anote pendências, riscos e observações úteis para a próxima sessão.

## Histórico

### 2026-05-02

- Criado este arquivo de memória para centralizar o registro das atividades do projeto.
- Estruturado o documento com seções para histórico, pendências e observações.

#### Atividades

- Adicionado botão para o professor ver a resposta do aluno e os arquivos anexados da atividade.
- Reposicionado o botão `Ver resposta` para ficar ao lado do status de entrega.
- Implementada a regra de encerrar automaticamente atividades vencidas quando não permitem entrega atrasada.
- Criado o botão para encerrar manualmente uma atividade.
- Criado o botão para reabrir uma atividade encerrada.
- Adicionados campos de mínimo e máximo de integrantes para atividades em grupo.
- Ajustado o mínimo de integrantes para `1`.
- Corrigido o bucket de upload de arquivos para o fluxo de atividades, respostas e anexos.

#### Permissões e Acesso

- Bloqueado o acesso do aluno ao módulo `Turmas`.
- Restrito o aluno para visualizar apenas atividades da própria turma.
- Ocultada a contagem de entregas e as ações de editar e remover atividade para o aluno.
- Liberado o módulo de mensagens para aluno.
- Liberado o chat direto para aluno.
- Liberada a foto de perfil para todos os usuários.

#### Chat

- Adicionados filtros no chat por aluno, professor, administração, secretaria, coordenação, turma e período.

#### Resumo Técnico

- Foram realizadas ajustes de interface, regras de acesso, validações de negócio e correções de upload para alinhar o sistema ao fluxo escolar.
- As alterações reforçaram a separação entre permissões de aluno e de perfis administrativos, além de melhorar a revisão de atividades pelo professor.

#### Sessao do Fundo por Usuario

- Criada a personalizacao de plano de fundo com os arquivos das pastas `src/img/video` e `src/img/estatico`.
- Adicionada a escolha entre `Movel` e `Estatico` para cada usuario.
- Sincronizada a preferencia entre desktop e mobile usando a mesma chave do perfil.
- Movido o controle para o menu de perfil do desktop e para o painel do shell mobile.
- Removido o controle global da tela de configuracoes para evitar conflito com a preferencia individual.
- Preparada a persistencia no Supabase com campos novos em `user_profiles` para permitir sincronizacao entre dispositivos.
- Criados os scripts `supabase/migration_user_shell_background_preferences.sql` e `supabase/manual_user_shell_background_preferences.sql` para aplicar a alteracao no banco.

## Pendências

- Preencher com tarefas abertas quando houver novas alterações no projeto.

## Observações

- Manter este arquivo atualizado junto com mudanças importantes de código, arquitetura ou documentação.
