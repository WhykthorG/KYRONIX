# Estagio_Supervisionado

## Descrição
Módulo de gestão de estágios supervisionados do sistema [[KYRONIX S.E.N.O - Visão Geral]]. Essencial para cursos técnicos.

## Funcionalidades
- Cadastro de empresas conveniadas
- Gestão de supervisores
- Acompanhamento de horas (necessárias vs cumpridas)
- Diário de estágio
- Avaliação do supervisor
- Status: pendente, aprovado, em andamento, concluído, cancelado

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Internships.jsx` | Página principal |
| `frontend/src/pages/InternshipCompanies.jsx` | Gestão de empresas |
| `frontend/src/pages/StudentInternship.jsx` | Portal do aluno |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/internships.js` | API de estágios |
| `backend/src/routes/admin/internship-companies.js` | API de empresas |
| `backend/src/routes/internships/diary.js` | API do diário |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `internship_companies` | Empresas conveniadas |
| `internship_supervisors` | Supervisores |
| `internships` | Estágios |
| `internship_diary` | Diário de estágio |
| `internship_evaluations` | Avaliações |

## Relacionamentos
- Pertence a [[Aluno]]
- Vinculado a [[Empresas_Conveniadas]]
- Supervisionado por [[Supervisores_Estagio]]
- Consultado via [[Portal_Aluno]]
- Acompanhado no [[Dashboard]]

## Ver Também
- [[Empresas_Conveniadas]] — Empresas parceiras
- [[Portal_Aluno]] — Visualização do aluno

