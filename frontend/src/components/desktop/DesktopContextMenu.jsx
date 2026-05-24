import React, { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Context ──────────────────────────────────────────────────────────────────

const ContextMenuCtx = createContext(null);

export function useContextMenu() {
  return useContext(ContextMenuCtx);
}

// ─── Provider (opcional – use quando quiser um único menu global) ──────────────

export function DesktopContextMenuProvider({ children }) {
  const [menu, setMenu] = useState(null); // { x, y, items }

  const open = useCallback((x, y, items) => {
    setMenu({ x, y, items });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  return (
    <ContextMenuCtx.Provider value={{ open, close }}>
      {children}
      <DesktopContextMenu menu={menu} onClose={close} />
    </ContextMenuCtx.Provider>
  );
}

// ─── Menu standalone (controlado externamente) ────────────────────────────────

/**
 * items: Array of:
 *   { label, icon?: ReactNode, onClick, disabled?, danger?, separator?: true }
 */
export function DesktopContextMenu({ menu, onClose }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Ajusta posição para não sair do viewport
  useEffect(() => {
    if (!menu || !menuRef.current) return;

    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TASKBAR = 48; // altura da taskbar fixa no fundo
    const PAD = 6;

    let x = menu.x;
    let y = menu.y;

    if (x + rect.width + PAD > vw) x = vw - rect.width - PAD;
    if (x < PAD) x = PAD;
    if (y + rect.height + PAD > vh - TASKBAR) y = vh - TASKBAR - rect.height - PAD;
    if (y < PAD) y = PAD;

    setPos({ x, y });
  }, [menu]);

  // Fecha ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (!menu) return;

    const handleDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };

    // Pequeno atraso para não capturar o próprio clique que abriu o menu
    const timeout = setTimeout(() => {
      window.addEventListener('pointerdown', handleDown, true);
      window.addEventListener('keydown', handleKey, true);
    }, 10);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('pointerdown', handleDown, true);
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [menu, onClose]);

  // Inicializa pos quando o menu abre
  useEffect(() => {
    if (menu) setPos({ x: menu.x, y: menu.y });
  }, [menu]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {menu && (
        <motion.div
          ref={menuRef}
          key="ctx-menu"
          initial={{ opacity: 0, scale: 0.92, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -4 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="fixed z-[99999] min-w-[190px] rounded-xl border border-white/10 bg-slate-950 shadow-[0_20px_50px_rgba(2,6,23,0.65)] overflow-hidden py-1 select-none"
          style={{ left: pos.x, top: pos.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menu.items.map((item, i) => {
            if (item.separator) {
              return <div key={`sep-${i}`} className="my-1 h-px bg-white/10 mx-2" />;
            }

            return (
              <button
                key={`item-${i}`}
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) {
                    onClose();
                    item.onClick?.();
                  }
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors
                  ${item.disabled
                    ? 'text-white/30 cursor-default'
                    : item.danger
                      ? 'text-rose-400 hover:bg-rose-500/15 hover:text-rose-300'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                {item.icon && (
                  <span className={`flex-shrink-0 w-4 h-4 ${item.danger ? 'text-rose-400' : 'text-white/50'}`}>
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="ml-4 text-xs text-white/30 font-mono">{item.shortcut}</span>
                )}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
