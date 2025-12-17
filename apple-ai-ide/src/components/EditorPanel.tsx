import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor, IDisposable } from 'monaco-editor';
import type * as Monaco from 'monaco-editor';
import { X, CircleDot, FileText, ChevronRight, Eye, Code } from 'lucide-react';
import { Tab, IDESettings } from '../types';
import { inlineCompletionService, InlineCompletionContext } from '../services/inlineCompletionService';
import { logger } from '../utils/logger';
import { InlineChat } from './InlineChat';
import { codeActionService, CodeActionContext } from '../services/codeActionService';
import { problemsService } from '../services/problemsService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { navigationService } from '../services/navigationService';
import { bookmarkService } from '../services/bookmarkService';
import { snippetService } from '../services/snippetService';
import { debugService } from '../services/debugService';
import { lintingService } from '../services/lintingService';

interface EditorPanelProps {
  tabs: Tab[];
  activeTab: Tab | null;
  onTabClose: (tabId: string) => void;
  onTabSelect: (tab: Tab) => void;
  onTabContentChange: (tabId: string, content: string) => void;
  onSave?: (tabId: string) => void;
  settings: IDESettings;
  projectContext?: {
    files?: Tab[];
    projectPath?: string;
  };
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  tabs,
  activeTab,
  onTabClose,
  onTabSelect,
  onTabContentChange,
  onSave,
  settings,
  projectContext
}) => {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inlineCompletionDisposableRef = useRef<IDisposable | null>(null);
  const codeActionDisposableRef = useRef<IDisposable | null>(null);
  const definitionProviderDisposableRef = useRef<IDisposable | null>(null);
  const referenceProviderDisposableRef = useRef<IDisposable | null>(null);
  const renameProviderDisposableRef = useRef<IDisposable | null>(null);
  const bookmarkDecorationsRef = useRef<string[]>([]);
  const breakpointDecorationsRef = useRef<string[]>([]);

  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [showInlineChat, setShowInlineChat] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [selectionPosition, setSelectionPosition] = useState<{ lineNumber: number; column: number } | null>(null);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  const handleEditorDidMount = (editor: MonacoEditor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Listen to diagnostics changes
    const updateDiagnostics = () => {
      if (!activeTab) return;
      
      const model = editor.getModel();
      if (!model) return;

      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      problemsService.updateProblems(activeTab.path, markers);
    };

    // Update diagnostics when markers change
    monaco.editor.onDidChangeMarkers(updateDiagnostics);
    
    // Initial diagnostics update
    setTimeout(updateDiagnostics, 100);

    // Lint file on content change (debounced)
    let lintTimeout: NodeJS.Timeout | null = null;
    const lintFile = async () => {
      if (!activeTab || !editor) return;

      try {
        const model = editor.getModel();
        if (!model) return;

        const content = model.getValue();
        const result = await lintingService.lintFile(activeTab.path, content, activeTab.language);

        // Convert lint issues to Monaco markers
        const markers = result.issues.map(issue => ({
          severity: issue.severity === 'error' 
            ? monaco.MarkerSeverity.Error 
            : issue.severity === 'warning'
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Info,
          startLineNumber: issue.line,
          startColumn: issue.column,
          endLineNumber: issue.endLine || issue.line,
          endColumn: issue.endColumn || issue.column + 1,
          message: issue.message,
          source: issue.source || 'Linter',
          code: issue.rule
        }));

        monaco.editor.setModelMarkers(model, 'linting', markers);
        problemsService.updateProblems(activeTab.path, markers);
      } catch (error) {
        logger.error('Error linting file:', error);
      }
    };

    // Lint on content change (debounced)
    editor.onDidChangeModelContent(() => {
      if (lintTimeout) {
        clearTimeout(lintTimeout);
      }
      lintTimeout = setTimeout(() => {
        lintFile();
      }, 1000); // Debounce 1 second
    });

    // Initial lint
    setTimeout(lintFile, 500);

    // Update bookmarks decorations
    const updateBookmarks = async () => {
      if (!activeTab || !projectContext?.projectPath || !editor) return;
      
      const bookmarks = bookmarkService.getBookmarks(projectContext.projectPath);
      const fileBookmarks = bookmarks.filter(b => b.filePath === activeTab.path);
      
      if (fileBookmarks.length > 0) {
        const decorations = fileBookmarks.map(bookmark => ({
          range: new monaco.Range(bookmark.lineNumber, 1, bookmark.lineNumber, 1),
          options: {
            isWholeLine: false,
            glyphMarginClassName: 'bookmark-glyph',
            glyphMarginHoverMessage: { value: bookmark.label || `Закладка на строке ${bookmark.lineNumber}` },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        }));
        
        bookmarkDecorationsRef.current = editor.deltaDecorations(bookmarkDecorationsRef.current, decorations);
      } else {
        bookmarkDecorationsRef.current = editor.deltaDecorations(bookmarkDecorationsRef.current, []);
      }
    };

    // Subscribe to bookmark changes
    if (projectContext?.projectPath) {
      const unsubscribe = bookmarkService.subscribe(projectContext.projectPath, () => {
        updateBookmarks();
      });
      
      // Initial update
      updateBookmarks();
      
      // Cleanup on unmount
      return () => {
        unsubscribe();
      };
    }

    // Update cursor position on change
    editor.onDidChangeCursorPosition(() => {
      const position = editor.getPosition();
      if (position) {
        setCursorPosition({ line: position.lineNumber, column: position.column });
      }
    });

    // Handle breakpoints - click on gutter to toggle
    editor.onMouseDown((e: MonacoEditor.IEditorMouseEvent) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS && activeTab) {
        const lineNumber = e.target.position.lineNumber;
        const result = debugService.toggleBreakpoint(activeTab.path, lineNumber);
        
        // Update breakpoint decorations
        updateBreakpointDecorations();
        
        logger.debug('Breakpoint toggled:', { filePath: activeTab.path, lineNumber, removed: result.removed });
      }
    });

    // Update breakpoint decorations
    const updateBreakpointDecorations = () => {
      if (!activeTab || !editor) return;
      
      const breakpoints = debugService.getBreakpoints(activeTab.path);
      const decorations = breakpoints
        .filter(bp => bp.enabled)
        .map(bp => ({
          range: new monaco.Range(bp.lineNumber, 1, bp.lineNumber, 1),
          options: {
            isWholeLine: false,
            glyphMarginClassName: 'breakpoint-glyph',
            glyphMarginHoverMessage: { value: `Точка останова на строке ${bp.lineNumber}` },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        }));
      
      breakpointDecorationsRef.current = editor.deltaDecorations(breakpointDecorationsRef.current, decorations);
    };

    // Initial breakpoint decorations
    if (activeTab) {
      updateBreakpointDecorations();
    }

    // Update breakpoints when active tab changes
    const updateBreakpointsOnTabChange = () => {
      updateBreakpointDecorations();
    };

    // Subscribe to breakpoint changes (would need event system in real implementation)
    // For now, update on tab change
    if (activeTab) {
      updateBreakpointsOnTabChange();
    }

    // Define custom theme with softer, more pleasant colors
    monaco.editor.defineTheme('ide-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '95a5a6', fontStyle: 'italic' },
        { token: 'keyword', foreground: '5b8db8', fontStyle: 'normal' },
        { token: 'string', foreground: '6b9e78', fontStyle: 'normal' },
        { token: 'number', foreground: 'c99a5a', fontStyle: 'normal' },
        { token: 'type', foreground: '9b7bb8', fontStyle: 'normal' },
        { token: 'function', foreground: '7b8ab8', fontStyle: 'normal' },
        { token: 'variable', foreground: '6b7b8b', fontStyle: 'normal' },
        { token: 'operator', foreground: '8b9ba6', fontStyle: 'normal' }
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#2c3e50',
        'editorLineNumber.foreground': '#95a5a6',
        'editor.selectionBackground': '#5b8db833',
        'editor.lineHighlightBackground': '#f8f9fa',
        'editorCursor.foreground': '#5b8db8',
        'editorWhitespace.foreground': '#e0e4e7',
        'editorIndentGuide.background': '#e8eaed',
        'editorIndentGuide.activeBackground': '#d0d4d7',
        'editorError.foreground': '#c85a5a',
        'editorWarning.foreground': '#c99a5a',
        'editorInfo.foreground': '#5b8db8',
        'editorBracketMatch.background': '#e8eaed',
        'editorBracketMatch.border': '#95a5a6'
      }
    });

    monaco.editor.defineTheme('ide-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7b8b', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7ba3d8', fontStyle: 'normal' },
        { token: 'string', foreground: '8bc58b', fontStyle: 'normal' },
        { token: 'number', foreground: 'd4a574', fontStyle: 'normal' },
        { token: 'type', foreground: 'b89bc8', fontStyle: 'normal' },
        { token: 'function', foreground: '9ba3d8', fontStyle: 'normal' },
        { token: 'variable', foreground: '9ba3b3', fontStyle: 'normal' },
        { token: 'operator', foreground: 'a3b3c3', fontStyle: 'normal' }
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#6b7b8b',
        'editor.selectionBackground': '#7ba3d833',
        'editor.lineHighlightBackground': '#252526',
        'editorCursor.foreground': '#7ba3d8',
        'editorWhitespace.foreground': '#3e3e42',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#4e4e52',
        'editorError.foreground': '#d87a7a',
        'editorWarning.foreground': '#d4a574',
        'editorInfo.foreground': '#7ba3d8',
        'editorBracketMatch.background': '#404040',
        'editorBracketMatch.border': '#6b7b8b'
      }
    });

    // Configure editor settings with enhanced options
    editor.updateOptions({
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap ? 'on' : 'off',
      minimap: { 
        enabled: settings.minimap,
        showSlider: 'always',
        side: 'right'
      },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      lineNumbers: 'on',
      renderLineHighlight: 'all',
      guides: {
        indentation: true,
        bracketPairs: true,
        bracketPairsHorizontal: true,
        highlightActiveIndentation: true
      },
      // Enhanced IntelliSense
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showClasses: true,
        showFunctions: true,
        showVariables: true,
        showModules: true,
        showProperties: true,
        showFields: true,
        showEvents: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumMembers: true,
        showStructs: true,
        showInterfaces: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showTypeParameters: true
      },
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true
      },
      quickSuggestionsDelay: 100,
      // Code folding
      folding: true,
      foldingStrategy: 'auto',
      showFoldingControls: 'always',
      unfoldOnClickAfterEndOfLine: true,
      // Multiple cursors
      multiCursorModifier: 'ctrlCmd',
      // Formatting
      formatOnPaste: true,
      formatOnType: true,
      // Bracket matching
      matchBrackets: 'always',
      // Smooth scrolling
      smoothScrolling: true,
      // Cursor
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      cursorStyle: 'line',
      // Selection
      selectOnLineNumbers: true,
      // Find
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'always'
      },
      // Accessibility
      accessibilitySupport: 'auto',
      // Render whitespace
      renderWhitespace: 'selection',
      // Color decorators
      colorDecorators: true,
      // Lightbulb - show code actions
      lightbulb: {
        enabled: true
      }
      // Note: codeActionsOnSave and formatOnSave are handled in handleSave, not in editor options
    });

    // Set up keyboard shortcuts
    editor.addAction({
      id: 'save-file',
      label: 'Сохранить файл',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        if (activeTab && onSave) {
          onSave(activeTab.id);
        }
      }
    });

    // Format document
    editor.addAction({
      id: 'format-document',
      label: 'Форматировать документ',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: async () => {
        await editor.getAction('editor.action.formatDocument')?.run();
      }
    });

    // Toggle comment
    editor.addAction({
      id: 'toggle-comment',
      label: 'Переключить комментарий',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
      run: async () => {
        await editor.getAction('editor.action.commentLine')?.run();
      }
    });

    // Go to line
    editor.addAction({
      id: 'go-to-line',
      label: 'Перейти к строке',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG],
      run: async () => {
        await editor.getAction('editor.action.gotoLine')?.run();
      }
    });

    // Find
    editor.addAction({
      id: 'find',
      label: 'Найти',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
      run: async () => {
        await editor.getAction('actions.find')?.run();
      }
    });

    // Replace
    editor.addAction({
      id: 'replace',
      label: 'Заменить',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH],
      run: async () => {
        await editor.getAction('editor.action.startFindReplaceAction')?.run();
      }
    });

    // Toggle word wrap
    editor.addAction({
      id: 'toggle-word-wrap',
      label: 'Переключить перенос строк',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
      run: () => {
        const currentWrap = editor.getOption(monaco.editor.EditorOption.wordWrap);
        editor.updateOptions({
          wordWrap: currentWrap === 'on' ? 'off' : 'on'
        });
      }
    });

    // Toggle Markdown Preview (Ctrl+Shift+V / Cmd+Shift+V)
    if (activeTab?.language === 'markdown') {
      editor.addAction({
        id: 'toggle-markdown-preview',
        label: 'Переключить предпросмотр Markdown',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV],
        run: () => {
          setShowMarkdownPreview(prev => !prev);
        }
      });
    }

    // Duplicate line
    editor.addAction({
      id: 'duplicate-line',
      label: 'Дублировать строку',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyD],
      run: async () => {
        await editor.getAction('editor.action.copyLinesDownAction')?.run();
      }
    });

    // Move line up
    editor.addAction({
      id: 'move-line-up',
      label: 'Переместить строку вверх',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.UpArrow],
      run: async () => {
        await editor.getAction('editor.action.moveLinesUpAction')?.run();
      }
    });

    // Move line down
    editor.addAction({
      id: 'move-line-down',
      label: 'Переместить строку вниз',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
      run: async () => {
        await editor.getAction('editor.action.moveLinesDownAction')?.run();
      }
    });

    // Select all occurrences
    editor.addAction({
      id: 'select-all-occurrences',
      label: 'Выделить все вхождения',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL],
      run: async () => {
        await editor.getAction('editor.action.selectHighlights')?.run();
      }
    });

    // Command Palette - trigger global event
    editor.addAction({
      id: 'command-palette',
      label: 'Command Palette',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP],
      run: () => {
        // Dispatch custom event to trigger Command Palette in App.tsx
        window.dispatchEvent(new CustomEvent('open-command-palette'));
      }
    });

    // Go to Definition (F12)
    editor.addAction({
      id: 'go-to-definition',
      label: 'Перейти к определению',
      keybindings: [monaco.KeyCode.F12],
      run: async () => {
        const position = editor.getPosition();
        const model = editor.getModel();
        if (!position || !model || !activeTab || !projectContext?.projectPath) return;

        try {
          const definition = await navigationService.findDefinition(
            activeTab.path,
            position.lineNumber,
            position.column,
            projectContext.projectPath
          );

          if (definition) {
            // Open file and navigate to definition
            const Uri = monaco.Uri;
            const uri = Uri.parse(definition.uri);
            const targetModel = monaco.editor.getModel(uri);
            
            if (targetModel) {
              editor.setModel(targetModel);
              editor.setPosition({
                lineNumber: definition.range.startLineNumber,
                column: definition.range.startColumn
              });
              editor.revealLineInCenter(definition.range.startLineNumber);
            } else {
              // File not open, dispatch event to open it
              window.dispatchEvent(new CustomEvent('open-file', { detail: { path: definition.filePath, line: definition.range.startLineNumber } }));
            }
          } else {
            // Show message that definition not found
            logger.debug('Definition not found');
          }
        } catch (error) {
          logger.error('Error in go to definition:', error);
        }
      }
    });

    // Find References (Shift+F12)
    editor.addAction({
      id: 'find-references',
      label: 'Найти все использования',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
      run: async () => {
        const position = editor.getPosition();
        const model = editor.getModel();
        if (!position || !model || !activeTab || !projectContext?.projectPath) return;

        try {
          const references = await navigationService.findReferences(
            activeTab.path,
            position.lineNumber,
            position.column,
            projectContext.projectPath
          );

          if (references.length > 0) {
            // Dispatch event to show references panel
            window.dispatchEvent(new CustomEvent('show-references', { detail: { references } }));
          } else {
            logger.debug('No references found');
          }
        } catch (error) {
          logger.error('Error in find references:', error);
        }
      }
    });

    // Toggle Bookmark (Ctrl+Alt+K)
    editor.addAction({
      id: 'toggle-bookmark',
      label: 'Переключить закладку',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyK],
      run: () => {
        const position = editor.getPosition();
        const model = editor.getModel();
        if (!position || !model || !activeTab || !projectContext?.projectPath) return;

        const result = bookmarkService.toggleBookmark(
          projectContext.projectPath,
          activeTab.path,
          position.lineNumber,
          position.column
        );

        // Show visual feedback
        if (result.removed) {
          logger.debug('Bookmark removed');
        } else {
          logger.debug('Bookmark added');
        }
      }
    });

    // Rename Symbol (F2)
    editor.addAction({
      id: 'rename-symbol',
      label: 'Переименовать символ',
      keybindings: [monaco.KeyCode.F2],
      run: async () => {
        const position = editor.getPosition();
        const model = editor.getModel();
        if (!position || !model || !activeTab || !projectContext?.projectPath) return;

        try {
          // Get current symbol name
          const line = model.getLineContent(position.lineNumber);
          const before = line.substring(0, position.column - 1);
          const after = line.substring(position.column - 1);
          const beforeMatch = before.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
          const afterMatch = after.match(/^([a-zA-Z0-9_$]*)/);
          
          if (beforeMatch && afterMatch) {
            const currentName = beforeMatch[1] + afterMatch[1];
            
            // Prompt for new name
            const newName = prompt(`Переименовать "${currentName}" в:`, currentName);
            if (newName && newName !== currentName) {
              const renameLocations = await navigationService.getRenameLocations(
                activeTab.path,
                position.lineNumber,
                position.column,
                newName,
                projectContext.projectPath
              );

              if (renameLocations.length > 0) {
                // Apply renames to each model
                const Uri = monaco.Uri;
                
                for (const location of renameLocations) {
                  const uri = Uri.parse(location.uri);
                  const targetModel = monaco.editor.getModel(uri);
                  
                  if (targetModel) {
                    const range = new monaco.Range(
                      location.range.startLineNumber,
                      location.range.startColumn,
                      location.range.endLineNumber,
                      location.range.endColumn
                    );
                    targetModel.pushEditOperations(
                      [],
                      [{
                        range,
                        text: location.newText
                      }],
                      () => null
                    );
                  }
                }
              }
            }
          }
        } catch (error) {
          logger.error('Error in rename symbol:', error);
        }
      }
    });

    // Helper function to open inline chat with action
    const openInlineChatWithAction = (action?: string) => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!model) return;

      const position = editor.getPosition();
      if (!position) return;

      let codeToUse = '';
      let posToUse: { lineNumber: number; column: number };

      if (selection && !selection.isEmpty()) {
        codeToUse = model.getValueInRange(selection);
        posToUse = {
          lineNumber: selection.endLineNumber,
          column: selection.endColumn
        };
      } else {
        // If no selection, use current line
        codeToUse = model.getLineContent(position.lineNumber);
        posToUse = {
          lineNumber: position.lineNumber,
          column: position.column
        };
      }

      // Update state via setTimeout to ensure it's called in React context
      setTimeout(() => {
        setSelectedCode(codeToUse);
        setSelectionPosition(posToUse);
        setShowInlineChat(true);
        // Store action for InlineChat component
        if (action) {
          window.__inlineChatAction = action;
        }
      }, 0);
    };

    // AI Actions in context menu (grouped at the end with 'z_ai')
    // Inline Chat (Ctrl+K / Cmd+K) - also in context menu
    editor.addAction({
      id: 'inline-chat',
      label: '💬 AI Чат (Ctrl+K)',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      contextMenuGroupId: 'z_ai',
      contextMenuOrder: 1,
      run: () => {
        openInlineChatWithAction();
      }
    });

    // AI Explain Code - in context menu
    editor.addAction({
      id: 'ai-explain-code',
      label: '💡 Объяснить код',
      contextMenuGroupId: 'z_ai',
      contextMenuOrder: 2,
      run: () => {
        openInlineChatWithAction('explain');
      }
    });

    // AI Refactor Code - in context menu
    editor.addAction({
      id: 'ai-refactor-code',
      label: '🔄 Рефакторить код',
      contextMenuGroupId: 'z_ai',
      contextMenuOrder: 3,
      run: () => {
        openInlineChatWithAction('refactor');
      }
    });

    // AI Fix Code - in context menu
    editor.addAction({
      id: 'ai-fix-code',
      label: '🐛 Исправить код',
      contextMenuGroupId: 'z_ai',
      contextMenuOrder: 4,
      run: () => {
        openInlineChatWithAction('fix');
      }
    });

    // AI Optimize Code - in context menu
    editor.addAction({
      id: 'ai-optimize-code',
      label: '⚡ Оптимизировать код',
      contextMenuGroupId: 'z_ai',
      contextMenuOrder: 5,
      run: () => {
        openInlineChatWithAction('optimize');
      }
    });

    // AI Generate Code - in context menu
    editor.addAction({
      id: 'ai-generate-code',
      label: '✨ Сгенерировать код',
      contextMenuGroupId: 'z_ai',
      contextMenuOrder: 6,
      run: () => {
        openInlineChatWithAction('generate');
      }
    });

    // Open AI Panel - in context menu
    editor.addAction({
      id: 'open-ai-panel',
      label: '🤖 Открыть AI Панель',
      contextMenuGroupId: 'z_ai',
      contextMenuOrder: 7,
      run: () => {
        window.dispatchEvent(new CustomEvent('open-ai-panel'));
      }
    });

    // Track selection changes for inline chat
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (selection && !selection.isEmpty() && model) {
        const selectedText = model.getValueInRange(selection);
        if (selectedText.trim()) {
          setTimeout(() => {
            setSelectedCode(selectedText);
          }, 0);
        }
      }
    });

    // Inline completions will be registered in useEffect to properly handle settings changes

  };

  const handleEditorChange = (value: string | undefined) => {
    if (activeTab && value !== undefined) {
      onTabContentChange(activeTab.id, value);
      
      // Auto-save functionality
      if (settings.autoSave && onSave) {
        // Clear existing timeout
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        
        // Set new timeout for auto-save
        autoSaveTimeoutRef.current = setTimeout(() => {
          if (activeTab && activeTab.isDirty) {
            onSave(activeTab.id);
          }
        }, settings.autoSaveDelay);
      }
    }
  };

  // Handle insert code from inline chat
  const handleInsertCode = (text: string) => {
    if (!editorRef.current || !activeTab || !selectionPosition) return;

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    // Insert at cursor position
    const position = editor.getPosition();
    if (position) {
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      };

      // Execute edit
      editor.executeEdits('inline-chat-insert', [{
        range,
        text: text
      }]);

      // Update tab content
      const newContent = model.getValue();
      onTabContentChange(activeTab.id, newContent);
    }
  };

  // Handle replace selected code from inline chat
  const handleReplaceCode = (text: string) => {
    if (!editorRef.current || !activeTab) return;

    const editor = editorRef.current;
    const selection = editor.getSelection();
    const model = editor.getModel();
    
    if (!selection || !model) return;

    // Replace selection
    editor.executeEdits('inline-chat-replace', [{
      range: selection,
      text: text
    }]);

    // Update tab content
    const newContent = model.getValue();
    onTabContentChange(activeTab.id, newContent);
  };

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Update editor options when settings change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        tabSize: settings.tabSize,
        wordWrap: settings.wordWrap ? 'on' : 'off',
        minimap: { enabled: settings.minimap },
        inlineSuggest: {
          enabled: settings.inlineCompletions
        }
      });
    }
  }, [settings.fontSize, settings.fontFamily, settings.tabSize, settings.wordWrap, settings.minimap, settings.inlineCompletions]);

  // Update inline completions when settings or activeTab changes
  useEffect(() => {
    if (monacoRef.current && editorRef.current) {
      // Dispose previous provider
      if (inlineCompletionDisposableRef.current) {
        inlineCompletionDisposableRef.current.dispose();
        inlineCompletionDisposableRef.current = null;
      }

      // Register new provider if enabled
      if (settings.inlineCompletions) {
        try {
          const disposable = monacoRef.current.languages.registerInlineCompletionsProvider('*', {
            provideInlineCompletions: async (
              model: MonacoEditor.ITextModel,
              position: Monaco.Position,
              context: { selectedSuggestionInfo?: unknown; triggerKind: number },
              token: Monaco.CancellationToken
            ) => {
              try {
                // Skip if no model selected
                if (!settings.selectedModel) {
                  return { items: [] };
                }

                // Get text before and after cursor
                const textBeforeCursor = model.getValueInRange({
                  startLineNumber: 1,
                  startColumn: 1,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column
                });

                const textAfterCursor = model.getValueInRange({
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: model.getLineCount(),
                  endColumn: model.getLineMaxColumn(model.getLineCount())
                });

                // Get language from model
                const modelLanguage = model.getLanguageId() || activeTab?.language || 'plaintext';

                // Create context
                const completionContext: InlineCompletionContext = {
                  textBeforeCursor,
                  textAfterCursor,
                  language: modelLanguage,
                  filePath: activeTab?.path,
                  lineNumber: position.lineNumber,
                  column: position.column
                };

                // Convert CancellationToken to AbortSignal
                const abortController = new AbortController();
                const abortSignal = abortController.signal;
                
                // Listen for cancellation
                const cancellationListener = token.onCancellationRequested(() => {
                  abortController.abort();
                });

                // Generate completion with debounce
                const completion = await inlineCompletionService.generateCompletionDebounced(
                  completionContext,
                  settings,
                  abortSignal
                );

                // Clean up listener
                cancellationListener.dispose();

                if (!completion || token.isCancellationRequested) {
                  return { items: [] };
                }

                // Convert to Monaco format
                return {
                  items: [
                    {
                      insertText: completion.text,
                      range: {
                        startLineNumber: completion.range.startLineNumber,
                        endLineNumber: completion.range.endLineNumber,
                        startColumn: completion.range.startColumn,
                        endColumn: completion.range.endColumn
                      },
                      command: completion.command
                    }
                  ]
                };
              } catch (error) {
                logger.error('Error in inline completion provider:', error);
                return { items: [] };
              }
            },
            freeInlineCompletions: (completions: any) => {
              // Cleanup method for completions - no action needed
            }
          });

          inlineCompletionDisposableRef.current = disposable;
        } catch (error) {
          logger.error('Error registering inline completions provider:', error);
        }
      }
    }
  }, [settings, activeTab?.language, activeTab?.path]);

  // Register Code Actions Provider
  useEffect(() => {
    if (monacoRef.current && editorRef.current && settings.selectedModel) {
      // Dispose previous provider
      if (codeActionDisposableRef.current) {
        codeActionDisposableRef.current.dispose();
        codeActionDisposableRef.current = null;
      }

      try {
        const disposable = monacoRef.current.languages.registerCodeActionProvider('*', {
          provideCodeActions: async (
            model: MonacoEditor.ITextModel,
            range: Monaco.Range,
            context: any,
            token: any
          ): Promise<any> => {
            try {
              // Skip if no model selected
              if (!settings.selectedModel) {
                return { actions: [], dispose: () => {} };
              }

              // Get code context
              const fullCode = model.getValue();
              const language = model.getLanguageId() || activeTab?.language || 'plaintext';
              
              // Get selected code if range is not empty
              const selectedCode = model.getValueInRange(range);
              
              const actionContext: CodeActionContext = {
                code: fullCode,
                language,
                lineNumber: range.startLineNumber,
                column: range.startColumn,
                filePath: activeTab?.path,
                selection: selectedCode.trim() ? {
                  startLine: range.startLineNumber,
                  endLine: range.endLineNumber,
                  startColumn: range.startColumn,
                  endColumn: range.endColumn
                } : undefined
              };

              // Generate code actions
              const actions = await codeActionService.analyzeCode(
                actionContext,
                settings,
                token
              );

              // Convert to Monaco format
              if (!monacoRef.current) return { actions: [], dispose: () => {} };
              
              const monacoActions = actions.map((action, index) => {
                const Range = monacoRef.current!.Range;
                const Uri = monacoRef.current!.Uri;
                
                // Get or create URI
                let uri = model.uri;
                if (typeof uri === 'string') {
                  uri = Uri.parse(uri);
                }

                return {
                  title: action.title,
                  kind: action.kind || 'refactor',
                  diagnostics: [],
                  edit: {
                    edits: [{
                      resource: uri,
                      versionId: model.getVersionId() || undefined,
                      textEdit: {
                        range: new Range(
                          action.edit.range.startLineNumber,
                          action.edit.range.startColumn,
                          action.edit.range.endLineNumber,
                          action.edit.range.endColumn
                        ),
                        text: action.edit.text
                      }
                    }]
                  },
                  command: action.command,
                  isPreferred: index === 0
                };
              });

              return {
                actions: monacoActions,
                dispose: () => {}
              };
            } catch (error) {
              logger.error('Error in code action provider:', error);
              return { actions: [], dispose: () => {} };
            }
          }
        });

        codeActionDisposableRef.current = disposable;
      } catch (error) {
        logger.error('Error registering code action provider:', error);
      }
    }
  }, [settings, activeTab?.language, activeTab?.path]);

  // Register Navigation Providers (Definition, References, Rename)
  useEffect(() => {
    if (monacoRef.current && projectContext?.projectPath) {
      // Dispose previous providers
      if (definitionProviderDisposableRef.current) {
        definitionProviderDisposableRef.current.dispose();
        definitionProviderDisposableRef.current = null;
      }
      if (referenceProviderDisposableRef.current) {
        referenceProviderDisposableRef.current.dispose();
        referenceProviderDisposableRef.current = null;
      }
      if (renameProviderDisposableRef.current) {
        renameProviderDisposableRef.current.dispose();
        renameProviderDisposableRef.current = null;
      }

      try {
        const monaco = monacoRef.current;
        const Uri = monaco.Uri;
        const Range = monaco.Range;

        // Register Definition Provider
        const definitionDisposable = monaco.languages.registerDefinitionProvider(['typescript', 'javascript', 'python', 'java', 'cpp', 'c', 'csharp', 'php', 'ruby', 'go', 'rust'], {
          provideDefinition: async (
            model: MonacoEditor.ITextModel,
            position: Monaco.Position
          ) => {
            try {
              const filePath = model.uri.toString();
              const definition = await navigationService.findDefinition(
                filePath,
                position.lineNumber,
                position.column,
                projectContext.projectPath
              );

              if (definition) {
                return {
                  uri: Uri.parse(definition.uri),
                  range: new Range(
                    definition.range.startLineNumber,
                    definition.range.startColumn,
                    definition.range.endLineNumber,
                    definition.range.endColumn
                  )
                };
              }
              return null;
            } catch (error) {
              logger.error('Error in definition provider:', error);
              return null;
            }
          }
        });

        // Register Reference Provider
        const referenceDisposable = monaco.languages.registerReferenceProvider(['typescript', 'javascript', 'python', 'java', 'cpp', 'c', 'csharp', 'php', 'ruby', 'go', 'rust'], {
          provideReferences: async (
            model: MonacoEditor.ITextModel,
            position: Monaco.Position
          ) => {
            try {
              const filePath = model.uri.toString();
              const references = await navigationService.findReferences(
                filePath,
                position.lineNumber,
                position.column,
                projectContext.projectPath
              );

              return references.map(ref => ({
                uri: Uri.parse(ref.uri),
                range: new Range(
                  ref.range.startLineNumber,
                  ref.range.startColumn,
                  ref.range.endLineNumber,
                  ref.range.endColumn
                )
              }));
            } catch (error) {
              logger.error('Error in reference provider:', error);
              return [];
            }
          }
        });

        // Register Rename Provider
        const renameDisposable = monaco.languages.registerRenameProvider(['typescript', 'javascript', 'python', 'java', 'cpp', 'c', 'csharp', 'php', 'ruby', 'go', 'rust'], {
          provideRenameEdits: async (
            model: MonacoEditor.ITextModel,
            position: Monaco.Position,
            newName: string
          ) => {
            try {
              const filePath = model.uri.toString();
              const renameLocations = await navigationService.getRenameLocations(
                filePath,
                position.lineNumber,
                position.column,
                newName,
                projectContext.projectPath
              );

              if (renameLocations.length === 0) {
                return null;
              }

              const edits: Array<{ resource: Monaco.Uri; versionId: number | null; textEdit: { range: Monaco.Range; text: string } }> = [];
              for (const location of renameLocations) {
                const uri = Uri.parse(location.uri);
                const targetModel = monaco.editor.getModel(uri);
                
                if (targetModel) {
                  edits.push({
                    resource: uri,
                    versionId: targetModel.getVersionId(),
                    textEdit: {
                      range: new Range(
                        location.range.startLineNumber,
                        location.range.startColumn,
                        location.range.endLineNumber,
                        location.range.endColumn
                      ),
                      text: location.newText
                    }
                  });
                }
              }

              // Edits have been applied directly to models
              return {
                edits: []
              };
            } catch (error) {
              logger.error('Error in rename provider:', error);
              return null;
            }
          },
          resolveRenameLocation: async (
            model: MonacoEditor.ITextModel,
            position: Monaco.Position
          ) => {
            // Return current position as rename location
            return {
              range: new Range(position.lineNumber, position.column, position.lineNumber, position.column),
              text: ''
            };
          }
        });

        definitionProviderDisposableRef.current = definitionDisposable;
        referenceProviderDisposableRef.current = referenceDisposable;
        renameProviderDisposableRef.current = renameDisposable;
      } catch (error) {
        logger.error('Error registering navigation providers:', error);
      }
    }

    return () => {
      if (definitionProviderDisposableRef.current) {
        definitionProviderDisposableRef.current.dispose();
        definitionProviderDisposableRef.current = null;
      }
      if (referenceProviderDisposableRef.current) {
        referenceProviderDisposableRef.current.dispose();
        referenceProviderDisposableRef.current = null;
      }
      if (renameProviderDisposableRef.current) {
        renameProviderDisposableRef.current.dispose();
        renameProviderDisposableRef.current = null;
      }
    };
  }, [projectContext?.projectPath, activeTab?.path]);

  // Register Snippets Provider
  useEffect(() => {
    if (monacoRef.current && activeTab?.language) {
      try {
        const monaco = monacoRef.current;
        const language = activeTab.language;

        // Register completion item provider for snippets
        const disposable = monaco.languages.registerCompletionItemProvider(language, {
          provideCompletionItems: (
            model: MonacoEditor.ITextModel,
            position: Monaco.Position
          ) => {
            const snippets = snippetService.getSnippets(language);
            const monacoSnippets = snippets.map(s => snippetService.toMonacoSnippet(s, monaco));

            return {
              suggestions: monacoSnippets
            };
          },
          triggerCharacters: []
        });

        return () => {
          disposable.dispose();
        };
      } catch (error) {
        logger.error('Error registering snippets provider:', error);
      }
    }
  }, [activeTab?.language]);

  // Listen for programmatic inline chat opening
  useEffect(() => {
    const handleOpenInlineChat = (_event: Event) => {
      if (!activeTab || !editorRef.current) {
        logger.warn('Cannot open inline chat: no active tab or editor');
        return;
      }

      const editor = editorRef.current;
      const model = editor.getModel();
      if (!model) return;

      const selection = editor.getSelection();
      let codeToUse = '';
      let posToUse: { lineNumber: number; column: number };

      if (selection && !selection.isEmpty()) {
        // Use selected code
        codeToUse = model.getValueInRange(selection);
        posToUse = {
          lineNumber: selection.startLineNumber,
          column: selection.startColumn
        };
      } else {
        // Use current line
        const position = editor.getPosition();
        if (position) {
          const lineContent = model.getLineContent(position.lineNumber);
          codeToUse = lineContent.trim();
          posToUse = {
            lineNumber: position.lineNumber,
            column: position.column
          };
        } else {
          return;
        }
      }

      setTimeout(() => {
        setSelectedCode(codeToUse);
        setSelectionPosition(posToUse);
        setShowInlineChat(true);
      }, 0);
    };

    const handleOpenAIPanel = () => {
      // This will be handled by App.tsx
      window.dispatchEvent(new CustomEvent('open-ai-panel'));
    };

    const handleOpenSettings = () => {
      window.dispatchEvent(new CustomEvent('open-settings'));
    };

    window.addEventListener('open-inline-chat', handleOpenInlineChat);
    window.addEventListener('open-ai-panel', handleOpenAIPanel);
    window.addEventListener('open-settings', handleOpenSettings);

    return () => {
      window.removeEventListener('open-inline-chat', handleOpenInlineChat);
      window.removeEventListener('open-ai-panel', handleOpenAIPanel);
      window.removeEventListener('open-settings', handleOpenSettings);
    };
  }, [activeTab]);

  // Reset markdown preview when switching tabs
  useEffect(() => {
    if (activeTab?.language !== 'markdown') {
      setShowMarkdownPreview(false);
    }
  }, [activeTab?.id, activeTab?.language]);

  // Handle keyboard shortcut for markdown preview
  useEffect(() => {
    if (activeTab?.language !== 'markdown') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // More reliable Mac detection
      const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform) || 
                    /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      
      if (modifier && e.shiftKey && e.key === 'V' && !e.altKey) {
        e.preventDefault();
        setShowMarkdownPreview(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab?.language]);

  // Listen for markdown preview toggle from Command Palette
  useEffect(() => {
    const handleToggleMarkdownPreview = () => {
      if (activeTab?.language === 'markdown') {
        setShowMarkdownPreview(prev => !prev);
      }
    };

    window.addEventListener('toggle-markdown-preview', handleToggleMarkdownPreview);
    return () => window.removeEventListener('toggle-markdown-preview', handleToggleMarkdownPreview);
  }, [activeTab?.language]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (inlineCompletionDisposableRef.current) {
        inlineCompletionDisposableRef.current.dispose();
        inlineCompletionDisposableRef.current = null;
      }
      if (codeActionDisposableRef.current) {
        codeActionDisposableRef.current.dispose();
        codeActionDisposableRef.current = null;
      }
      if (definitionProviderDisposableRef.current) {
        definitionProviderDisposableRef.current.dispose();
        definitionProviderDisposableRef.current = null;
      }
      if (referenceProviderDisposableRef.current) {
        referenceProviderDisposableRef.current.dispose();
        referenceProviderDisposableRef.current = null;
      }
      if (renameProviderDisposableRef.current) {
        renameProviderDisposableRef.current.dispose();
        renameProviderDisposableRef.current = null;
      }
      if (breakpointDecorationsRef.current && editorRef.current) {
        editorRef.current.deltaDecorations(breakpointDecorationsRef.current, []);
        breakpointDecorationsRef.current = [];
      }
      inlineCompletionService.cancelAll();
      
      // Clean up problems for closed tabs
      if (activeTab) {
        problemsService.removeProblems(activeTab.path);
      }
    };
  }, [activeTab]);


  const getLanguageForMonaco = (language: string): string => {
    const languageMap: { [key: string]: string } = {
      'javascript': 'javascript',
      'typescript': 'typescript',
      'python': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'csharp',
      'php': 'php',
      'ruby': 'ruby',
      'go': 'go',
      'rust': 'rust',
      'swift': 'swift',
      'kotlin': 'kotlin',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'markdown': 'markdown',
      'sql': 'sql',
      'shell': 'shell',
      'powershell': 'powershell',
      'dockerfile': 'dockerfile',
      'vue': 'html',
      'svelte': 'html'
    };
    
    return languageMap[language] || 'plaintext';
  };

  if (!activeTab && tabs.length === 0) {
    return (
      <div 
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={32} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Файл не открыт
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Откройте файл из боковой панели, чтобы начать редактирование
          </div>
          
          {/* Quick tips */}
          <div style={{ 
            marginTop: '24px',
            padding: '16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'left',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            maxWidth: '500px'
          }}>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px', fontSize: '13px' }}>
              🚀 Новые возможности AI IDE:
            </div>
            <div style={{ lineHeight: '1.8' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>⚡ Автодополнение:</strong> Начните печатать → AI предложит завершения
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>💬 Inline Chat:</strong> Выделите код → <strong>Ctrl+K</strong> → задайте вопрос
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>💡 Code Actions:</strong> Появится 💡 рядом с кодом → кликните для предложений
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>⌨️ Command Palette:</strong> <strong>Ctrl+Shift+P</strong> → быстрый доступ ко всем командам
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>🔍 Глобальный поиск:</strong> <strong>Ctrl+Shift+F</strong> → поиск по всему проекту
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>⚠️ Problems:</strong> <strong>Ctrl+Shift+M</strong> → просмотр ошибок и предупреждений
              </div>
              <div>
                <strong>📖 Руководство:</strong> Кликните на <strong>?</strong> в меню для подробной инструкции
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', minWidth: 0, overflow: 'hidden' }}>
      {/* Tabs */}
      {tabs.length > 0 && (
        <div 
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            overflowX: 'auto',
            scrollbarWidth: 'none'
          }}
        >
          <style>{`
            .tabs-container::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <div className="tabs-container" style={{ display: 'flex', minWidth: 0, flex: 1 }}>
            {tabs.map((tab, index) => (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: activeTab?.id === tab.id ? 'var(--bg-primary)' : 'transparent',
                  borderBottom: activeTab?.id === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  minWidth: '80px', // Минимальная ширина для кликабельности
                  maxWidth: '200px', // Максимальная ширина одной вкладки
                  flex: '0 1 auto', // Может сжиматься, но не растягиваться
                  cursor: 'pointer',
                  position: 'relative',
                  height: '32px'
                }}
                onClick={() => onTabSelect(tab)}
                onMouseDown={(e) => {
                  // Close tab on middle mouse button
                  if (e.button === 1) {
                    e.preventDefault();
                    onTabClose(tab.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  // Context menu for tabs (can be extended)
                  const menu = document.createElement('div');
                  menu.style.position = 'fixed';
                  menu.style.left = `${e.clientX}px`;
                  menu.style.top = `${e.clientY}px`;
                  menu.style.backgroundColor = 'var(--bg-primary)';
                  menu.style.border = '1px solid var(--border-color)';
                  menu.style.borderRadius = 'var(--radius-md)';
                  menu.style.padding = '4px';
                  menu.style.zIndex = '10000';
                  menu.style.boxShadow = 'var(--shadow-lg)';
                  
                  const closeItem = document.createElement('div');
                  closeItem.textContent = 'Закрыть';
                  closeItem.style.padding = '6px 12px';
                  closeItem.style.cursor = 'pointer';
                  closeItem.style.borderRadius = 'var(--radius-sm)';
                  closeItem.style.fontSize = '12px';
                  closeItem.onmouseenter = () => {
                    closeItem.style.backgroundColor = 'var(--bg-hover)';
                  };
                  closeItem.onmouseleave = () => {
                    closeItem.style.backgroundColor = 'transparent';
                  };
                  closeItem.onclick = () => {
                    onTabClose(tab.id);
                    document.body.removeChild(menu);
                  };
                  
                  const closeOthersItem = document.createElement('div');
                  closeOthersItem.textContent = 'Закрыть остальные';
                  closeOthersItem.style.padding = '6px 12px';
                  closeOthersItem.style.cursor = 'pointer';
                  closeOthersItem.style.borderRadius = 'var(--radius-sm)';
                  closeOthersItem.style.fontSize = '12px';
                  closeOthersItem.onmouseenter = () => {
                    closeOthersItem.style.backgroundColor = 'var(--bg-hover)';
                  };
                  closeOthersItem.onmouseleave = () => {
                    closeOthersItem.style.backgroundColor = 'transparent';
                  };
                  closeOthersItem.onclick = () => {
                    tabs.forEach(t => {
                      if (t.id !== tab.id) {
                        onTabClose(t.id);
                      }
                    });
                    document.body.removeChild(menu);
                  };
                  
                  const closeAllItem = document.createElement('div');
                  closeAllItem.textContent = 'Закрыть все';
                  closeAllItem.style.padding = '6px 12px';
                  closeAllItem.style.cursor = 'pointer';
                  closeAllItem.style.borderRadius = 'var(--radius-sm)';
                  closeAllItem.style.fontSize = '12px';
                  closeAllItem.onmouseenter = () => {
                    closeAllItem.style.backgroundColor = 'var(--bg-hover)';
                  };
                  closeAllItem.onmouseleave = () => {
                    closeAllItem.style.backgroundColor = 'transparent';
                  };
                  closeAllItem.onclick = () => {
                    tabs.forEach(t => onTabClose(t.id));
                    document.body.removeChild(menu);
                  };
                  
                  menu.appendChild(closeItem);
                  menu.appendChild(closeOthersItem);
                  menu.appendChild(closeAllItem);
                  document.body.appendChild(menu);
                  
                  const removeMenu = () => {
                    if (document.body.contains(menu)) {
                      document.body.removeChild(menu);
                    }
                  };
                  
                  setTimeout(() => {
                    document.addEventListener('click', removeMenu, { once: true });
                  }, 0);
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 12px',
                    flex: 1,
                    height: '100%'
                  }}
                >
                  <CircleDot 
                    size={8} 
                    style={{ 
                      color: tab.isDirty ? 'var(--accent-orange)' : 'transparent',
                      flexShrink: 0
                    }} 
                  />
                  <span 
                    style={{ 
                      fontSize: '12px',
                      color: activeTab?.id === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0
                    }}
                    title={tab.path}
                  >
                    {(() => {
                      // Всегда показываем только имя файла, даже если title содержит путь
                      const fileName = tab.path.split(/[/\\]/).pop() || tab.title.split(/[/\\]/).pop() || tab.title || 'Без названия';
                      return fileName;
                    })()}
                  </span>
                </div>
                
                <button
                  className="btn btn-ghost"
                  style={{
                    height: '20px',
                    width: '20px',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '4px',
                    opacity: activeTab?.id === tab.id ? 1 : 0,
                    transition: 'opacity 0.2s ease'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  onMouseDown={(e) => {
                    // Close on middle mouse button
                    if (e.button === 1) {
                      e.preventDefault();
                      onTabClose(tab.id);
                    }
                  }}
                  title="Закрыть вкладку (Средняя кнопка мыши)"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Breadcrumbs and Editor Toolbar */}
      {activeTab && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 12px',
              backgroundColor: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '11px',
              minHeight: '24px',
              gap: '12px',
              minWidth: 0
            }}
          >
            {/* Breadcrumbs */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flex: 1,
                overflow: 'hidden',
                minWidth: 0
              }}
            >
              <FileText size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0
                }}
                title={activeTab.path}
              >
                {(() => {
                  // Показываем только последние 2-3 сегмента пути для компактности
                  const segments = activeTab.path.split(/[/\\]/).filter(Boolean);
                  const maxSegments = 3; // Показываем максимум 3 последних сегмента
                  const startIndex = Math.max(0, segments.length - maxSegments);
                  const displaySegments = segments.slice(startIndex);
                  
                  // Если путь очень длинный, добавляем многоточие в начале
                  if (segments.length > maxSegments) {
                    return (
                      <>
                        <span style={{ color: 'var(--text-tertiary)' }}>...</span>
                        <ChevronRight size={10} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                        {displaySegments.map((segment, index, array) => (
                          <React.Fragment key={startIndex + index}>
                            {index > 0 && (
                              <ChevronRight size={10} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                            )}
                            <span
                              style={{
                                color: index === array.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: index === array.length - 1 ? '500' : '400',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: index === array.length - 1 ? '200px' : '120px'
                              }}
                              title={segment}
                            >
                              {segment}
                            </span>
                          </React.Fragment>
                        ))}
                      </>
                    );
                  }
                  
                  // Если путь короткий, показываем все сегменты
                  return segments.map((segment, index, array) => (
                    <React.Fragment key={index}>
                      {index > 0 && (
                        <ChevronRight size={10} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                      )}
                      <span
                        style={{
                          color: index === array.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: index === array.length - 1 ? '500' : '400',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: index === array.length - 1 ? '200px' : '120px'
                        }}
                        title={segment}
                      >
                        {segment}
                      </span>
                    </React.Fragment>
                  ));
                })()}
              </div>
              <span
                style={{
                  color: 'var(--text-tertiary)',
                  marginLeft: '8px',
                  padding: '2px 6px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0
                }}
              >
                {activeTab.language}
              </span>
            </div>

            {/* Editor Info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: 'var(--text-tertiary)',
                fontSize: '10px',
                flexShrink: 0
              }}
            >
              {activeTab.language === 'markdown' && (
                <button
                  className="btn btn-ghost"
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onClick={() => setShowMarkdownPreview(prev => !prev)}
                  title="Переключить предпросмотр (Ctrl+Shift+V)"
                >
                  {showMarkdownPreview ? (
                    <>
                      <Code size={12} />
                      <span>Исходник</span>
                    </>
                  ) : (
                    <>
                      <Eye size={12} />
                      <span>Предпросмотр</span>
                    </>
                  )}
                </button>
              )}
              
              {!showMarkdownPreview && (
                <>
                  <span>
                    Строка {cursorPosition.line}, Колонка {cursorPosition.column}
                  </span>
                  <span>•</span>
                  <span>
                    {activeTab.content.split('\n').length} строк
                  </span>
                  {activeTab.isDirty && (
                    <>
                      <span>•</span>
                      <span style={{ color: 'var(--accent-orange)' }}>
                        Не сохранено
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Editor or Markdown Preview */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {activeTab.language === 'markdown' && showMarkdownPreview ? (
              <div
                style={{
                  height: '100%',
                  overflow: 'auto',
                  padding: '32px',
                  backgroundColor: 'var(--bg-primary)',
                  maxWidth: '900px',
                  margin: '0 auto'
                }}
              >
                <MarkdownRenderer 
                  content={activeTab.content} 
                  className="markdown-body"
                />
              </div>
            ) : (
              <Editor
              height="100%"
              language={getLanguageForMonaco(activeTab.language)}
              value={activeTab.content}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              theme={settings.theme === 'dark' ? 'ide-dark' : 'ide-light'}
              loading={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>Загрузка редактора...</div>}
            options={{
              readOnly: false,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              fontSize: settings.fontSize,
              fontFamily: settings.fontFamily,
              tabSize: settings.tabSize,
              wordWrap: settings.wordWrap ? 'on' : 'off',
              minimap: { 
                enabled: settings.minimap,
                showSlider: 'always',
                side: 'right',
                maxColumn: 120,
                renderCharacters: true,
                scale: 1
              },
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              renderLineHighlight: 'all',
              renderFinalNewline: 'on',
              renderValidationDecorations: 'on',
              occurrencesHighlight: 'singleFile',
              selectionHighlight: true,
              codeLens: true,
              guides: {
                indentation: true,
                bracketPairs: true,
                bracketPairsHorizontal: true,
                highlightActiveIndentation: true
              },
              suggest: {
                showKeywords: true,
                showSnippets: true,
                showClasses: true,
                showFunctions: true,
                showVariables: true,
                showModules: true,
                showProperties: true,
                showFields: true,
                showEvents: true,
                showOperators: true,
                showUnits: true,
                showValues: true,
                showConstants: true,
                showEnums: true,
                showEnumMembers: true,
                showStructs: true,
                showInterfaces: true,
                showColors: true,
                showFiles: true,
                showReferences: true,
                showTypeParameters: true
              },
              quickSuggestions: {
                other: true,
                comments: true,
                strings: true
              },
              quickSuggestionsDelay: 100,
              folding: true,
              foldingStrategy: 'auto',
              showFoldingControls: 'always',
              unfoldOnClickAfterEndOfLine: true,
              multiCursorModifier: 'ctrlCmd',
              formatOnPaste: true,
              formatOnType: true,
              matchBrackets: 'always',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              cursorStyle: 'line',
              selectOnLineNumbers: true,
              find: {
                addExtraSpaceOnTop: false,
                autoFindInSelection: 'never',
                seedSearchStringFromSelection: 'always'
              },
              accessibilitySupport: 'auto',
              renderWhitespace: 'selection',
              colorDecorators: true,
              lightbulb: {
                enabled: true
              },
              // Enhanced bracket matching
              bracketPairColorization: {
                enabled: true
              },
              // Git decorations
              glyphMargin: true,
              // Inline suggestions
              inlineSuggest: {
                enabled: true
              },
              // Parameter hints
              parameterHints: {
                enabled: true,
                cycle: true
              },
              // Hover
              hover: {
                enabled: true,
                delay: 300
              },
              // Links
              links: true,
              // Context menu
              contextmenu: true,
              // Mouse wheel
              mouseWheelZoom: true,
              // Drag and drop
              dragAndDrop: true,
              // Unicode highlighting
              unicodeHighlight: {
                ambiguousCharacters: true,
                invisibleCharacters: true,
                nonBasicASCII: false
              }
            }}
          />
            )}
          </div>
        </>
      )}

      {/* Inline Chat */}
      {showInlineChat && activeTab && (
        <InlineChat
          selectedCode={selectedCode}
          language={activeTab.language}
          filePath={activeTab.path}
          position={selectionPosition || { lineNumber: cursorPosition.line, column: cursorPosition.column }}
          onClose={() => {
            setShowInlineChat(false);
            setSelectedCode('');
            setSelectionPosition(null);
            // Focus editor after closing
            editorRef.current?.focus();
          }}
          onInsert={handleInsertCode}
          onReplace={handleReplaceCode}
          settings={settings}
          projectContext={projectContext}
        />
      )}
    </div>
  );
};