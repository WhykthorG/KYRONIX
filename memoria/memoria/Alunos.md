# Alunos

## Descrição
Módulo de cadastro e gestão de alunos do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro completo com dados pessoais, endereço e responsável
- Matrícula em turmas
- Status: ativo, inativo, pendente, transferido, formado, evadido, trancado
- Importação em lote
- Busca e filtros avançados

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Students.jsx` | Página principal (CRUD) |
| `frontend/src/pages/StudentEnrollment.jsx` | Wizard de matrícula |
| `frontend/src/components/enrollment/SectionPersonal.jsx` | Dados pessoais |
| `frontend/src/components/enrollment/SectionAddress.jsx` | Endereço |
| `frontend/src/components/enrollment/SectionGuardian.jsx` | Responsável |
| `frontend/src/components/enrollment/SectionAcademic.jsx` | Dados acadêmicos |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/enrollments.js` | API de matrículas |
| `supabase/migration_enrollment_transaction.sql` | RPC de matrícula |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `students` | Dados dos alunos |
| `student_guardians` | Vínculo aluno-responsável (5NF) |

## Relacionamentos
- Possui [[Turma]] via `current_class_id`
- Possui [[Responsavel]] via `guardian_student_links`
- Possui [[Notas]] via `student_id`
- Possui [[Frequencia]] via `student_id`
- Pode ter [[Estagio_Supervisionado]]
- Pode ter [[TCC_Projeto_Integrador]]
- Gera [[Certificados]] ao concluir

## Ver Também
- [[Portal_Aluno]] — Visualização do aluno
- [[Portal_Responsavel]] — Visualização do responsável
- [[Matricula]] — Processo de matrícula

