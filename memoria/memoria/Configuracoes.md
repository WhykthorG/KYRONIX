# Configuracoes

## Descrição
Módulo de configurações do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Configurações gerais (nome da escola, telefone, endereço)
- Configurações de idioma
- Configurações de notificações
- Configurações de segurança
- Exportação de dados (XLSX, CSV)

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/SettingsPage.jsx` | Página principal |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/system-export.js` | Exportação |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `app_settings` | Configurações do sistema |

## Configurações Disponíveis
- Nome da escola
- Telefone
- Endereço
- Idioma (pt-BR, en, es)
- Fuso horário
- Notificações por tipo
- Limite de faltas para alertas

## Relacionamentos
- Afeta [[Idiomas]]
- Afeta [[Frequencia]] (limite de alertas)
- Controla [[Relatorios]] (exportação)

## Ver Também
- [[Idiomas]] — Configurações de idioma
- [[Seguranca]] — Configurações de segurança

