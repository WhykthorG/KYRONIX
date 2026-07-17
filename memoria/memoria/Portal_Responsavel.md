# Portal_Responsavel

## Descrição
Portal do responsável no sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- **Boletim** — Notas e frequência dos alunos vinculados
- **Frequência** — Histórico de presença
- **Comunicados** — Mensagens da escola
- **Documentos** — Documentos dos alunos
- **Agenda** — Eventos e provas
- **Relatório Mensal** — Geração de PDF

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/GuardianPortal.jsx` | Portal principal |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/guardian/monthly-report.js` | Relatório mensal |
| `backend/src/routes/guardian/documents.js` | Documentos |

## Permissões Necessárias
- `guardian_portal.view`

## Relacionamentos
- Visualiza [[Alunos]] vinculados
- Visualiza [[Notas]] dos alunos
- Visualiza [[Frequencia]] dos alunos
- Recebe [[Comunicados]]
- Acessa [[Certificados]]

## Ver Também
- [[Portal_Aluno]] — Portal do aluno
- [[Alunos]] — Alunos vinculados

