import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import RenderProfiler from '@/components/common/RenderProfiler';
import { cn } from '@/lib/utils';
import {
  mapRpcRowsToSearchItems,
  searchWorkspaceRpc,
} from '@/lib/globalSearchRpc';
import {
  getSearchableEntitiesForRole,
  GLOBAL_SEARCH_MIN_QUERY_LENGTH,
  normalizeSearchText,
  rankSearchResult,
} from '@/lib/globalSearch';
import { Loader2, Search, Sparkles } from 'lucide-react';

const MAX_RESULTS_PER_ENTITY = 5;
const MAX_TOTAL_RESULTS = 24;

function GlobalSearchBar({
  appsById,
  profileType,
  searchEnabled,
  topOffset = 48,
  user,
  isVisible = false,
  onVisibilityChange,
  onActivate,
  onOpenResult,
}) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const entities = useMemo(
    () => getSearchableEntitiesForRole(profileType),
    [profileType]
  );

  const normalizedQuery = useMemo(
    () => normalizeSearchText(deferredQuery),
    [deferredQuery]
  );

  const searchEnabledQuery =
    searchEnabled &&
    Boolean(profileType) &&
    normalizedQuery.length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH;

  const {
    data: rpcRows = [],
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ['global-search-rpc', profileType, user?.email || 'anon', normalizedQuery],
    queryFn: async () => {
      const rows = await searchWorkspaceRpc(normalizedQuery, {
        limitPerEntity: MAX_RESULTS_PER_ENTITY,
        maxTotal: MAX_TOTAL_RESULTS,
      });
      return rows;
    },
    enabled: searchEnabledQuery,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 10,
  });

  const groupedResults = useMemo(() => {
    if (normalizedQuery.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
      return [];
    }

    const items = mapRpcRowsToSearchItems(rpcRows).sort(
      (left, right) =>
        rankSearchResult(left, normalizedQuery) - rankSearchResult(right, normalizedQuery)
        || left.title.localeCompare(right.title, 'pt-BR')
    );

    const orderKeys = entities.map((e) => e.key);
    const buckets = new Map(orderKeys.map((k) => [k, []]));

    let total = 0;
    for (const item of items) {
      if (total >= MAX_TOTAL_RESULTS) break;
      const list = buckets.get(item.entityKey);
      if (!list || list.length >= MAX_RESULTS_PER_ENTITY) continue;
      list.push(item);
      total += 1;
    }

    // Create entity map from local entities + RPC data
    const entityByKey = Object.fromEntries(
      entities.map(e => [e.key, { key: e.key, label: e.label }])
    );

    return orderKeys
      .map((key) => {
        const entity = entityByKey[key];
        const groupItems = buckets.get(key) ?? [];
        return entity && groupItems.length > 0 ? { entity, items: groupItems } : null;
      })
      .filter(Boolean);
  }, [entities, normalizedQuery, rpcRows]);

  const closeSearch = useCallback((clearQuery = true) => {
    setOpen(false);
    if (clearQuery) {
      setQuery('');
    }
    inputRef.current?.blur();
    onVisibilityChange?.(false);
  }, [onVisibilityChange]);

  useEffect(() => {
    if (!isVisible) {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
      return;
    }

    onActivate?.();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isVisible, onActivate]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!isVisible) return;
      if (!containerRef.current?.contains(event.target)) {
        closeSearch(true);
      }
    };

    const handleKeyDown = (event) => {
      if (!isVisible) return;

      if (event.key === 'Escape') {
        closeSearch(true);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeSearch, isVisible]);

  const handleQueryChange = useCallback((nextValue) => {
    setQuery(nextValue);
    startTransition(() => {
      setOpen(true);
    });
  }, []);

  const handleSelect = useCallback((item) => {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    onOpenResult?.(item.appId, {
      globalSearch: {
        token,
        entityKey: item.entityKey,
        entityLabel: item.entityLabel,
        recordId: item.id,
        query,
      },
    });
    closeSearch(true);
  }, [closeSearch, onOpenResult, query]);

  const helperOpen = isVisible && (open || query.length > 0);

  return (
    <RenderProfiler id="GlobalSearchBar" minDuration={6}>
      <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto absolute left-1/2 z-[10005] w-full max-w-4xl -translate-x-1/2 px-4"
          style={{ top: topOffset }}
        >
          <div className="overflow-hidden rounded-[28px] border border-white/15 bg-slate-950/70 shadow-2xl shadow-black/35 backdrop-blur-3xl">
            <Command
              shouldFilter={false}
              className="bg-transparent text-white [&_[cmdk-input-wrapper]]:flex-1 [&_[cmdk-input-wrapper]]:border-0 [&_[cmdk-input-wrapper]]:px-0"
            >
              <div className="flex items-center gap-3 px-4 py-1">
                <CommandInput
                  ref={inputRef}
                  value={query}
                  onValueChange={handleQueryChange}
                  placeholder="Buscar registros em alunos, turmas, disciplinas, comunicados e mais..."
                  data-cy="desktop-global-search"
                  className="h-12 border-0 bg-transparent text-sm text-white placeholder:text-white/45"
                />
              </div>

              {helperOpen && (
                <>
                  <CommandSeparator className="bg-white/10" />
                  <CommandList className="max-h-[420px] overflow-y-auto p-2">
                    {normalizedQuery.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH ? (
                      <div className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-white/75">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/12 text-cyan-300">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">Busca global pronta</p>
                            <p className="text-xs text-white/55">
                              Digite pelo menos {GLOBAL_SEARCH_MIN_QUERY_LENGTH} caracteres para filtrar os registros das entidades ativas.
                            </p>
                          </div>
                        </div>
                        <div className="hidden items-center gap-2 text-xs text-white/45 md:flex">
                          <Search className="h-3.5 w-3.5" />
                          Busca no servidor
                        </div>
                      </div>
                    ) : isLoading ? (
                      <div className="flex items-center justify-center gap-3 py-8 text-sm text-white/70">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Buscando no servidor...
                      </div>
                    ) : isError ? (
                      <div className="py-8 px-4 text-center text-sm text-amber-200/90">
                        Não foi possível completar a busca.
                        {import.meta.env.DEV && error?.message ? (
                          <span className="mt-2 block text-xs text-white/45">{error.message}</span>
                        ) : null}
                      </div>
                    ) : groupedResults.length === 0 ? (
                      <CommandEmpty className="py-8 text-white/65">
                        Nenhum registro encontrado para "{query}".
                      </CommandEmpty>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center justify-between px-2 pt-1 text-[11px] uppercase tracking-[0.16em] text-white/45">
                          <span>
                            {groupedResults.reduce((total, group) => total + group.items.length, 0)} resultado(s)
                          </span>
                          <span>
                            {isFetching ? 'atualizando' : 'servidor'}
                          </span>
                        </div>
                        {groupedResults.map((group) => (
                          <CommandGroup
                            key={group.entity.key}
                            heading={group.entity.label}
                            className="rounded-2xl bg-white/[0.03] p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-white/45"
                          >
                            {group.items.map((item) => {
                              const app = appsById[item.appId];
                              const Icon = app?.icon;

                              return (
                                <CommandItem
                                  key={`${item.entityKey}-${item.id}`}
                                  value={`${item.entityKey}-${item.id}`}
                                  onSelect={() => handleSelect(item)}
                                  className={cn(
                                    'rounded-2xl px-3 py-3 text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white',
                                    'cursor-pointer'
                                  )}
                                >
                                  <div
                                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5"
                                    style={app?.bgColor ? { backgroundColor: `${app.bgColor}cc` } : undefined}
                                  >
                                    {Icon ? (
                                      <Icon
                                        className="h-4 w-4"
                                        style={app?.iconColor ? { color: app.iconColor } : undefined}
                                      />
                                    ) : (
                                      <Search className="h-4 w-4 text-white/60" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="truncate font-medium text-white">{item.title}</p>
                                      {item.meta && (
                                        <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/55">
                                          {item.meta}
                                        </span>
                                      )}
                                    </div>
                                    {item.subtitle && (
                                      <p className="truncate text-xs text-white/55">{item.subtitle}</p>
                                    )}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        ))}
                      </>
                    )}
                  </CommandList>
                </>
              )}
            </Command>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </RenderProfiler>
  );
}

export default memo(GlobalSearchBar);


