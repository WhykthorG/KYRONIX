## 1. Visão geral da segurança e robustez do sistema

Escopo coberto: frontend React/Vite, rotas serverless em `api/`, helpers em `server/`, integrações Supabase/Auth/Storage, schema e migrations SQL, contratos compartilhados, configuração e suíte de testes. A cobertura disponível é suficiente para uma auditoria ampla do sistema visível.

Validações executadas:
- `npm run build`: sucesso.
- `npm test`: sucesso, `92/92` testes passando.

Limitações declaradas:
- Não houve execução contra uma instância Supabase/PostgreSQL real.
- Não houve disparo real de e-mail, storage externo nem validação operacional em produção.
- Alguns riscos dependem de estado de dados legados e não puderam ser confirmados por ausência de banco ativo.

Diagnóstico resumido: o projeto está funcional e tem sinais positivos de engenharia, como contratos compartilhados, testes automatizados e tentativa explícita de endurecimento de RLS. Ainda assim, há falhas relevantes de autorização, exposição de credenciais temporárias, drift entre frontend e schema, e uso excessivo de `service role` em fluxos sensíveis. O sistema não está apto para produção nas condições atuais.

## 2. Lista completa de problemas encontrados

### Exportação sistêmica excessivamente ampla para perfis não administradores
1. Categoria: Exposição de segurança
2. Severidade: `CRÍTICO`
3. Local afetado: [src/lib/contracts/access.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/contracts/access.js#L129), [src/lib/contracts/access.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/contracts/access.js#L173), [src/lib/contracts/access.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/contracts/access.js#L219), [api/admin/system-export.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/admin/system-export.js#L18), [api/admin/system-export.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/admin/system-export.js#L44), [server/systemExportServer.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/server/systemExportServer.js#L85), [src/lib/contracts/systemExport.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/contracts/systemExport.js#L10), [src/lib/contracts/systemExport.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/contracts/systemExport.js#L19), [tests/access.integration.test.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/tests/access.integration.test.js#L47)
4. Descrição detalhada: Verificado no código. Os perfis `secretario`, `coordenador` e `administrador` recebem `system.export`, a rota aceita qualquer usuário com essa permissão e a exportação é feita com `createServiceRoleClient()` e `.select('*')`, incluindo datasets como `user_profiles`, `messages`, `direct_messages`, `grades` e `attendance`.
5. Causa raiz técnica: O controle de autorização foi modelado no contrato de permissões de forma ampla demais e a execução usa `service role`, ignorando a limitação natural de RLS do usuário autenticado.
6. Impacto real: Vazamento massivo de PII, dados acadêmicos, mensagens privadas e metadados internos para perfis operacionais que não deveriam possuir dump completo do sistema.
7. Risco de exploração ou quebra: Muito alto. Basta um usuário autorizado de secretaria ou coordenação acionar a rota para obter exportação completa.
8. Correção recomendada: Restringir `system.export` apenas a `administrador`, particionar datasets por criticidade, usar allowlist por perfil e remover exportação de mensagens privadas por padrão.
9. Código corrigido, quando possível:
```js
// src/lib/contracts/access.js
secretario: Object.freeze([
  // remover PERMISSIONS.SYSTEM_EXPORT
]),
coordenador: Object.freeze([
  // remover PERMISSIONS.SYSTEM_EXPORT
]),
administrador: Object.freeze([
  PERMISSIONS.SYSTEM_EXPORT,
])

// api/admin/system-export.js
const requester = await requirePermissionRequest(req, PERMISSIONS.SYSTEM_EXPORT);
if (requester.profile?.profile_type !== 'administrador') {
  return sendJson(res, 403, { error: 'Apenas administradores podem exportar o sistema.' });
}
```

### Senhas temporárias expostas em tela e em texto puro por e-mail
1. Categoria: Exposição de segurança
2. Severidade: `ALTO`
3. Local afetado: [src/pages/UserManagement.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/UserManagement.jsx#L119), [src/pages/UserManagement.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/UserManagement.jsx#L165), [src/pages/Registration.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/Registration.jsx#L311), [src/pages/Registration.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/Registration.jsx#L605), [api/admin/users/[userId].js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/admin/users/[userId].js#L68), [src/lib/contracts/notifications.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/contracts/notifications.js#L223), [tests/notifications.integration.test.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/tests/notifications.integration.test.js#L47)
4. Descrição detalhada: Verificado no código. O fluxo de cadastro e reset de acesso exibe a senha temporária na UI e a inclui em `emailText` do template `ACCESS_RESET`.
5. Causa raiz técnica: O projeto trata a senha temporária como artefato de onboarding compartilhável, em vez de usar link de definição de senha com validade curta e uso único.
6. Impacto real: Vazamento de credenciais por mailbox comprometida, captura de tela, shoulder surfing, histórico de navegação, observabilidade do cliente e repasse manual inseguro.
7. Risco de exploração ou quebra: Alto. Quem tiver acesso ao e-mail ou à tela no momento do cadastro/reset consegue autenticar como o usuário.
8. Correção recomendada: Substituir senha temporária por token de ativação/reset de uso único com expiração curta, nunca exibir a senha em tela e nunca enviá-la por e-mail.
9. Código corrigido, quando possível:
```js
// src/lib/contracts/notifications.js
return {
  title,
  body,
  emailSubject: title,
  emailText: `${body}\n\nDefina sua senha pelo link seguro enviado ao sistema.`,
};
```

### Troca obrigatória de senha no primeiro acesso não é enforcement real
1. Categoria: Vulnerabilidade
2. Severidade: `CRÍTICO`
3. Local afetado: [src/App.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/App.jsx#L118), [src/App.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/App.jsx#L122), [src/App.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/App.jsx#L128), [src/App.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/App.jsx#L158), [src/components/common/ChangePasswordModal.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/components/common/ChangePasswordModal.jsx#L86), [supabase/migration_improvements.sql](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_improvements.sql#L91), [supabase/schema.sql](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/schema.sql#L57), [supabase/migration_combined_corrected.sql](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql#L78), [supabase/migration_combined_corrected.sql](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql#L2205)
4. Descrição detalhada: Verificado no código. O modal depende de `sessionStorage.just_logged_in`, é removido logo após a leitura e o frontend tenta limpar `is_first_login` via `UserProfileApi.update(...)`. Ao mesmo tempo, o campo aparece apenas em migration antiga e não consta no schema principal atual, nem há política RLS de self-update correspondente.
5. Causa raiz técnica: Regra crítica de autenticação ficou implementada no cliente, acoplada a storage de sessão e com drift entre schema, RLS e interface.
6. Impacto real: Usuários podem continuar operando com credencial temporária sem troca real de senha, o que mantém contas frágeis e quebra o fluxo de hardening inicial.
7. Risco de exploração ou quebra: Muito alto. O bypass é trivial por refresh, nova aba ou simples ausência da coluna/policy no banco efetivo.
8. Correção recomendada: Mover o enforcement para backend/Auth, bloquear sessões com flag de primeiro acesso até troca de senha concluída e alinhar schema/RLS com uma fonte única de verdade.
9. Código corrigido, quando possível:
```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN NOT NULL DEFAULT TRUE;

CREATE POLICY "own profile first login update" ON user_profiles
  FOR UPDATE
  USING (lower(user_email) = auth_user_email())
  WITH CHECK (lower(user_email) = auth_user_email());
```

### Erros internos do backend retornam detalhes sensíveis ao cliente
1. Categoria: Exposição de segurança
2. Severidade: `ALTO`
3. Local afetado: [server/supabaseAdminServer.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/server/supabaseAdminServer.js#L134), [server/supabaseAdminServer.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/server/supabaseAdminServer.js#L142), [server/supabaseAdminServer.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/server/supabaseAdminServer.js#L541), [server/supabaseAdminServer.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/server/supabaseAdminServer.js#L554), [api/admin/enrollments.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/admin/enrollments.js#L34)
4. Descrição detalhada: Verificado no código. O normalizador propaga `error.details`, o handler devolve `details` no JSON e a API de matrículas monta detalhes com `postgresCode`, `postgresDetails` e `postgresHint`.
5. Causa raiz técnica: Estratégia de observabilidade e diagnóstico foi reaproveitada diretamente na resposta HTTP sem sanitização por ambiente ou tipo de erro.
6. Impacto real: Exposição de nomes de constraints, hints do PostgreSQL, detalhes de limpeza transacional e estrutura interna do backend para usuários autenticados.
7. Risco de exploração ou quebra: Alto. Ajuda enumeração de schema, acelera exploração lógica e amplia superfície de vazamento de PII ou metadados internos.
8. Correção recomendada: Sanitizar respostas para o cliente, preservar detalhes completos apenas em logs internos seguros e aplicar envelope de erro estável com `traceId`.
9. Código corrigido, quando possível:
```js
return createJson(res, normalizedError.statusCode, {
  error: normalizedError.message || 'Erro interno do servidor.',
  code: normalizedError.code,
  traceId: normalizedError.traceId,
});
```

### Escopo de tenant em notificações aceita linhas com `tenant_id` nulo
1. Categoria: Problema arquitetural
2. Severidade: `MÉDIO`
3. Local afetado: [server/notificationsServer.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/server/notificationsServer.js#L88), [server/notificationsServer.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/server/notificationsServer.js#L90), [tests/notifications.integration.test.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/tests/notifications.integration.test.js#L47), [supabase/migration_combined_corrected.sql](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql#L1324), [supabase/migration_combined_corrected.sql](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql#L2237)
4. Descrição detalhada: Verificado no código. A camada server ainda usa `tenant_id.is.null,tenant_id.eq.${tenantId}` enquanto o schema corrigido evoluiu para `tenant_id NOT NULL` e `tenant_id = current_tenant_id()`.
5. Causa raiz técnica: Drift entre hardening recente do banco e lógica legado do backend de notificações.
6. Impacto real: Se houver registros legados com `tenant_id = NULL`, eles podem atravessar o filtro e aparecer fora do tenant esperado.
7. Risco de exploração ou quebra: Médio. A exploração depende da existência de dados legados ou gravações inconsistentes, mas a brecha lógica está presente.
8. Correção recomendada: Remover fallback para `NULL`, tornar `tenant_id` obrigatório em toda escrita e criar rotina de saneamento para registros legados.
9. Código corrigido, quando possível:
```js
function applyTenantScope(query, tenantId) {
  if (!tenantId) throw new Error('tenantId obrigatorio');
  return query.eq('tenant_id', tenantId);
}
```

### Configurações de segurança caem para `localStorage` e a UI comunica conformidade sem verificação
1. Categoria: Problema de UX/UI
2. Severidade: `MÉDIO`
3. Local afetado: [src/pages/SettingsPage.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/SettingsPage.jsx#L48), [src/pages/SettingsPage.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/SettingsPage.jsx#L63), [src/pages/SettingsPage.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/SettingsPage.jsx#L92), [src/pages/SettingsPage.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/SettingsPage.jsx#L360), [src/lib/contracts/settings.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/contracts/settings.js#L102), [src/lib/contracts/settings.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/contracts/settings.js#L114)
4. Descrição detalhada: Verificado no código. Se `app_settings` falha ou não existe, a página salva configurações deste navegador. Ao mesmo tempo, a tela mostra estados fixos como “Criptografia de Dados: Ativo”, “Backup Automático: Diário” e “Logs de Auditoria: Ativo” sem aferição operacional.
5. Causa raiz técnica: Mistura entre preferência local de interface e configuração sistêmica, além de indicadores de conformidade implementados como texto estático.
6. Impacto real: Gera falsa sensação de segurança operacional e permite que operadores acreditem ter ativado controles de produção quando só mudaram um estado local.
7. Risco de exploração ou quebra: Médio. O problema induz erro operacional e tomada de decisão incorreta, especialmente em ambientes multiusuário.
8. Correção recomendada: Separar preferências locais de configurações globais, bloquear fallback local para controles sistêmicos e transformar cards de conformidade em indicadores reais alimentados por backend/telemetria.
9. Código corrigido, quando possível:
```js
if (isSettingsTableUnavailable(error)) {
  return toast.error('Configuracoes do sistema indisponiveis. Nenhuma alteracao foi persistida.');
}
```

### Regra de e-mail `@gmail.com` em produção é incompatível com uso institucional real
1. Categoria: Erro funcional
2. Severidade: `MÉDIO`
3. Local afetado: [src/lib/validators.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/lib/validators.js#L104), [src/pages/StudentEnrollment.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/StudentEnrollment.jsx#L119), [src/pages/Registration.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/Registration.jsx#L350), [src/pages/Registration.jsx](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/pages/Registration.jsx#L386)
4. Descrição detalhada: Verificado no código. O frontend rejeita qualquer e-mail que não seja `@gmail.com` em matrícula e criação de acesso de aluno.
5. Causa raiz técnica: Regra temporária de validação foi promovida para regra de negócio fixa.
6. Impacto real: Bloqueia domínios institucionais, e-mails corporativos e provedores legítimos, afetando onboarding e operação escolar real.
7. Risco de exploração ou quebra: Médio. Não é vulnerabilidade clássica, mas quebra um fluxo crítico de produção.
8. Correção recomendada: Trocar por validação RFC básica ou allowlist configurável por domínio; se houver política institucional, ela deve ser parametrizável no backend.
9. Código corrigido, quando possível:
```js
export function validateEmail(email) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(email || '').trim());
}
```

### CRUD genérico no navegador faz overfetch com `select('*')`
1. Categoria: Má prática técnica
2. Severidade: `MÉDIO`
3. Local afetado: [src/api/supabaseApi.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/api/supabaseApi.js#L15), [src/api/supabaseApi.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/api/supabaseApi.js#L45), [src/api/supabaseApi.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/src/api/supabaseApi.js#L132)
4. Descrição detalhada: Verificado no código. A API genérica usada pelo frontend lista, busca e filtra tabelas com `select('*')`, o que entrega à UI todos os campos disponíveis em entidades sensíveis.
5. Causa raiz técnica: Busca por conveniência e reaproveitamento levou à perda de contratos mínimos por tela e por caso de uso.
6. Impacto real: Aumenta exposição de PII no browser, amplia o impacto de qualquer XSS futuro, piora performance e dificulta governança de dados.
7. Risco de exploração ou quebra: Médio. A exploração depende de outra falha no cliente ou de uso indevido do console, mas o excesso de dados já é entregue.
8. Correção recomendada: Substituir CRUD genérico por repositórios específicos por entidade/tela com projeção explícita de colunas.
9. Código corrigido, quando possível:
```js
const USER_PROFILE_LIST_COLUMNS = 'id, full_name, user_email, profile_type, status, created_at';
const { data, error } = await supabase
  .from('user_profiles')
  .select(USER_PROFILE_LIST_COLUMNS)
  .order('created_at', { ascending: false });
```

### Portal do responsável depende de `service role` e autorização manual em vez de RLS
1. Categoria: Problema arquitetural
2. Severidade: `MÉDIO`
3. Local afetado: [api/guardian/students.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/guardian/students.js#L34), [api/guardian/students.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/guardian/students.js#L60), [api/guardian/documents.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/guardian/documents.js#L34), [api/guardian/documents.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/guardian/documents.js#L60), [api/guardian/documents.js](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/api/guardian/documents.js#L108)
4. Descrição detalhada: Verificado no código. As rotas do responsável autenticam o usuário, mas fazem leitura e assinatura de arquivos com `createServiceRoleClient()` e checagens manuais em JavaScript.
5. Causa raiz técnica: O backend foi usado para contornar ou simplificar RLS/Storage policies, concentrando a autorização em lógica de aplicação.
6. Impacto real: A segurança desse fluxo depende de manter múltiplas validações manuais coerentes; qualquer regressão futura pode expor documentos de alunos indevidamente.
7. Risco de exploração ou quebra: Médio. Não há bypass confirmado nesta revisão, mas há alta fragilidade arquitetural e risco de drift.
8. Correção recomendada: Mover o enforcement para políticas de banco/storage e usar cliente request-scoped sempre que possível; deixar `service role` apenas para operações administrativas estritas.
9. Código corrigido, quando possível:
```js
// Preferir cliente vinculado ao token do requester
const supabase = createRequestScopedClient(req);
const { data } = await supabase
  .from('guardian_student_links')
  .select('student_id')
  .eq('guardian_profile_id', requester.profile.id);
```

### Drift entre documentação, schema e comportamento real do sistema
1. Categoria: Má prática técnica
2. Severidade: `BAIXO`
3. Local afetado: [docs/banco-de-dados.md](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/docs/banco-de-dados.md#L5), [docs/banco-de-dados.md](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/docs/banco-de-dados.md#L65), [docs/banco-de-dados.md](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/docs/banco-de-dados.md#L75), [supabase/schema.sql](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/schema.sql#L57), [supabase/migration_combined_corrected.sql](C:/Users/Home/Pictures/TCC_Claude/projeto/escola-supabase/TCC-3/supabase/migration_combined_corrected.sql#L78)
4. Descrição detalhada: Verificado no código. A documentação aponta para caminhos do repositório `TCC-2`, descreve artefatos antigos e não reflete integralmente o baseline atual. Em paralelo, o app depende de `is_first_login`, mas o campo não está no schema principal visível.
5. Causa raiz técnica: Ausência de processo de manutenção entre código, documentação e migrations ativas.
6. Impacto real: Risco de bootstrap incorreto, auditoria enganosa, aplicação de migrations erradas e aumento do tempo de resposta a incidentes.
7. Risco de exploração ou quebra: Baixo isoladamente, mas relevante como multiplicador de erros operacionais.
8. Correção recomendada: Atualizar a documentação para o estado real do `TCC-3`, definir uma migration baseline única e eliminar dependências do app em colunas não presentes no schema principal.
9. Código corrigido, quando possível:
```md
- Referenciar somente arquivos do repositório atual `TCC-3`
- Declarar explicitamente qual arquivo é o baseline oficial do banco
- Remover do app qualquer dependência de coluna ausente do schema oficial
```

## 3. Resumo por severidade

- `CRÍTICO`: 2
- `ALTO`: 2
- `MÉDIO`: 5
- `BAIXO`: 1

## 4. Resumo por área analisada

- Frontend: funcional e testável, mas carrega dados demais, implementa regra crítica de segurança no cliente e mistura preferências locais com configurações sistêmicas.
- Backend/API: há boas abstrações utilitárias, porém ainda existe uso excessivo de `service role`, sanitização insuficiente de erros e autorização espalhada fora do banco.
- Banco de dados: houve avanço no endurecimento de tenant/RLS, mas há drift entre schema principal, migrations legadas e expectativas do frontend.
- Autenticação/autorização: é a área mais crítica; exportação sistêmica ampla, primeiro acesso não garantido server-side e dependência de lógica duplicada em múltiplas camadas.
- UX/UI: há feedback claro em vários fluxos, mas a UI também comunica garantias de segurança que não são verificadas e expõe credenciais temporárias.
- Operação/configuração: build e testes passam, porém a suíte valida parte do comportamento inseguro atual, e a documentação está desalinhada com o estado real do projeto.

## 5. Top 10 riscos mais graves

1. Exportação sistêmica completa disponível para perfis além de administrador.
2. Troca obrigatória de senha no primeiro acesso sem enforcement real no backend/Auth.
3. Senhas temporárias expostas em UI e e-mail.
4. Detalhes internos de erro vazando em respostas HTTP.
5. Drift de tenant nas notificações com fallback para `tenant_id` nulo.
6. Portal do responsável dependente de `service role` e checagens manuais.
7. CRUD genérico no browser com `select('*')` sobre entidades sensíveis.
8. Configurações sistêmicas com fallback para `localStorage`.
9. Indicadores de conformidade estáticos sem prova operacional.
10. Drift entre documentação, schema e comportamento real da aplicação.

## 6. Correções prioritárias

1. Revogar `system.export` de `secretario` e `coordenador`, e remover datasets ultra sensíveis do export padrão.
2. Trocar imediatamente o modelo de senha temporária por link seguro de ativação/reset com expiração curta.
3. Implementar enforcement server-side para primeiro acesso e alinhar schema/RLS com a regra.
4. Sanitizar respostas de erro e manter detalhes internos apenas em logs seguros.
5. Remover fallback de tenant `NULL` e saneá-lo no banco.
6. Migrar fluxos do portal do responsável para políticas request-scoped e storage policies reais.
7. Quebrar a API genérica de `select('*')` em contratos mínimos por tela.
8. Desativar fallback local para controles sistêmicos e revisar a página de configurações para refletir apenas estados medidos.
9. Remover a regra hardcoded de `@gmail.com` e substituí-la por política configurável.
10. Consolidar schema baseline, migrations e documentação do `TCC-3`.

## 7. Diagnóstico final do projeto

O sistema não está apto para produção no estado atual. Ele demonstra boa base de desenvolvimento, build estável e testes automatizados, mas ainda carrega falhas sérias de autorização e exposição de credenciais, além de inconsistência entre frontend, backend e banco. Os itens `CRÍTICO` e `ALTO` precisam ser corrigidos antes de qualquer entrada em produção real.

## 8. Nível atual de maturidade do sistema

Classificação: `intermediária`.

Justificativa: o projeto já possui estrutura razoável, testes, separação de camadas e sinais de evolução arquitetural. Ainda assim, os controles de segurança e robustez operacional não estão maduros o suficiente para ambiente de produção, principalmente em autorização, governança de dados sensíveis e coerência entre camadas.
