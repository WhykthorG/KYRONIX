/**
 * Busca global via RPC Postgres (search_workspace) — não carrega tabelas inteiras no cliente.
 */

import { supabase } from '@/lib/supabase';

const SEARCH_WORKSPACE_RPC_NAME = 'search_workspace';
const SEARCH_WORKSPACE_RPC_MISSING_CODE = 'PGRST202';
const AUTH_PERMISSION_FUNC_MISSING_CODE = '42883';

let cachedMissingSearchWorkspaceRpcError = null;

export function isMissingSearchWorkspaceRpcError(error) {
  const haystack = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    error?.code === SEARCH_WORKSPACE_RPC_MISSING_CODE
    && haystack.includes(`public.${SEARCH_WORKSPACE_RPC_NAME}`)
  );
}

export function isMissingAuthHasPermissionError(error) {
  const haystack = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    error?.code === AUTH_PERMISSION_FUNC_MISSING_CODE
    && haystack.includes('auth_has_permission')
  );
}

function createMissingSearchWorkspaceRpcError(error) {
  const wrappedError = new Error(
    'Busca global indisponivel: a funcao RPC public.search_workspace nao existe no banco atual. Aplique supabase/migration_search_workspace_rpc.sql e recarregue o schema cache do Supabase.'
  );
  wrappedError.name = 'MissingSearchWorkspaceRpcError';
  wrappedError.code = error?.code ?? SEARCH_WORKSPACE_RPC_MISSING_CODE;
  wrappedError.cause = error;
  wrappedError.isMissingSearchWorkspaceRpc = true;
  return wrappedError;
}

function createMissingAuthPermissionError(error) {
  const wrappedError = new Error(
    `Erro de permissões no banco: função auth_has_permission não existe.\n\n` +
    `SOLUÇÃO:\n` +
    `1. Abra Supabase Dashboard → SQL Editor → New Query\n` +
    `2. Execute primeiro "supabase/migration_security_baseline.sql"\n` +
    `3. Depois execute "supabase/migration_rbac_permissions.sql"\n` +
    `4. Recarregue a página do app\n\n` +
    `Essas migrações criam as funções de segurança (RBAC/RLS) usadas pela busca global.`
  );
  wrappedError.name = 'MissingAuthPermissionError';
  wrappedError.code = error?.code ?? AUTH_PERMISSION_FUNC_MISSING_CODE;
  wrappedError.cause = error;
  wrappedError.isMissingAuthPermission = true;
  return wrappedError;
}

/**
 * @param {string} normalizedQuery — use normalizeSearchText() do globalSearch.js
 * @param {{ limitPerEntity?: number, maxTotal?: number }} [options]
 */
export async function searchWorkspaceRpc(normalizedQuery, options = {}) {
  if (cachedMissingSearchWorkspaceRpcError) {
    throw cachedMissingSearchWorkspaceRpcError;
  }

  const p_limit_per_entity = options.limitPerEntity ?? 5;
  const p_max_total = options.maxTotal ?? 24;
  const { data, error } = await supabase.rpc(SEARCH_WORKSPACE_RPC_NAME, {
    p_query: normalizedQuery,
    p_limit_per_entity,
    p_max_total,
  });
  if (error) {
    if (isMissingSearchWorkspaceRpcError(error)) {
      cachedMissingSearchWorkspaceRpcError = createMissingSearchWorkspaceRpcError(error);
      if (import.meta.env.MODE === 'development') {
        console.warn('[global-search] RPC search_workspace ausente no banco conectado.', error);
      }
      throw cachedMissingSearchWorkspaceRpcError;
    }
    if (isMissingAuthHasPermissionError(error)) {
      const cachedError = cachedMissingSearchWorkspaceRpcError || createMissingAuthPermissionError(error);
      cachedMissingSearchWorkspaceRpcError = cachedError;
      if (import.meta.env.MODE === 'development') {
        console.error('[global-search] Função auth_has_permission ausente no banco.', error);
      }
      throw cachedError;
    }
    throw error;
  }
  return data ?? [];
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function mapRpcRowsToSearchItems(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: row.record_id,
    title: row.title,
    subtitle: row.subtitle || '',
    meta: row.meta || '',
    appId: row.app_id,
    entityKey: row.entity_key,
    entityLabel: row.entity_label,
    searchText: row.search_document,
  }));
}
