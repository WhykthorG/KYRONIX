# Matricula

## Descrição
Processo de matrícula e cadastro de alunos no sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro completo do aluno
- Dados pessoais, endereço e responsável
- Dados acadêmicos
- Upload de documentos
- Criação de acesso de autenticação
- Wizard de matrícula segmentado

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Registration.jsx` | Fluxo de cadastro |
| `frontend/src/pages/StudentEnrollment.jsx` | Wizard de matrícula |
| `frontend/src/components/enrollment/SectionPersonal.jsx` | Dados pessoais |
| `frontend/src/components/enrollment/SectionAddress.jsx` | Endereço |
| `frontend/src/components/enrollment/SectionGuardian.jsx` | Responsável |
| `frontend/src/components/enrollment/SectionAcademic.jsx` | Dados acadêmicos |
| `frontend/src/components/enrollment/SectionAttachments.jsx` | Anexos |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/enrollments.js` | API de matrículas |
| `backend/src/routes/admin/users.js` | Criação de acesso |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `students` | Dados do aluno |
| `student_guardians` | Vínculo aluno-responsável (5NF) |
| `class_enrollments` | Vínculo aluno-turma (5NF) |

## Relacionamentos
- Cria [[Alunos]]
- Vincula a [[Turmas]]
- Registra [[Responsavel]]
- Gera acesso para [[Portal_Aluno]]

## Ver Também
- [[Alunos]] — Alunos cadastrados
- [[Turmas]] — Turmas disponíveis
- [[Portal_Aluno]] — Acesso do aluno
