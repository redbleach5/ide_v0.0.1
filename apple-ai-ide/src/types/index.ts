export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  isOpen?: boolean;
}

export interface Tab {
  id: string;
  title: string;
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export interface Project {
  name: string;
  path: string;
  files: FileNode[];
  openTabs: Tab[];
  activeTabId?: string;
}

export interface AIModel {
  name: string;
  provider: 'ollama' | 'lmstudio';
  endpoint: string;
  model: string;
  isActive: boolean;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'chat' | 'code' | 'analysis';
  tool_calls?: Array<{
    id?: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

export interface AIChatSession {
  id: string;
  title: string;
  messages: AIMessage[];
  context?: {
    files?: string[];
    projectPath?: string;
  };
}

export interface IDESettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  aiProvider: 'ollama' | 'lmstudio';
  ollamaEndpoint: string;
  lmStudioEndpoint: string;
  selectedModel: string;
  autoSave: boolean;
  autoSaveDelay: number;
  inlineCompletions: boolean;
  inlineCompletionsDelay: number;
  streamingResponses: boolean;
  formatOnSave?: boolean;
  lintOnSave?: boolean;
  githubToken?: string;
}

export interface CodeAction {
  id: string;
  title: string;
  type: 'refactor' | 'generate' | 'fix' | 'explain' | 'optimize';
  description: string;
  icon?: string;
}

export interface AICodeSuggestion {
  type: 'completion' | 'refactor' | 'generation' | 'fix';
  content: string;
  description?: string;
  confidence?: number;
}

declare global {
  interface Window {
    __inlineChatAction?: string;
    MonacoEnvironment?: {
      locale?: string;
      [key: string]: unknown;
    };
    electronAPI: {
      readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      readDirectory: (dirPath: string) => Promise<{ success: boolean; files?: any[]; error?: string }>;
      getFileSize?: (filePath: string) => Promise<{ success: boolean; size?: number; error?: string }>;
      showOpenDialog?: (options: { properties: string[] }) => Promise<{ success: boolean; canceled?: boolean; filePaths?: string[]; error?: string }>;
      createProject?: (projectPath: string, projectName: string) => Promise<{ success: boolean; projectPath?: string; error?: string }>;
      onMenuAction: (callback: (event: any, data?: any) => void) => void;
      removeAllListeners: (channel: string) => void;
      git?: {
        execute: (projectPath: string, command: string) => Promise<{ success: boolean; output?: string; error?: string }>;
        isRepository: (projectPath: string) => Promise<{ success: boolean; isRepository?: boolean; error?: string }>;
      };
      terminal?: {
        create: (options: { cwd?: string; shell?: string; env?: Record<string, string> }) => Promise<string>;
        write: (ptyId: string, data: string) => Promise<{ success: boolean; error?: string }>;
        resize: (ptyId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
        kill: (ptyId: string) => Promise<{ success: boolean; error?: string }>;
        onData: (ptyId: string, callback: (data: string) => void) => () => void;
        onExit: (ptyId: string, callback: (exitCode: number, signal?: number) => void) => () => void;
      };
    };
    versions: {
      node: string;
      chrome: string;
      electron: string;
      platform?: string; // 'darwin', 'win32', 'linux'
    };
  }
}