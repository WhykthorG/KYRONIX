// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
/**
 * Utilitários para eliminar duplicações comuns no projeto.
 * Importe como: import { cn, countByStatus, ... } from '@/lib/utils';
 */

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge de classes Tailwind (shadcn/ui). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Conta itens por status (substitui array.filter(item => item.status === status).length)
 * @param {Array} array - Array de objetos com 'status'
 * @param {string} status - Status a contar
 * @returns {number}
 */
export const countByStatus = (array, status) => array.filter((item) => item.status === status).length;

/**
 * Atualiza item em array por ID (substitui manual map/find)
 * @param {Array} array - Array atual
 * @param {string} id - ID do item
 * @param {function} updater - Função (item) => newItem
 * @returns {Array} Novo array
 */
export const updateArrayItemById = (array, id, updater) => array.map((item) => (item.id === id ? updater(item) : item));

/**
 * Toggle item em array (para checkboxes/channels)
 * @param {Array} array - Array atual
 * @param {string} value - Item a toggle
 * @returns {Array} Novo array
 */
export const toggleArrayItem = (array, value) => {
  return array.includes(value)
    ? array.filter(item => item !== value)
    : [...array, value];
};

/**
 * Verifica session flag segura (substitui sessionStorage.getItem(key) === 'true')
 * @param {string} key - Chave
 * @param {boolean} [defaultValue=false] - Default
 * @returns {boolean}
 */
export const safeSessionFlag = (key, defaultValue = false) => {
  try {
    return sessionStorage.getItem(key) === 'true';
  } catch {
    return defaultValue;
  }
};

/**
 * Encontra por prop (genérico)
 * @param {Array} array
 * @param {string} prop
 * @param {any} value
 * @returns {object|null}
 */
export const findByProp = (array, prop, value) => array.find(item => item[prop] === value) || null;

/**
 * Empty state checker (para {length === 0 && (...)})
 * @param {Array} array
 * @returns {boolean}
 */
export const isEmpty = (array) => !array || array.length === 0;
