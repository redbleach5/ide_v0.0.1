import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareIcon, SettingsIcon, TerminalIcon } from './Icons';
import { HelpCircle, FolderOpen, Save, SaveAll, MessageSquare, Zap, Search, RotateCcw, RotateCw, Scissors, Copy, Clipboard, MousePointer, FileText, Edit, Bot, Eye } from 'lucide-react';

interface MenuBarProps {
  onOpenProject: (projectPath?: string) => void | Promise<void>;
  onSave: () => void;
  onSaveAll: () => void;
  onOpenSettings: () => void;
  onToggleAIPanel: () => void;
  onToggleTerminal?: () => void;
  onNewProject?: () => void;
  onReload?: () => void;
  onToggleDevTools?: () => void;
}

export const MenuBarSimple: React.FC<MenuBarProps> = ({
  onOpenProject,
  onSave,
  onSaveAll,
  onOpenSettings,
  onToggleAIPanel,
  onToggleTerminal,
  onNewProject,
  onReload,
  onToggleDevTools
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const menuOpenedTimeRef = useRef<number>(0); // Время открытия меню для предотвращения немедленного закрытия
  
  // Определяем платформу для отображения правильных горячих клавиш
  const isMac = typeof window !== 'undefined' && (
    (window.versions && window.versions.platform === 'darwin') ||
    navigator.platform.toUpperCase().indexOf('MAC') >= 0
  );
  const cmdKey = isMac ? '⌘' : 'Ctrl';
  const shiftKey = isMac ? '⇧' : 'Shift';
  
  // На macOS с hiddenInset title bar нужно добавить отступ для traffic light кнопок
  const macTrafficLightsWidth = isMac ? 78 : 0; // Примерная ширина traffic lights + отступ

  const menuItems = [
    {
      id: 'file',
      label: 'Файл',
      icon: FileText, // Иконка для кнопки меню
      items: [
        { 
          label: 'Новый проект', 
          shortcut: `${cmdKey}N`, 
          icon: FolderOpen, 
          action: () => {
            if (onNewProject) {
              try {
                onNewProject();
              } catch (error) {
                console.error('Error calling onNewProject:', error);
              }
            }
          } 
        },
        { 
          label: 'Открыть проект', 
          shortcut: `${cmdKey}O`, 
          icon: FolderOpen, 
          action: () => {
            try {
              onOpenProject();
            } catch (error) {
              console.error('Error opening project:', error);
            }
          } 
        },
        { type: 'separator' },
        { 
          label: 'Сохранить', 
          shortcut: `${cmdKey}S`, 
          icon: Save, 
          action: onSave 
        },
        { 
          label: 'Сохранить всё', 
          shortcut: `${cmdKey}${shiftKey}S`, 
          icon: SaveAll, 
          action: onSaveAll 
        },
      ]
    },
    {
      id: 'edit',
      label: 'Правка',
      icon: Edit, // Иконка для кнопки меню
      items: [
        { 
          label: 'Отменить', 
          shortcut: `${cmdKey}Z`, 
          icon: RotateCcw, 
          action: () => {
            document.execCommand('undo');
          } 
        },
        { 
          label: 'Повторить', 
          shortcut: `${cmdKey}${shiftKey}Z`, 
          icon: RotateCw, 
          action: () => {
            document.execCommand('redo');
          } 
        },
        { type: 'separator' },
        { 
          label: 'Вырезать', 
          shortcut: `${cmdKey}X`, 
          icon: Scissors, 
          action: () => {
            document.execCommand('cut');
          } 
        },
        { 
          label: 'Копировать', 
          shortcut: `${cmdKey}C`, 
          icon: Copy, 
          action: () => {
            document.execCommand('copy');
          } 
        },
        { 
          label: 'Вставить', 
          shortcut: `${cmdKey}V`, 
          icon: Clipboard, 
          action: () => {
            document.execCommand('paste');
          } 
        },
        { 
          label: 'Выделить всё', 
          shortcut: `${cmdKey}A`, 
          icon: MousePointer, 
          action: () => {
            document.execCommand('selectAll');
          } 
        },
      ]
    },
    {
      id: 'ai',
      label: 'ИИ',
      icon: Bot, // Иконка для кнопки меню
      items: [
        { 
          label: 'Чат с ИИ', 
          shortcut: `${cmdKey}${shiftKey}/`, 
          icon: MessageSquare, 
          action: onToggleAIPanel 
        },
        { 
          label: 'Сгенерировать код', 
          shortcut: `${cmdKey}${shiftKey}G`, 
          icon: Zap, 
          action: () => {
            onToggleAIPanel();
            // Можно добавить автоматический переход в режим генерации
          } 
        },
        { 
          label: 'Анализировать проект', 
          shortcut: `${cmdKey}${shiftKey}A`, 
          icon: Search, 
          action: () => {
            onToggleAIPanel();
            // Можно добавить автоматический переход в режим анализа
          } 
        },
      ]
    },
    {
      id: 'view',
      label: 'Вид',
      icon: Eye, // Иконка для кнопки меню
      items: [
        {
          label: 'Терминал',
          shortcut: `${cmdKey}${shiftKey}\``,
          icon: TerminalIcon,
          action: () => {
            if (onToggleTerminal) onToggleTerminal();
          }
        },
        { type: 'separator' },
        { 
          label: 'Перезагрузить', 
          shortcut: `${cmdKey}R`, 
          action: () => {
            if (onReload) {
              onReload();
            } else {
              window.location.reload();
            }
          } 
        },
        { 
          label: 'Инструменты разработчика', 
          shortcut: 'F12', 
          action: () => {
            if (onToggleDevTools) {
              onToggleDevTools();
            } else if (window.electronAPI && (window.electronAPI as any).toggleDevTools) {
              // Используем метод из electronAPI
              (window.electronAPI as any).toggleDevTools();
            }
          } 
        },
        { type: 'separator' },
        { 
          label: 'Фактический размер', 
          shortcut: `${cmdKey}0`, 
          action: () => {
            if (window.electronAPI && (window.electronAPI as any).webContents) {
              // В Electron используем webContents.zoomLevel
              (window as any).electronAPI.webContents.setZoomLevel(0);
            } else {
              // В браузере используем CSS zoom (не стандартное свойство, но работает)
              (document.body.style as any).zoom = '1';
            }
          } 
        },
        { 
          label: 'Увеличить', 
          shortcut: `${cmdKey}=`, 
          action: () => {
            if (window.electronAPI && (window.electronAPI as any).webContents) {
              const current = (window as any).electronAPI.webContents.getZoomLevel() || 0;
              (window as any).electronAPI.webContents.setZoomLevel(current + 0.5);
            } else {
              const currentZoom = parseFloat((getComputedStyle(document.body) as any).zoom) || 1;
              (document.body.style as any).zoom = String(currentZoom + 0.1);
            }
          } 
        },
        { 
          label: 'Уменьшить', 
          shortcut: `${cmdKey}-`, 
          action: () => {
            if (window.electronAPI && (window.electronAPI as any).webContents) {
              const current = (window as any).electronAPI.webContents.getZoomLevel() || 0;
              (window as any).electronAPI.webContents.setZoomLevel(Math.max(-2, current - 0.5));
            } else {
              const currentZoom = parseFloat((getComputedStyle(document.body) as any).zoom) || 1;
              (document.body.style as any).zoom = String(Math.max(0.5, currentZoom - 0.1));
            }
          } 
        },
        { type: 'separator' },
        { 
          label: 'Полноэкранный режим', 
          shortcut: 'F11', 
          action: () => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen();
            }
          } 
        },
      ]
    }
  ];

  const handleMenuClick = (menuId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (activeMenu === menuId) {
      // Если меню уже открыто, закрываем его
      menuOpenedTimeRef.current = 0; // Сбрасываем время открытия
      setActiveMenu(null);
      setMenuPosition(null);
    } else {
      // Получаем позицию кнопки для правильного позиционирования меню
      const button = menuButtonRefs.current[menuId];
      if (button) {
        const rect = button.getBoundingClientRect();
        const position = {
          left: rect.left,
          top: rect.bottom + 2
        };
        setMenuPosition(position);
        setActiveMenu(menuId);
        // Запоминаем время открытия меню
        menuOpenedTimeRef.current = Date.now();
      } else {
        // Всё равно открываем меню с дефолтной позицией
        setMenuPosition({
          left: 80 + macTrafficLightsWidth,
          top: 30
        });
        setActiveMenu(menuId);
      }
    }
  };

  // Эта функция больше не используется напрямую, но оставлена для совместимости
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMenuItemClick = (action: () => void) => {
    try {
      action();
    } catch (error) {
      console.error('Error in menu action:', error);
    }
    
    // Закрываем меню после выполнения действия
    // Используем requestAnimationFrame чтобы дать React время обновить состояние перед закрытием меню
    requestAnimationFrame(() => {
      setActiveMenu(null);
      setMenuPosition(null);
    });
  };

  // Закрываем меню при клике вне его
  useEffect(() => {
    if (!activeMenu) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isClickInMenu = target.closest('[data-menu-dropdown]') !== null;
      const isClickOnMenuButton = target.closest('[data-menu-button]') !== null;
      
      // Не закрываем меню, если клик внутри меню или на кнопке меню
      if (isClickInMenu || isClickOnMenuButton) {
        return;
      }
      
      // Закрываем меню при клике вне его
      const timeSinceOpen = Date.now() - menuOpenedTimeRef.current;
      // Не закрываем меню, если оно открылось менее 200ms назад
      if (timeSinceOpen < 200) {
        return;
      }
      
      setActiveMenu(null);
      setMenuPosition(null);
    };
    
    // Добавляем обработчик с небольшой задержкой, чтобы не закрыть сразу после открытия
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true); // Используем capture phase
    }, 200);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [activeMenu]);
  
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
          paddingLeft: `${8 + macTrafficLightsWidth}px`, // Отступ для macOS traffic lights
          userSelect: 'none',
          position: 'relative',
          zIndex: 100,
          pointerEvents: 'auto', // Явно включаем обработку событий
        } as React.CSSProperties}
      >
        {/* Левое меню - теперь всегда видно */}
        <div 
          style={{ 
            display: 'flex', 
            gap: '8px', // Увеличиваем отступ между элементами
            alignItems: 'center',
            WebkitAppRegion: 'no-drag' as any, // Кнопки не должны перетаскивать окно
            position: 'relative',
            zIndex: 1002, // Высокий z-index для всего контейнера меню
            pointerEvents: 'auto', // Явно включаем обработку событий
          } as React.CSSProperties}
        >
          {menuItems.map((menu) => {
            const MenuIcon = menu.icon;
            return (
              <div key={menu.id} style={{ position: 'relative' }}>
                <button
                  ref={(el) => { 
                    menuButtonRefs.current[menu.id] = el;
                    // Добавляем прямой обработчик на нативный элемент как fallback
                    if (el && !(el as any).__menuClickHandler) {
                      const clickHandler = (e: Event) => {
                        e.stopPropagation();
                        handleMenuClick(menu.id, e as any);
                      };
                      el.addEventListener('click', clickHandler);
                      (el as any).__menuClickHandler = clickHandler;
                    }
                  }}
                  data-menu-button
                  className="btn btn-ghost"
                  style={{
                    height: '24px',
                    padding: '0 8px', // Такой же padding как у кнопок справа
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: activeMenu === menu.id ? 'var(--bg-active)' : 'transparent',
                    color: activeMenu === menu.id ? 'var(--text-primary)' : 'var(--text-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'background-color 0.15s ease',
                    pointerEvents: 'auto',
                    position: 'relative',
                    zIndex: activeMenu === menu.id ? 1002 : 1001, // Всегда высокий z-index чтобы не перекрывались
                    WebkitAppRegion: 'no-drag' as any, // Явно отключаем drag для кнопок
                  } as React.CSSProperties}
                  onClick={(e) => {
                    e.stopPropagation(); // Останавливаем всплытие, но не preventDefault
                    handleMenuClick(menu.id, e);
                  }}
                  onMouseEnter={(e) => {
                    if (activeMenu !== menu.id) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeMenu !== menu.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  title={menu.label} // Tooltip с названием меню
                >
                  {MenuIcon && <MenuIcon size={14} />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Выпадающие меню */}
        <AnimatePresence>
          {activeMenu && (
            <motion.div
              data-menu-dropdown
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.1 }} // Уменьшаем время анимации
              style={{
                position: 'fixed',
                top: menuPosition ? `${menuPosition.top}px` : '28px',
                left: menuPosition ? `${menuPosition.left}px` : `${80 + macTrafficLightsWidth}px`,
                zIndex: 1001, // Увеличиваем z-index выше overlay (999), чтобы меню было поверх
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-xl)',
                padding: '4px 0',
                minWidth: '200px',
                maxWidth: '300px',
                overflow: 'hidden',
                pointerEvents: 'auto', // Убеждаемся, что клики работают
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                // НЕ останавливаем всплытие - пусть события доходят до элементов меню
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
                        fontSize: '13px',
                        textAlign: 'left',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: 'transparent',
                        transition: 'background-color 0.15s ease',
                        position: 'relative', // Добавляем position для z-index
                        zIndex: 1002, // Выше чем меню и overlay
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      onMouseDown={(e) => {
                        // Обрабатываем mousedown для более быстрой реакции
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseUp={(e) => {
                        // Также обрабатываем mouseup для надежности
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if ('action' in item && item.action) {
                          // Выполняем действие синхронно, но закрываем меню асинхронно
                          try {
                            // Вызываем действие сразу
                            item.action();
                            // Закрываем меню после небольшой задержки
                            requestAnimationFrame(() => {
                              setActiveMenu(null);
                              setMenuPosition(null);
                            });
                          } catch (error) {
                            console.error('Error executing menu action:', error);
                            // Закрываем меню даже при ошибке
                            setActiveMenu(null);
                            setMenuPosition(null);
                          }
                        } else {
                          setActiveMenu(null);
                          setMenuPosition(null);
                        }
                      }}
                    >
                      {Icon && <Icon size={14} />}
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.shortcut && (
                        <span style={{ 
                          fontSize: '11px', 
                          color: 'var(--text-tertiary)',
                          fontFamily: 'monospace',
                          marginLeft: '16px'
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

        {/* Пустая область для drag окна */}
        <div 
          style={{ 
            flex: 1,
            WebkitAppRegion: 'drag' as any, // Позволяет перетаскивать окно за пустые области
          } as React.CSSProperties}
        />

        {/* Правые кнопки - всегда видимы */}
        <div 
          style={{ 
            display: 'flex', 
            gap: '8px',
            WebkitAppRegion: 'no-drag' as any, // Кнопки не должны перетаскивать окно
          } as React.CSSProperties}
        >
        {onToggleTerminal && (
          <button
            className="btn btn-ghost"
            style={{ height: '24px', padding: '0 8px' }}
            onClick={onToggleTerminal}
            title="Переключить терминал (⌘⇧`)"
          >
            <TerminalIcon size={14} />
          </button>
        )}
        
        <button
          className="btn btn-ghost"
          style={{ height: '24px', padding: '0 8px' }}
          onClick={onToggleAIPanel}
          title="Переключить панель ИИ (⌘⇧/)"
        >
          <MessageSquareIcon size={14} />
        </button>
        
        <button
          className="btn btn-ghost"
          style={{ height: '24px', padding: '0 8px' }}
          onClick={onOpenSettings}
          title="Настройки"
        >
          <SettingsIcon size={14} />
        </button>
        
        <button
          className="btn btn-ghost"
          style={{ height: '24px', padding: '0 8px' }}
          onClick={() => {
            // Create and show help modal
            const modal = document.createElement('div');
            Object.assign(modal.style, {
              position: 'fixed',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: '10000',
              padding: '20px'
            });
            
            const content = document.createElement('div');
            Object.assign(content.style, {
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: 'var(--shadow-lg)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              lineHeight: '1.6',
              wordWrap: 'break-word',
              overflowWrap: 'break-word'
            });
            
            content.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; position: relative;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 600; flex: 1;">📖 Руководство пользователя</h2>
                <button id="closeHelp" style="background: none; border: none; cursor: pointer; font-size: 24px; line-height: 1; color: var(--text-secondary); padding: 4px 8px; margin-left: 16px; flex-shrink: 0;">×</button>
              </div>
              
              <div style="margin-bottom: 20px;">
                <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-primary);">🚀 Основные функции:</h3>
                
                <div style="margin-bottom: 12px; padding: 12px; background-color: var(--bg-secondary); border-radius: var(--radius-sm); word-wrap: break-word;">
                  <div style="font-weight: 600; margin-bottom: 6px;">⌨️ Command Palette (Ctrl+Shift+P)</div>
                  <div style="line-height: 1.8;">• Быстрый доступ ко всем командам IDE<br/>
                  • Нажмите <strong>Ctrl+Shift+P</strong> / <strong>Cmd+Shift+P</strong><br/>
                  • Введите название команды или используйте стрелки для навигации<br/>
                  • Централизованный доступ ко всем функциям</div>
                </div>
                
                <div style="margin-bottom: 12px; padding: 12px; background-color: var(--bg-secondary); border-radius: var(--radius-sm); word-wrap: break-word;">
                  <div style="font-weight: 600; margin-bottom: 6px;">🔍 Глобальный поиск (Ctrl+Shift+F)</div>
                  <div style="line-height: 1.8;">• Поиск по всему проекту<br/>
                  • Замена в файлах с предпросмотром<br/>
                  • Регулярные выражения и фильтры по типам файлов<br/>
                  • Учет регистра</div>
                </div>
                
                <div style="margin-bottom: 12px; padding: 12px; background-color: var(--bg-secondary); border-radius: var(--radius-sm); word-wrap: break-word;">
                  <div style="font-weight: 600; margin-bottom: 6px;">⚠️ Problems панель (Ctrl+Shift+M)</div>
                  <div style="line-height: 1.8;">• Централизованное отображение ошибок и предупреждений<br/>
                  • Фильтрация по типу (Errors, Warnings, Info)<br/>
                  • Переход к проблеме одним кликом<br/>
                  • Автоматическое обнаружение проблем в коде</div>
                </div>
                
                <div style="margin-bottom: 12px; padding: 12px; background-color: var(--bg-secondary); border-radius: var(--radius-sm); word-wrap: break-word;">
                  <div style="font-weight: 600; margin-bottom: 6px;">🌿 Git интеграция</div>
                  <div style="line-height: 1.8;">• Просмотр статуса файлов (измененные, индексированные)<br/>
                  • Стадирование и снятие файлов из индекса<br/>
                  • Создание коммитов прямо из IDE<br/>
                  • Откройте через Command Palette: "Git: Показать панель"</div>
                </div>
              </div>
              
              <div style="margin-bottom: 20px;">
                <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-primary);">🤖 AI функции:</h3>
                
                <div style="margin-bottom: 12px; padding: 12px; background-color: var(--bg-secondary); border-radius: var(--radius-sm); word-wrap: break-word;">
                  <div style="font-weight: 600; margin-bottom: 6px;">⚡ Inline Completions (Автодополнение)</div>
                  <div style="line-height: 1.8;">• Начните печатать код → AI предложит завершения<br/>
                  • <strong>Tab</strong> - принять, <strong>Esc</strong> - отклонить<br/>
                  • Настройки: ⚙️ → Редактор → AI автодополнение</div>
                </div>
                
                <div style="margin-bottom: 12px; padding: 12px; background-color: var(--bg-secondary); border-radius: var(--radius-sm); word-wrap: break-word;">
                  <div style="font-weight: 600; margin-bottom: 6px;">💬 Inline Chat (Ctrl+K)</div>
                  <div style="line-height: 1.8;">• Выделите код и нажмите <strong>Ctrl+K</strong> / <strong>Cmd+K</strong><br/>
                  • Быстрые действия: Объяснить, Рефакторить, Исправить<br/>
                  • Вставка/замена кода одной кнопкой</div>
                </div>
                
                <div style="margin-bottom: 12px; padding: 12px; background-color: var(--bg-secondary); border-radius: var(--radius-sm); word-wrap: break-word;">
                  <div style="font-weight: 600; margin-bottom: 6px;">💡 Code Actions (Lightbulb)</div>
                  <div style="line-height: 1.8;">• Появится 💡 рядом с кодом автоматически<br/>
                  • Кликните для предложений AI<br/>
                  • Применение одним кликом</div>
                </div>
                
                <div style="margin-bottom: 12px; padding: 12px; background-color: var(--bg-secondary); border-radius: var(--radius-sm); word-wrap: break-word;">
                  <div style="font-weight: 600; margin-bottom: 6px;">🌊 Streaming (Потоковые ответы)</div>
                  <div style="line-height: 1.8;">• Включите: ⚙️ → ИИ-помощник → Потоковые ответы<br/>
                  • Ответы появляются постепенно</div>
                </div>
                
                <div style="margin-bottom: 12px; padding: 12px; background-color: var(--bg-secondary); border-radius: var(--radius-sm); word-wrap: break-word;">
                  <div style="font-weight: 600; margin-bottom: 6px;">📚 Codebase Indexing</div>
                  <div style="line-height: 1.8;">• Работает автоматически при открытии проекта<br/>
                  • Улучшает контекст для всех AI запросов</div>
                </div>
              </div>
              
              <div style="margin-bottom: 20px;">
                <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">⌨️ Горячие клавиши:</h3>
                <div style="font-family: monospace; font-size: 12px; line-height: 1.8;">
                  <strong>Навигация и поиск:</strong><br/>
                  • <strong>Ctrl+Shift+P</strong> / <strong>Cmd+Shift+P</strong> - Command Palette<br/>
                  • <strong>Ctrl+Shift+F</strong> / <strong>Cmd+Shift+F</strong> - Глобальный поиск<br/>
                  • <strong>Ctrl+Shift+H</strong> / <strong>Cmd+Shift+H</strong> - Замена в файлах<br/>
                  • <strong>Ctrl+Shift+M</strong> / <strong>Cmd+Shift+M</strong> - Problems панель<br/>
                  <br/>
                  <strong>AI функции:</strong><br/>
                  • <strong>Ctrl+K</strong> / <strong>Cmd+K</strong> - Inline Chat<br/>
                  • <strong>Ctrl+Shift+/</strong> - AI Панель<br/>
                  • <strong>Tab</strong> - принять автодополнение<br/>
                  • <strong>Esc</strong> - отклонить автодополнение<br/>
                  <br/>
                  <strong>Редактор:</strong><br/>
                  • <strong>Ctrl+S</strong> / <strong>Cmd+S</strong> - Сохранить<br/>
                  • <strong>Ctrl+Shift+S</strong> / <strong>Cmd+Shift+S</strong> - Сохранить всё<br/>
                  • <strong>Ctrl+G</strong> / <strong>Cmd+G</strong> - Перейти к строке<br/>
                  • <strong>Ctrl+F</strong> / <strong>Cmd+F</strong> - Найти в файле<br/>
                  • <strong>Ctrl+&#96;</strong> / <strong>Cmd+&#96;</strong> - Терминал
                </div>
              </div>
              
              <div style="padding: 12px; background-color: var(--bg-tertiary); border-radius: var(--radius-sm); font-size: 11px; color: var(--text-secondary); word-wrap: break-word;">
                💡 <strong>Совет:</strong> Используйте Command Palette (Ctrl+Shift+P) для быстрого доступа ко всем функциям IDE!
              </div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            const closeHelp = () => {
              if (document.body.contains(modal)) {
                document.body.removeChild(modal);
              }
            };
            
            const closeBtn = content.querySelector('#closeHelp');
            if (closeBtn) {
              closeBtn.addEventListener('click', closeHelp);
            }
            modal.addEventListener('click', (e) => {
              if (e.target === modal) closeHelp();
            });
            
            // Close on Escape key
            const handleEscape = (e: KeyboardEvent) => {
              if (e.key === 'Escape') {
                closeHelp();
                document.removeEventListener('keydown', handleEscape);
              }
            };
            document.addEventListener('keydown', handleEscape);
          }}
          title="Руководство пользователя - Как использовать новые фичи"
        >
          <HelpCircle size={14} />
        </button>
        </div>
      </div>

    </>
  );
};