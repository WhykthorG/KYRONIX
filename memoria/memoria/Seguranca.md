# Seguranca

## Descrição
Sistema de segurança do [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Autenticação via Supabase Auth (JWT)
- Controle de acesso baseado em papéis (RBAC)
- 67 permissões granulares
- 6 tipos de perfil
- Rate limiting por IP
- Validação de entrada (Zod)
- Headers de segurança (CSP, HSTS, CORS)
- Validação MIME para uploads
- Registro de auditoria

## Perfis de Usuário
| Perfil | Descrição |
|--------|-----------|
| `aluno` | Aluno — acesso limitado aos próprios dados |
| `responsavel` | Responsável — acesso aos alunos vinculados |
| `professor` | Professor — acesso a turmas e disciplinas |
| `secretario` | Secretário — acesso administrativo |
| `coordenador` | Coordenador — acesso total acadêmico |
| `administrador` | Administrador — acesso total ao sistema |

## Arquivos

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/database/supabaseAdminServer.js` | Autenticação e autorização |
| `backend/src/middlewares/requestSecurity.js` | Rate limiting |
| `backend/src/middlewares/requestSchemas.js` | Validação Zod |

### Configuração
| Arquivo | Função |
|---------|--------|
| `infra/nginx.conf` | Headers de segurança |
| `frontend/src/lib/webrtcConfig.js` | Credenciais TURN |

## Melhorias Implementadas
- ✅ CSP, HSTS, CORS no nginx
- ✅ Validação MIME para uploads
- ✅ 48 vulnerabilidades corrigidas
- ✅ Credenciais via variáveis de ambiente

## Ver Também
- [[Configuracoes]] — Configurações de segurança

