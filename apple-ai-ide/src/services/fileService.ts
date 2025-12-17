import { FileNode, Tab } from '../types';
import { logger } from '../utils/logger';
import { generateIds } from '../utils/idGenerator';

export class FileService {
  // Maximum file size to load (10MB)
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

  /**
   * Validates file path for security
   * Prevents directory traversal and other security issues
   */
  private validatePath(filePath: string): void {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path: path must be a non-empty string');
    }

    // Prevent directory traversal attacks
    if (filePath.includes('..')) {
      throw new Error('Invalid file path: directory traversal detected');
    }

    // Prevent null bytes
    if (filePath.includes('\0')) {
      throw new Error('Invalid file path: null byte detected');
    }

    // Check for absolute paths (in Electron, we want to allow them, but log for security)
    if (filePath.startsWith('/') || /^[A-Za-z]:\\/.test(filePath)) {
      logger.debug('Accessing absolute path:', filePath);
    }
  }

  async readFile(filePath: string, checkSize: boolean = true): Promise<string> {
    this.validatePath(filePath);
    
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    
    try {
      logger.debug('Reading file:', filePath);
      
      // Check file size if available
      if (checkSize && window.electronAPI.getFileSize) {
        const sizeResult = await window.electronAPI.getFileSize(filePath);
        if (sizeResult.success && sizeResult.size) {
          if (sizeResult.size > this.MAX_FILE_SIZE) {
            const sizeMB = (sizeResult.size / (1024 * 1024)).toFixed(2);
            const maxMB = (this.MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
            throw new Error(
              `Файл слишком большой (${sizeMB} MB). Максимальный размер: ${maxMB} MB. ` +
              `Откройте файл в другом редакторе или уменьшите его размер.`
            );
          }
          logger.debug('File size check passed:', { filePath, size: sizeResult.size });
        }
      }
      
      const result = await window.electronAPI.readFile(filePath);
      
      if (!result.success) {
        logger.error('Failed to read file:', new Error(result.error || 'Unknown error'), { filePath });
        throw new Error(result.error || 'Failed to read file');
      }
      
      // Additional check: verify content size
      if (checkSize && result.content) {
        const contentSize = new Blob([result.content]).size;
        if (contentSize > this.MAX_FILE_SIZE) {
          const sizeMB = (contentSize / (1024 * 1024)).toFixed(2);
          const maxMB = (this.MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
          throw new Error(
            `Содержимое файла слишком большое (${sizeMB} MB). Максимальный размер: ${maxMB} MB.`
          );
        }
      }
      
      logger.debug('File read successfully:', filePath);
      return result.content || '';
    } catch (error) {
      logger.error('Error reading file:', error, { filePath });
      throw error;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.validatePath(filePath);
    
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    
    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }
    
    try {
      logger.debug('Writing file:', filePath);
      const result = await window.electronAPI.writeFile(filePath, content);
      
      if (!result.success) {
        logger.error('Failed to write file:', new Error(result.error || 'Unknown error'), { filePath });
        throw new Error(result.error || 'Failed to write file');
      }
      
      logger.debug('File written successfully:', filePath);
    } catch (error) {
      logger.error('Error writing file:', error, { filePath });
      throw error;
    }
  }

  async readDirectory(dirPath: string): Promise<FileNode[]> {
    this.validatePath(dirPath);
    
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    
    try {
      logger.debug('Reading directory:', dirPath);
      const result = await window.electronAPI.readDirectory(dirPath);
      
      if (!result.success) {
        logger.error('Failed to read directory:', new Error(result.error || 'Unknown error'), { dirPath });
        throw new Error(result.error || 'Failed to read directory');
      }
      
      const files = result.files || [];
      logger.debug('Raw files from directory:', { dirPath, count: files.length, files: files.map(f => f.name) });
      
      const fileNodes = files.map(file => ({
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory,
        children: file.isDirectory ? [] : undefined,
        isOpen: false
      }));
      
      logger.debug('Directory read successfully:', dirPath, { fileCount: fileNodes.length });
      return fileNodes;
    } catch (error) {
      logger.error('Error reading directory:', error, { dirPath });
      throw error;
    }
  }

  async buildFileTree(dirPath: string): Promise<FileNode[]> {
    try {
      // Check if we're trying to open an ignored directory
      const dirName = dirPath.split('/').pop() || dirPath.split('\\').pop() || '';
      if (this.shouldIgnoreDirectory(dirName) && dirName !== '') {
        logger.warn(`Attempted to open ignored directory: ${dirPath}`);
        return [];
      }

      const items = await this.readDirectory(dirPath);
      logger.debug(`Building file tree for ${dirPath}:`, { itemCount: items.length });
      
      const fileTree: FileNode[] = [];

      for (const item of items) {
        if (item.isDirectory) {
          // Skip ignored directories
          if (!this.shouldIgnoreDirectory(item.name)) {
            logger.debug(`Including directory: ${item.name}`);
            const children = await this.buildFileTree(item.path);
            fileTree.push({
              ...item,
              children
            });
          } else {
            logger.debug(`Skipping ignored directory: ${item.name}`);
          }
        } else {
          // Check if file should be ignored
          if (!this.shouldIgnoreFile(item.name)) {
            logger.debug(`Including file: ${item.name}`);
            fileTree.push(item);
          } else {
            logger.debug(`Skipping ignored file: ${item.name}`);
          }
        }
      }

      logger.debug(`File tree built for ${dirPath}:`, { fileCount: fileTree.length });
      return this.sortFileNodes(fileTree);
    } catch (error) {
      logger.error(`Error building file tree for ${dirPath}:`, error);
      return [];
    }
  }

  private shouldIgnoreDirectory(name: string): boolean {
    const ignored = [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'target',
      'bin',
      'obj',
      '.next',
      '.nuxt',
      '.output',
      'coverage',
      '.coverage',
      '__pycache__',
      '.pytest_cache',
      '.venv',
      'venv',
      'env',
      // '.env' - это файл, не директория, убираем из списка
      'site-packages'
    ];
    // Case-insensitive check
    const nameLower = name.toLowerCase();
    // Игнорируем скрытые директории, но не .env (это файл) и не .github
    return ignored.includes(nameLower) || (name.startsWith('.') && name !== '.github' && name !== '.env');
  }

  private shouldIgnoreFile(name: string): boolean {
    const ignoredExtensions = [
      '.log',
      '.tmp',
      '.cache',
      '.DS_Store',
      '.pid'
    ];
    
    const ignoredFiles = [
      // Не скрываем lock файлы и package.json - они важны для проекта
      '.eslintcache',
      '.DS_Store'
    ];

    const extension = name.split('.').pop()?.toLowerCase();
    // Не фильтруем .lock файлы (package-lock.json, yarn.lock и т.д.)
    if (extension === 'lock') {
      return false;
    }
    
    return ignoredExtensions.includes(`.${extension}`) || 
           ignoredFiles.includes(name) ||
           name.endsWith('.min.js') ||
           name.endsWith('.min.css');
  }

  private sortFileNodes(nodes: FileNode[]): FileNode[] {
    return nodes.sort((a, b) => {
      // Directories first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      
      // Then sort by name (case-insensitive)
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  getLanguageFromExtension(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
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
      'kt': 'kotlin',
      'scala': 'scala',
      'dart': 'dart',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      'ps1': 'powershell',
      'bat': 'batch',
      'cmd': 'batch',
      'sql': 'sql',
      'md': 'markdown',
      'mdx': 'markdown',
      'tex': 'latex',
      'dockerfile': 'dockerfile',
      'vue': 'vue',
      'svelte': 'svelte',
      'astro': 'astro'
    };
    
    return languageMap[extension || ''] || 'plaintext';
  }

  generateTabId(): string {
    return generateIds.tab();
  }

  async createTab(filePath: string, skipSizeCheck: boolean = false): Promise<Tab> {
    try {
      const content = await this.readFile(filePath, !skipSizeCheck);
      const language = this.getLanguageFromExtension(filePath);
      
      return {
        id: this.generateTabId(),
        title: this.getFileName(filePath),
        path: filePath,
        content,
        language,
        isDirty: false
      };
    } catch (error) {
      // If it's a size error, create a tab with error message
      if (error instanceof Error && error.message.includes('слишком большой')) {
        const language = this.getLanguageFromExtension(filePath);
        return {
          id: this.generateTabId(),
          title: this.getFileName(filePath),
          path: filePath,
          content: `// ${error.message}\n// Файл не может быть открыт из-за большого размера.`,
          language,
          isDirty: false
        };
      }
      throw error;
    }
  }

  private getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath.split('\\').pop() || 'Untitled';
  }

  async saveTab(tab: Tab): Promise<Tab> {
    await this.writeFile(tab.path, tab.content);
    return {
      ...tab,
      isDirty: false
    };
  }

  async saveAllTabs(tabs: Tab[]): Promise<Tab[]> {
    const savedTabs = await Promise.all(
      tabs.filter(tab => tab.isDirty)
        .map(tab => this.saveTab(tab))
    );
    
    return tabs.map(tab => {
      const saved = savedTabs.find(s => s.id === tab.id);
      return saved || tab;
    });
  }
}

export const fileService = new FileService();