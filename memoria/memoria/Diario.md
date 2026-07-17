# Diario

## Descrição
Módulo de diário de classe do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Registro de conteúdo ministrado
- Objetivos da aula
- Metodologia utilizada
- Atividades realizadas
- Observações
- Planos de aula

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Diary.jsx` | Página principal |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `class_diary` | Entradas do diário |
| `lesson_plans` | Planos de aula |

## Relacionamentos
- Registrado por [[Professores]]
- Referente a [[Turma]]
- Referente a [[Disciplina]]
- Vinculado a [[Frequencia]]
- Consultado via [[Portal_Professor]]

## Ver Também
- [[Frequencia]] — Presença dos alunos
- [[Atividades]] — Atividades da aula

