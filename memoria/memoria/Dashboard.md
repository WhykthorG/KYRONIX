# Dashboard

## Descrição
Módulo de dashboard e indicadores do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Indicadores gerais da escola
- Acessos rápidos a módulos
- Alertas e notificações
- Gráficos de desempenho
- Resumo de frequência e notas

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Dashboard.jsx` | Página principal |
| `frontend/src/components/dashboard/StatsCard.jsx` | Cards de indicadores |
| `frontend/src/components/dashboard/QuickActions.jsx` | Acessos rápidos |
| `frontend/src/components/dashboard/UpcomingEvents.jsx` | Próximos eventos |

### Banco de Dados
| Tabela/Função | Descrição |
|---------------|-----------|
| `dashboard_summary()` | RPC de resumo consolidado |
| `mv_student_report_card` | View materializada do boletim |

## Indicadores
- Total de alunos ativos
- Total de professores ativos
- Total de turmas em andamento
- Frequência média
- Alunos em risco
- Próximas avaliações
- Estágios ativos
- TCCs em andamento

## Relacionamentos
- Consulta dados de [[Alunos]]
- Consulta dados de [[Notas]]
- Consulta dados de [[Frequencia]]
- Consulta dados de [[Turmas]]
- Consulta dados de [[Disciplinas]]
- Integra com [[Relatorios]]

## Ver Também
- [[Relatorios]] — Relatórios detalhados
- [[Portal_Aluno]] — Visualização do aluno
- [[Portal_Professor]] — Visualização do professor
