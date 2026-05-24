// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
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
