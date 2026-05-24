import React, { memo, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ExternalLink, Pin, PinOff, Trash2, Info } from 'lucide-react';
import { DesktopContextMenu } from '@/components/desktop/DesktopContextMenu';

function DesktopIcon({ app, onOpen, onRemove, onPin, isPinned, initialPosition, onPositionChange, dragConstraintsRef }) {
  const [selected, setSelected] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y }
  const dragStartPos = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  const accessEntries = Array.isArray(app.roles) && app.roles.length > 0
    ? app.roles
    : Array.isArray(app.permissions)
      ? app.permissions
      : [];
  const accessLabel = Array.isArray(app.roles) && app.roles.length > 0
    ? 'Perfis com Acesso:'
    : 'Permissões de Acesso:';

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(true);
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const ctxItems = [
    {
      label: 'Abrir',
      icon: <ExternalLink className="w-4 h-4" />,
      onClick: () => { onOpen(app.id); setSelected(false); },
    },
    { separator: true },
    {
      label: isPinned ? 'Remover da Barra' : 'Fixar na Barra',
      icon: isPinned
        ? <PinOff className="w-4 h-4" />
        : <Pin className="w-4 h-4" />,
      onClick: () => onPin?.(app.id),
      disabled: !onPin,
    },
    {
      label: 'Remover Ícone',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => { onRemove?.(app.id); },
      disabled: !onRemove,
      danger: true,
    },
    { separator: true },
    {
      label: 'Propriedades',
      icon: <Info className="w-4 h-4" />,
      onClick: () => setPropertiesOpen(true),
    },
  ];

  return (
    <>
    <motion.div
      drag
      dragMomentum={false}
      dragConstraints={dragConstraintsRef || undefined}
      dragElastic={0.1}
      animate={initialPosition}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ position: 'absolute', cursor: dragging ? 'grabbing' : 'grab', zIndex: dragging ? 50 : selected ? 10 : 5 }}
      onDragStart={(e, info) => {
        didDrag.current = false;
        setDragging(true);
        dragStartPos.current = { x: info.point.x, y: info.point.y };
      }}
      onDrag={(e, info) => {
        const dx = Math.abs(info.point.x - dragStartPos.current.x);
        const dy = Math.abs(info.point.y - dragStartPos.current.y);
        if (dx > 5 || dy > 5) didDrag.current = true;
      }}
      onDragEnd={(e, info) => {
        setDragging(false);
        if (onPositionChange) {
          const containerRect = dragConstraintsRef?.current?.getBoundingClientRect?.();
          const iconRect = e.currentTarget?.getBoundingClientRect?.();

          if (containerRect && iconRect) {
            onPositionChange(app.id, {
              x: iconRect.left - containerRect.left,
              y: iconRect.top - containerRect.top,
            });
            return;
          }

          onPositionChange(app.id, { x: info.point.x - 44, y: info.point.y - 44 });
        }
      }}
      onClick={() => {
        if (didDrag.current) return;
        setSelected(s => !s);
      }}
      onDoubleClick={() => {
        if (didDrag.current) return;
        onOpen(app.id);
        setSelected(false);
      }}
      onContextMenu={handleContextMenu}
    >
      <div className={`flex flex-col items-center gap-1 p-2 rounded-xl w-20 transition-all select-none ${
        selected ? 'bg-white/25' : dragging ? 'bg-white/20 scale-105' : 'hover:bg-white/10'
      }`}>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: app.bgColor || 'rgba(255,255,255,0.15)' }}
        >
          {app.icon && <app.icon className="w-7 h-7" style={{ color: app.iconColor || 'white' }} />}
        </div>
        <span
          className="text-white text-xs text-center leading-tight font-medium w-full"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
        >
          {app.title}
        </span>
      </div>
    </motion.div>

    {/* Context Menu customizado */}
    <DesktopContextMenu
      menu={ctxMenu ? { ...ctxMenu, items: ctxItems } : null}
      onClose={closeCtxMenu}
    />

    {/* @ts-ignore */}
    <Dialog open={propertiesOpen} onOpenChange={setPropertiesOpen}>
      {/* @ts-ignore */}
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-[400px]">
        {/* @ts-ignore */}
        <DialogHeader>
          <div 
            className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-black/50"
            style={{ background: app.bgColor || 'rgba(255,255,255,0.15)' }}
          >
            {app.icon && <app.icon className="w-7 h-7" style={{ color: app.iconColor || 'white' }} />}
          </div>
          <DialogTitle className="text-center text-xl">{app.title}</DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            Propriedades do Módulo
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4 text-sm text-slate-300">
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-500">ID do Módulo</span>
            <span className="font-mono text-indigo-300">{app.id}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-500">Página Destino</span>
            <span className="font-mono">{app.page}.jsx</span>
          </div>
          <div className="flex flex-col gap-2 py-2 border-b border-slate-800">
            <span className="text-slate-500">{accessLabel}</span>
            <div className="flex flex-wrap gap-1">
{accessEntries.length > 0 ? accessEntries.map((entry, index) => (
                <span key={`${entry || 'empty'}-${index}`} className="bg-slate-800 px-2 py-0.5 rounded text-xs font-medium text-slate-300">
                  {entry}
                </span>
              )) : (
                <span className="bg-slate-800 px-2 py-0.5 rounded text-xs font-medium text-slate-400">
                  Sem regra declarada
                </span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default memo(DesktopIcon);
