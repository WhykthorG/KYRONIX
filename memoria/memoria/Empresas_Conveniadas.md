# Empresas_Conveniadas

## Descrição
Módulo de gestão de empresas conveniadas para estágios supervisionados do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro de empresas parceiras
- Dados de contato e endereço
- Vagas disponíveis
- Histórico de supervisores
- Avaliação da empresa

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/InternshipCompanies.jsx` | Gestão de empresas |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/internship-companies.js` | API de empresas |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `internship_companies` | Dados das empresas |

## Relacionamentos
- Possui [[Supervisores_Estagio]]
- Recebe [[Estagio_Supervisionado]] de [[Alunos]]
- Consultado via [[Portal_Aluno]]

## Ver Também
- [[Estagio_Supervisionado]] — Gestão de estágios
- [[Supervisores_Estagio]] — Supervisores das empresas
- [[Portal_Aluno]] — Visualização do aluno
