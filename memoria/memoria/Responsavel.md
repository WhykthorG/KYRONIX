# Responsavel

## Descrição
Módulo de gestão de responsáveis (pais/encarregados) do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro de responsáveis
- Vínculo com alunos
- Contatos e endereço
- Histórico de vínculos

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Registration.jsx` | Cadastro no fluxo de matrícula |
| `frontend/src/pages/GuardianPortal.jsx` | Portal do responsável |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `user_profiles` | Perfis com `profile_type = 'responsavel'` |
| `guardian_student_links` | Vínculo responsável-aluno (5NF) |

## Relacionamentos
- Vinculado a [[Alunos]] via `guardian_student_links`
- Acessa [[Portal_Responsavel]]
- Visualiza [[Notas]] e [[Frequencia]] dos alunos vinculados

## Ver Também
- [[Portal_Responsavel]] — Visualização do responsável
- [[Alunos]] — Alunos vinculados
