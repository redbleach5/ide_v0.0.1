import { Command } from '../components/CommandPalette';
import { Tab, Project } from '../types';

export interface CommandContext {
  project?: Project | null;
  activeTab?: Tab | null;
  openTabs?: Tab[];
  onOpenProject?: () => void;
  onNewProject?: () => void;
  onSave?: () => void;
  onSaveAll?: () => void;
  onOpenSettings?: () => void;
  onToggleAIPanel?: () => void;
  onToggleTerminal?: () => void;
  onToggleGitPanel?: () => void;
  onToggleGitHubPanel?: () => void;
  onToggleProblemsPanel?: () => void;
  onToggleGlobalSearch?: () => void;
  onToggleBookmarks?: () => void;
  onToggleDebugPanel?: () => void;
  onOpenFile?: (filePath: string) => void;
  onCloseTab?: (tabId: string) => void;
}

export function createCommands(context: CommandContext): Command[] {
  const {
    project,
    activeTab,
    openTabs = [],
    onOpenProject,
    onNewProject,
    onSave,
    onSaveAll,
    onOpenSettings,
    onToggleAIPanel,
    onToggleTerminal,
    onOpenFile
  } = context;

  const commands: Command[] = [];

  // File commands
  if (onNewProject) {
    commands.push({
      id: 'file.new-project',
      label: 'Новый проект',
      category: 'Файл',
      keywords: ['новый', 'проект', 'create', 'new', 'project'],
      shortcut: 'Ctrl+N',
      action: onNewProject
    });
  }

  if (onOpenProject) {
    commands.push({
      id: 'file.open-project',
      label: 'Открыть проект',
      category: 'Файл',
      keywords: ['открыть', 'проект', 'open', 'project', 'folder'],
      shortcut: 'Ctrl+O',
      action: onOpenProject
    });
  }

  if (onSave && activeTab) {
    commands.push({
      id: 'file.save',
      label: 'Сохранить',
      category: 'Файл',
      keywords: ['сохранить', 'save', 'файл', 'file'],
      shortcut: 'Ctrl+S',
      action: onSave
    });
  }

  if (onSaveAll) {
    commands.push({
      id: 'file.save-all',
      label: 'Сохранить всё',
      category: 'Файл',
      keywords: ['сохранить', 'всё', 'save', 'all', 'все'],
      shortcut: 'Ctrl+Shift+S',
      action: onSaveAll
    });
  }

  // View commands
  if (onToggleAIPanel) {
    commands.push({
      id: 'view.toggle-ai-panel',
      label: 'Переключить AI Панель',
      category: 'Вид',
      keywords: ['ai', 'панель', 'чат', 'chat', 'panel', 'toggle'],
      shortcut: 'Ctrl+Shift+/',
      action: onToggleAIPanel
    });
  }

  if (onToggleTerminal) {
    commands.push({
      id: 'view.toggle-terminal',
      label: 'Переключить Терминал',
      category: 'Вид',
      keywords: ['терминал', 'terminal', 'консоль', 'console', 'toggle'],
      shortcut: 'Ctrl+Shift+`',
      action: onToggleTerminal
    });
  }

  // Settings
  if (onOpenSettings) {
    commands.push({
      id: 'preferences.settings',
      label: 'Настройки',
      category: 'Настройки',
      keywords: ['настройки', 'settings', 'preferences', 'config'],
      shortcut: 'Ctrl+,',
      action: onOpenSettings
    });
  }

  // Git commands
  if (project && context.onToggleGitPanel) {
    commands.push({
      id: 'git.toggle-panel',
      label: 'Git: Показать панель',
      category: 'Git',
      keywords: ['git', 'панель', 'panel', 'статус', 'status'],
      action: context.onToggleGitPanel
    });
  }

  // GitHub commands
  if (context.onToggleGitHubPanel) {
    commands.push({
      id: 'github.toggle-panel',
      label: 'GitHub: Показать панель',
      category: 'GitHub',
      keywords: ['github', 'панель', 'panel', 'репозитории', 'repositories'],
      action: context.onToggleGitHubPanel
    });
  }

  // Search commands
  if (context.onToggleGlobalSearch) {
    commands.push({
      id: 'search.find-in-files',
      label: 'Найти в файлах',
      category: 'Поиск',
      keywords: ['поиск', 'найти', 'search', 'find', 'файлы', 'files'],
      shortcut: 'Ctrl+Shift+F',
      action: context.onToggleGlobalSearch
    });
  }

  // Markdown preview (only if markdown file is open)
  if (activeTab?.language === 'markdown') {
    commands.push({
      id: 'markdown.toggle-preview',
      label: 'Переключить предпросмотр Markdown',
      category: 'Редактор',
      keywords: ['markdown', 'предпросмотр', 'preview', 'md', 'просмотр'],
      shortcut: 'Ctrl+Shift+V',
      action: () => {
        window.dispatchEvent(new CustomEvent('toggle-markdown-preview'));
      }
    });
  }

  // Problems panel
  if (context.onToggleProblemsPanel) {
    commands.push({
      id: 'view.problems',
      label: 'Показать проблемы',
      category: 'Вид',
      keywords: ['проблемы', 'ошибки', 'problems', 'errors', 'warnings'],
      shortcut: 'Ctrl+Shift+M',
      action: context.onToggleProblemsPanel
    });
  }

  // Bookmarks panel
  if (context.onToggleBookmarks) {
    commands.push({
      id: 'view.bookmarks',
      label: 'Показать закладки',
      category: 'Вид',
      keywords: ['закладки', 'bookmarks', 'bookmark'],
      shortcut: 'Ctrl+Alt+B',
      action: context.onToggleBookmarks
    });
  }

  // Debug panel
  if (context.onToggleDebugPanel) {
    commands.push({
      id: 'view.debug',
      label: 'Показать отладчик',
      category: 'Отладка',
      keywords: ['отладка', 'debug', 'debugger', 'breakpoint'],
      shortcut: 'Ctrl+Shift+D',
      action: context.onToggleDebugPanel
    });
  }

  // Tab management
  if (openTabs.length > 0) {
    openTabs.forEach((tab, index) => {
      commands.push({
        id: `tab.open-${tab.id}`,
        label: `Открыть: ${tab.title}`,
        category: 'Вкладки',
        keywords: ['вкладка', 'tab', 'файл', 'file', tab.title.toLowerCase()],
        action: () => {
          if (onOpenFile) {
            onOpenFile(tab.path);
          }
        }
      });
    });
  }

  return commands;
}
