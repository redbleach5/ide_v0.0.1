const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Try to load node-pty, but don't fail if it's not available
let pty;
try {
  pty = require('node-pty');
} catch (error) {
  console.warn('node-pty not available. Terminal functionality will be disabled.');
  console.warn('To enable terminal, install node-pty: npm install node-pty');
  console.warn('Note: On Windows, you need Visual Studio Build Tools with "Desktop development with C++" workload');
  pty = null;
}

let mainWindow;

// Store active PTY processes
const ptyProcesses = new Map();

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const preloadPath = isDev 
    ? path.join(__dirname, 'preload.js')
    : path.join(__dirname, 'preload.js'); // In production, both files are in build folder
  
  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: preloadPath,
      webSecurity: true
    },
    show: false
  };

  // macOS-specific title bar style
  // Используем hiddenInset для интеграции traffic lights в интерфейс
  if (process.platform === 'darwin') {
    windowOptions.titleBarStyle = 'hiddenInset';
    windowOptions.frame = true;
    // Дополнительные опции для правильного отображения
    windowOptions.titleBarOverlay = false;
  }

  // Icon path (only set if file exists)
  const iconPath = path.join(__dirname, 'icon.png');
  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Load the app - development or production
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // In production: 
    // - If packaged by electron-builder, index.html is in same directory as electron.js
    // - If running directly with electron ., index.html is in ../build/index.html
    const indexPath = app.isPackaged 
      ? path.join(__dirname, 'index.html')
      : path.join(__dirname, '..', 'build', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // DevTools можно открыть вручную через меню "Вид" -> "Инструменты разработчика"
    // if (process.env.NODE_ENV === 'development') {
    //   mainWindow.webContents.openDevTools();
    // }
  });
  
  // Глобальная горячая клавиша F12 для открытия DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
  
  // IPC обработчик для переключения DevTools из меню
  ipcMain.on('toggle-devtools', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => {
    // Remove all IPC listeners to prevent memory leaks
    ipcMain.removeAllListeners();
    mainWindow = null;
  });

  // Handle window close - cleanup before closing
  mainWindow.on('close', (event) => {
    // Clean up PTY processes before closing
    if (ptyProcesses.size > 0) {
      console.log(`Closing window, killing ${ptyProcesses.size} PTY processes...`);
      ptyProcesses.forEach((ptyProcess, ptyId) => {
        try {
          // Remove event listeners to prevent memory leaks
          ptyProcess.removeAllListeners?.('data');
          ptyProcess.removeAllListeners?.('exit');
          
          // Try graceful kill first
          if (process.platform === 'win32') {
            ptyProcess.kill();
          } else {
            ptyProcess.kill('SIGTERM');
          }
        } catch (error) {
          console.error(`Error killing PTY process ${ptyId}:`, error);
          try {
            // Force kill if graceful kill failed
            if (process.platform === 'win32') {
              ptyProcess.kill();
            } else {
              ptyProcess.kill('SIGKILL');
            }
          } catch (forceError) {
            console.error(`Error force killing PTY process ${ptyId}:`, forceError);
          }
        }
      });
      ptyProcesses.clear();
    }
  });
}

function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Новый проект',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              console.log('[electron] Sending menu-new-project event');
              mainWindow.webContents.send('menu-new-project');
            } else {
              console.warn('[electron] Cannot send menu-new-project: mainWindow is not available');
            }
          }
        },
        {
          label: 'Открыть проект',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory']
            });
            
            if (!result.canceled) {
              mainWindow.webContents.send('menu-open-project', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Сохранить',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save');
          }
        },
        {
          label: 'Сохранить всё',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('menu-save-all');
          }
        },
        { type: 'separator' },
        {
          label: 'Выход',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            // Clean up PTY processes before exit
            if (ptyProcesses.size > 0) {
              ptyProcesses.forEach((ptyProcess) => {
                try {
                  ptyProcess.removeAllListeners?.('data');
                  ptyProcess.removeAllListeners?.('exit');
                  if (process.platform === 'win32') {
                    ptyProcess.kill();
                  } else {
                    ptyProcess.kill('SIGTERM');
                  }
                } catch (error) {
                  console.error('Error killing PTY process:', error);
                }
              });
              ptyProcesses.clear();
            }
            ipcMain.removeAllListeners();
            app.exit(0);
          }
        }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { label: 'Отменить', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Повторить', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Вырезать', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Копировать', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Вставить', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Выделить всё', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
      ]
    },
    {
      label: 'ИИ',
      submenu: [
        {
          label: 'Чат с ИИ',
          accelerator: 'CmdOrCtrl+Shift+/',
          click: () => {
            mainWindow.webContents.send('menu-ai-chat');
          }
        },
        {
          label: 'Сгенерировать код',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => {
            mainWindow.webContents.send('menu-ai-generate');
          }
        },
        {
          label: 'Анализировать проект',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            mainWindow.webContents.send('menu-ai-analyze');
          }
        }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        {
          label: 'Терминал',
          accelerator: 'CmdOrCtrl+Shift+`',
          click: () => {
            mainWindow.webContents.send('menu-terminal');
          }
        },
        { type: 'separator' },
        { label: 'Перезагрузить', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Принудительная перезагрузка', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Инструменты разработчика', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Фактический размер', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Увеличить', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Уменьшить', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Полноэкранный режим', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    }
  ];

  // Отключаем нативное меню - используем кастомное меню в интерфейсе
  // const menu = Menu.buildFromTemplate(template);
  // Menu.setApplicationMenu(menu);
  
  // Устанавливаем пустое меню вместо нативного
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createMenu(); // Recreate menu to ensure handlers reference the new window
    }
  });
});

app.on('window-all-closed', () => {
  console.log('All windows closed, cleaning up...');
  
  // Clean up all PTY processes
  if (ptyProcesses.size > 0) {
    console.log(`Killing ${ptyProcesses.size} remaining PTY processes...`);
    ptyProcesses.forEach((ptyProcess, ptyId) => {
      try {
        // Remove event listeners to prevent memory leaks
        ptyProcess.removeAllListeners?.('data');
        ptyProcess.removeAllListeners?.('exit');
        
        if (process.platform === 'win32') {
          ptyProcess.kill();
        } else {
          ptyProcess.kill('SIGTERM');
        }
      } catch (error) {
        console.error(`Error killing PTY process ${ptyId}:`, error);
        try {
          // Force kill if graceful kill failed
          if (process.platform === 'win32') {
            ptyProcess.kill();
          } else {
            ptyProcess.kill('SIGKILL');
          }
        } catch (forceError) {
          console.error(`Error force killing PTY process ${ptyId}:`, forceError);
        }
      }
    });
    ptyProcesses.clear();
  }

  // Remove all IPC listeners
  ipcMain.removeAllListeners();

  console.log('Quitting application...');
  // Force quit immediately on all platforms
  app.exit(0);
});

// IPC handlers for file system operations
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    const fileList = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      path: path.join(dirPath, file.name)
    }));
    return { success: true, files: fileList };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-file-size', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return { success: true, size: stats.size };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return { success: true, canceled: result.canceled, filePaths: result.filePaths };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create new project handler
ipcMain.handle('create-project', async (event, projectPath, projectName) => {
  try {
    // Create project directory
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    } else {
      // Check if directory is empty
      const files = fs.readdirSync(projectPath);
      if (files.length > 0) {
        return { success: false, error: 'Папка не пуста. Выберите другую папку или удалите содержимое.' };
      }
    }

    // Create basic project structure
    const readmePath = path.join(projectPath, 'README.md');
    const gitignorePath = path.join(projectPath, '.gitignore');
    
    const readmeContent = `# ${projectName}

Описание проекта.

## Установка

\`\`\`bash
npm install
\`\`\`

## Использование

Начните редактирование здесь.
`;

    const gitignoreContent = `# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build outputs
dist/
build/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
`;

    // Write files
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');

    return { success: true, projectPath };
  } catch (error) {
    console.error('Error creating project:', error);
    return { success: false, error: error.message || 'Не удалось создать проект' };
  }
});

// Terminal/PTY handlers
ipcMain.handle('terminal-create', async (event, options) => {
  if (!pty) {
    return { 
      success: false, 
      error: 'node-pty is not installed. node-pty fully supports Windows, but requires Visual Studio Build Tools with C++ components for compilation. Please see TERMINAL_WINDOWS_INFO.md for details.' 
    };
  }

  try {
    const shell = options.shell || (os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash');
    const cwd = options.cwd || os.homedir();
    
    // Determine shell for Windows
    let shellPath = shell;
    if (os.platform() === 'win32') {
      // Use PowerShell or CMD
      if (shell.includes('powershell')) {
        shellPath = 'powershell.exe';
      } else {
        shellPath = process.env.COMSPEC || 'cmd.exe';
      }
    }

    const ptyProcess = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: {
        ...process.env,
        ...(options.env || {})
      }
    });

    const ptyId = `pty-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    ptyProcesses.set(ptyId, ptyProcess);

    // Handle data from PTY
    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal-data', ptyId, data);
      }
    });

    // Handle exit
    ptyProcess.onExit((exitCode, signal) => {
      ptyProcesses.delete(ptyId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal-exit', ptyId, exitCode, signal);
      }
    });

    return { success: true, ptyId };
  } catch (error) {
    console.error('Failed to create terminal:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-write', async (event, ptyId, data) => {
  if (!pty) {
    return { success: false, error: 'node-pty is not installed' };
  }
  try {
    const ptyProcess = ptyProcesses.get(ptyId);
    if (!ptyProcess) {
      return { success: false, error: 'PTY process not found' };
    }
    ptyProcess.write(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-resize', async (event, ptyId, cols, rows) => {
  if (!pty) {
    return { success: false, error: 'node-pty is not installed' };
  }
  try {
    const ptyProcess = ptyProcesses.get(ptyId);
    if (!ptyProcess) {
      return { success: false, error: 'PTY process not found' };
    }
    ptyProcess.resize(cols, rows);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-kill', async (event, ptyId) => {
  if (!pty) {
    return { success: false, error: 'node-pty is not installed' };
  }
  try {
    const ptyProcess = ptyProcesses.get(ptyId);
    if (!ptyProcess) {
      return { success: false, error: 'PTY process not found' };
    }
    ptyProcess.kill();
    ptyProcesses.delete(ptyId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Git handlers
ipcMain.handle('git-is-repository', async (event, projectPath) => {
  try {
    const gitPath = path.join(projectPath, '.git');
    const exists = fs.existsSync(gitPath);
    return { success: true, isRepository: exists };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-execute', async (event, projectPath, command) => {
  try {
    // Check if project path exists
    if (!fs.existsSync(projectPath)) {
      return {
        success: false,
        error: 'Project path does not exist'
      };
    }

    const fullCommand = `git ${command}`;
    
    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: projectPath,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        encoding: 'utf8',
        timeout: 30000, // 30 second timeout
        killSignal: 'SIGTERM'
      });
      
      return {
        success: true,
        output: stdout || '',
        error: stderr || undefined
      };
    } catch (execError) {
      // Git commands often return non-zero exit codes even for valid operations
      // Check if we got output despite the error
      if (execError.stdout) {
        return {
          success: true,
          output: execError.stdout,
          error: execError.stderr
        };
      }
      
      // Handle EPIPE and other stream errors gracefully
      if (execError.code === 'EPIPE' || execError.code === 'ENOENT') {
        return {
          success: false,
          error: execError.code === 'ENOENT' 
            ? 'Git is not installed or not found in PATH'
            : 'Git command failed: process terminated unexpectedly'
        };
      }
      
      return {
        success: false,
        error: execError.message || 'Git command failed'
      };
    }
  } catch (error) {
    console.error('Error in git-execute handler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});

// Cleanup all PTY processes on app quit
app.on('before-quit', (event) => {
  console.log('Application quitting, cleaning up PTY processes...');
  
  // Kill all PTY processes
  if (ptyProcesses.size > 0) {
    ptyProcesses.forEach((ptyProcess, ptyId) => {
      try {
        // Remove event listeners to prevent memory leaks
        ptyProcess.removeAllListeners?.('data');
        ptyProcess.removeAllListeners?.('exit');
        
        if (process.platform === 'win32') {
          ptyProcess.kill();
        } else {
          ptyProcess.kill('SIGTERM');
        }
      } catch (error) {
        console.error(`Error killing PTY process ${ptyId}:`, error);
        try {
          // Force kill if graceful kill failed
          if (process.platform === 'win32') {
            ptyProcess.kill();
          } else {
            ptyProcess.kill('SIGKILL');
          }
        } catch (forceError) {
          console.error(`Error force killing PTY process ${ptyId}:`, forceError);
        }
      }
    });
    ptyProcesses.clear();
  }
  
  // Remove all IPC listeners
  ipcMain.removeAllListeners();
});

// Final cleanup on will-quit
app.on('will-quit', (event) => {
  console.log('Final cleanup before quit...');
  
  // Final cleanup - kill any remaining processes
  if (ptyProcesses.size > 0) {
    ptyProcesses.forEach((ptyProcess, ptyId) => {
      try {
        // Remove event listeners to prevent memory leaks
        ptyProcess.removeAllListeners?.('data');
        ptyProcess.removeAllListeners?.('exit');
        
        if (process.platform === 'win32') {
          ptyProcess.kill();
        } else {
          ptyProcess.kill('SIGKILL'); // Force kill on final cleanup
        }
      } catch (error) {
        console.error(`Error killing PTY process ${ptyId}:`, error);
      }
    });
    ptyProcesses.clear();
  }
  
  // Remove all IPC listeners
  ipcMain.removeAllListeners();
  
  // Force exit immediately to ensure process terminates
  console.log('Force exiting process...');
  process.exit(0);
});