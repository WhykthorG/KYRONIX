// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
/**
 * src/components/examples/PaginatedListExample.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * EXEMPLO: Lista com paginação, filtros e lazy loading
 *
 * Resolve o problema de N+1 queries carregando TODAS as linhas.
 * Implementa:
 * - Paginação server-side
 * - Filtros
 * - Lazy loading
 * - Estados de loading/error
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import {
  assertSafeIdentifier,
  dedupeRecordsById,
  normalizeSearchText,
  sortRecordsByColumn,
  uniqueSafeIdentifiers,
} from './paginatedListSecurity';

const PAGE_SIZE = 50; // Itens por página

/**
 * Hook para paginação
 */
function usePaginatedQuery(table, options = {}) {
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState(options.initialFilters || {});
  const safeTable = assertSafeIdentifier(table, 'Tabela');
  const safeOrderBy = options.orderBy ? assertSafeIdentifier(options.orderBy, 'Ordenação') : null;
  const safeSearchFields = uniqueSafeIdentifiers(options.searchFields || []);
  const normalizedSearchTerm = normalizeSearchText(searchTerm);
  const ascending = options.ascending !== false;
  const searchFetchLimit = options.searchFetchLimit || 1000;

  const buildBaseQuery = () => {
    let query = supabase
      .from(safeTable)
      .select('*', { count: 'exact' });

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        query = query.eq(assertSafeIdentifier(key, 'Filtro'), value);
      }
    });

    if (safeOrderBy) {
      query = query.order(safeOrderBy, { ascending });
    }

    return query;
  };

  const { data, isLoading, error, isError } = useQuery({
    queryKey: [table, page, searchTerm, filters],
    queryFn: async () => {
      try {
        if (normalizedSearchTerm && safeSearchFields.length > 0) {
          const searchPattern = `%${normalizedSearchTerm}%`;
          const queryResults = await Promise.all(
            safeSearchFields.map((field) => buildBaseQuery().ilike(field, searchPattern).limit(searchFetchLimit))
          );

          const merged = dedupeRecordsById(queryResults.flatMap(({ data: rows }) => rows || []));
          const ordered = safeOrderBy ? sortRecordsByColumn(merged, safeOrderBy, ascending) : merged;
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE;
          const items = ordered.slice(from, to);

          return {
            items,
            count: ordered.length,
            hasMore: ordered.length > (page + 1) * PAGE_SIZE,
          };
        }

        const query = buildBaseQuery();
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, count, error } = await query.range(from, to);

        if (error) throw error;

        return {
          items: data || [],
          count: count || 0,
          hasMore: count > (page + 1) * PAGE_SIZE,
        };
      } catch (err) {
        console.error(`Erro ao carregar ${table}:`, err);
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0;

  return {
    items: data?.items || [],
    count: data?.count || 0,
    hasMore: data?.hasMore || false,
    totalPages,
    currentPage: page,
    isLoading,
    error,
    isError,
    setPage,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
  };
}

/**
 * Componente de paginação
 */
function Pagination({ currentPage, totalPages, onPageChange, isLoading }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200">
      <div className="text-sm text-slate-600">
        Página {currentPage + 1} de {totalPages}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0 || isLoading}
          className="gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1 || isLoading}
          className="gap-1"
        >
          Próxima
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Componente de filtros
 */
function FilterBar({ searchTerm, onSearchChange, filters, onFilterChange }) {
  return (
    <div className="flex gap-3 p-4 bg-slate-50 border-b border-slate-200">
      <div className="flex-1 relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Exemplo: filtro por status */}
      <select
        value={filters.status || ''}
        onChange={(e) => onFilterChange('status', e.target.value || null)}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">Todos os status</option>
        <option value="ativo">Ativo</option>
        <option value="inativo">Inativo</option>
      </select>
    </div>
  );
}

/**
 * Componente principal: Lista com paginação
 */
export function PaginatedListExample() {
  const {
    items,
    count,
    totalPages,
    currentPage,
    isLoading,
    error,
    setPage,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
  } = usePaginatedQuery('students', {
    searchFields: ['name', 'email'],
    orderBy: 'created_at',
    ascending: false,
    initialFilters: { status: null },
  });

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setPage(newPage);
      // Scroll para o topo da lista
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFilterChange = (filterKey, filterValue) => {
    setFilters({ ...filters, [filterKey]: filterValue });
    setPage(0); // Reset para primeira página ao filtrar
  };

  // Colunas da tabela
  const columns = [
    { key: 'id', label: 'ID', width: '80px' },
    { key: 'name', label: 'Nome', width: 'auto' },
    { key: 'email', label: 'E-mail', width: '200px' },
    { key: 'phone', label: 'Telefone', width: '150px' },
    { key: 'status', label: 'Status', width: '100px' },
  ];

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alunos</h1>
        <p className="text-sm text-slate-600 mt-1">
          Total: <span className="font-semibold">{count}</span> registros
        </p>
      </div>

      {/* Feedback de erro */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Erro ao carregar dados</p>
            <p className="text-sm text-red-800 mt-1">{error?.message}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <FilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Tabela */}
      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Carregando...</p>
            </div>
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-slate-600 font-medium">Nenhum registro encontrado</p>
              <p className="text-xs text-slate-500 mt-1">Tente ajustar os filtros</p>
            </div>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className="px-4 py-3 text-left font-semibold text-slate-700"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                >
                  {columns.map(col => (
                    <td
                      key={`${item.id}-${col.key}`}
                      className="px-4 py-3 text-slate-900"
                    >
                      {item[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

export default PaginatedListExample;
