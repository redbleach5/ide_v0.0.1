import { logger } from '../utils/logger';
import { generateIds } from '../utils/idGenerator';

export interface Snippet {
  id: string;
  name: string;
  prefix: string;
  body: string | string[];
  description?: string;
  scope?: string; // language scope (e.g., 'typescript', 'javascript', '*')
  variables?: Record<string, string>; // Variable definitions
}

class SnippetService {
  private snippets: Map<string, Snippet[]> = new Map(); // scope -> snippets
  private userSnippets: Snippet[] = [];

  constructor() {
    this.loadDefaultSnippets();
  }

  /**
   * Load default snippets
   */
  private loadDefaultSnippets(): void {
    const defaultSnippets: Snippet[] = [
      // JavaScript/TypeScript
      {
        id: 'log',
        name: 'Console Log',
        prefix: 'log',
        body: 'console.log($1);',
        description: 'Console log statement',
        scope: 'javascript,typescript'
      },
      {
        id: 'func',
        name: 'Function',
        prefix: 'func',
        body: [
          'function ${1:name}($2) {',
          '\t$3',
          '}'
        ],
        description: 'Function declaration',
        scope: 'javascript,typescript'
      },
      {
        id: 'arrow',
        name: 'Arrow Function',
        prefix: 'arrow',
        body: 'const ${1:name} = ($2) => {',
        description: 'Arrow function',
        scope: 'javascript,typescript'
      },
      {
        id: 'comp',
        name: 'React Component',
        prefix: 'comp',
        body: [
          "import React from 'react';",
          '',
          'interface ${1:ComponentName}Props {',
          '\t$2',
          '}',
          '',
          'export const ${1:ComponentName}: React.FC<${1:ComponentName}Props> = ({ $3 }) => {',
          '\treturn (',
          '\t\t<div>',
          '\t\t\t$4',
          '\t\t</div>',
          '\t);',
          '};'
        ],
        description: 'React functional component',
        scope: 'typescript,typescriptreact'
      },
      // Python
      {
        id: 'def',
        name: 'Function',
        prefix: 'def',
        body: [
          'def ${1:name}($2):',
          '\t$3',
          '\treturn $4'
        ],
        description: 'Python function',
        scope: 'python'
      },
      {
        id: 'class',
        name: 'Class',
        prefix: 'class',
        body: [
          'class ${1:ClassName}:',
          '\tdef __init__(self, $2):',
          '\t\t$3'
        ],
        description: 'Python class',
        scope: 'python'
      },
      // HTML
      {
        id: 'html',
        name: 'HTML Boilerplate',
        prefix: 'html',
        body: [
          '<!DOCTYPE html>',
          '<html lang="en">',
          '<head>',
          '\t<meta charset="UTF-8">',
          '\t<meta name="viewport" content="width=device-width, initial-scale=1.0">',
          '\t<title>$1</title>',
          '</head>',
          '<body>',
          '\t$2',
          '</body>',
          '</html>'
        ],
        description: 'HTML5 boilerplate',
        scope: 'html'
      }
    ];

    // Group by scope
    for (const snippet of defaultSnippets) {
      const scopes = snippet.scope?.split(',') || ['*'];
      for (const scope of scopes) {
        const trimmedScope = scope.trim();
        if (!this.snippets.has(trimmedScope)) {
          this.snippets.set(trimmedScope, []);
        }
        this.snippets.get(trimmedScope)!.push(snippet);
      }
    }
  }

  /**
   * Get snippets for a language
   */
  getSnippets(language: string): Snippet[] {
    const languageSnippets = this.snippets.get(language) || [];
    const allSnippets = this.snippets.get('*') || [];
    const userSnippetsForLanguage = this.userSnippets.filter(
      s => !s.scope || s.scope === '*' || s.scope.split(',').map(s => s.trim()).includes(language)
    );
    
    return [...languageSnippets, ...allSnippets, ...userSnippetsForLanguage];
  }

  /**
   * Get snippet by prefix
   */
  getSnippetByPrefix(language: string, prefix: string): Snippet | null {
    const snippets = this.getSnippets(language);
    return snippets.find(s => s.prefix === prefix) || null;
  }

  /**
   * Add user snippet
   */
  addUserSnippet(snippet: Omit<Snippet, 'id'>): Snippet {
    const newSnippet: Snippet = {
      ...snippet,
      id: generateIds.userSnippet()
    };
    
    this.userSnippets.push(newSnippet);
    this.saveUserSnippets();
    
    logger.debug('User snippet added:', newSnippet);
    return newSnippet;
  }

  /**
   * Remove user snippet
   */
  removeUserSnippet(snippetId: string): void {
    this.userSnippets = this.userSnippets.filter(s => s.id !== snippetId);
    this.saveUserSnippets();
    logger.debug('User snippet removed:', snippetId);
  }

  /**
   * Update user snippet
   */
  updateUserSnippet(snippetId: string, updates: Partial<Snippet>): Snippet | null {
    const index = this.userSnippets.findIndex(s => s.id === snippetId);
    if (index === -1) return null;

    this.userSnippets[index] = { ...this.userSnippets[index], ...updates };
    this.saveUserSnippets();
    
    logger.debug('User snippet updated:', this.userSnippets[index]);
    return this.userSnippets[index];
  }

  /**
   * Get all user snippets
   */
  getUserSnippets(): Snippet[] {
    return [...this.userSnippets];
  }

  /**
   * Save user snippets to localStorage
   */
  private saveUserSnippets(): void {
    try {
      localStorage.setItem('ide-user-snippets', JSON.stringify(this.userSnippets));
    } catch (error) {
      logger.error('Failed to save user snippets:', error);
    }
  }

  /**
   * Load user snippets from localStorage
   */
  loadUserSnippets(): void {
    try {
      const saved = localStorage.getItem('ide-user-snippets');
      if (saved) {
        this.userSnippets = JSON.parse(saved);
        logger.debug('User snippets loaded:', this.userSnippets.length);
      }
    } catch (error) {
      logger.error('Failed to load user snippets:', error);
    }
  }

  /**
   * Convert snippet to Monaco format
   */
  toMonacoSnippet(snippet: Snippet, monaco: any): any {
    const body = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;
    
    return {
      label: snippet.name,
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: body,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: snippet.description || snippet.name,
      detail: `Snippet: ${snippet.prefix}`,
      filterText: snippet.prefix
    };
  }
}

// Initialize and load user snippets
export const snippetService = new SnippetService();
snippetService.loadUserSnippets();
