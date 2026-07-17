# Turmas

## Descrição
Módulo de organização de turmas do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro de turmas com ano letivo e turno
- Vinculação de alunos e coordenador
- Status: ativa, encerrada, planejada
- Controle de capacidade máxima

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Classes.jsx` | Página principal (CRUD) |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `classes` | Dados das turmas |
| `class_enrollments` | Vínculo turma-aluno (5NF) |
| `class_offerings` | Ofertas de disciplina por turma |

## Relacionamentos
- Contém [[Alunos]]
- Possui [[Disciplinas]] via `class_offerings`
- Possui [[Professores]] via coordenação
- Possui [[Horarios]] gerados
- Possui [[Frequencia]] dos alunos
- Possui [[Notas]] dos alunos

## Ver Também
- [[Horarios]] — Grade da turma
- [[Frequencia]] — Presença dos alunos

