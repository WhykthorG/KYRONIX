# Biblioteca

## Descrição
Módulo de gestão da biblioteca do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro de acervo (livros, periódicos, DVDs, ebooks)
- Empréstimos e devoluções
- Reservas
- Multas automáticas
- Controle de cópias disponíveis

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/LibraryPage.jsx` | Página principal |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `library_items` | Acervo |
| `library_loans` | Empréstimos |
| `library_reservations` | Reservas |
| `library_fines` | Multas |

## Funcionalidades RPC
- `calculate_library_fine()` — Cálculo de multa
- `process_library_return()` — Processamento de devolução

## Relacionamentos
- Utilizado por [[Alunos]]
- Utilizado por [[Professores]]
- Consultado no [[Dashboard]]

## Ver Também
- [[Portal_Aluno]] — Empréstimos do aluno

