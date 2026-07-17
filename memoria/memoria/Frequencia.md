# Frequencia

## Descrição
Módulo de controle de frequência do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Chamada por aula (presença, ausente, justificado, atrasado)
- Calendário mensal de frequência
- Alertas de faltas excessivas
- Upload de justificativa
- Relatórios por aluno e turma
- Portal do aluno para consultar frequência

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Attendance.jsx` | Lançamento de chamada |
| `frontend/src/pages/StudentAttendance.jsx` | Portal do aluno |
| `frontend/src/pages/Reports.jsx` | Relatórios de frequência |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/attendance/lesson.js` | API de chamada |
| `backend/src/services/attendanceServer.js` | Serviço de frequência |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `attendance` | Registros de presença |

## Status Possíveis
- `presente` — Aluno presente
- `ausente` — Aluno ausente
- `justificado` — Falta justificada
- `atrasado` — Aluno atrasado

## Alertas Automáticos
- Trigger `check_absence_alerts` verifica faltas excessivas
- Limite configurável (padrão: 25%)
- Notificação automática quando excedido

## Relacionamentos
- Pertence a [[Aluno]]
- Pertence a [[Turma]]
- Pertence a [[Disciplina]]
- Registrada por [[Professores]]
- Consultada via [[Portal_Aluno]]
- Consultada via [[Portal_Responsavel]]
- Exibida no [[Dashboard]]

## Ver Também
- [[Diario]] — Conteúdo da aula
- [[Relatorios]] — Relatórios de frequência

