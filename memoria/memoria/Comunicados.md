# Comunicados

## Descrição
Módulo de comunicação e mensagens do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Comunicados institucionais por perfil
- Mensagens diretas entre usuários
- Filtros por destinatário
- Notificações push
- Chat interno

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Messages.jsx` | Comunicados institucionais |
| `frontend/src/components/chat/ChatHub.jsx` | Chat direto |
| `frontend/src/components/chat/ChatWindow.jsx` | Janela de conversa |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `messages` | Comunicados institucionais |
| `direct_messages` | Mensagens diretas |
| `message_targets` | Destinatários (5NF) |
| `message_channels` | Canais de comunicação |
| `message_reads` | Confirmações de leitura |
| `notifications` | Notificações do sistema |

## Relacionamentos
- Enviado para [[Alunos]], [[Professores]], [[Responsavel]]
- Consultado via [[Portal_Aluno]]
- Consultado via [[Portal_Professor]]
- Consultado via [[Portal_Responsavel]]

## Ver Também
- [[Portal_Aluno]] — Comunicados do aluno
- [[Portal_Responsavel]] — Comunicados do responsável
- [[Portal_Professor]] — Centro de comunicação do professor
