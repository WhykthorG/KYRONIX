# Disciplinas

## Descrição
Módulo de gestão de disciplinas do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro com código, nome e descrição
- Carga horária (semanal e total)
- Ementa, objetivos e competências
- Status: ativa, inativa
- Obrigatória ou optativa

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Subjects.jsx` | Página principal (CRUD) |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `subjects` | Dados das disciplinas |

## Relacionamentos
- Lecionada por [[Professores]]
- Cursada em [[Turmas]]
- Possui [[Notas]] dos alunos
- Possui [[Frequencia]] dos alunos
- Pode ter [[Horarios]] gerados
- Vinculada a [[Cursos]] e [[Series]]

## Ver Também
- [[Notas]] — Notas da disciplina
- [[Horarios]] — Grade da disciplina

