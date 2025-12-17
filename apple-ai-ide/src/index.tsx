import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './utils/monacoConfig'; // Configure Monaco Editor before app loads
import { logger } from './utils/logger';

// Global error handler for uncaught errors (like Monaco CDN loading issues)
window.addEventListener('error', (event) => {
  // Suppress generic "Script error" messages from CDN scripts
  if (event.message === 'Script error.' || event.message === '') {
    logger.debug('Suppressed script error (likely from CDN):', event.filename);
    event.preventDefault();
    return false;
  }
  return true;
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && typeof event.reason === 'object' && 'message' in event.reason) {
    const message = (event.reason as Error).message;
    if (message.includes('Script error') || message === '') {
      logger.debug('Suppressed unhandled rejection (likely from CDN):', message);
      event.preventDefault();
      return;
    }
  }
});

// Register global keyboard shortcuts handler early, before React loads
// This ensures shortcuts work everywhere, including outside Monaco Editor
(function registerGlobalShortcuts() {
  const handleKeyDown = (e: KeyboardEvent) => {
    // More reliable Mac detection
    const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform) || 
                  /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    
    // Debug: log all keydown events with modifiers (can be removed later)
    // if (modifier || e.shiftKey) {
    //   const target = e.target as HTMLElement;
    //   console.log('[Global Shortcuts] Keydown:', {
    //     key: e.key,
    //     code: e.code,
    //     modifier,
    //     shift: e.shiftKey,
    //     target: target?.tagName,
    //     className: target?.className,
    //     isMonaco: target?.closest?.('.monaco-editor') !== null
    //   });
    // }
    
    // Only handle shortcuts with modifiers (Ctrl/Cmd)
    if (!modifier && !e.shiftKey && !e.altKey) {
      return; // Not a shortcut, let it pass through
    }
    
    // Check if target is a regular input/textarea (not Monaco Editor)
    const target = e.target as HTMLElement;
    const isMonacoEditor = target?.closest?.('.monaco-editor') !== null;
    const isRegularInput = (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') && !isMonacoEditor;
    const isContentEditable = target?.isContentEditable && !isMonacoEditor;
    
    // F12 - Toggle DevTools (работает везде, кроме Monaco Editor, где F12 используется для Go to Definition)
    if (e.key === 'F12' && !isMonacoEditor) {
      // В Electron DevTools откроется автоматически через обработчик в electron.js
      // Не preventDefault, чтобы Electron мог обработать F12
      logger.debug('[Global Shortcuts] F12 pressed - DevTools should open');
      return;
    }
    
    // Skip if user is typing in a regular input (but allow Monaco and global shortcuts)
    if (isRegularInput || isContentEditable) {
      // Allow shortcuts even in inputs
      if (!modifier && !e.shiftKey && !e.altKey) {
        return;
      }
    }
    
    // Use e.code instead of e.key to work with any keyboard layout
    // e.code represents the physical key, not the character
    const keyCode = e.code;
    
    // Dispatch custom events for React components to handle
    // Command Palette: Ctrl+Shift+P / Cmd+Shift+P
    if (modifier && e.shiftKey && (keyCode === 'KeyP' || e.key === 'P' || e.key === 'p') && !e.altKey) {
      logger.debug('[Global Shortcuts] Command Palette triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'command-palette' } }));
      return;
    }
    
    // New Project: Ctrl+N / Cmd+N
    if (modifier && !e.shiftKey && !e.altKey && (keyCode === 'KeyN' || e.key === 'N' || e.key === 'n')) {
      logger.debug('[Global Shortcuts] New Project triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'new-project' } }));
      return;
    }
    
    // Open Project: Ctrl+O / Cmd+O
    if (modifier && !e.shiftKey && !e.altKey && (keyCode === 'KeyO' || e.key === 'O' || e.key === 'o')) {
      logger.debug('[Global Shortcuts] Open Project triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'open-project' } }));
      return;
    }
    
    // Save: Ctrl+S / Cmd+S
    if (modifier && !e.shiftKey && !e.altKey && (keyCode === 'KeyS' || e.key === 'S' || e.key === 's')) {
      logger.debug('[Global Shortcuts] Save triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'save' } }));
      return;
    }
    
    // Save All: Ctrl+Shift+S / Cmd+Shift+S
    if (modifier && e.shiftKey && !e.altKey && (keyCode === 'KeyS' || e.key === 'S' || e.key === 's')) {
      logger.debug('[Global Shortcuts] Save All triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'save-all' } }));
      return;
    }
    
    // AI Panel: Ctrl+Shift+/ / Cmd+Shift+/
    if (modifier && e.shiftKey && !e.altKey && (keyCode === 'Slash' || e.key === '/' || e.key === '?')) {
      logger.debug('[Global Shortcuts] AI Panel triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'ai-panel' } }));
      return;
    }
    
    // Terminal: Ctrl+Shift+` / Cmd+Shift+`
    if (modifier && e.shiftKey && !e.altKey && (keyCode === 'Backquote' || e.key === '`' || e.key === '~')) {
      logger.debug('[Global Shortcuts] Terminal triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'terminal' } }));
      return;
    }
    
    // Settings: Ctrl+, / Cmd+,
    if (modifier && !e.shiftKey && !e.altKey && (keyCode === 'Comma' || e.key === ',') && !isRegularInput && !isContentEditable) {
      logger.debug('[Global Shortcuts] Settings triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'settings' } }));
      return;
    }
    
    // Problems Panel: Ctrl+Shift+M / Cmd+Shift+M
    if (modifier && e.shiftKey && !e.altKey && (keyCode === 'KeyM' || e.key === 'M' || e.key === 'm')) {
      logger.debug('[Global Shortcuts] Problems Panel triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'problems-panel' } }));
      return;
    }
    
    // Global Search: Ctrl+Shift+F / Cmd+Shift+F
    if (modifier && e.shiftKey && !e.altKey && (keyCode === 'KeyF' || e.key === 'F' || e.key === 'f')) {
      logger.debug('[Global Shortcuts] Global Search triggered');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'global-search' } }));
      return;
    }
  };
  
  // Register handlers when DOM is ready
  // Use only document.documentElement with capture phase for earliest interception
  // This prevents duplicate event handling
  const registerHandlers = () => {
    // Register only on document.documentElement with capture phase
    // This is the earliest possible interception point
    document.documentElement.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
    
    logger.debug('[Global Shortcuts] Registered keyboard handler on documentElement');
  };
  
  // Register immediately if DOM is ready, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerHandlers);
  } else {
    // Use setTimeout to ensure DOM is fully ready
    setTimeout(registerHandlers, 0);
  }
})();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);