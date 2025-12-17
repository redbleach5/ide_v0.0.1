import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { MenuBarSimple } from './components/MenuBarSimple';
import { SidebarSimple } from './components/SidebarSimple';
import { EditorPanel } from './components/EditorPanel';
import { SplitEditorPanel } from './components/SplitEditorPanel';
import { StatusBarSimple } from './components/StatusBarSimple';
import { SettingsDialogSimple } from './components/SettingsDialogSimple';
import { NewProjectDialog } from './components/NewProjectDialog';
import { AIPanel } from './components/AIPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { CommandPalette } from './components/CommandPalette';
import { GitPanel } from './components/GitPanel';
import { GitHubPanel } from './components/GitHubPanel';
import { ProblemsPanel, Problem } from './components/ProblemsPanel';
import { GlobalSearch } from './components/GlobalSearch';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ReferencesPanel } from './components/ReferencesPanel';
import { ReferenceLocation } from './services/navigationService';
import { BookmarksPanel } from './components/BookmarksPanel';
import { DebugPanel } from './components/DebugPanel';
import { problemsService } from './services/problemsService';
import { lintingService } from './services/lintingService';
import { Project, Tab, IDESettings, AIChatSession } from './types';
import { fileService } from './services/fileService';
import { logger } from './utils/logger';
import { loadSettingsFromStorage } from './utils/settingsValidator';
import { codebaseIndexService } from './services/codebaseIndexService';
import { ragService } from './services/ragService';
import { inlineCompletionService } from './services/inlineCompletionService';
import { createCommands, CommandContext } from './utils/commandRegistry';
import './styles/global.css';

const defaultSettings: IDESettings = {
  theme: 'light',
  fontSize: 14,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  aiProvider: 'ollama',
  ollamaEndpoint: 'http://localhost:11434',
  lmStudioEndpoint: 'http://localhost:1234',
  selectedModel: '',
  autoSave: true,
  autoSaveDelay: 3000,
  inlineCompletions: true,
  inlineCompletionsDelay: 500,
  streamingResponses: true,
  formatOnSave: false,
  lintOnSave: true
};

function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [settings, setSettings] = useState<IDESettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [showGitHubPanel, setShowGitHubPanel] = useState(false);
  const [showProblemsPanel, setShowProblemsPanel] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [references, setReferences] = useState<ReferenceLocation[]>([]);
  const [useSplitView] = useState(false); // Split view feature (setter unused for now)
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [aiSessions, setAISessions] = useState<AIChatSession[]>([
    {
      id: 'default',
      title: 'Новый чат',
      messages: []
    }
  ]);
  const [activeAISession, setActiveAISession] = useState<AIChatSession | null>(aiSessions[0]);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [ragIndexing, setRagIndexing] = useState<{ inProgress: boolean; progress?: number; filesIndexed?: number; totalFiles?: number }>({ inProgress: false });

  // Sync activeAISession with aiSessions
  useEffect(() => {
    if (activeAISession && !aiSessions.find(s => s.id === activeAISession.id)) {
      // Active session was removed, switch to first available
      setActiveAISession(aiSessions[0] || null);
    }
  }, [aiSessions, activeAISession]);

  // Load settings from localStorage on mount with validation
  useEffect(() => {
    const validatedSettings = loadSettingsFromStorage();
    setSettings(validatedSettings);
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('ide-settings', JSON.stringify(settings));
      logger.debug('Settings saved to localStorage');
    } catch (error) {
      logger.error('Failed to save settings to localStorage:', error);
    }
  }, [settings]);

  const handleTabClose = (tabId: string) => {
    const newTabs = openTabs.filter(tab => tab.id !== tabId);
    const newActiveTab = activeTab?.id === tabId 
      ? (newTabs.length > 0 ? newTabs[newTabs.length - 1] : null)
      : activeTab;
    
    setOpenTabs(newTabs);
    setActiveTab(newActiveTab);
  };

  const handleTabSelect = (tab: Tab) => {
    setActiveTab(tab);
  };

  const handleTabContentChange = (tabId: string, content: string) => {
    setOpenTabs(tabs => 
      tabs.map(tab => 
        tab.id === tabId ? { ...tab, content, isDirty: true } : tab
      )
    );
  };

  const handleFileOpen = useCallback(async (filePath: string) => {
    // Check if file is already open
    const existingTab = openTabs.find(tab => tab.path === filePath);
    if (existingTab) {
      setActiveTab(existingTab);
      return;
    }

    // Skip demo files - they don't exist on disk
    if (filePath.startsWith('/demo/')) {
      logger.debug('Skipping demo file:', filePath);
      return;
    }

    try {
      logger.debug('Opening file:', filePath);
      const newTab = await fileService.createTab(filePath);
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTab(newTab);
      logger.debug('File opened successfully:', filePath);
    } catch (error) {
      logger.error('Failed to open file:', error, { filePath });
      // Fallback to error message if file read fails
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'Без названия';
      const language = fileService.getLanguageFromExtension(fileName);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      const newTab: Tab = {
        id: fileService.generateTabId(),
        title: fileName,
        path: filePath,
        content: `// Не удалось загрузить файл: ${filePath}\n// Ошибка: ${errorMessage}\n// Убедитесь, что файл существует и доступен для чтения.`,
        language,
        isDirty: false
      };
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTab(newTab);
    }
  }, [openTabs]);

  const handleOpenProject = useCallback(async (projectPath: string) => {
    setIsLoadingProject(true);
    try {
      logger.info('Opening project:', projectPath);
      
      // Validate project path - check if it's an ignored directory
      const pathParts = projectPath.split(/[/\\]/).filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      const ignoredDirs = ['node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'target', 'bin', 'obj'];
      
      if (ignoredDirs.includes(lastPart.toLowerCase())) {
        logger.warn('Attempted to open ignored directory, trying parent directory');
        // Try to open parent directory instead
        const pathSeparator = projectPath.includes('\\') ? '\\' : '/';
        const parentPath = pathParts.slice(0, -1).join(pathSeparator);
        if (parentPath) {
          projectPath = parentPath;
          logger.info('Switched to parent directory:', projectPath);
        } else {
          throw new Error('Нельзя открыть игнорируемую директорию. Пожалуйста, выберите корневую директорию проекта.');
        }
      }
      
      logger.info('Building file tree for:', projectPath);
      const files = await fileService.buildFileTree(projectPath);
      logger.info('File tree built:', { fileCount: files.length, files: files.map(f => f.name) });
      
      if (files.length === 0) {
        logger.warn('No files found in project. It might be empty, all files are ignored, or opened from wrong directory.');
        // Check if directory exists and has files
        try {
          const testFiles = await fileService.readDirectory(projectPath);
          if (testFiles.length > 0) {
            logger.warn('Directory has files but all were filtered:', { 
              totalFiles: testFiles.length,
              files: testFiles.map(f => f.name)
            });
          }
        } catch (e) {
          logger.error('Error checking directory contents:', e);
        }
      }
      
      const projectName = projectPath.split('/').pop() || projectPath.split('\\').pop() || 'Проект';
      
      setProject({
        name: projectName,
        path: projectPath,
        files,
        openTabs: [],
        activeTabId: undefined
      });
      
      setOpenTabs([]);
      setActiveTab(null);
      
      // Очищаем все кеши перед индексацией нового проекта
      if (project?.path && project.path !== projectPath) {
        logger.info('Clearing caches for project switch', { 
          oldProject: project.path, 
          newProject: projectPath 
        });
        codebaseIndexService.clearCache(project.path);
        ragService.clearCache(project.path);
        inlineCompletionService.clearCache();
      } else {
        // Очищаем все кеши если проект не был открыт
        codebaseIndexService.clearCache();
        ragService.clearCache();
        inlineCompletionService.clearCache();
      }
      
      // Index codebase in background (базовая индексация)
      codebaseIndexService.indexProject(projectPath).catch(error => {
        logger.error('Error indexing codebase:', error);
      });
      
      // Index with RAG in background (семантическая индексация - ЯДРО СИСТЕМЫ)
      setRagIndexing({ inProgress: true, progress: 0 });
      ragService.indexProject(projectPath)
        .then(() => {
          setRagIndexing({ inProgress: false });
          logger.info('RAG indexing completed successfully');
        })
        .catch(error => {
          logger.error('Error indexing with RAG:', error);
          setRagIndexing({ inProgress: false });
        });
      
      logger.info('Project opened successfully:', projectPath);
      
      // Warn if no files found (might be wrong directory)
      if (files.length === 0) {
        logger.warn('No files found in project. It might be empty or opened from wrong directory.');
      }
    } catch (error) {
      logger.error('Failed to open project:', error, { projectPath });
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Не удалось открыть проект: ${errorMessage}\n\nУбедитесь, что вы выбрали корневую директорию проекта, а не подпапку (например, node_modules, .git, dist и т.д.).`);
    } finally {
      setIsLoadingProject(false);
    }
  }, []);

  const handleNewProject = useCallback(() => {
    console.log('=== handleNewProject CALLED ===');
    logger.info('New project dialog requested');
    console.log('Setting showNewProjectDialog to true...');
    setShowNewProjectDialog(true);
    console.log('showNewProjectDialog will be set to true (async state update)');
  }, []);

  const handleCreateProject = useCallback(async (projectPath: string, projectName: string) => {
    logger.info('Creating new project:', { projectPath, projectName });
    try {
      // Clear codebase index for the old project
      if (project?.path) {
        codebaseIndexService.clearCache(project.path);
        ragService.clearCache(project.path);
        logger.debug('Cleared codebase and RAG index for old project');
      }
      
      // Open the newly created project
      await handleOpenProject(projectPath);
      
      logger.info('New project created and opened successfully');
    } catch (error) {
      logger.error('Error creating new project:', error);
      throw error;
    }
  }, [project?.path, handleOpenProject]);

  const handleSave = useCallback(async () => {
    if (!activeTab || !activeTab.isDirty) {
      logger.debug('No active tab or tab is not dirty');
      return;
    }

    try {
      logger.info('Saving file:', activeTab.path);
      
      // Format on save if enabled
      let contentToSave = activeTab.content;
      if (settings.formatOnSave) {
        try {
          const formatted = await lintingService.formatFile(activeTab.path, activeTab.content, activeTab.language);
          contentToSave = formatted;
          // Update tab content
          setOpenTabs(prev => prev.map(tab => 
            tab.id === activeTab.id ? { ...tab, content: formatted } : tab
          ));
        } catch (error) {
          logger.debug('Error formatting file on save:', error);
        }
      }

      // Fix auto-fixable issues on save if enabled
      if (settings.lintOnSave) {
        try {
          const fixResult = await lintingService.fixFile(activeTab.path, contentToSave, activeTab.language);
          if (fixResult.fixed) {
            contentToSave = fixResult.content;
            // Update tab content
            setOpenTabs(prev => prev.map(tab => 
              tab.id === activeTab.id ? { ...tab, content: fixResult.content } : tab
            ));
          }
        } catch (error) {
          logger.debug('Error fixing file on save:', error);
        }
      }

      const tabToSave = { ...activeTab, content: contentToSave };
      const savedTab = await fileService.saveTab(tabToSave);
      setOpenTabs(prev => prev.map(tab => tab.id === savedTab.id ? savedTab : tab));
      setActiveTab(savedTab);
      
      // Update codebase index for saved file
      if (project?.path) {
        codebaseIndexService.updateFileIndex(project.path, activeTab.path).catch(error => {
          logger.debug('Error updating file index:', error);
        });
        
        // Update RAG index for saved file (инкрементальное обновление)
        ragService.updateFileIndex(project.path, activeTab.path).catch(error => {
          logger.debug('Error updating RAG index:', error);
        });
      }
      
      logger.info('File saved successfully:', activeTab.path);
    } catch (error) {
      logger.error('Failed to save file:', error, { filePath: activeTab.path });
    }
  }, [activeTab, project?.path, settings.formatOnSave, settings.lintOnSave]);

  const handleSaveAll = useCallback(async () => {
    const dirtyTabs = openTabs.filter(tab => tab.isDirty);
    if (dirtyTabs.length === 0) {
      logger.debug('No dirty tabs to save');
      return;
    }

    try {
      logger.info('Saving all files:', { count: dirtyTabs.length });
      const savedTabs = await fileService.saveAllTabs(openTabs);
      setOpenTabs(savedTabs);
      if (activeTab) {
        const updatedActiveTab = savedTabs.find(tab => tab.id === activeTab.id);
        if (updatedActiveTab) {
          setActiveTab(updatedActiveTab);
        }
      }
      logger.info('All files saved successfully');
    } catch (error) {
      logger.error('Failed to save all files:', error);
    }
  }, [openTabs, activeTab]);

  // Handle Electron menu events
  useEffect(() => {
    if (!window.electronAPI) {
      logger.warn('Electron API not available - running in browser mode');
      return;
    }

    const handleMenuAction = (event: any, data?: any) => {
      logger.debug('Menu action received:', { event, data });
      if (data?.type === 'menu-open-project' && data.path) {
        handleOpenProject(data.path);
      } else if (data?.type === 'menu-new-project') {
        logger.info('menu-new-project event received, calling handleNewProject');
        handleNewProject();
      } else if (data?.type === 'menu-save') {
        handleSave();
      } else if (data?.type === 'menu-save-all') {
        handleSaveAll();
      } else if (data?.type === 'menu-ai-chat') {
        setShowAIPanel(prev => !prev);
      } else if (data?.type === 'menu-terminal') {
        setShowTerminal(prev => !prev);
      } else {
        logger.warn('Unknown menu action type:', data?.type);
      }
    };

    window.electronAPI.onMenuAction(handleMenuAction);

    return () => {
      if (window.electronAPI) {
        // Clean up all listeners properly
        window.electronAPI.removeAllListeners('menu-new-project');
        window.electronAPI.removeAllListeners('menu-open-project');
        window.electronAPI.removeAllListeners('menu-save');
        window.electronAPI.removeAllListeners('menu-save-all');
        window.electronAPI.removeAllListeners('menu-ai-chat');
        window.electronAPI.removeAllListeners('menu-ai-generate');
        window.electronAPI.removeAllListeners('menu-ai-analyze');
      }
    };
  }, [handleOpenProject, handleNewProject, handleSave, handleSaveAll]);

  useEffect(() => {
    // Apply theme
    const root = document.documentElement;
    if (settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [settings.theme]);

  // Listen for global events from AI Tools Panel
  useEffect(() => {
    const handleOpenAIPanel = () => {
      setShowAIPanel(true);
    };

    const handleOpenSettings = () => {
      setShowSettings(true);
    };

    window.addEventListener('open-ai-panel', handleOpenAIPanel);
    window.addEventListener('open-settings', handleOpenSettings);

    return () => {
      window.removeEventListener('open-ai-panel', handleOpenAIPanel);
      window.removeEventListener('open-settings', handleOpenSettings);
    };
  }, []);

  // Handle global keyboard shortcuts - must work everywhere including Monaco Editor
  useEffect(() => {
    // Listen for custom events from early keyboard handler (index.tsx) and Monaco Editor
    const handleCommandPaletteEvent = () => {
      setShowCommandPalette(prev => !prev);
    };
    
    const handleGlobalShortcut = (e: CustomEvent) => {
      const action = e.detail?.action;
      logger.debug('Global shortcut event received:', action);
      
      switch (action) {
        case 'command-palette':
          setShowCommandPalette(prev => !prev);
          break;
        case 'new-project':
          handleNewProject();
          break;
        case 'open-project':
          if (window.electronAPI && window.electronAPI.showOpenDialog) {
            window.electronAPI.showOpenDialog({
              properties: ['openDirectory']
            }).then((result: any) => {
              if (result.success && !result.canceled && result.filePaths && result.filePaths.length > 0) {
                handleOpenProject(result.filePaths[0]);
              }
            }).catch((error: any) => {
              logger.error('Failed to open project dialog:', error);
            });
          }
          break;
        case 'save':
          handleSave();
          break;
        case 'save-all':
          handleSaveAll();
          break;
        case 'ai-panel':
          setShowAIPanel(prev => !prev);
          break;
        case 'terminal':
          setShowTerminal(prev => !prev);
          break;
        case 'settings':
          setShowSettings(true);
          break;
        case 'problems-panel':
          setShowProblemsPanel(prev => !prev);
          break;
        case 'global-search':
          setShowGlobalSearch(prev => !prev);
          break;
      }
    };
    
    const handleShowReferences = (e: CustomEvent) => {
      const refs = e.detail?.references || [];
      setReferences(refs);
      setShowReferences(true);
    };

    const handleOpenFile = (e: CustomEvent) => {
      const { path, line } = e.detail || {};
      if (path) {
        handleFileOpen(path);
        // Navigate to line if specified
        if (line) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('navigate-to-line', { detail: { line } }));
          }, 100);
        }
      }
    };

    window.addEventListener('open-command-palette', handleCommandPaletteEvent);
    window.addEventListener('global-shortcut', handleGlobalShortcut as EventListener);
    window.addEventListener('show-references', handleShowReferences as EventListener);
    window.addEventListener('open-file', handleOpenFile as EventListener);
    
    // Handle Escape key for closing modals (only in App, not in early handler)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const target = e.target as HTMLElement;
        const isRegularInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
        const isContentEditable = target?.isContentEditable;
        
        if (isRegularInput || isContentEditable) {
          return; // Don't close modals when typing
        }
        
        // Close modals in order of priority
        if (showCommandPalette) {
          e.preventDefault();
          setShowCommandPalette(false);
          return;
        }
        if (showGlobalSearch) {
          e.preventDefault();
          setShowGlobalSearch(false);
          return;
        }
        if (showSettings) {
          e.preventDefault();
          setShowSettings(false);
          return;
        }
        if (showNewProjectDialog) {
          e.preventDefault();
          setShowNewProjectDialog(false);
          return;
        }
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      window.removeEventListener('open-command-palette', handleCommandPaletteEvent);
      window.removeEventListener('global-shortcut', handleGlobalShortcut as EventListener);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('show-references', handleShowReferences as EventListener);
      window.removeEventListener('open-file', handleOpenFile as EventListener);
    };
  }, [
    handleNewProject, 
    handleOpenProject, 
    handleSave, 
    handleSaveAll,
    handleFileOpen,
    showCommandPalette,
    showGlobalSearch,
    showSettings,
    showNewProjectDialog
  ]);

  // Subscribe to problems changes
  useEffect(() => {
    const unsubscribe = problemsService.subscribe((newProblems) => {
      setProblems(newProblems);
    });

    return unsubscribe;
  }, []);

  // Create commands for Command Palette
  const commandContext: CommandContext = {
    project,
    activeTab,
    openTabs,
    onOpenProject: () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ['openDirectory']
        }).then((result: any) => {
          if (result.success && !result.canceled && result.filePaths && result.filePaths.length > 0) {
            handleOpenProject(result.filePaths[0]);
          }
        }).catch((error: any) => {
          logger.error('Failed to open project dialog:', error);
        });
      }
    },
    onNewProject: handleNewProject,
    onSave: handleSave,
    onSaveAll: handleSaveAll,
    onOpenSettings: () => setShowSettings(true),
    onToggleAIPanel: () => setShowAIPanel(prev => !prev),
    onToggleTerminal: () => setShowTerminal(prev => !prev),
    onToggleGitPanel: () => setShowGitPanel(prev => !prev),
    onToggleGitHubPanel: () => setShowGitHubPanel(prev => !prev),
    onToggleProblemsPanel: () => setShowProblemsPanel(prev => !prev),
    onToggleGlobalSearch: () => setShowGlobalSearch(prev => !prev),
    onToggleBookmarks: () => setShowBookmarks(prev => !prev),
    onToggleDebugPanel: () => setShowDebugPanel(prev => !prev),
    onOpenFile: handleFileOpen,
    onCloseTab: handleTabClose
  };

  const commands = createCommands(commandContext);

  return (
    <ErrorBoundary>
      <div className="App" data-theme={settings.theme}>
        <Layout>
          <MenuBarSimple 
            onOpenProject={(projectPath?: string) => {
              logger.debug('onOpenProject called from menu:', { projectPath });
              if (projectPath) {
                handleOpenProject(projectPath);
              } else {
                // Если путь не передан, открываем диалог выбора папки
                if (window.electronAPI && window.electronAPI.showOpenDialog) {
                  logger.debug('Opening project dialog via Electron API');
                  window.electronAPI.showOpenDialog({
                    properties: ['openDirectory']
                  }).then((result: any) => {
                    logger.debug('Project dialog result:', result);
                    if (result.success && !result.canceled && result.filePaths && result.filePaths.length > 0) {
                      handleOpenProject(result.filePaths[0]);
                    } else {
                      logger.debug('Project dialog was canceled or failed');
                    }
                  }).catch((error: any) => {
                    logger.error('Failed to open project dialog:', error);
                  });
                } else {
                  logger.warn('Electron API not available - cannot open project dialog');
                }
              }
            }}
            onSave={handleSave}
            onSaveAll={handleSaveAll}
            onOpenSettings={() => setShowSettings(true)}
            onToggleAIPanel={() => {
              logger.debug('Toggle AI panel requested');
              setShowAIPanel(prev => !prev);
            }}
            onToggleTerminal={() => {
              logger.debug('Toggle terminal requested');
              setShowTerminal(prev => !prev);
            }}
            onNewProject={() => {
              console.log('=== onNewProject CALLED from MenuBarSimple ===');
              logger.debug('New project requested via menu');
              console.log('handleNewProject exists:', !!handleNewProject);
              console.log('Calling handleNewProject...');
              try {
                handleNewProject();
                console.log('handleNewProject called successfully');
              } catch (error) {
                console.error('Error calling handleNewProject:', error);
                logger.error('Error calling handleNewProject:', error);
              }
            }}
            onReload={() => {
              window.location.reload();
            }}
            onToggleDevTools={() => {
              logger.debug('Toggle DevTools requested');
              if (window.electronAPI && (window.electronAPI as any).toggleDevTools) {
                // Используем метод из electronAPI
                (window.electronAPI as any).toggleDevTools();
                logger.debug('DevTools toggle called');
              } else {
                // Fallback: просто сообщаем пользователю
                console.log('Используйте F12 для открытия/закрытия DevTools');
              }
            }}
          />
          
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', minWidth: 0 }}>
            {isLoadingProject && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '24px 32px',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                >
                  <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border-subtle)', borderTop: '3px solid var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                    Загрузка проекта...
                  </span>
                </div>
              </div>
            )}
            
            <SidebarSimple
              project={project}
              onFileOpen={handleFileOpen}
              onProjectOpen={handleOpenProject}
              onOpenInlineChat={() => {
                // Открытие Inline Chat будет обработано через событие в EditorPanel
                logger.debug('Open inline chat requested from sidebar');
              }}
              onOpenAIPanel={() => {
                setShowAIPanel(true);
              }}
            />
            
            {useSplitView ? (
              <SplitEditorPanel
                tabs={openTabs}
                activeTab={activeTab}
                onTabClose={handleTabClose}
                onTabSelect={handleTabSelect}
                onTabContentChange={handleTabContentChange}
                onSave={handleSave}
                settings={settings}
                projectContext={{
                  files: openTabs,
                  projectPath: project?.path
                }}
              />
            ) : (
              <EditorPanel
                tabs={openTabs}
                activeTab={activeTab}
                onTabClose={handleTabClose}
                onTabSelect={handleTabSelect}
                onTabContentChange={handleTabContentChange}
                onSave={handleSave}
                settings={settings}
                projectContext={{
                  files: openTabs,
                  projectPath: project?.path
                }}
              />
            )}
            
            {showProblemsPanel && (
              <ProblemsPanel
                problems={problems}
                onClose={() => setShowProblemsPanel(false)}
                onProblemClick={(problem) => {
                  handleFileOpen(problem.file);
                  // Focus will be handled by EditorPanel
                }}
              />
            )}

            {showGitPanel && (
              <GitPanel
                projectPath={project?.path}
                onClose={() => setShowGitPanel(false)}
                onFileOpen={handleFileOpen}
              />
            )}

            {showGitHubPanel && (
              <GitHubPanel
                githubToken={settings.githubToken}
                onClose={() => setShowGitHubPanel(false)}
                onProjectOpen={handleOpenProject}
              />
            )}

            {showBookmarks && (
              <BookmarksPanel
                projectPath={project?.path}
                onClose={() => setShowBookmarks(false)}
                onNavigateToBookmark={(bookmark) => {
                  handleFileOpen(bookmark.filePath);
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('navigate-to-line', { 
                      detail: { line: bookmark.lineNumber, column: bookmark.column } 
                    }));
                  }, 100);
                }}
              />
            )}

            {showDebugPanel && (
              <DebugPanel
                projectPath={project?.path}
                onClose={() => setShowDebugPanel(false)}
                onNavigateToFile={(filePath, line) => {
                  handleFileOpen(filePath);
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('navigate-to-line', { 
                      detail: { line, column: 1 } 
                    }));
                  }, 100);
                }}
              />
            )}
            
            {showAIPanel && (
              <AIPanel
                sessions={aiSessions}
                activeSession={activeAISession}
                onSessionSelect={(session) => setActiveAISession(session)}
                onNewSession={() => {
                  // Очищаем кеши при создании новой сессии для чистого контекста
                  inlineCompletionService.clearCache();
                  logger.debug('Cleared inline completion cache for new session');
                  
                  const newSession: AIChatSession = {
                    id: `session-${Date.now()}`,
                    title: `Чат ${aiSessions.length + 1}`,
                    messages: []
                  };
                  setAISessions(prev => [...prev, newSession]);
                  setActiveAISession(newSession);
                }}
                onClose={() => setShowAIPanel(false)}
                onSessionUpdate={(sessionId, messages) => {
                  // Remove duplicates before updating
                  const uniqueMessages = messages.filter((msg, index, self) => {
                // Keep only first occurrence of each ID
                const firstIndex = self.findIndex(m => m.id === msg.id);
                // Remove empty streaming messages if non-empty exists
                if (msg.id.startsWith('streaming-') && msg.content === '') {
                  const hasNonEmpty = self.some(m => 
                    m.id.startsWith('streaming-') && 
                    m.content !== '' && 
                    m.role === 'assistant'
                  );
                  return !hasNonEmpty || index === firstIndex;
                }
                return index === firstIndex;
              });
                  
                  setAISessions(prev => {
                    const updated = prev.map(session => 
                      session.id === sessionId 
                        ? { ...session, messages: uniqueMessages }
                        : session
                    );
                    // Update active session if it matches - use the same updated object
                    if (activeAISession?.id === sessionId) {
                      const updatedActive = updated.find(s => s.id === sessionId);
                      if (updatedActive) {
                        setActiveAISession(updatedActive);
                      }
                    }
                    return updated;
                  });
                }}
                projectContext={{
                  files: openTabs,
                  projectPath: project?.path
                }}
                settings={settings}
                onFileCreate={async (filePath: string, content: string) => {
                  try {
                    await fileService.writeFile(filePath, content);
                    logger.info('File created by AI:', filePath);
                  } catch (error) {
                    logger.error('Failed to create file:', error, { filePath });
                    throw error;
                  }
                }}
                onFileOpen={handleFileOpen}
              />
            )}
          </div>
          
          {showTerminal && (
            <TerminalPanel
              onClose={() => setShowTerminal(false)}
              projectPath={project?.path}
              theme={settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'}
            />
          )}
          
          <StatusBarSimple
            project={project}
            activeTab={activeTab}
            settings={settings}
            ragIndexing={ragIndexing}
          />
        </Layout>

        {showSettings && (
          <SettingsDialogSimple
            settings={settings}
            onSettingsChange={setSettings}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showNewProjectDialog && (
          <NewProjectDialog
            onClose={() => setShowNewProjectDialog(false)}
            onCreate={handleCreateProject}
          />
        )}

        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          commands={commands}
          project={project}
          activeTab={activeTab}
        />

        <GlobalSearch
          project={project}
          isOpen={showGlobalSearch}
          onClose={() => setShowGlobalSearch(false)}
          onFileOpen={handleFileOpen}
        />

        {showReferences && (
          <ReferencesPanel
            references={references}
            onClose={() => setShowReferences(false)}
            onNavigateToReference={(ref) => {
              handleFileOpen(ref.filePath);
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('navigate-to-line', { detail: { line: ref.range.startLineNumber, column: ref.range.startColumn } }));
              }, 100);
              setShowReferences(false);
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;