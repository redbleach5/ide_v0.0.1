const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  getFileSize: (filePath) => ipcRenderer.invoke('get-file-size', filePath),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  createProject: (projectPath, projectName) => ipcRenderer.invoke('create-project', projectPath, projectName),
  
  // Menu events
  onMenuAction: (callback) => {
    // Remove all existing listeners first to avoid duplicates
    ipcRenderer.removeAllListeners('menu-new-project');
    ipcRenderer.removeAllListeners('menu-open-project');
    ipcRenderer.removeAllListeners('menu-save');
    ipcRenderer.removeAllListeners('menu-save-all');
    ipcRenderer.removeAllListeners('menu-ai-chat');
    ipcRenderer.removeAllListeners('menu-ai-generate');
    ipcRenderer.removeAllListeners('menu-ai-analyze');
    ipcRenderer.removeAllListeners('menu-terminal');
    ipcRenderer.removeAllListeners('menu-toggle-devtools');
    
    // Register new listeners
    ipcRenderer.on('menu-new-project', (event) => {
      console.log('[preload] menu-new-project event received');
      callback(event, { type: 'menu-new-project' });
    });
    ipcRenderer.on('menu-open-project', (event, path) => callback(event, { type: 'menu-open-project', path }));
    ipcRenderer.on('menu-save', (event) => callback(event, { type: 'menu-save' }));
    ipcRenderer.on('menu-save-all', (event) => callback(event, { type: 'menu-save-all' }));
    ipcRenderer.on('menu-ai-chat', (event) => callback(event, { type: 'menu-ai-chat' }));
    ipcRenderer.on('menu-ai-generate', (event) => callback(event, { type: 'menu-ai-generate' }));
    ipcRenderer.on('menu-ai-analyze', (event) => callback(event, { type: 'menu-ai-analyze' }));
    ipcRenderer.on('menu-terminal', (event) => callback(event, { type: 'menu-terminal' }));
    ipcRenderer.on('menu-toggle-devtools', (event) => callback(event, { type: 'menu-toggle-devtools' }));
  },
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // DevTools toggle
  toggleDevTools: () => {
    ipcRenderer.send('toggle-devtools');
  },
  
  // Git API
  git: {
    execute: (projectPath, command) => ipcRenderer.invoke('git-execute', projectPath, command),
    isRepository: (projectPath) => ipcRenderer.invoke('git-is-repository', projectPath),
  },
  
  // Terminal API
  terminal: {
    create: (options) => {
      return ipcRenderer.invoke('terminal-create', options).then(result => {
        if (result.success) {
          return result.ptyId;
        } else {
          throw new Error(result.error || 'Failed to create terminal');
        }
      });
    },
    
    write: (ptyId, data) => {
      return ipcRenderer.invoke('terminal-write', ptyId, data);
    },
    
    resize: (ptyId, cols, rows) => {
      return ipcRenderer.invoke('terminal-resize', ptyId, cols, rows);
    },
    
    kill: (ptyId) => {
      return ipcRenderer.invoke('terminal-kill', ptyId);
    },
    
    onData: (ptyId, callback) => {
      const handler = (event, id, data) => {
        if (id === ptyId) {
          callback(data);
        }
      };
      ipcRenderer.on('terminal-data', handler);
      return () => ipcRenderer.removeListener('terminal-data', handler);
    },
    
    onExit: (ptyId, callback) => {
      const handler = (event, id, exitCode, signal) => {
        if (id === ptyId) {
          callback(exitCode, signal);
        }
      };
      ipcRenderer.on('terminal-exit', handler);
      return () => ipcRenderer.removeListener('terminal-exit', handler);
    }
  }
});

contextBridge.exposeInMainWorld('versions', {
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron,
  platform: process.platform, // Добавляем платформу для определения macOS
});