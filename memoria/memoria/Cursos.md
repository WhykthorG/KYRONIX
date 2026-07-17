# Cursos

## Descrição
Módulo de gestão de cursos e séries do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro de cursos técnicos
- Séries por curso (1ª, 2ª, 3ª série)
- Vínculo turma-série
- Duração e carga horária

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Courses.jsx` | Página com abas Cursos/Séries |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/courses.js` | API de cursos |
| `backend/src/routes/admin/series.js` | API de séries |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `courses` | Cursos |
| `series` | Séries |
| `class_series` | Vínculo turma-série |

## Relacionamentos
- Possui [[Series]]
- Vinculado a [[Turmas]]
- Cursado por [[Alunos]]
- Possui [[Disciplinas]]

## Ver Também
- [[Alunos]] — Alunos matriculados
- [[Turmas]] — Turmas do curso

