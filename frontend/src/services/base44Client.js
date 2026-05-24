/**
 * base44Client.js — compatibility shim
 *
 * Every page and component that does:
 *   import { base44 } from '@/services/base44Client';
 * will now silently use Supabase instead of the old Base44 SDK.
 * No other files need to change.
 */
export { base44, default } from './supabaseApi';
