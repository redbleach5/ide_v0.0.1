import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { logger } from '../utils/logger';

interface TerminalPanelProps {
  onClose?: () => void;
  projectPath?: string;
  theme?: 'light' | 'dark';
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ 
  onClose, 
  projectPath,
  theme = 'light'
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyProcessIdRef = useRef<string | null>(null);
  const cleanupHandlersRef = useRef<Array<(() => void) | undefined>>([]);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    const terminal = new Terminal({
      theme: {
        background: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        foreground: theme === 'dark' ? '#d4d4d4' : '#1d1d1f',
        cursor: theme === 'dark' ? '#d4d4d4' : '#1d1d1f',
        cursorAccent: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Monaco, 'Roboto Mono', 'Consolas', 'Courier New', monospace",
      fontWeight: 400,
      cursorBlink: true,
      cursorStyle: 'block',
      lineHeight: 1.4,
      letterSpacing: 0.3,
      allowTransparency: true,
      convertEol: true,
      scrollback: 5000,
      tabStopWidth: 4,
      disableStdin: false,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: false
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.open(terminalRef.current);
    
    // Delay fit() to ensure terminal is fully initialized
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          if (fitAddonRef.current && terminalInstanceRef.current) {
            fitAddonRef.current.fit();
          }
        } catch (error) {
          logger.error('Error fitting terminal:', error);
        }
      }, 0);
    });

    // Check if Electron API is available
    if (!window.electronAPI || !window.electronAPI.terminal) {
      terminal.writeln('\r\n\x1b[31mОшибка: Терминал недоступен в браузерном режиме.\x1b[0m');
      terminal.writeln('Терминал работает только в Electron приложении.\r\n');
      return;
    }

    // Create PTY process
    const createTerminal = async () => {
      try {
        const terminalAPI = window.electronAPI.terminal!;
        // Use project path if available, otherwise let the shell use default
        const defaultCwd = projectPath || undefined;
        
        const ptyId = await terminalAPI.create({
          cwd: defaultCwd,
          shell: undefined, // Let electron.js determine the shell
          env: {}
        });

        ptyProcessIdRef.current = ptyId;

        // Handle data from terminal
        const dataHandler = terminalAPI.onData(ptyId, (data: string) => {
          terminal.write(data);
        });

        // Handle exit
        const exitHandler = terminalAPI.onExit(ptyId, (exitCode: number, signal?: number) => {
          terminal.writeln(`\r\n\x1b[33mПроцесс завершён с кодом: ${exitCode}\x1b[0m\r\n`);
          ptyProcessIdRef.current = null;
        });
        
        // Store handlers for cleanup
        cleanupHandlersRef.current = [dataHandler, exitHandler];

        // Send input to terminal
        terminal.onData((data) => {
          if (ptyProcessIdRef.current) {
            terminalAPI.write(ptyProcessIdRef.current, data);
          }
        });

        // Handle resize
        terminal.onResize((size) => {
          if (ptyProcessIdRef.current) {
            terminalAPI.resize(ptyProcessIdRef.current, size.cols, size.rows);
          }
        });

        logger.info('Terminal initialized successfully', { ptyId, cwd: defaultCwd });
      } catch (error) {
        logger.error('Failed to create terminal:', error);
        terminal.writeln(`\r\n\x1b[31mОшибка создания терминала: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}\x1b[0m\r\n`);
      }
    };

    createTerminal();

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current && terminalInstanceRef.current) {
        fitAddonRef.current.fit();
        if (ptyProcessIdRef.current && window.electronAPI.terminal) {
          const terminalAPI = window.electronAPI.terminal;
          const cols = terminalInstanceRef.current.cols;
          const rows = terminalInstanceRef.current.rows;
          if (cols && rows) {
            terminalAPI.resize(ptyProcessIdRef.current, cols, rows);
          }
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Cleanup handlers
      cleanupHandlersRef.current.forEach(cleanup => {
        if (cleanup && typeof cleanup === 'function') {
          cleanup();
        }
      });
      cleanupHandlersRef.current = [];
      
      if (ptyProcessIdRef.current && window.electronAPI.terminal) {
        const terminalAPI = window.electronAPI.terminal;
        terminalAPI.kill(ptyProcessIdRef.current).catch((err: Error) => {
          logger.error('Error killing terminal process:', err);
        });
        ptyProcessIdRef.current = null;
      }

      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
        terminalInstanceRef.current = null;
      }
    };
  }, [projectPath, theme]);

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    // Trigger resize after state update
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }, 0);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const terminal = terminalInstanceRef.current;
    if (!terminal) return;

    const menu = document.createElement('div');
    menu.className = 'terminal-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.style.backgroundColor = theme === 'dark' ? '#252526' : '#ffffff';
    menu.style.border = `1px solid ${theme === 'dark' ? '#3e3e42' : '#d2d2d7'}`;
    menu.style.borderRadius = 'var(--radius-md)';
    menu.style.padding = '4px';
    menu.style.zIndex = '10000';
    menu.style.boxShadow = 'var(--shadow-lg)';
    menu.style.minWidth = '180px';
    menu.style.fontSize = '12px';

    const createMenuItem = (text: string, onClick: () => void, disabled = false) => {
      const item = document.createElement('div');
      item.className = 'terminal-context-menu-item';
      item.textContent = text;
      item.style.padding = '6px 12px';
      item.style.cursor = disabled ? 'not-allowed' : 'pointer';
      item.style.borderRadius = 'var(--radius-sm)';
      item.style.color = disabled 
        ? (theme === 'dark' ? '#6b7b8b' : '#a1a1a6')
        : (theme === 'dark' ? '#d4d4d4' : '#1d1d1f');
      item.style.opacity = disabled ? '0.5' : '1';
      
      if (!disabled) {
        item.onmouseenter = () => {
          item.style.backgroundColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
        };
        item.onmouseleave = () => {
          item.style.backgroundColor = 'transparent';
        };
        item.onclick = () => {
          onClick();
          if (document.body.contains(menu)) {
            document.body.removeChild(menu);
          }
        };
      }
      
      return item;
    };

    const createSeparator = () => {
      const separator = document.createElement('div');
      separator.style.height = '1px';
      separator.style.margin = '4px 0';
      separator.style.backgroundColor = theme === 'dark' ? '#3e3e42' : '#d2d2d7';
      return separator;
    };

    // Копировать
    const hasSelection = terminal.hasSelection ? terminal.hasSelection() : !!terminal.getSelection();
    const copyItem = createMenuItem('Копировать', () => {
      const selection = terminal.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch(err => {
          logger.error('Failed to copy to clipboard:', err);
        });
      }
    }, !hasSelection);

    // Вставить
    const pasteItem = createMenuItem('Вставить', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (ptyProcessIdRef.current && window.electronAPI?.terminal) {
          await window.electronAPI.terminal.write(ptyProcessIdRef.current, text);
        }
      } catch (err) {
        logger.error('Failed to paste from clipboard:', err);
      }
    });

    // Выделить все
    const selectAllItem = createMenuItem('Выделить всё', () => {
      terminal.selectAll();
    });

    // Очистить
    const clearItem = createMenuItem('Очистить', () => {
      terminal.clear();
    });

    menu.appendChild(copyItem);
    menu.appendChild(pasteItem);
    menu.appendChild(selectAllItem);
    menu.appendChild(createSeparator());
    menu.appendChild(clearItem);
    
    document.body.appendChild(menu);

    // Закрыть меню при клике вне его
    const removeMenu = () => {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', removeMenu, { once: true });
      document.addEventListener('contextmenu', removeMenu, { once: true });
    }, 0);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isMaximized ? '100vh' : '400px',
        backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        borderTop: `1px solid ${theme === 'dark' ? '#3e3e42' : '#d2d2d7'}`,
        transition: 'height 0.2s ease',
        position: 'relative'
      }}
    >
      {/* Terminal Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: theme === 'dark' ? '#252526' : '#f5f5f7',
          borderBottom: `1px solid ${theme === 'dark' ? '#3e3e42' : '#d2d2d7'}`,
          minHeight: '36px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: theme === 'dark' ? '#d4d4d4' : '#1d1d1f'
            }}
          >
            Терминал
          </span>
          {projectPath && (
            <span
              style={{
                fontSize: '11px',
                color: theme === 'dark' ? '#9ba3b3' : '#86868b',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {projectPath}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={handleMaximize}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              border: 'none',
              backgroundColor: 'transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              color: theme === 'dark' ? '#9ba3b3' : '#86868b',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={isMaximized ? 'Восстановить' : 'Развернуть'}
          >
            {isMaximized ? (
              <Minimize2 size={14} />
            ) : (
              <Maximize2 size={14} />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: '4px',
                cursor: 'pointer',
                color: theme === 'dark' ? '#9ba3b3' : '#86868b',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Закрыть"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Container */}
      <div
        ref={terminalRef}
        onContextMenu={handleContextMenu}
        style={{
          flex: 1,
          padding: '8px',
          overflow: 'hidden',
          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff'
        }}
      />
    </div>
  );
};
