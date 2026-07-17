# Horarios

## Descrição
Módulo de geração e gestão de horários do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Geração automática com Simulated Annealing
- Grade interativa (drag-and-drop)
- Restrições obrigatórias e preferências
- Conflitos e sugestões automáticas
- Exportação (PDF, Excel, CSV, JSON)
- Comparação de versões
- Bloqueio de horários

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/SchedulePlanner.jsx` | Página principal |
| `frontend/src/modules/schedule-planner/components/ScheduleGrid.jsx` | Grade drag-and-drop |
| `frontend/src/modules/schedule-planner/components/ScheduleComparison.jsx` | Comparação |
| `frontend/src/lib/scheduleExport.js` | Exportação |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/schedule-planner/generate.js` | Geração |
| `backend/src/routes/admin/schedule-planner/structures.js` | Estruturas |
| `backend/src/routes/admin/schedule-planner/conflicts.js` | Conflitos |
| `backend/src/routes/admin/schedule-planner/suggestions.js` | Sugestões |

### Algoritmo
- **Greedy inicial** — Alocação gulosa por dificuldade
- **Simulated Annealing** — Otimização com 1000 iterações
- **Auto-fix** — Correção automática de conflitos
- **Métricas** — 5 indicadores de qualidade

## Restrições
- Professor não pode estar em 2 turmas ao mesmo tempo
- Turma não pode ter 2 aulas ao mesmo tempo
- Ambiente não pode ser ocupado por 2 turmas
- Respeitar indisponibilidade do professor

## Relacionamentos
- Aloca [[Professores]]
- Aloca [[Turmas]]
- Aloca [[Disciplinas]]
- Aloca [[Laboratorios]]
- Consultado via [[Portal_Professor]]
- Consultado via [[Portal_Aluno]]

## Ver Também
- [[Turmas]] — Turmas com horários
- [[Professores]] — Disponibilidade dos professores

