import { logger } from './logger';

export interface ParsedFile {
  path: string;
  content: string;
  language?: string;
}

/**
 * Парсит ответ AI и извлекает информацию о файлах с кодом
 * Поддерживает форматы:
 * - ```path/to/file.js\ncode\n```
 * - ```javascript:path/to/file.js\ncode\n```
 * - // File: path/to/file.js\ncode
 */
export function parseCodeFromResponse(response: string, projectPath?: string, userRequest?: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  
  try {
    logger.debug('Parsing code from response', { responseLength: response.length, hasProjectPath: !!projectPath });
    
    // Паттерн для блоков кода с указанием файла
    // Поддерживает: ```path/file.js, ```js:path/file.js, ```javascript:path/file.js
    const codeBlockPattern = /```(?:(\w+):)?([^\n`]+)\n([\s\S]*?)```/g;
    
    let match;
    while ((match = codeBlockPattern.exec(response)) !== null) {
      const language = match[1] || '';
      const filePath = match[2].trim();
      const content = match[3].trim();
      
      // Пропускаем, если это не путь к файлу (например, просто язык)
      if (!filePath.includes('/') && !filePath.includes('\\') && !filePath.includes('.')) {
        continue;
      }
      
      // Если путь относительный, делаем его абсолютным относительно проекта
      let fullPath = filePath;
      if (projectPath && !filePath.startsWith('/') && !/^[A-Za-z]:\\/.test(filePath)) {
        const pathSeparator = projectPath.includes('\\') ? '\\' : '/';
        fullPath = `${projectPath}${pathSeparator}${filePath.replace(/\//g, pathSeparator)}`;
      }
      
      files.push({
        path: fullPath,
        content,
        language: language || getLanguageFromPath(filePath)
      });
    }
    
    // Альтернативный паттерн: комментарии с указанием файла
    // // File: path/to/file.js
    const commentPattern = /(?:^|\n)\s*(?:\/\/|#)\s*File:\s*([^\n]+)\n([\s\S]*?)(?=\n\s*(?:\/\/|#)\s*File:|$)/g;
    let commentMatch;
    while ((commentMatch = commentPattern.exec(response)) !== null) {
      const filePath = commentMatch[1].trim();
      const content = commentMatch[2].trim();
      
      if (filePath && content) {
        let fullPath = filePath;
        if (projectPath && !filePath.startsWith('/') && !/^[A-Za-z]:\\/.test(filePath)) {
          const pathSeparator = projectPath.includes('\\') ? '\\' : '/';
          fullPath = `${projectPath}${pathSeparator}${filePath.replace(/\//g, pathSeparator)}`;
        }
        
        // Проверяем, не добавлен ли уже этот файл
        if (!files.some(f => f.path === fullPath)) {
          files.push({
            path: fullPath,
            content,
            language: getLanguageFromPath(filePath)
          });
        }
      }
    }
    
    // Если не найдено файлов с явным указанием пути, но есть код,
    // пытаемся определить имя файла из запроса пользователя и создать файл
    if (files.length === 0) {
      // Извлекаем все блоки кода из ответа
      const allCodeBlocks = response.match(/```(?:\w+)?\n([\s\S]*?)```/g);
      
      if (allCodeBlocks && allCodeBlocks.length > 0) {
        // Пытаемся определить имя файла из запроса пользователя
        let suggestedFileName = 'code.js'; // значение по умолчанию
        
        if (userRequest) {
          // Ищем упоминания файлов в запросе
          const filePatterns = [
            /(?:создай|напиши|сделай|реализуй).*?(?:файл|file)[\s:]+([^\s\n\.]+\.\w+)/i,
            /(?:игра|game)[\s:]+([^\s\n\.]+\.\w+)/i,
            /([a-zA-Z0-9_-]+\.(js|ts|jsx|tsx|py|html|css|json|md))/i,
            /([a-zA-Z0-9_-]+)\.(js|ts|jsx|tsx|py|html|css)/i
          ];
          
          for (const pattern of filePatterns) {
            const match = userRequest.match(pattern);
            if (match) {
              suggestedFileName = match[1] || match[0];
              break;
            }
          }
          
          // Если не нашли явное имя файла, пытаемся определить из контекста
          if (suggestedFileName === 'code.js') {
            const lowerRequest = userRequest.toLowerCase();
            if (lowerRequest.includes('игру') || lowerRequest.includes('game')) {
              suggestedFileName = 'game.js';
            } else if (lowerRequest.includes('компонент') || lowerRequest.includes('component')) {
              suggestedFileName = 'Component.jsx';
            } else if (lowerRequest.includes('функцию') || lowerRequest.includes('function')) {
              suggestedFileName = 'function.js';
            } else if (lowerRequest.includes('класс') || lowerRequest.includes('class')) {
              suggestedFileName = 'Class.js';
            }
          }
        }
        
        // Извлекаем код из первого блока кода
        const firstCodeBlock = allCodeBlocks[0];
        const codeMatch = firstCodeBlock.match(/```(?:\w+)?\n([\s\S]*?)```/);
        
        if (codeMatch && codeMatch[1]) {
          const content = codeMatch[1].trim();
          
          // Определяем язык из первого блока кода
          const langMatch = firstCodeBlock.match(/```(\w+)/);
          const detectedLanguage = langMatch ? langMatch[1] : 'javascript';
          
          // Обновляем расширение файла в зависимости от языка
          const extensionMap: { [key: string]: string } = {
            'javascript': 'js',
            'typescript': 'ts',
            'jsx': 'jsx',
            'tsx': 'tsx',
            'python': 'py',
            'html': 'html',
            'css': 'css',
            'json': 'json'
          };
          
          const ext = extensionMap[detectedLanguage] || 'js';
          if (!suggestedFileName.includes('.')) {
            suggestedFileName = `${suggestedFileName.replace(/\.\w+$/, '')}.${ext}`;
          }
          
          let fullPath = suggestedFileName;
          if (projectPath) {
            const pathSeparator = projectPath.includes('\\') ? '\\' : '/';
            fullPath = `${projectPath}${pathSeparator}${suggestedFileName}`;
          }
          
          logger.debug('Auto-detected file from code blocks', { 
            fileName: suggestedFileName, 
            language: detectedLanguage,
            contentLength: content.length 
          });
          
          files.push({
            path: fullPath,
            content,
            language: detectedLanguage
          });
        }
      }
    }
    
    logger.debug('Parsed files from AI response:', { count: files.length, files: files.map(f => f.path) });
    return files;
  } catch (error) {
    logger.error('Error parsing code from response:', error);
    return [];
  }
}

/**
 * Определяет язык программирования по расширению файла
 */
function getLanguageFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
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
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'sh': 'shell',
    'sql': 'sql'
  };
  
  return languageMap[extension || ''] || 'plaintext';
}

/**
 * Определяет, является ли запрос запросом на создание файлов/кода
 */
export function isCodeGenerationRequest(message: string): boolean {
  const codeGenerationKeywords = [
    'напиши', 'создай', 'сделай', 'реализуй', 'напиши код', 'создай файл',
    'напиши игру', 'создай компонент', 'напиши функцию', 'создай класс',
    'write', 'create', 'implement', 'build', 'make', 'generate code',
    'create file', 'write code', 'implement function', 'game', 'игру',
    'component', 'компонент', 'function', 'функцию', 'class', 'класс'
  ];
  
  const lowerMessage = message.toLowerCase();
  return codeGenerationKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Проверяет, содержит ли ответ AI код (блоки кода)
 */
export function responseContainsCode(response: string): boolean {
  // Проверяем наличие блоков кода
  const codeBlockPattern = /```[\s\S]*?```/;
  return codeBlockPattern.test(response);
}
