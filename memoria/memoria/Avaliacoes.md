# Avaliacoes

## Descrição
Módulo de avaliações do sistema [[KYRONIX S.E.N.O - Visão Geral]], abrangendo provas, trabalhos e recuperações.

## Funcionalidades
- Cadastro de avaliações
- Tipos: prova, prova final, recuperação, 2ª chamada, trabalho, projeto
- Segunda chamada
- Conselho de classe
- Legenda visual por tipo

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/ExamCalendar.jsx` | Calendário de avaliações |
| `frontend/src/pages/Grades.jsx` | Lançamento de notas |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/grades/second-chances.js` | Segunda chamada |
| `backend/src/routes/grades/councils.js` | Conselho de classe |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `evaluations` | Definição das avaliações |
| `student_evaluation_results` | Resultados por aluno |
| `second_chances` | Segunda chamada |
| `class_councils` | Conselhos de classe |

## Relacionamentos
- Vinculada a [[Disciplinas]]
- Vinculada a [[Turmas]]
- Registrada por [[Professores]]
- Gera [[Notas]]
- Consultado via [[Portal_Aluno]]

## Ver Também
- [[Notas]] — Notas das avaliações
- [[Calendario_Provas]] — Calendário dedicado de provas
