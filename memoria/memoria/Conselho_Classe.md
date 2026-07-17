# Conselho_Classe

## Descrição
Módulo de conselho de classe do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Abertura de conselho de classe
- Registro de deliberações
- Decisões sobre aprovação/reprovação
- Histórico de conselhos
- Documentação formal

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Grades.jsx` | Integrado ao módulo de notas |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/grades/councils.js` | API de conselhos |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `class_councils` | Conselhos de classe |
| `council_decisions` | Decisões dos conselhos |

## Relacionamentos
- Referente a [[Turmas]]
- Referente a [[Disciplinas]]
- Envolve [[Alunos]]
- Coordenado por [[Professores]]

## Ver Também
- [[Notas]] — Notas avaliadas no conselho
- [[Avaliacoes]] — Avaliações do período
