import { lazy } from 'react';
import { ALL_APP_ENTRIES } from '@/lib/appManifest';

/**
 * appRegistry.js — Registro de componentes lazy-loaded.
 *
 * Derivado automaticamente de appManifest.js.
 * Cada chave é o `page` da entrada do manifesto; o valor é um React.lazy.
 *
 * NÃO edite este arquivo manualmente — adicione apps em appManifest.js.
 */
const appRegistry = Object.fromEntries(
  ALL_APP_ENTRIES.map(app => [app.page, lazy(app.load)])
);

// Desktop é rota especial não listada no manifesto de apps
appRegistry.Desktop = lazy(() => import('@/pages/Desktop'));

// StudentEnrollment é página auxiliar de rota, não um app do desktop
appRegistry.StudentEnrollment = lazy(() => import('@/pages/StudentEnrollment'));

export default appRegistry;

