# Professores

## Descrição
Módulo de gestão de professores do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro completo com dados profissionais
- Especialidades e disciplinas
- Tipo de contrato (efetivo, temporário, etc.)
- Carga horária
- Vinculação a [[Turmas]]

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Teachers.jsx` | Página principal (CRUD) |
| `frontend/src/pages/TeacherPortal.jsx` | Portal do professor |
| `frontend/src/pages/TeacherCalendar.jsx` | Calendário do professor |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `teachers` | Dados dos professores |
| `teacher_subjects` | Vínculo professor-disciplina (5NF) |

## Relacionamentos
- Leciona [[Disciplinas]]
- Leciona em [[Turmas]]
- Registra [[Frequencia]]
- Lança [[Notas]]
- Preenche [[Diario]]
- Cria [[Atividades]]
- Orienta [[TCC_Projeto_Integrador]]

## Ver Também
- [[Portal_Professor]] — Portal do professor
- [[Horarios]] — Grade do professor

