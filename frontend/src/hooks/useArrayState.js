import { useState, useCallback } from 'react';

/**
 * Hook para gerenciar arrays com operações comuns, eliminando duplicações de setState(prev => prev.map/filter).
 */
export function useArrayState(initialValue = []) {
  const [array, setArray] = useState(initialValue);

  const updateById = useCallback((id, updater) => {
    setArray(prev => prev.map(item => item.id === id ? updater(item) : item));
  }, []);

  const upsert = useCallback((newItem) => {
    setArray(prev => {
      const index = prev.findIndex(item => item.id === newItem.id);
      if (index > -1) {
        const updated = [...prev];
        updated[index] = { ...updated[index], ...newItem };
        return updated;
      }
      return [...prev, newItem];
    });
  }, []);

  const toggleItem = useCallback((value) => {
    setArray(prev => {
      const index = prev.findIndex(item => item === value);
      if (index > -1) {
        return prev.filter(item => item !== value);
      }
      return [...prev, value];
    });
  }, []);

  const removeById = useCallback((id) => {
    setArray(prev => prev.filter(item => item.id !== id));
  }, []);

  const setFiltered = useCallback((predicate) => {
    setArray(prev => prev.filter(predicate));
  }, []);

  return {
    array,
    setArray,
    updateById,
    upsert,
    toggleItem,
    removeById,
    setFiltered,
  };
}
