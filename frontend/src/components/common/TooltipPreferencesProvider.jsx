import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import { AppSettingsApi } from '@/services/supabaseApi';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';
import {
  SYSTEM_SETTINGS_STORAGE_KEY,
  SYSTEM_SETTINGS_UPDATED_EVENT,
  buildSystemSettingsRecord,
  isSettingsRecordMissing,
  isSettingsTableUnavailable,
  mapSystemSettingsRecord,
  readSystemSettingsFromStorage,
  writeSystemSettingsToStorage,
} from '@shared/contracts/settings';

const TOOLTIP_SELECTOR = 'button, [role="button"], [role="switch"], [data-tooltip]';
const TOOLTIP_TITLE_SELECTOR = 'button[title], [role="button"][title], [role="switch"][title], [data-tooltip][title]';
const TOOLTIP_OFFSET = 10;
const TOOLTIP_VIEWPORT_PADDING = 8;

const TooltipPreferencesContext = createContext({
  tooltipsEnabled: true,
  setTooltipsEnabled: async () => true,
  toggleTooltips: async () => true,
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeTooltipLabel(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function isDisabledElement(target) {
  if (!(target instanceof HTMLElement)) return true;
  if ('disabled' in target && target.disabled) return true;
  return target.getAttribute('aria-disabled') === 'true';
}

function getTooltipTarget(node) {
  if (!(node instanceof Element)) return null;

  const target = node.closest(TOOLTIP_SELECTOR);
  if (!(target instanceof HTMLElement) || isDisabledElement(target)) {
    return null;
  }

  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return target;
}

function getLabelledByText(target) {
  const labelledBy = target.getAttribute('aria-labelledby');
  if (!labelledBy) return '';

  return normalizeTooltipLabel(
    labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || '')
      .filter(Boolean)
      .join(' '),
  );
}

function getExternalLabelText(target) {
  if (!target.id) return '';

  const label = Array.from(document.querySelectorAll('label')).find(
    (item) => item.htmlFor === target.id,
  );

  return normalizeTooltipLabel(label?.textContent || '');
}

function getSwitchLabelText(target) {
  const container = target.closest('label, [data-tooltip-context], .flex, .grid, .space-y-2, .space-y-4');
  if (!(container instanceof HTMLElement)) return '';

  const candidates = Array.from(
    container.querySelectorAll('label, p, span, strong, h1, h2, h3, h4, h5, h6'),
  );

  for (const candidate of candidates) {
    if (!(candidate instanceof HTMLElement) || candidate.contains(target)) continue;

    const text = normalizeTooltipLabel(candidate.textContent || '');
    if (text) return text;
  }

  return '';
}

function getTooltipLabel(target) {
  const directLabel = normalizeTooltipLabel(target.dataset.tooltip)
    || normalizeTooltipLabel(target.getAttribute('aria-label'))
    || normalizeTooltipLabel(target.getAttribute('title'))
    || normalizeTooltipLabel(target.dataset.tooltipOriginalTitle)
    || getLabelledByText(target)
    || getExternalLabelText(target)
    || normalizeTooltipLabel(target.innerText || target.textContent || '');

  if (directLabel) return directLabel;

  if (target.getAttribute('role') === 'switch') {
    return getSwitchLabelText(target);
  }

  return '';
}

function GlobalButtonTooltip({ enabled }) {
  const tooltipRef = useRef(null);
  const activeTargetRef = useRef(null);
  const [tooltip, setTooltip] = useState({
    label: '',
    target: null,
    left: -10000,
    top: -10000,
  });

  const hideTooltip = useCallback(() => {
    activeTargetRef.current = null;
    setTooltip((current) => {
      if (!current.target && !current.label) return current;
      return {
        label: '',
        target: null,
        left: -10000,
        top: -10000,
      };
    });
  }, []);

  const showTooltip = useCallback((target) => {
    if (!(target instanceof HTMLElement)) {
      hideTooltip();
      return;
    }

    const label = getTooltipLabel(target);
    if (!label) {
      hideTooltip();
      return;
    }

    activeTargetRef.current = target;
    setTooltip({
      label,
      target,
      left: -10000,
      top: -10000,
    });
  }, [hideTooltip]);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined;

    const suppressNativeTitle = (element) => {
      if (!(element instanceof HTMLElement)) return;

      const title = element.getAttribute('title');
      if (!title) return;

      if (!element.dataset.tooltipOriginalTitle) {
        element.dataset.tooltipOriginalTitle = title;
      }

      element.removeAttribute('title');
    };

    const restoreNativeTitle = (element) => {
      if (!(element instanceof HTMLElement)) return;
      if (!element.dataset.tooltipOriginalTitle) return;

      element.setAttribute('title', element.dataset.tooltipOriginalTitle);
      delete element.dataset.tooltipOriginalTitle;
    };

    const processNode = (node) => {
      if (!(node instanceof HTMLElement)) return;

      if (node.matches(TOOLTIP_TITLE_SELECTOR)) {
        suppressNativeTitle(node);
      }

      node.querySelectorAll(TOOLTIP_TITLE_SELECTOR).forEach(suppressNativeTitle);
    };

    processNode(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          suppressNativeTitle(mutation.target);
          return;
        }

        mutation.addedNodes.forEach(processNode);
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['title'],
    });

    return () => {
      observer.disconnect();
      document.querySelectorAll('[data-tooltip-original-title]').forEach(restoreNativeTitle);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      hideTooltip();
      return undefined;
    }

    const handlePointerOver = (event) => {
      showTooltip(getTooltipTarget(event.target));
    };

    const handlePointerOut = (event) => {
      const currentTarget = getTooltipTarget(event.target);
      if (!currentTarget || activeTargetRef.current !== currentTarget) return;

      const relatedTarget = getTooltipTarget(event.relatedTarget);
      if (relatedTarget === currentTarget) return;

      hideTooltip();
    };

    const handleFocusIn = (event) => {
      showTooltip(getTooltipTarget(event.target));
    };

    const handleFocusOut = (event) => {
      const currentTarget = getTooltipTarget(event.target);
      if (!currentTarget || activeTargetRef.current !== currentTarget) return;

      const relatedTarget = getTooltipTarget(event.relatedTarget);
      if (relatedTarget === currentTarget) return;

      hideTooltip();
    };

    const handleViewportChange = () => hideTooltip();

    document.addEventListener('pointerover', handlePointerOver, true);
    document.addEventListener('pointerout', handlePointerOut, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    document.addEventListener('pointerdown', handleViewportChange, true);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      document.removeEventListener('pointerover', handlePointerOver, true);
      document.removeEventListener('pointerout', handlePointerOut, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      document.removeEventListener('pointerdown', handleViewportChange, true);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [enabled, hideTooltip, showTooltip]);

  useLayoutEffect(() => {
    if (!enabled || !tooltip.target || !tooltip.label || !tooltipRef.current) return;

    const targetRect = tooltip.target.getBoundingClientRect();
    const bubbleRect = tooltipRef.current.getBoundingClientRect();
    const fitsOnTop = targetRect.top >= bubbleRect.height + TOOLTIP_OFFSET + TOOLTIP_VIEWPORT_PADDING;
    const top = fitsOnTop
      ? targetRect.top - bubbleRect.height - TOOLTIP_OFFSET
      : targetRect.bottom + TOOLTIP_OFFSET;
    const maxLeft = window.innerWidth - bubbleRect.width - TOOLTIP_VIEWPORT_PADDING;
    const left = clamp(
      targetRect.left + targetRect.width / 2 - bubbleRect.width / 2,
      TOOLTIP_VIEWPORT_PADDING,
      Math.max(TOOLTIP_VIEWPORT_PADDING, maxLeft),
    );

    setTooltip((current) => {
      if (
        current.left === left
        && current.top === top
        && current.target === tooltip.target
        && current.label === tooltip.label
      ) {
        return current;
      }

      return {
        ...current,
        left,
        top,
      };
    });
  }, [enabled, tooltip.label, tooltip.target]);

  if (!enabled || !tooltip.target || !tooltip.label || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={tooltipRef}
      aria-hidden="true"
      className="pointer-events-none fixed z-[2147483646] rounded-md border border-slate-800/80 bg-slate-950/95 px-3 py-1.5 text-xs font-medium text-white shadow-[0_18px_40px_rgba(15,23,42,0.42)] animate-in fade-in-0 zoom-in-95"
      style={{
        left: `${tooltip.left}px`,
        top: `${tooltip.top}px`,
      }}
    >
      {tooltip.label}
    </div>,
    document.body,
  );
}

export function TooltipPreferencesProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [tooltipsEnabled, setTooltipsEnabledState] = useState(
    () => readSystemSettingsFromStorage().enableTooltips,
  );
  const tooltipsEnabledRef = useRef(tooltipsEnabled);
  const syncedFromServerRef = useRef(false);

  useEffect(() => {
    tooltipsEnabledRef.current = tooltipsEnabled;
  }, [tooltipsEnabled]);

  useEffect(() => {
    const handleSettingsUpdated = (event) => {
      const nextSettings = event?.detail || readSystemSettingsFromStorage();
      setTooltipsEnabledState(Boolean(nextSettings.enableTooltips));
    };

    const handleStorage = (event) => {
      if (event.key && event.key !== SYSTEM_SETTINGS_STORAGE_KEY) return;
      setTooltipsEnabledState(readSystemSettingsFromStorage().enableTooltips);
    };

    window.addEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      syncedFromServerRef.current = false;
      return;
    }

    if (syncedFromServerRef.current) return;
    syncedFromServerRef.current = true;

    let active = true;

    const syncFromServer = async () => {
      try {
        const record = await AppSettingsApi.getOptional('system');
        if (!active || !record) return;

        const normalized = writeSystemSettingsToStorage(mapSystemSettingsRecord(record));
        setTooltipsEnabledState(normalized.enableTooltips);
      } catch (error) {
        if (isSettingsRecordMissing(error) || isSettingsTableUnavailable(error)) return;
        console.warn('[TooltipPreferencesProvider] Falha ao sincronizar configuracao de tooltip.', error);
      }
    };

    void syncFromServer();

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const persistTooltipsEnabled = useCallback(async (nextValue, options = {}) => {
    const { announce = false, syncServer = true } = options;
    const nextEnabled = Boolean(nextValue);
    const nextSettings = writeSystemSettingsToStorage({
      ...readSystemSettingsFromStorage(),
      enableTooltips: nextEnabled,
    });

    setTooltipsEnabledState(nextSettings.enableTooltips);

    if (syncServer && isAuthenticated) {
      try {
        await AppSettingsApi.upsert(buildSystemSettingsRecord(nextSettings), { onConflict: 'id' });
      } catch (error) {
        if (!isSettingsRecordMissing(error) && !isSettingsTableUnavailable(error)) {
          console.warn('[TooltipPreferencesProvider] Falha ao salvar configuracao de tooltip no servidor.', error);
        }
      }
    }

    if (announce) {
      toast.success(nextEnabled ? 'Tooltips ativados.' : 'Tooltips desativados.');
    }

    return nextSettings.enableTooltips;
  }, [isAuthenticated]);

  const toggleTooltips = useCallback((options = {}) => (
    persistTooltipsEnabled(!tooltipsEnabledRef.current, options)
  ), [persistTooltipsEnabled]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'y') return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      event.stopPropagation();
      void toggleTooltips({ announce: true });
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [toggleTooltips]);

  const contextValue = useMemo(() => ({
    tooltipsEnabled,
    setTooltipsEnabled: persistTooltipsEnabled,
    toggleTooltips,
  }), [persistTooltipsEnabled, toggleTooltips, tooltipsEnabled]);

  return (
    <TooltipProvider delayDuration={160}>
      <TooltipPreferencesContext.Provider value={contextValue}>
        {children}
        <GlobalButtonTooltip enabled={tooltipsEnabled} />
      </TooltipPreferencesContext.Provider>
    </TooltipProvider>
  );
}

export function useTooltipPreferences() {
  return useContext(TooltipPreferencesContext);
}
