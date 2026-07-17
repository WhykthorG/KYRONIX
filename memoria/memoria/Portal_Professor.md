# Portal_Professor

## Descrição
Portal do professor no sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- **Diário** — Registro de aulas
- **Notas** — Lançamento de notas
- **Frequência** — Registro de chamada
- **Plano de Aula** — Planos de aula
- **Horários** — Grade de horários
- **Desempenho** — Métricas de desempenho
- **Comunicação** — Centro de comunicação

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/TeacherPortal.jsx` | Portal principal |
| `frontend/src/components/teacher/TeacherAnalytics.jsx` | Análises |
| `frontend/src/components/teacher/StudentPerformance.jsx` | Desempenho |
| `frontend/src/components/teacher/EngagementMetrics.jsx` | Métricas |
| `frontend/src/components/teacher/CommunicationCenter.jsx` | Comunicação |

## Permissões Necessárias
- `teacher_portal.view`
- `grades.read`, `grades.write`
- `attendance.read`, `attendance.write`
- `assignments.read`, `assignments.write`

## Relacionamentos
- Registra [[Frequencia]]
- Lança [[Notas]]
- Preenche [[Diario]]
- Cria [[Atividades]]
- Gerencia [[Horarios]]

## Ver Também
- [[Professores]] — Dados do professor
- [[Portal_Aluno]] — Portal do aluno

