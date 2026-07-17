# Calendario_Escolar

## Descrição
Módulo de calendário escolar do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro de eventos (aulas, provas, reuniões, feriados)
- Visualização em grade mensal
- Filtro por tipo de evento
- Exportação ICS
- Integração com [[Calendario_Provas]]

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/SchoolCalendar.jsx` | Página principal |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `events` | Eventos do calendário |

## Tipos de Evento
- `aula` — Aula regular
- `prova` — Avaliação
- `reuniao` — Reunião
- `feriado` — Feriado
- `evento` — Evento escolar
- `recesso` — Recesso
- `conselho` — Conselho de classe

## Relacionamentos
- Vinculado a [[Turmas]]
- Vinculado a [[Disciplinas]]
- Complementa [[Calendario_Provas]]
- Consultado por [[Alunos]], [[Professores]], [[Responsavel]]

## Ver Também
- [[Calendario_Provas]] — Calendário dedicado de provas
- [[Horarios]] — Grade de horários

