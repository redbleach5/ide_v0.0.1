import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { MenuBarSimple } from './components/MenuBarSimple';
import { SidebarSimple } from './components/SidebarSimple';
import { EditorPanelSimple } from './components/EditorPanelSimple';
import { StatusBarSimple } from './components/StatusBarSimple';
import { SettingsDialogSimple } from './components/SettingsDialogSimple';
import { AIPanel } from './components/AIPanel';
import { Project, Tab, IDESettings, AIChatSession, AIMessage } from './types';
import { fileService } from './services/fileService';
import { logger } from './utils/logger';
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
  streamingResponses: true
};

// Sample data for demonstration
const sampleProject: Project = {
  name: 'AI IDE',
  path: '/demo',
  files: [
    {
      name: 'src',
      path: '/demo/src',
      isDirectory: true,
      isOpen: true,
      children: [
        {
          name: 'App.tsx',
          path: '/demo/src/App.tsx',
          isDirectory: false
        },
        {
          name: 'index.tsx',
          path: '/demo/src/index.tsx',
          isDirectory: false
        },
        {
          name: 'components',
          path: '/demo/src/components',
          isDirectory: true,
          isOpen: false,
          children: [
            {
              name: 'Header.tsx',
              path: '/demo/src/components/Header.tsx',
              isDirectory: false
            },
            {
              name: 'MenuBar.tsx',
              path: '/demo/src/components/MenuBar.tsx',
              isDirectory: false
            },
            {
              name: 'Sidebar.tsx',
              path: '/demo/src/components/Sidebar.tsx',
              isDirectory: false
            }
          ]
        },
        {
          name: 'services',
          path: '/demo/src/services',
          isDirectory: true,
          isOpen: false,
          children: [
            {
              name: 'aiService.ts',
              path: '/demo/src/services/aiService.ts',
              isDirectory: false
            },
            {
              name: 'fileService.ts',
              path: '/demo/src/services/fileService.ts',
              isDirectory: false
            }
          ]
        }
      ]
    },
    {
      name: 'package.json',
      path: '/demo/package.json',
      isDirectory: false
    },
    {
      name: 'README.md',
      path: '/demo/README.md',
      isDirectory: false
    },
    {
      name: 'tsconfig.json',
      path: '/demo/tsconfig.json',
      isDirectory: false
    }
  ],
  openTabs: [],
  activeTabId: undefined
};

const sampleTabs: Tab[] = [
  {
    id: 'tab1',
    title: 'App.tsx',
    path: '/demo/src/App.tsx',
    content: `import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { MenuBar } from './components/MenuBar';
import { Sidebar } from './components/Sidebar';
import { EditorPanel } from './components/EditorPanel';
import { StatusBar } from './components/StatusBar';
import { Project, Tab, IDESettings } from './types';

function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [settings, setSettings] = useState<IDESettings>(defaultSettings);

  return (
    <div className="App" data-theme={settings.theme}>
      <Layout>
        <MenuBar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar project={project} />
          <EditorPanel
            tabs={project?.openTabs || []}
            activeTab={activeTab}
            settings={settings}
          />
        </div>
        <StatusBar
          project={project}
          activeTab={activeTab}
          settings={settings}
        />
      </Layout>
    </div>
  );
}

export default App;`,
    language: 'typescript',
    isDirty: false
  },
  {
    id: 'tab2',
    title: 'README.md',
    path: '/demo/README.md',
    content: `# AI IDE

A beautiful integrated development environment with AI-powered assistance.

## ✨ Features

### 🎨 Modern Design
- Clean, minimalist interface
- Smooth animations and transitions
- Dark and light theme support
- Native macOS window controls

### 🤖 AI Integration
- Local AI model support (Ollama, LM Studio)
- Code generation and completion
- Project analysis and refactoring
- Chat interface for AI assistance

### 📝 Advanced Editor
- Syntax highlighting for multiple languages
- IntelliSense and code completion
- Multi-tab interface
- Split view support
- Git integration

### 📁 Project Management
- File explorer with tree view
- Project search and filtering
- Recent projects
- Workspace management

### ⚙️ Customization
- Custom themes and color schemes
- Keyboard shortcuts
- Extensions support
- Settings and preferences

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- Ollama or LM Studio for AI features

### Installation
\`\`\`bash
git clone https://github.com/your-username/ai-ide.git
cd ai-ide
npm install
npm start
\`\`\`

### AI Setup

#### With Ollama
1. Install Ollama: \`curl -fsSL https://ollama.ai/install.sh | sh\`
2. Pull a model: \`ollama pull codellama\`
3. Start Ollama server: \`ollama serve\`

#### With LM Studio
1. Download and install LM Studio
2. Load your preferred model
3. Start the local server

## 🎯 Usage

1. **Open Project**: Click "File" → "Open Project" or use \`⌘O\`
2. **AI Chat**: Press \`⌘⇧/\` to open AI assistant
3. **Code Generation**: Use \`⌘⇧G\` to generate code
4. **Settings**: Click the gear icon to configure settings

## 🛠️ Development

### Technology Stack
- **Frontend**: React with TypeScript
- **Desktop**: Electron
- **Editor**: Monaco Editor
- **UI**: Custom components with CSS-in-JS
- **AI**: REST API integration

### Project Structure
\`\`\`
src/
├── components/     # React components
├── services/      # API and business logic
├── styles/        # Global styles and themes
├── types/         # TypeScript definitions
└── utils/         # Helper functions
\`\`\`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- The open-source community for inspiration
- Microsoft for Monaco Editor
- The open-source community

---

Made with ❤️ by the AI IDE team`,
    language: 'markdown',
    isDirty: false
  }
];

function AppSimple() {
  const [project, setProject] = useState<Project | null>(sampleProject);
  const [activeTab, setActiveTab] = useState<Tab | null>(sampleTabs[0]);
  const [openTabs, setOpenTabs] = useState<Tab[]>(sampleTabs);
  const [settings, setSettings] = useState<IDESettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiSessions, setAISessions] = useState<AIChatSession[]>([
    {
      id: 'default',
      title: 'Новый чат',
      messages: []
    }
  ]);
  const [activeAISession, setActiveAISession] = useState<AIChatSession | null>(aiSessions[0]);

  // Sync activeAISession with aiSessions
  useEffect(() => {
    if (activeAISession && !aiSessions.find(s => s.id === activeAISession.id)) {
      // Active session was removed, switch to first available
      setActiveAISession(aiSessions[0] || null);
    }
  }, [aiSessions, activeAISession]);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('ide-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
        logger.debug('Settings loaded from localStorage');
      }
    } catch (error) {
      logger.error('Failed to load settings from localStorage:', error);
    }
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

    try {
      logger.debug('Opening file:', filePath);
      const newTab = await fileService.createTab(filePath);
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTab(newTab);
      logger.debug('File opened successfully:', filePath);
    } catch (error) {
      logger.error('Failed to open file:', error, { filePath });
      // Fallback to demo content if file read fails
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'Без названия';
      const language = fileService.getLanguageFromExtension(fileName);
      const newTab: Tab = {
        id: fileService.generateTabId(),
        title: fileName,
        path: filePath,
        content: `// Не удалось загрузить файл: ${filePath}\n// Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        language,
        isDirty: false
      };
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTab(newTab);
    }
  }, [openTabs]);

  const handleOpenProject = useCallback(async (projectPath: string) => {
    try {
      logger.info('Opening project:', projectPath);
      const files = await fileService.buildFileTree(projectPath);
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
      logger.info('Project opened successfully:', projectPath);
    } catch (error) {
      logger.error('Failed to open project:', error, { projectPath });
    }
  }, []);

  const handleNewProject = useCallback(() => {
    logger.info('Creating new project');
    setProject(null);
    setOpenTabs([]);
    setActiveTab(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeTab || !activeTab.isDirty) {
      logger.debug('No active tab or tab is not dirty');
      return;
    }

    try {
      logger.info('Saving file:', activeTab.path);
      const savedTab = await fileService.saveTab(activeTab);
      setOpenTabs(prev => prev.map(tab => tab.id === savedTab.id ? savedTab : tab));
      setActiveTab(savedTab);
      logger.info('File saved successfully:', activeTab.path);
    } catch (error) {
      logger.error('Failed to save file:', error, { filePath: activeTab.path });
    }
  }, [activeTab]);

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
      if (data?.type === 'menu-open-project' && data.path) {
        handleOpenProject(data.path);
      } else if (data?.type === 'menu-new-project') {
        handleNewProject();
      } else if (data?.type === 'menu-save') {
        handleSave();
      } else if (data?.type === 'menu-save-all') {
        handleSaveAll();
      }
    };

    window.electronAPI.onMenuAction(handleMenuAction);

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('menu-new-project');
        window.electronAPI.removeAllListeners('menu-open-project');
        window.electronAPI.removeAllListeners('menu-save');
        window.electronAPI.removeAllListeners('menu-save-all');
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

  return (
    <div className="App" data-theme={settings.theme}>
      <Layout>
        <MenuBarSimple 
          onOpenProject={() => {
            if (window.electronAPI) {
              logger.debug('Open project requested via menu');
            } else {
              logger.warn('Open project not available in browser mode');
            }
          }}
          onSave={handleSave}
          onSaveAll={handleSaveAll}
          onOpenSettings={() => setShowSettings(true)}
          onToggleAIPanel={() => {
            logger.debug('Toggle AI panel requested');
            setShowAIPanel(prev => !prev);
          }}
        />
        
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <SidebarSimple
            project={project}
            onFileOpen={handleFileOpen}
            onProjectOpen={handleOpenProject}
          />
          
          <EditorPanelSimple
            tabs={openTabs}
            activeTab={activeTab}
            onTabClose={handleTabClose}
            onTabSelect={handleTabSelect}
            onTabContentChange={handleTabContentChange}
            settings={settings}
          />
          
          {showAIPanel && (
            <AIPanel
              sessions={aiSessions}
              activeSession={activeAISession}
              onSessionSelect={(session) => setActiveAISession(session)}
              onNewSession={() => {
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
                setAISessions(prev => 
                  prev.map(session => 
                    session.id === sessionId 
                      ? { ...session, messages }
                      : session
                  )
                );
                if (activeAISession?.id === sessionId) {
                  setActiveAISession({ ...activeAISession, messages });
                }
              }}
              projectContext={{
                files: openTabs,
                projectPath: project?.path
              }}
              settings={settings}
            />
          )}
        </div>
        
        <StatusBarSimple
          project={project}
          activeTab={activeTab}
          settings={settings}
        />
      </Layout>

      {showSettings && (
        <SettingsDialogSimple
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default AppSimple;