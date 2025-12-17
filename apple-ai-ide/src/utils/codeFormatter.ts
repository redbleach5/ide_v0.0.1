import { logger } from './logger';

/**
 * Форматирует код в зависимости от языка
 */
export async function formatCode(content: string, language: string): Promise<string> {
  try {
    // Для некоторых языков можно использовать встроенные форматтеры
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
      case 'jsx':
      case 'tsx':
        return formatJavaScript(content);
      
      case 'json':
        return formatJSON(content);
      
      case 'html':
        return formatHTML(content);
      
      case 'css':
      case 'scss':
        return formatCSS(content);
      
      default:
        // Для остальных языков просто нормализуем отступы
        return normalizeIndentation(content);
    }
  } catch (error) {
    logger.warn('Error formatting code, returning original:', error);
    return content;
  }
}

/**
 * Форматирует JavaScript/TypeScript код
 */
function formatJavaScript(code: string): string {
  // Базовая нормализация:
  // 1. Убираем лишние пробелы в конце строк
  // 2. Нормализуем отступы
  // 3. Добавляем точку с запятой где нужно (базовая логика)
  
  let formatted = code;
  
  // Убираем пробелы в конце строк
  formatted = formatted.replace(/[ \t]+$/gm, '');
  
  // Нормализуем отступы (используем 2 пробела)
  formatted = normalizeIndentation(formatted);
  
  // Убираем множественные пустые строки (максимум 2 подряд)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  return formatted;
}

/**
 * Форматирует JSON
 */
function formatJSON(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
  } catch (error) {
    // Если не валидный JSON, возвращаем как есть
    return json;
  }
}

/**
 * Форматирует HTML
 */
function formatHTML(html: string): string {
  // Базовая нормализация HTML
  let formatted = html;
  
  // Нормализуем отступы
  formatted = normalizeIndentation(formatted);
  
  // Убираем лишние пробелы между тегами
  formatted = formatted.replace(/>\s+</g, '>\n<');
  
  return formatted;
}

/**
 * Форматирует CSS
 */
function formatCSS(css: string): string {
  let formatted = css;
  
  // Нормализуем отступы
  formatted = normalizeIndentation(formatted);
  
  // Добавляем пробелы после двоеточий
  formatted = formatted.replace(/:\s*/g, ': ');
  
  // Добавляем пробелы перед открывающими фигурными скобками
  formatted = formatted.replace(/\s*\{/g, ' {');
  
  return formatted;
}

/**
 * Нормализует отступы в коде (приводит к единому стилю - 2 пробела)
 */
function normalizeIndentation(code: string): string {
  const lines = code.split('\n');
  const normalized: string[] = [];
  let indentLevel = 0;
  const indentSize = 2;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Пропускаем пустые строки
    if (trimmed === '') {
      normalized.push('');
      continue;
    }
    
    // Определяем, нужно ли уменьшить уровень отступа
    if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    // Добавляем строку с правильным отступом
    normalized.push(' '.repeat(indentLevel * indentSize) + trimmed);
    
    // Определяем, нужно ли увеличить уровень отступа
    if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
      indentLevel++;
    }
  }
  
  return normalized.join('\n');
}

/**
 * Определяет язык по расширению файла
 */
export function getLanguageFromFileName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  const languageMap: { [key: string]: string } = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
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
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
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
