# Atividades

## Descrição
Módulo de atividades, tarefas e entregas do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Criação de atividades pelos professores
- Definição de prazos e tipos
- Sistema de entrega pelos alunos
- Correção e feedback
- Atividades em grupo
- Anexos de arquivos

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Assignments.jsx` | Página principal |
| `frontend/src/components/assignments/AssignmentForm.jsx` | Criação/edição |
| `frontend/src/components/assignments/AssignmentSubmission.jsx` | Entrega do aluno |
| `frontend/src/components/assignments/AssignmentGrading.jsx` | Correção do professor |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `assignments` | Atividades publicadas |
| `submissions` | Entregas dos alunos |
| `submission_group_members` | Membros de grupo (5NF) |
| `submission_files` | Anexos das entregas |

## Relacionamentos
- Criada por [[Professores]]
- Entregue por [[Alunos]]
- Vinculada a [[Turmas]] e [[Disciplinas]]
- Consultado via [[Portal_Aluno]]
- Consultado via [[Portal_Professor]]

## Ver Também
- [[Portal_Aluno]] — Visualização do aluno
- [[Portal_Professor]] — Visualização do professor
- [[Notas]] — Notas das avaliações
