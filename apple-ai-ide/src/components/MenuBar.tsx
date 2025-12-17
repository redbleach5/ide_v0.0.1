import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderOpen, 
  Save, 
  SaveAll, 
  Settings, 
  MessageSquare, 
  Zap,
  Search,
  Command
} from 'lucide-react';

interface MenuBarProps {
  onOpenProject: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onOpenSettings: () => void;
  onToggleAIPanel: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onOpenProject,
  onSave,
  onSaveAll,
  onOpenSettings,
  onToggleAIPanel
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const menuItems = [
    {
      id: 'file',
      label: 'Файл',
      items: [
        { label: 'Новый проект', shortcut: '⌘N', icon: FolderOpen, action: () => {} },
        { label: 'Открыть проект', shortcut: '⌘O', icon: FolderOpen, action: onOpenProject },
        { type: 'separator' },
        { label: 'Сохранить', shortcut: '⌘S', icon: Save, action: onSave },
        { label: 'Сохранить всё', shortcut: '⌘⇧S', icon: SaveAll, action: onSaveAll },
      ]
    },
    {
      id: 'edit',
      label: 'Правка',
      items: [
        { label: 'Отменить', shortcut: '⌘Z', action: () => {} },
        { label: 'Повторить', shortcut: '⌘⇧Z', action: () => {} },
        { type: 'separator' },
        { label: 'Вырезать', shortcut: '⌘X', action: () => {} },
        { label: 'Копировать', shortcut: '⌘C', action: () => {} },
        { label: 'Вставить', shortcut: '⌘V', action: () => {} },
        { label: 'Выделить всё', shortcut: '⌘A', action: () => {} },
      ]
    },
    {
      id: 'ai',
      label: 'ИИ',
      items: [
        { label: 'Чат с ИИ', shortcut: '⌘⇧/', icon: MessageSquare, action: onToggleAIPanel },
        { label: 'Сгенерировать код', shortcut: '⌘⇧G', icon: Zap, action: () => {} },
        { label: 'Анализировать проект', shortcut: '⌘⇧A', icon: Search, action: () => {} },
      ]
    },
    {
      id: 'view',
      label: 'Вид',
      items: [
        { label: 'Полноэкранный режим', shortcut: 'F11', action: () => {} },
        { label: 'Инструменты разработчика', shortcut: 'F12', action: () => {} },
        { type: 'separator' },
        { label: 'Увеличить', shortcut: '⌘=', action: () => {} },
        { label: 'Уменьшить', shortcut: '⌘-', action: () => {} },
        { label: 'Сбросить масштаб', shortcut: '⌘0', action: () => {} },
      ]
    }
  ];

  const handleMenuClick = (menuId: string) => {
    setActiveMenu(activeMenu === menuId ? null : menuId);
  };

  const handleMenuItemClick = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  return (
    <>
      <div 
        style={{
          height: '28px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          userSelect: 'none',
          ...({ WebkitAppRegion: 'drag' } as React.CSSProperties)
        } as React.CSSProperties}
      >
        <div style={{ display: 'flex', gap: '4px', ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) } as React.CSSProperties}>
          {menuItems.map((menu) => (
            <div key={menu.id} style={{ position: 'relative' }}>
              <button
                className="btn btn-ghost"
                style={{
                  height: '24px',
                  padding: '0 8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  backgroundColor: activeMenu === menu.id ? 'var(--bg-active)' : 'transparent',
                  color: activeMenu === menu.id ? 'var(--text-primary)' : 'var(--text-primary)'
                }}
                onClick={() => handleMenuClick(menu.id)}
              >
                {menu.label}
              </button>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: '8px', ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) } as React.CSSProperties}>
          <button
            className="btn btn-ghost"
            style={{ height: '24px', padding: '0 8px' }}
            onClick={onToggleAIPanel}
            title="Переключить панель ИИ (⌘⇧/)"
          >
            <MessageSquare size={14} />
          </button>
          
          <button
            className="btn btn-ghost"
            style={{ height: '24px', padding: '0 8px' }}
            onClick={onOpenSettings}
            title="Настройки"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {activeMenu && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '28px',
              left: '8px',
              zIndex: 1000,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-xl)',
              padding: '4px 0',
              minWidth: '200px'
            }}
          >
            {menuItems
              .find(menu => menu.id === activeMenu)
              ?.items.map((item, index) => {
                if (item.type === 'separator') {
                  return (
                    <div
                      key={`separator-${index}`}
                      style={{
                        height: '1px',
                        backgroundColor: 'var(--border-subtle)',
                        margin: '4px 8px'
                      }}
                    />
                  );
                }

                const Icon = 'icon' in item ? item.icon : undefined;
                return (
                  <button
                    key={item.label}
                    className="btn btn-ghost"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '6px 12px',
                      gap: '8px',
                      fontSize: '13px'
                    }}
                    onClick={() => 'action' in item && item.action && handleMenuItemClick(item.action)}
                  >
                    {Icon && <Icon size={14} />}
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                    {item.shortcut && (
                      <span style={{ 
                        fontSize: '11px', 
                        color: 'var(--text-tertiary)',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
          </motion.div>
        )}
      </AnimatePresence>

      {activeMenu && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999
          }}
          onClick={() => setActiveMenu(null)}
        />
      )}
    </>
  );
};