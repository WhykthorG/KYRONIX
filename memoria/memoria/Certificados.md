# Certificados

## Descrição
Módulo de emissão de certificados do sistema [[KYRONIX S.E.N.O - Visão Geral]].

## Funcionalidades
- Emissão de certificados de conclusão
- Declarações
- Histórico escolar
- Certificados por módulo
- Validação por número de série

## Arquivos

### Frontend
| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Certificates.jsx` | Página principal |

### Backend
| Arquivo | Função |
|---------|--------|
| `backend/src/routes/admin/certificates.js` | API de certificados |

### Banco de Dados
| Tabela | Descrição |
|--------|-----------|
| `certificates` | Certificados emitidos |

## Tipos de Certificado
- **Conclusão** — Certificado de conclusão do curso
- **Declaração** — Declaração de vínculo
- **Histórico** — Histórico escolar completo
- **Módulo** — Certificado por módulo
- **Curso** — Certificado de curso

## Relacionamentos
- Emitido para [[Aluno]]
- Baseado em [[Notas]] e [[Frequencia]]
- Consultado via [[Portal_Aluno]]

## Ver Também
- [[Alunos]] — Alunos elegíveis
- [[Notas]] — Notas para o certificado

