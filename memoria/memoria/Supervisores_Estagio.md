# Supervisores_Estagio

## Descrição
Módulo de gestão de supervisores de estágio supervisionado do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro de supervisores
- Vínculo com empresas conveniadas
- Acompanhamento de estágios
- Avaliação de desempenho
- Histórico de orientações

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Internships.jsx` | Página principal |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/internships.js` | API de estágios |
| `backend/src/routes/admin/internship-companies.js` | API de empresas |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `internship_supervisors` | Dados dos supervisores |
| `internship_evaluations` | Avaliações de estágio |

## Relacionamentos
- Supervisiona [[Estagio_Supervisionado]]
- Pertence a [[Empresas_Conveniadas]]
- Acompanha [[Alunos]]

## Ver Também
- [[Estagio_Supervisionado]] — Gestão de estágios
- [[Empresas_Conveniadas]] — Empresas parceiras
- [[Portal_Aluno]] — Visualização do aluno
