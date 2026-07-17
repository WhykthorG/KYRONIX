# Notas

## Descrição
Módulo de lançamento e consulta de notas do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Lançamento por bimestre
- 4 atividades + recuperação por bimestre
- Cálculo automático de médias
- Situação: aprovado, recuperação, reprovado
- Boletim do aluno
- Segunda chamada

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Grades.jsx` | Lançamento de notas |
| `frontend/src/components/student/StudentGradesView.jsx` | Visualização do aluno |
| `frontend/src/components/common/StudentReportCard.jsx` | Boletim |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/grades/second-chances.js` | Segunda chamada |
| `backend/src/routes/grades/councils.js` | Conselho de classe |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `grades` | Notas dos alunos |
| `second_chances` | Segunda chamada |
| `class_councils` | Conselhos de classe |

## Fórmulas
- **Média Bimestral:** (A1 + A2 + A3 + A4 + Recuperação) / 5
- **Média Anual:** (B1 + B2 + B3 + B4) / 4
- **Situação:** Média >= 6 = Aprovado | Média >= 5 = Recuperação | Média < 5 = Reprovado

## Relacionamentos
- Pertence a [[Aluno]]
- Pertence a [[Disciplina]]
- Pertence a [[Turma]]
- Lançada por [[Professores]]
- Consultada via [[Portal_Aluno]]
- Consultada via [[Portal_Responsavel]]
- Gera [[Certificados]]

## Ver Também
- [[Avaliacoes]] — Tipos de avaliação
- [[Conselho_Classe]] — Decisões finais

