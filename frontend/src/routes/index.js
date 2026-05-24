/**
 * pages.config.js - Page routing configuration
 *
 * Page components are lazy-loaded via ../lib/appRegistry.js.
 * To change the landing page, edit mainPage (must match a key in appRegistry).
 */
import appRegistry from '../lib/appRegistry';
import __Layout from '../Layout.jsx';

export const PAGES = appRegistry;

export const pagesConfig = {
    mainPage: "Desktop",
    Pages: appRegistry,
    Layout: __Layout,
};
