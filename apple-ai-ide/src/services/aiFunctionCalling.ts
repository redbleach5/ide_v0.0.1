import { logger } from '../utils/logger';
import { fileService } from './fileService';
import { formatCode, getLanguageFromFileName } from '../utils/codeFormatter';
import { generateIds } from '../utils/idGenerator';

export interface AITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: { [key: string]: any };
      required: string[];
    };
  };
}

export interface AIToolCall {
  id?: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface AIToolResult {
  tool_call_id?: string;
  name: string;
  result: any;
}

/**
 * Определения инструментов (функций), которые может вызывать AI
 */
export const AI_TOOLS: AITool[] = [
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Создает новый файл с указанным содержимым. Используйте эту функцию, когда пользователь просит создать, написать или реализовать код.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Путь к файлу относительно корня проекта (например, "game.js", "src/Component.jsx", "utils.js")'
          },
          content: {
            type: 'string',
            description: 'Содержимое файла (код)'
          }
        },
        required: ['file_path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Читает содержимое существующего файла из проекта',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Путь к файлу относительно корня проекта'
          }
        },
        required: ['file_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Редактирует существующий файл, заменяя его содержимое',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Путь к файлу относительно корня проекта'
          },
          content: {
            type: 'string',
            description: 'Новое содержимое файла'
          }
        },
        required: ['file_path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'Просматривает структуру проекта, возвращает список файлов и директорий. Используйте для понимания структуры проекта перед созданием файлов.',
      parameters: {
        type: 'object',
        properties: {
          directory_path: {
            type: 'string',
            description: 'Путь к директории относительно корня проекта (по умолчанию корень проекта). Используйте "." для корня проекта.'
          },
          max_depth: {
            type: 'number',
            description: 'Максимальная глубина вложенности для просмотра (по умолчанию 2)'
          }
        },
        required: []
      }
    }
  }
];

/**
 * Обрабатывает вызов функции от AI
 */
export async function executeToolCall(
  toolCall: AIToolCall,
  projectPath?: string,
  onFileCreate?: (filePath: string, content: string) => Promise<void>,
  onFileOpen?: (filePath: string) => Promise<void>
): Promise<AIToolResult> {
  try {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    
    logger.debug('Executing tool call:', { functionName, args });

    switch (functionName) {
      case 'create_file': {
        const filePath = args.file_path;
        const content = args.content;
        
        if (!filePath || !content) {
          throw new Error('file_path and content are required');
        }

        // Валидация пути
        if (filePath.includes('..')) {
          throw new Error('Invalid file path: directory traversal detected');
        }

        // Создаем полный путь
        let fullPath = filePath;
        if (projectPath && !filePath.startsWith('/') && !/^[A-Za-z]:\\/.test(filePath)) {
          const pathSeparator = projectPath.includes('\\') ? '\\' : '/';
          fullPath = `${projectPath}${pathSeparator}${filePath.replace(/\//g, pathSeparator)}`;
        }

        // Проверяем, не существует ли файл уже
        try {
          await fileService.readFile(fullPath);
          // Файл существует - предупреждаем, но не блокируем
          logger.warn('File already exists, will be overwritten:', fullPath);
        } catch (error) {
          // Файл не существует - это нормально для create_file
        }

        // Форматируем код перед созданием файла
        let formattedContent = content;
        try {
          const language = getLanguageFromFileName(filePath);
          formattedContent = await formatCode(content, language);
          logger.debug('Code formatted:', { filePath, language, originalLength: content.length, formattedLength: formattedContent.length });
        } catch (formatError) {
          logger.warn('Failed to format code, using original:', formatError);
          // Используем оригинальный контент, если форматирование не удалось
        }

        // Создаем файл с улучшенной обработкой ошибок
        try {
          if (onFileCreate) {
            await onFileCreate(fullPath, formattedContent);
            logger.info('File created via tool call:', fullPath);
            
            // Открываем файл в редакторе
            if (onFileOpen) {
              await onFileOpen(fullPath);
            }
          } else {
            // Fallback: используем fileService напрямую
            await fileService.writeFile(fullPath, formattedContent);
            logger.info('File created via fileService:', fullPath);
          }

          return {
            tool_call_id: toolCall.id,
            name: functionName,
            result: { 
              success: true, 
              file_path: fullPath, 
              relative_path: filePath,
              message: `File ${filePath} created successfully`,
              size: formattedContent.length
            }
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Failed to create file:', error, { filePath: fullPath });
          throw new Error(`Failed to create file ${filePath}: ${errorMessage}`);
        }
      }

      case 'read_file': {
        const filePath = args.file_path;
        
        if (!filePath) {
          throw new Error('file_path is required');
        }

        // Создаем полный путь
        let fullPath = filePath;
        if (projectPath && !filePath.startsWith('/') && !/^[A-Za-z]:\\/.test(filePath)) {
          const pathSeparator = projectPath.includes('\\') ? '\\' : '/';
          fullPath = `${projectPath}${pathSeparator}${filePath.replace(/\//g, pathSeparator)}`;
        }

        try {
          const content = await fileService.readFile(fullPath);
          
          return {
            tool_call_id: toolCall.id,
            name: functionName,
            result: { 
              success: true, 
              file_path: fullPath,
              relative_path: filePath,
              content,
              size: content.length,
              lines: content.split('\n').length
            }
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Failed to read file:', error, { filePath: fullPath });
          throw new Error(`Failed to read file ${filePath}: ${errorMessage}`);
        }
      }

      case 'edit_file': {
        const filePath = args.file_path;
        const content = args.content;
        
        if (!filePath || !content) {
          throw new Error('file_path and content are required');
        }

        // Создаем полный путь
        let fullPath = filePath;
        if (projectPath && !filePath.startsWith('/') && !/^[A-Za-z]:\\/.test(filePath)) {
          const pathSeparator = projectPath.includes('\\') ? '\\' : '/';
          fullPath = `${projectPath}${pathSeparator}${filePath.replace(/\//g, pathSeparator)}`;
        }

        // Проверяем существование файла
        try {
          await fileService.readFile(fullPath);
        } catch (error) {
          throw new Error(`File ${filePath} does not exist. Use create_file to create new files.`);
        }

        // Форматируем код перед редактированием файла
        let formattedContent = content;
        try {
          const language = getLanguageFromFileName(filePath);
          formattedContent = await formatCode(content, language);
          logger.debug('Code formatted before edit:', { filePath, language });
        } catch (formatError) {
          logger.warn('Failed to format code, using original:', formatError);
        }

        await fileService.writeFile(fullPath, formattedContent);
        logger.info('File edited via tool call:', fullPath);

        // Открываем файл в редакторе после редактирования
        if (onFileOpen) {
          await onFileOpen(fullPath);
        }

        return {
          tool_call_id: toolCall.id,
          name: functionName,
          result: { success: true, file_path: fullPath, message: `File ${filePath} updated successfully` }
        };
      }

      case 'list_files': {
        const directoryPath = args.directory_path || '.';
        const maxDepth = args.max_depth || 2;
        
        // Создаем полный путь
        let fullPath = directoryPath === '.' ? projectPath : directoryPath;
        if (projectPath && directoryPath !== '.' && !directoryPath.startsWith('/') && !/^[A-Za-z]:\\/.test(directoryPath)) {
          const pathSeparator = projectPath.includes('\\') ? '\\' : '/';
          fullPath = `${projectPath}${pathSeparator}${directoryPath.replace(/\//g, pathSeparator)}`;
        }

        if (!fullPath) {
          throw new Error('Project path is required for list_files');
        }

        // Получаем структуру файлов
        const fileTree = await fileService.buildFileTree(fullPath);
        
        // Ограничиваем глубину
        const limitDepth = (nodes: any[], currentDepth: number = 0): any[] => {
          if (currentDepth >= maxDepth) {
            return [];
          }
          return nodes.map(node => ({
            name: node.name,
            path: node.path,
            isDirectory: node.isDirectory,
            children: node.isDirectory ? limitDepth(node.children || [], currentDepth + 1) : undefined
          }));
        };

        const limitedTree = limitDepth(fileTree);

        return {
          tool_call_id: toolCall.id,
          name: functionName,
          result: { 
            success: true, 
            directory: fullPath,
            files: limitedTree,
            message: `Listed ${limitedTree.length} items in ${directoryPath}`
          }
        };
      }

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  } catch (error) {
    logger.error('Error executing tool call:', error);
    return {
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      result: { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    };
  }
}

/**
 * Форматирует инструменты для отправки в API (Ollama/LM Studio)
 */
export function formatToolsForAPI(tools: AITool[], provider: 'ollama' | 'lmstudio'): any {
  if (provider === 'ollama') {
    // Ollama использует формат OpenAI
    return tools;
  } else {
    // LM Studio также использует формат OpenAI
    return tools;
  }
}

/**
 * Константы для fallback парсинга tool calls
 */
const FALLBACK_PARSING_CONFIG = {
  MAX_CONTENT_LENGTH: 100000, // Максимальная длина контента файла
  MAX_CONTENT_PREVIEW: 200, // Максимальная длина превью для логов
  SUPPORTED_FUNCTIONS: ['create_file', 'edit_file', 'read_file', 'list_files'] as const,
} as const;

/**
 * Валидирует извлеченный tool call
 */
function validateToolCall(toolCall: Partial<AIToolCall>): toolCall is AIToolCall {
  if (!toolCall.function || !toolCall.function.name) {
    return false;
  }
  
  // Проверяем, что функция поддерживается
  if (!FALLBACK_PARSING_CONFIG.SUPPORTED_FUNCTIONS.includes(
    toolCall.function.name as typeof FALLBACK_PARSING_CONFIG.SUPPORTED_FUNCTIONS[number]
  )) {
    logger.warn('Unsupported function in tool call:', toolCall.function.name);
    return false;
  }
  
  // Валидируем arguments
  try {
    if (toolCall.function.arguments) {
      const args = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      
      // Для create_file и edit_file проверяем наличие file_path и content
      if (toolCall.function.name === 'create_file' || toolCall.function.name === 'edit_file') {
        if (!args.file_path || typeof args.file_path !== 'string') {
          return false;
        }
        if (args.content === undefined) {
          return false;
        }
      }
    }
  } catch (e) {
    logger.warn('Invalid arguments in tool call:', e);
    return false;
  }
  
  return true;
}

/**
 * Извлекает вызовы функций из ответа AI
 */
export function extractToolCallsFromResponse(response: any, provider: 'ollama' | 'lmstudio'): AIToolCall[] {
  const toolCalls: AIToolCall[] = [];

  try {
    if (provider === 'ollama') {
      // Ollama может возвращать tool_calls в message
      if (response.message?.tool_calls) {
        return response.message.tool_calls.map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function?.name || tc.name,
            arguments: typeof tc.function?.arguments === 'string' 
              ? tc.function.arguments 
              : JSON.stringify(tc.function?.arguments || {})
          }
        }));
      }
    } else {
      // LM Studio (OpenAI format)
      if (response.choices?.[0]?.message?.tool_calls) {
        return response.choices[0].message.tool_calls.map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function?.name,
            arguments: tc.function?.arguments || '{}'
          }
        }));
      }
    }

    // Попытка извлечь из текстового ответа (fallback для моделей без поддержки function calling)
    const text = response.message?.content || response.choices?.[0]?.message?.content || '';
    
    // Паттерн 1: <tool_call>...</tool_call>
    const toolCallPattern = /<tool_call>\s*\{[^}]+\}\s*<\/tool_call>/g;
    const matches = text.match(toolCallPattern);
    
    if (matches) {
      for (const match of matches) {
        try {
          const jsonMatch = match.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const toolCallData = JSON.parse(jsonMatch[0]);
          const toolCall: AIToolCall = {
            id: toolCallData.id || generateIds.toolCall(),
            type: 'function',
            function: {
              name: toolCallData.name || toolCallData.function,
              arguments: JSON.stringify(toolCallData.arguments || {})
            }
          };
          
          if (validateToolCall(toolCall)) {
            toolCalls.push(toolCall);
          } else {
            logger.warn('Invalid tool call parsed from text, skipping:', toolCall);
          }
          }
        } catch (e) {
          logger.warn('Failed to parse tool call from text:', e);
        }
      }
    }
    
    // Паттерн 2: "Call create_file("file", "content")" - парсим текстовые вызовы функций
    if (toolCalls.length === 0) {
      // Ищем паттерн: Call create_file("path", многострочный контент)
      const createFilePattern = /Call\s+create_file\s*\(\s*"([^"]+)"\s*,\s*"([\s\S]*?)"\s*\)/gi;
      let match;
      
      while ((match = createFilePattern.exec(text)) !== null) {
        try {
          const filePath = match[1];
          let content = match[2] || '';
          
          // Обрабатываем экранированные символы
          content = content
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\');
          
          // Если контент очень длинный, обрезаем его (возможно, это неполный вызов)
          if (content.length > FALLBACK_PARSING_CONFIG.MAX_CONTENT_LENGTH) {
            logger.warn('Content too long, might be incomplete:', { filePath, contentLength: content.length });
            content = content.substring(0, FALLBACK_PARSING_CONFIG.MAX_CONTENT_LENGTH);
          }
          
          const toolCall: AIToolCall = {
            id: generateIds.toolCall(),
            type: 'function',
            function: {
              name: 'create_file',
              arguments: JSON.stringify({
                file_path: filePath,
                content: content
              })
            }
          };
          
          if (validateToolCall(toolCall)) {
            toolCalls.push(toolCall);
          } else {
            logger.warn('Invalid create_file call parsed from text, skipping:', { filePath });
          }
          
          logger.info('Parsed create_file call from text:', { 
            filePath, 
            contentLength: content.length,
            preview: content.substring(0, 100)
          });
        } catch (e) {
          logger.warn('Failed to parse create_file call from text:', e, { 
            filePath: match[1],
            contentPreview: match[2]?.substring(0, FALLBACK_PARSING_CONFIG.MAX_CONTENT_PREVIEW)
          });
        }
      }
      
      // Также ищем паттерн с обратными кавычками для многострочного контента
      const createFilePatternBacktick = /Call\s+create_file\s*\(\s*"([^"]+)"\s*,\s*`([^`]+)`\s*\)/gi;
      while ((match = createFilePatternBacktick.exec(text)) !== null) {
        try {
          const filePath = match[1];
          let content = match[2] || '';
          
          // Ограничиваем длину контента
          if (content.length > FALLBACK_PARSING_CONFIG.MAX_CONTENT_LENGTH) {
            logger.warn('Content too long in backtick pattern, truncating:', { filePath, contentLength: content.length });
            content = content.substring(0, FALLBACK_PARSING_CONFIG.MAX_CONTENT_LENGTH);
          }
          
          const toolCall: AIToolCall = {
            id: generateIds.toolCall(),
            type: 'function',
            function: {
              name: 'create_file',
              arguments: JSON.stringify({
                file_path: filePath,
                content: content
              })
            }
          };
          
          if (validateToolCall(toolCall)) {
            toolCalls.push(toolCall);
          } else {
            logger.warn('Invalid create_file call parsed from text (backtick), skipping:', { filePath });
          }
          
          logger.info('Parsed create_file call from text (backtick):', { 
            filePath, 
            contentLength: content.length 
          });
        } catch (e) {
          logger.warn('Failed to parse create_file call from text (backtick):', e);
        }
      }
    }
  } catch (error) {
    logger.error('Error extracting tool calls:', error);
  }

  return toolCalls;
}
