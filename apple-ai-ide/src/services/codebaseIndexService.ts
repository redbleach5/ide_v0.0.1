import { FileNode } from '../types';
import { fileService } from './fileService';
import { logger } from '../utils/logger';

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'enum';
  filePath: string;
  lineNumber: number;
  signature?: string;
  description?: string;
}

export interface FileIndex {
  path: string;
  language: string;
  symbols: CodeSymbol[];
  dependencies: string[];
  imports: string[];
  exports: string[];
  size: number;
  lastModified: number;
}

export interface CodebaseIndex {
  projectPath: string;
  files: Map<string, FileIndex>;
  symbols: Map<string, CodeSymbol[]>;
  dependencies: Map<string, string[]>;
  indexedAt: number;
}

class CodebaseIndexService {
  private indexCache: Map<string, CodebaseIndex> = new Map();
  private indexingInProgress: Set<string> = new Set();
  private readonly MAX_FILE_SIZE = 500 * 1024; // 500KB per file for indexing

  /**
   * Index a project
   */
  async indexProject(projectPath: string, force: boolean = false): Promise<CodebaseIndex> {
    // Check cache
    if (!force) {
      const cached = this.indexCache.get(projectPath);
      if (cached && Date.now() - cached.indexedAt < 5 * 60 * 1000) { // 5 minutes cache
        logger.debug('Using cached codebase index');
        return cached;
      }
    }

    // Check if already indexing
    if (this.indexingInProgress.has(projectPath)) {
      logger.debug('Indexing already in progress for:', projectPath);
      // Return cached if available, otherwise wait
      const cached = this.indexCache.get(projectPath);
      if (cached) return cached;
      // Wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.indexProject(projectPath, false);
    }

    this.indexingInProgress.add(projectPath);

    try {
      logger.info('Indexing codebase:', projectPath);

      // Build file tree
      const fileTree = await fileService.buildFileTree(projectPath);
      
      // Index all files
      const files = new Map<string, FileIndex>();
      const symbols = new Map<string, CodeSymbol[]>();
      const dependencies = new Map<string, string[]>();

      await this.indexFiles(fileTree, projectPath, files, symbols, dependencies);

      const index: CodebaseIndex = {
        projectPath,
        files,
        symbols,
        dependencies,
        indexedAt: Date.now()
      };

      this.indexCache.set(projectPath, index);
      logger.info('Codebase indexed successfully', {
        files: files.size,
        symbols: Array.from(symbols.values()).reduce((sum, arr) => sum + arr.length, 0)
      });

      return index;
    } catch (error) {
      logger.error('Error indexing codebase:', error);
      // Return empty index on error
      return {
        projectPath,
        files: new Map(),
        symbols: new Map(),
        dependencies: new Map(),
        indexedAt: Date.now()
      };
    } finally {
      this.indexingInProgress.delete(projectPath);
    }
  }

  /**
   * Index files recursively
   */
  private async indexFiles(
    fileTree: FileNode[],
    projectPath: string,
    files: Map<string, FileIndex>,
    symbols: Map<string, CodeSymbol[]>,
    dependencies: Map<string, string[]>
  ): Promise<void> {
    for (const node of fileTree) {
      if (node.isDirectory && node.children) {
        await this.indexFiles(node.children, projectPath, files, symbols, dependencies);
      } else if (!node.isDirectory) {
        try {
          const fileIndex = await this.indexFile(node.path, projectPath);
          if (fileIndex) {
            files.set(node.path, fileIndex);
            
            // Add symbols to global index
            for (const symbol of fileIndex.symbols) {
              if (!symbols.has(symbol.type)) {
                symbols.set(symbol.type, []);
              }
              symbols.get(symbol.type)!.push(symbol);
            }

            // Add dependencies
            if (fileIndex.dependencies.length > 0) {
              dependencies.set(node.path, fileIndex.dependencies);
            }
          }
        } catch (error) {
          logger.debug('Error indexing file:', node.path, error);
          // Continue with other files
        }
      }
    }
  }

  /**
   * Index a single file
   */
  private async indexFile(filePath: string, projectPath: string): Promise<FileIndex | null> {
    try {
      // Skip large files
      if (window.electronAPI?.getFileSize) {
        const sizeResult = await window.electronAPI.getFileSize(filePath);
        if (sizeResult.success && sizeResult.size && sizeResult.size > this.MAX_FILE_SIZE) {
          logger.debug('Skipping large file:', filePath);
          return null;
        }
      }

      // Read file content
      const content = await fileService.readFile(filePath, false);
      const language = this.getLanguageFromPath(filePath);

      // Parse file for symbols
      const symbols = this.extractSymbols(content, filePath, language);
      const dependencies = this.extractDependencies(content, language);
      const imports = this.extractImports(content, language);
      const exports = this.extractExports(content, language);

      return {
        path: filePath,
        language,
        symbols,
        dependencies,
        imports,
        exports,
        size: content.length,
        lastModified: Date.now()
      };
    } catch (error) {
      logger.debug('Error reading file for indexing:', filePath, error);
      return null;
    }
  }

  /**
   * Extract symbols from code
   */
  private extractSymbols(content: string, filePath: string, language: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');

    // Simple regex-based extraction (can be improved with proper parsers)
    if (language === 'typescript' || language === 'javascript') {
      // Functions
      const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
      let match;
      let lineNum = 1;
      for (const line of lines) {
        while ((match = functionRegex.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            type: 'function',
            filePath,
            lineNumber: lineNum
          });
        }
        lineNum++;
      }

      // Classes
      const classRegex = /(?:export\s+)?class\s+(\w+)/g;
      lineNum = 1;
      for (const line of lines) {
        while ((match = classRegex.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            type: 'class',
            filePath,
            lineNumber: lineNum
          });
        }
        lineNum++;
      }

      // Interfaces
      const interfaceRegex = /(?:export\s+)?interface\s+(\w+)/g;
      lineNum = 1;
      for (const line of lines) {
        while ((match = interfaceRegex.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            type: 'interface',
            filePath,
            lineNumber: lineNum
          });
        }
        lineNum++;
      }

      // Types
      const typeRegex = /(?:export\s+)?type\s+(\w+)/g;
      lineNum = 1;
      for (const line of lines) {
        while ((match = typeRegex.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            type: 'type',
            filePath,
            lineNumber: lineNum
          });
        }
        lineNum++;
      }
    } else if (language === 'python') {
      // Python functions and classes
      const defRegex = /(?:def|class)\s+(\w+)/g;
      let match;
      let lineNum = 1;
      for (const line of lines) {
        while ((match = defRegex.exec(line)) !== null) {
          const isClass = line.trim().startsWith('class');
          symbols.push({
            name: match[1],
            type: isClass ? 'class' : 'function',
            filePath,
            lineNumber: lineNum
          });
        }
        lineNum++;
      }
    }

    return symbols;
  }

  /**
   * Extract dependencies (imports)
   */
  private extractDependencies(content: string, language: string): string[] {
    const dependencies: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // import ... from '...'
      const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }

      // require('...')
      const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
    } else if (language === 'python') {
      // import ... or from ... import ...
      const importRegex = /(?:from\s+(\S+)\s+)?import\s+/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1]) {
          dependencies.push(match[1]);
        }
      }
    }

    return Array.from(new Set(dependencies)); // Remove duplicates
  }

  /**
   * Extract imports
   */
  private extractImports(content: string, language: string): string[] {
    return this.extractDependencies(content, language);
  }

  /**
   * Extract exports
   */
  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // export const/function/class ...
      const exportRegex = /export\s+(?:const|function|class|interface|type)\s+(\w+)/g;
      let match;
      while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1]);
      }
    }

    return exports;
  }

  /**
   * Get language from file path
   */
  private getLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const languageMap: { [key: string]: string } = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin'
    };
    return languageMap[ext] || 'plaintext';
  }

  /**
   * Get index for project
   */
  getIndex(projectPath: string): CodebaseIndex | null {
    return this.indexCache.get(projectPath) || null;
  }

  /**
   * Get relevant context for AI query
   */
  getRelevantContext(projectPath: string, query: string, limit: number = 10): Array<{ path: string; content: string; symbols: CodeSymbol[] }> {
    const index = this.getIndex(projectPath);
    if (!index) return [];

    const results: Array<{ path: string; content: string; symbols: CodeSymbol[] }> = [];
    const queryLower = query.toLowerCase();

    // Search in symbols
    const symbolEntries = Array.from(index.symbols.entries());
    for (const [, symbols] of symbolEntries) {
      for (const symbol of symbols) {
        if (symbol.name.toLowerCase().includes(queryLower)) {
          const fileIndex = index.files.get(symbol.filePath);
          if (fileIndex) {
            results.push({
              path: symbol.filePath,
              content: '', // Will be loaded on demand
              symbols: [symbol]
            });
            if (results.length >= limit) break;
          }
        }
      }
      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  }

  /**
   * Clear cache for project
   */
  clearCache(projectPath?: string): void {
    if (projectPath) {
      this.indexCache.delete(projectPath);
    } else {
      this.indexCache.clear();
    }
    logger.debug('Codebase index cache cleared', { projectPath });
  }

  /**
   * Update index for a specific file
   */
  async updateFileIndex(projectPath: string, filePath: string): Promise<void> {
    const index = this.getIndex(projectPath);
    if (!index) return;

    try {
      const fileIndex = await this.indexFile(filePath, projectPath);
      if (fileIndex) {
        // Remove old symbols
        const symbolEntries = Array.from(index.symbols.entries());
        for (const [type, symbols] of symbolEntries) {
          index.symbols.set(type, symbols.filter((s: CodeSymbol) => s.filePath !== filePath));
        }

        // Add new symbols
        for (const symbol of fileIndex.symbols) {
          if (!index.symbols.has(symbol.type)) {
            index.symbols.set(symbol.type, []);
          }
          index.symbols.get(symbol.type)!.push(symbol);
        }

        // Update file index
        index.files.set(filePath, fileIndex);
        index.indexedAt = Date.now();

        logger.debug('File index updated:', filePath);
      }
    } catch (error) {
      logger.error('Error updating file index:', error);
    }
  }
}

export const codebaseIndexService = new CodebaseIndexService();
