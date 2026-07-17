# Calendario_Provas

## Descrição
Módulo dedicado de agendamento de provas do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Agendamento de provas, trabalhos e projetos
- Tipos: prova, prova final, recuperação, 2ª chamada, trabalho, projeto
- Legenda visual por tipo
- Próximas avaliações
- Integração com [[Calendario_Escolar]]

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/ExamCalendar.jsx` | Página principal |

## Tipos de Avaliação
- `prova` — Prova regular
- `prova_final` — Prova final
- `recuperacao` — Recuperação
- `segunda_chamada` — 2ª chamada
- `trabalho` — Trabalho
- `projeto` — Projeto
- `apresentacao` — Apresentação

## Relacionamentos
- Vinculado a [[Disciplinas]]
- Vinculado a [[Turmas]]
- Consultado por [[Alunos]]
- Gerenciado por [[Professores]]
- Integra com [[Calendario_Escolar]]

## Ver Também
- [[Calendario_Escolar]] — Calendário geral
- [[Notas]] — Notas das avaliações

