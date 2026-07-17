# Laboratorios

## Descrição
Módulo de gestão de laboratórios do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Cadastro de laboratórios com capacidade
- Reserva de horários
- Controle de equipamentos
- Empréstimos de materiais
- Histórico de utilização
- Status: disponível, em uso, manutenção, fechado

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Laboratories.jsx` | Página com 3 abas |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/laboratories.js` | API de laboratórios |
| `backend/src/routes/laboratories/reservations.js` | API de reservas |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `laboratories` | Laboratórios |
| `lab_reservations` | Reservas |
| `lab_equipment` | Equipamentos |
| `lab_material_loans` | Empréstimos |
| `lab_usage_logs` | Histórico |

## Relacionamentos
- Reservado para [[Turmas]]
- Usado em [[Disciplinas]]
- Vinculado a [[Horarios]]

## Ver Também
- [[Horarios]] — Alocação de laboratórios

