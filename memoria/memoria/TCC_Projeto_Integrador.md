# TCC_Projeto_Integrador

## Descrição
Módulo de gestão de TCC e projetos integradores do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro de projetos com título e tema
- Formação de grupos de trabalho
- Gestão de orientadores
- Fases do projeto (seleção, orientação, pesquisa, redação, revisão, final)
- Entregas com prazos
- Bancas avaliadoras
- Notas finais

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/TCCProjects.jsx` | Página principal |
| `frontend/src/pages/StudentTCC.jsx` | Portal do aluno |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/tcc-projects.js` | API de projetos |
| `backend/src/routes/tcc/deliveries.js` | API de entregas |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `tcc_projects` | Projetos TCC |
| `tcc_members` | Integrantes do projeto |
| `tcc_deliveries` | Entregas |
| `tcc_bancas` | Bancas avaliadoras |
| `tcc_orientations` | Orientações |

## Fases do TCC
1. **Seleção de Tema** — Definição do tema
2. **Orientação** — Acompanhamento com orientador
3. **Pesquisa** — Coleta de dados
4. **Redação** — Escrita do documento
5. **Revisão** — Correções e ajustes
6. **Final** — Entrega e defesa

## Relacionamentos
- Pertence a [[Aluno]]
- Orientado por [[Professores]]
- Consultado via [[Portal_Aluno]]
- Acompanhado no [[Dashboard]]

## Ver Também
- [[Portal_Aluno]] — Visualização do aluno
- [[Certificados]] — Certificado de conclusão

