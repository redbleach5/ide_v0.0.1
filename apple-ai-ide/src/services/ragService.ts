import { logger } from '../utils/logger';
import { fileService } from './fileService';
import { codebaseIndexService, CodeSymbol, FileIndex } from './codebaseIndexService';

/**
 * Code chunk - семантический фрагмент кода
 */
export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  language: string;
  type: 'function' | 'class' | 'interface' | 'method' | 'block' | 'file';
  symbol?: CodeSymbol;
  startLine: number;
  endLine: number;
  metadata: {
    dependencies?: string[];
    imports?: string[];
    exports?: string[];
    comments?: string;
  };
}

/**
 * Embedding vector для code chunk
 */
export interface ChunkEmbedding {
  chunkId: string;
  embedding: number[];
  metadata: CodeChunk;
}

/**
 * Результат поиска
 */
export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  relevance: 'high' | 'medium' | 'low';
}

/**
 * RAG Service - ядро системы для семантического поиска кода
 */
export class RAGService {
  private embeddings: Map<string, ChunkEmbedding> = new Map();
  private chunks: Map<string, CodeChunk> = new Map();
  private projectPath: string | null = null;
  private searchCache: Map<string, { results: SearchResult[]; timestamp: number }> = new Map();
  
  // Константы для конфигурации
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 минут кэш
  private readonly EMBEDDING_BATCH_SIZE = 50; // Обрабатываем по 50 чанков за раз
  private readonly FILE_PREVIEW_LENGTH = 2000; // Первые 2000 символов файла для preview
  private readonly BLOCK_CONTENT_LENGTH = 500; // Максимальная длина блока кода
  private readonly FULL_CONTENT_LENGTH = 1000; // Максимальная длина полного контента
  private readonly EMBEDDING_VECTOR_SIZE = 256; // Размер вектора эмбеддинга
  private readonly EMBEDDING_TEXT_LIMIT = 1500; // Лимит текста для эмбеддинга
  private readonly CONTEXT_CONTENT_LIMIT = 2500; // Лимит контента для контекста
  private readonly MAX_CACHE_ENTRIES = 100; // Максимальное количество записей в кэше
  private readonly MAX_LOOKBACK_LINES = 10; // Максимальное количество строк для поиска комментариев
  private readonly MIN_BLOCK_GAP = 5; // Минимальный промежуток между символами для создания блока
  private readonly MIN_BLOCK_LENGTH = 50; // Минимальная длина блока для включения
  private readonly MAX_FUNCTION_LINES = 200; // Максимальное количество строк для поиска конца функции
  private readonly MAX_CLASS_LINES = 500; // Максимальное количество строк для поиска конца класса
  private readonly DEFAULT_END_LINE_OFFSET = 20; // Смещение по умолчанию для конца символа
  private readonly TOP_CHUNKS_PER_FILE = 3; // Топ 3 чанка из файла для контекста
  
  // Простая функция для генерации эмбеддингов (можно заменить на реальную модель)
  private embeddingModel: 'simple' | 'sentence-transformers' = 'simple';

  /**
   * Индексирует проект с использованием RAG
   */
  async indexProject(projectPath: string, force: boolean = false): Promise<void> {
    if (this.projectPath === projectPath && !force && this.chunks.size > 0) {
      logger.debug('Project already indexed, using cache');
      return;
    }

    this.projectPath = projectPath;
    const startTime = Date.now();
    logger.info('RAG: Starting project indexing', { projectPath });

    try {
      // Сначала получаем базовый индекс
      const baseIndex = await codebaseIndexService.indexProject(projectPath, force);
      
      // Чанкуем файлы
      const chunks: CodeChunk[] = [];
      const filesArray = Array.from(baseIndex.files.entries());
      const totalFiles = filesArray.length;
      
      for (let i = 0; i < filesArray.length; i++) {
        const [filePath, fileIndex] = filesArray[i];
        try {
          const fileChunks = await this.chunkFile(filePath, fileIndex, projectPath);
          chunks.push(...fileChunks);
          
          // Логируем прогресс каждые 10 файлов
          if ((i + 1) % 10 === 0 || i + 1 === totalFiles) {
            logger.debug('RAG: Chunking progress', {
              filesProcessed: i + 1,
              totalFiles,
              chunksGenerated: chunks.length
            });
          }
        } catch (error) {
          logger.debug('Error chunking file:', filePath, error);
        }
      }

      // Генерируем эмбеддинги (батчинг для производительности)
      logger.info('RAG: Generating embeddings', { chunksCount: chunks.length });
      const embeddings: ChunkEmbedding[] = [];
      
      for (let i = 0; i < chunks.length; i += this.EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(i, i + this.EMBEDDING_BATCH_SIZE);
        
        // Генерируем эмбеддинги для батча
        const batchEmbeddings = await Promise.all(
          batch.map(async (chunk) => {
            try {
              const embedding = await this.generateEmbedding(chunk);
              this.chunks.set(chunk.id, chunk);
              this.embeddings.set(chunk.id, embedding);
              return embedding;
            } catch (error) {
              logger.debug('Error generating embedding for chunk:', chunk.id, error);
              return null;
            }
          })
        );
        
        embeddings.push(...batchEmbeddings.filter((e): e is ChunkEmbedding => e !== null));
        
        // Логируем прогресс
        if (i % (this.EMBEDDING_BATCH_SIZE * 5) === 0 || i + this.EMBEDDING_BATCH_SIZE >= chunks.length) {
          logger.debug('RAG: Embedding progress', {
            processed: Math.min(i + this.EMBEDDING_BATCH_SIZE, chunks.length),
            total: chunks.length,
            percentage: ((Math.min(i + this.EMBEDDING_BATCH_SIZE, chunks.length) / chunks.length) * 100).toFixed(1)
          });
        }
      }

      const indexingTime = Date.now() - startTime;
      logger.info('RAG: Indexing completed', {
        projectPath,
        chunks: chunks.length,
        embeddings: embeddings.length,
        filesIndexed: baseIndex.files.size,
        avgChunksPerFile: baseIndex.files.size > 0 ? (chunks.length / baseIndex.files.size).toFixed(2) : '0',
        indexingTimeMs: indexingTime,
        indexingTimeSec: (indexingTime / 1000).toFixed(2)
      });
    } catch (error) {
      logger.error('RAG: Error indexing project', error);
      throw error;
    }
  }

  /**
   * Разбивает файл на семантические чанки
   */
  private async chunkFile(
    filePath: string,
    fileIndex: FileIndex,
    projectPath: string
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    
    try {
      const content = await fileService.readFile(filePath, false);
      const lines = content.split('\n');
      const language = this.getLanguageFromPath(filePath);

      // Чанк 1: Весь файл (для общего контекста)
      chunks.push({
        id: `${filePath}_file`,
        filePath,
        content: content.substring(0, this.FILE_PREVIEW_LENGTH),
        language,
        type: 'file',
        startLine: 1,
        endLine: Math.min(50, lines.length),
        metadata: {
          dependencies: fileIndex.dependencies || [],
          imports: fileIndex.imports || [],
          exports: fileIndex.exports || [],
          comments: undefined
        }
      });

      // Чанк 2: По символам (функции, классы, интерфейсы)
      for (const symbol of fileIndex.symbols || []) {
        const symbolChunk = this.extractSymbolChunk(
          content,
          lines,
          symbol,
          filePath,
          language,
          fileIndex
        );
        if (symbolChunk) {
          chunks.push(symbolChunk);
        }
      }

      // Чанк 3: Блоки кода между символами (для контекста)
      const blockChunks = this.extractBlockChunks(
        content,
        lines,
        fileIndex.symbols || [],
        filePath,
        language
      );
      chunks.push(...blockChunks);

      return chunks;
    } catch (error) {
      logger.debug('Error chunking file:', filePath, error);
      return [];
    }
  }

  /**
   * Извлекает чанк для символа (функция, класс и т.д.)
   */
  private extractSymbolChunk(
    content: string,
    lines: string[],
    symbol: CodeSymbol,
    filePath: string,
    language: string,
    fileIndex: FileIndex
  ): CodeChunk | null {
    try {
      const startLine = symbol.lineNumber - 1; // 0-indexed
      let endLine = startLine;

      // Находим конец символа (улучшенная эвристика с учетом вложенности)
      if (symbol.type === 'function') {
        // Ищем закрывающую скобку с учетом вложенности и строк
        let braceCount = 0;
        let parenCount = 0;
        let foundStart = false;
        let inString = false;
        let stringChar = '';
        
        for (let i = startLine; i < Math.min(startLine + this.MAX_FUNCTION_LINES, lines.length); i++) {
          const line = lines[i];
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            // Обработка строк (игнорируем скобки внутри строк)
            if ((char === '"' || char === "'" || char === '`') && (j === 0 || line[j-1] !== '\\')) {
              if (!inString) {
                inString = true;
                stringChar = char;
              } else if (char === stringChar) {
                inString = false;
                stringChar = '';
              }
            } else if (!inString) {
              // Обработка скобок
              if (char === '(') parenCount++;
              else if (char === ')') parenCount--;
              else if (char === '{') {
                braceCount++;
                foundStart = true;
              } else if (char === '}') {
                braceCount--;
                if (foundStart && braceCount === 0 && parenCount === 0) {
                  endLine = i;
                  break;
                }
              }
            }
          }
          
          if (foundStart && braceCount === 0 && parenCount === 0) break;
        }
      } else if (symbol.type === 'class' || symbol.type === 'interface') {
        // Для классов и интерфейсов ищем закрывающую скобку с учетом вложенности
        let braceCount = 0;
        let foundStart = false;
        let inString = false;
        let stringChar = '';
        
        for (let i = startLine; i < Math.min(startLine + this.MAX_CLASS_LINES, lines.length); i++) {
          const line = lines[i];
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            // Обработка строк
            if ((char === '"' || char === "'" || char === '`') && (j === 0 || line[j-1] !== '\\')) {
              if (!inString) {
                inString = true;
                stringChar = char;
              } else if (char === stringChar) {
                inString = false;
                stringChar = '';
              }
            } else if (!inString) {
              if (char === '{') {
                braceCount++;
                foundStart = true;
              } else if (char === '}') {
                braceCount--;
                if (foundStart && braceCount === 0) {
                  endLine = i;
                  break;
                }
              }
            }
          }
          
          if (foundStart && braceCount === 0) break;
        }
      }

      if (endLine === startLine) {
        endLine = Math.min(startLine + this.DEFAULT_END_LINE_OFFSET, lines.length - 1);
      }

      const chunkContent = lines.slice(startLine, endLine + 1).join('\n');
      
      // Извлекаем комментарии перед символом
      const comments = this.extractComments(lines, startLine, language);

      return {
        id: `${filePath}_${symbol.name}_${symbol.lineNumber}`,
        filePath,
        content: chunkContent,
        language,
        type: symbol.type === 'function' ? 'function' :
              symbol.type === 'class' ? 'class' :
              symbol.type === 'interface' ? 'interface' : 'block',
        symbol,
        startLine: startLine + 1,
        endLine: endLine + 1,
        metadata: {
          comments: comments.length > 0 ? comments.join('\n') : undefined,
          imports: fileIndex.imports || [],
          dependencies: fileIndex.dependencies || []
        }
      };
    } catch (error) {
      logger.debug('Error extracting symbol chunk:', symbol.name, error);
      return null;
    }
  }

  /**
   * Извлекает блоки кода между символами
   */
  private extractBlockChunks(
    content: string,
    lines: string[],
    symbols: CodeSymbol[],
    filePath: string,
    language: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    if (symbols.length === 0) {
      // Если нет символов, создаем один большой чанк
      chunks.push({
        id: `${filePath}_block_0`,
        filePath,
        content: content.substring(0, this.FULL_CONTENT_LENGTH),
        language,
        type: 'block',
        startLine: 1,
        endLine: Math.min(50, lines.length),
        metadata: {
          imports: [],
          dependencies: [],
          comments: undefined
        }
      });
      return chunks;
    }

    // Создаем чанки между символами
    let lastEnd = 0;
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const symbolStart = symbol.lineNumber - 1;
      
      if (symbolStart > lastEnd + this.MIN_BLOCK_GAP) {
        // Есть промежуток между символами
        const blockContent = lines.slice(lastEnd, symbolStart).join('\n');
        if (blockContent.trim().length > this.MIN_BLOCK_LENGTH) {
          chunks.push({
            id: `${filePath}_block_${i}`,
            filePath,
            content: blockContent.substring(0, this.BLOCK_CONTENT_LENGTH),
            language,
            type: 'block',
            startLine: lastEnd + 1,
            endLine: symbolStart,
            metadata: {
              imports: [],
              dependencies: [],
              comments: undefined
            }
          });
        }
      }
      
      lastEnd = symbolStart;
    }

    return chunks;
  }

  /**
   * Извлекает комментарии перед символом
   */
  private extractComments(
    lines: string[],
    symbolLine: number,
    language: string
  ): string[] {
    const comments: string[] = [];
    
    for (let i = symbolLine - 1; i >= Math.max(0, symbolLine - this.MAX_LOOKBACK_LINES); i--) {
      const line = lines[i].trim();
      
      if (language === 'typescript' || language === 'javascript') {
        if (line.startsWith('//') || line.startsWith('*')) {
          comments.unshift(line.replace(/^\/\/\s*|\/\*\s*|\s*\*\/|\s*\*\s*/g, ''));
        } else if (line.startsWith('/**')) {
          comments.unshift(line.replace(/^\/\*\*\s*|\s*\*\/$/g, ''));
        } else if (line.length > 0 && !line.match(/^[{}[\];,()]*$/)) {
          break; // Прерываем на не-пустой строке, не являющейся комментарием
        }
      } else if (language === 'python') {
        if (line.startsWith('#')) {
          comments.unshift(line.replace(/^#\s*/, ''));
        } else if (line.length > 0) {
          break;
        }
      }
    }
    
    return comments;
  }

  /**
   * Генерирует эмбеддинг для чанка
   * TODO: Заменить на реальную модель (sentence-transformers или OpenAI)
   */
  private async generateEmbedding(chunk: CodeChunk): Promise<ChunkEmbedding> {
    // Простая реализация: TF-IDF-like вектор
    // В продакшене использовать sentence-transformers или OpenAI embeddings
    
    const text = this.prepareTextForEmbedding(chunk);
    const embedding = this.simpleEmbedding(text);
    
    return {
      chunkId: chunk.id,
      embedding,
      metadata: chunk
    };
  }

  /**
   * Подготавливает текст для эмбеддинга с улучшенной структурой
   */
  private prepareTextForEmbedding(chunk: CodeChunk): string {
    const parts: string[] = [];
    
    // 1. Тип и имя символа (высокий приоритет)
    if (chunk.symbol) {
      parts.push(`[${chunk.symbol.type}] ${chunk.symbol.name}`);
      
      // Добавляем сигнатуру, если есть
      if (chunk.symbol.signature) {
        parts.push(chunk.symbol.signature);
      }
    }
    
    // 2. Комментарии (очень важны для понимания)
    if (chunk.metadata.comments) {
      parts.push(`/* ${chunk.metadata.comments} */`);
    }
    
    // 3. Импорты и зависимости (контекст)
    if (chunk.metadata.imports && chunk.metadata.imports.length > 0) {
      parts.push(`imports: ${chunk.metadata.imports.join(', ')}`);
    }
    
    // 4. Код (сохраняем структуру, но нормализуем)
    const cleanCode = this.normalizeCode(chunk.content);
    parts.push(cleanCode);
    
    return parts.join(' ').substring(0, this.EMBEDDING_TEXT_LIMIT);
  }

  /**
   * Нормализует код, сохраняя важную структуру
   */
  private normalizeCode(code: string): string {
    return code
      // Сохраняем комментарии (они важны!)
      // .replace(/\/\/.*$/gm, '') // НЕ удаляем комментарии
      // .replace(/\/\*[\s\S]*?\*\//g, '') // НЕ удаляем комментарии
      // Нормализуем пробелы, но сохраняем структуру
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}();,=])\s*/g, ' $1 ') // Нормализуем операторы
      .trim();
  }

  /**
   * Улучшенная функция эмбеддинга с пониманием семантики кода
   * Использует TF-IDF-like подход с учетом контекста кода
   */
  private simpleEmbedding(text: string): number[] {
    // Разбиваем на токены (слова + ключевые слова кода)
    const tokens = this.tokenizeCode(text);
    
    // Создаем вектор большего размера для лучшей семантики
    const vector = new Array(this.EMBEDDING_VECTOR_SIZE).fill(0);
    
    // Веса для разных типов токенов
    const weights = {
      keyword: 2.0,      // Ключевые слова (function, class, etc.)
      identifier: 1.5,   // Идентификаторы (имена функций, переменных)
      comment: 1.8,      // Комментарии (важны для понимания)
      code: 1.0,        // Обычный код
      type: 1.7         // Типы (string, number, etc.)
    };
    
    // Ключевые слова программирования
    const codeKeywords = new Set([
      'function', 'class', 'interface', 'type', 'const', 'let', 'var',
      'async', 'await', 'return', 'if', 'else', 'for', 'while', 'switch',
      'import', 'export', 'from', 'default', 'extends', 'implements',
      'public', 'private', 'protected', 'static', 'abstract', 'readonly',
      'string', 'number', 'boolean', 'object', 'array', 'void', 'any',
      'null', 'undefined', 'true', 'false', 'this', 'super'
    ]);
    
    // Типы данных
    const typeKeywords = new Set([
      'string', 'number', 'boolean', 'object', 'array', 'void', 'any',
      'null', 'undefined', 'Promise', 'Array', 'Map', 'Set'
    ]);
    
    // Обрабатываем каждый токен
    for (const token of tokens) {
      const lowerToken = token.toLowerCase();
      let weight = weights.code;
      
      // Определяем тип токена
      if (codeKeywords.has(lowerToken)) {
        weight = weights.keyword;
      } else if (typeKeywords.has(lowerToken)) {
        weight = weights.type;
      } else if (token.length > 2 && /^[a-z][a-zA-Z0-9]*$/i.test(token)) {
        // Идентификатор (camelCase или PascalCase)
        weight = weights.identifier;
      }
      
      // Хешируем токен в позицию вектора
      const hash = this.simpleHash(token);
      const position = hash % this.EMBEDDING_VECTOR_SIZE;
      
      // Добавляем взвешенное значение
      vector[position] += weight / tokens.length;
      
      // Также добавляем в соседние позиции для лучшей семантики
      if (position > 0) {
        vector[position - 1] += (weight * 0.3) / tokens.length;
      }
      if (position < this.EMBEDDING_VECTOR_SIZE - 1) {
        vector[position + 1] += (weight * 0.3) / tokens.length;
      }
    }
    
    // Нормализуем вектор
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return vector.map(v => v / magnitude);
    }
    
    return vector;
  }

  /**
   * Токенизирует код, извлекая значимые элементы
   */
  private tokenizeCode(text: string): string[] {
    const tokens: string[] = [];
    
    // Разбиваем на слова и символы
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Заменяем спецсимволы на пробелы
      .split(/\s+/)
      .filter(w => w.length > 0);
    
    // Добавляем слова
    tokens.push(...words);
    
    // Извлекаем camelCase и PascalCase идентификаторы
    const identifiers = text.match(/[a-z][a-zA-Z0-9]*|[A-Z][a-z][a-zA-Z0-9]*/g) || [];
    for (const id of identifiers) {
      // Разбиваем camelCase на отдельные слова
      const parts = id.replace(/([A-Z])/g, ' $1').trim().split(/\s+/);
      tokens.push(...parts.map(p => p.toLowerCase()));
    }
    
    // Извлекаем ключевые слова из комментариев
    const commentMatches = text.match(/\/\/.*|\/\*[\s\S]*?\*\//g) || [];
    for (const comment of commentMatches) {
      const commentWords = comment
        .replace(/\/\/|\/\*|\*\//g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);
      tokens.push(...commentWords);
    }
    
    return tokens.filter(t => t.length > 1);
  }

  /**
   * Простая хеш-функция
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Семантический поиск по кодовой базе с улучшенным ранжированием
   */
  async search(
    query: string,
    options: {
      limit?: number;
      fileTypes?: string[];
      minScore?: number;
      boostTypes?: string[]; // Типы чанков для повышения приоритета
      useCache?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const limit = options.limit || 10;
    const minScore = options.minScore || 0.1;
    const useCache = options.useCache !== false; // По умолчанию используем кэш
    const searchStartTime = Date.now();

    // Проверяем кэш
    if (useCache) {
      const cacheKey = `${query}_${limit}_${minScore}_${options.fileTypes?.join(',') || ''}`;
      const cached = this.searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.debug('RAG: Using cached search results', { query: query.substring(0, 50) });
        return cached.results;
      }
    }

    logger.debug('RAG: Semantic search', { query, limit });

    // Генерируем эмбеддинг для запроса
    const queryEmbedding = this.simpleEmbedding(query.toLowerCase());
    
    // Дополнительно: извлекаем ключевые слова из запроса
    const queryKeywords = this.extractKeywords(query);
    
    // Ищем похожие чанки
    const results: SearchResult[] = [];
    
    for (const [chunkId, chunkEmbedding] of Array.from(this.embeddings.entries())) {
      // Фильтр по типу файла
      if (options.fileTypes && options.fileTypes.length > 0) {
        const fileExt = chunkEmbedding.metadata.filePath.split('.').pop()?.toLowerCase();
        if (!fileExt || !options.fileTypes.includes(fileExt)) {
          continue;
        }
      }
      
      // Вычисляем косинусное сходство
      let score = this.cosineSimilarity(queryEmbedding, chunkEmbedding.embedding);
      
      // Буст для определенных типов чанков
      if (options.boostTypes && options.boostTypes.includes(chunkEmbedding.metadata.type)) {
        score *= 1.2;
      }
      
      // Буст если имя символа содержит ключевые слова
      if (chunkEmbedding.metadata.symbol) {
        const symbolName = chunkEmbedding.metadata.symbol.name.toLowerCase();
        for (const keyword of queryKeywords) {
          if (symbolName.includes(keyword)) {
            score *= 1.3; // Значительный буст
            break;
          }
        }
      }
      
      // Буст если комментарии содержат ключевые слова
      if (chunkEmbedding.metadata.metadata.comments) {
        const comments = chunkEmbedding.metadata.metadata.comments.toLowerCase();
        for (const keyword of queryKeywords) {
          if (comments.includes(keyword)) {
            score *= 1.15;
            break;
          }
        }
      }
      
      if (score >= minScore) {
        results.push({
          chunk: chunkEmbedding.metadata,
          score: Math.min(score, 1.0), // Ограничиваем максимум 1.0
          relevance: score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low'
        });
      }
    }
    
    // Сортируем по релевантности
    results.sort((a, b) => b.score - a.score);
    
    const searchTime = Date.now() - searchStartTime;
    const finalResults = results.slice(0, limit);
    
    logger.debug('RAG: Search completed', {
      query: query.substring(0, 50),
      resultsCount: finalResults.length,
      searchTimeMs: searchTime
    });
    
    // Сохраняем в кэш
    if (useCache) {
      const cacheKey = `${query}_${limit}_${minScore}_${options.fileTypes?.join(',') || ''}`;
      this.searchCache.set(cacheKey, {
        results: finalResults,
        timestamp: Date.now()
      });
      
      // Очищаем старый кэш (оставляем только последние N запросов)
      if (this.searchCache.size > this.MAX_CACHE_ENTRIES) {
        const entries = Array.from(this.searchCache.entries());
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        this.searchCache.clear();
        entries.slice(0, this.MAX_CACHE_ENTRIES).forEach(([key, value]) => {
          this.searchCache.set(key, value);
        });
      }
    }
    
    return finalResults;
  }

  /**
   * Извлекает ключевые слова из запроса
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'как', 'что', 'где', 'когда', 'почему', 'какой', 'какая', 'какое',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'can', 'could', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those'
    ]);
    
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  /**
   * Вычисляет косинусное сходство между векторами
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Получает релевантный контекст для AI запроса с улучшенной логикой
   */
  async getRelevantContext(
    query: string,
    projectPath: string,
    limit: number = 5
  ): Promise<Array<{ path: string; content: string; score: number }>> {
    // ВАЖНО: Если проект изменился, очищаем старый индекс
    if (this.projectPath && this.projectPath !== projectPath) {
      logger.warn('RAG: Project path changed, clearing old index', {
        oldProject: this.projectPath,
        newProject: projectPath
      });
      this.clearCache(this.projectPath);
    }
    
    // Если проект не проиндексирован, индексируем
    if (this.projectPath !== projectPath || this.chunks.size === 0) {
      logger.info('RAG: Project not indexed, indexing now...', { projectPath });
      await this.indexProject(projectPath);
    }
    
    // Определяем тип запроса для лучшего поиска
    const isCodeGenRequest = query.match(/\b(создай|напиши|реализуй|сделай|create|write|implement|make|build)\b/i);
    const boostTypes = isCodeGenRequest ? ['function', 'class'] : ['function', 'class', 'interface'];
    
    // Ищем релевантные чанки с бустом для определенных типов
    const searchResults = await this.search(query, { 
      limit: limit * 2, // Берем больше, чтобы выбрать лучшие файлы
      boostTypes 
    });
    
    // Группируем по файлам и выбираем лучшие чанки из каждого
    const fileChunks = new Map<string, SearchResult[]>();
    for (const result of searchResults) {
      const filePath = result.chunk.filePath;
      if (!fileChunks.has(filePath)) {
        fileChunks.set(filePath, []);
      }
      fileChunks.get(filePath)!.push(result);
    }
    
    // Сортируем файлы по максимальному score
    const sortedFiles = Array.from(fileChunks.entries())
      .map(([filePath, chunks]) => ({
        filePath,
        maxScore: Math.max(...chunks.map(c => c.score)),
        chunks
      }))
      .sort((a, b) => b.maxScore - a.maxScore)
      .slice(0, limit);
    
    // Загружаем полное содержимое файлов
    const context: Array<{ path: string; content: string; score: number }> = [];
    
    for (const fileInfo of sortedFiles) {
      try {
        const fullContent = await fileService.readFile(fileInfo.filePath, false);
        
        // Если есть несколько релевантных чанков, выделяем их
        let content = fullContent;
        if (fileInfo.chunks.length > 1) {
          // Собираем релевантные части
          const relevantParts = fileInfo.chunks
            .sort((a, b) => b.score - a.score)
            .slice(0, this.TOP_CHUNKS_PER_FILE)
            .map(chunk => {
              const lines = fullContent.split('\n');
              const start = Math.max(0, chunk.chunk.startLine - 5);
              const end = Math.min(lines.length, chunk.chunk.endLine + 5);
              return lines.slice(start, end).join('\n');
            });
          
          // Объединяем релевантные части
          content = relevantParts.join('\n\n// ...\n\n');
        }
        
        context.push({
          path: fileInfo.filePath,
          content: content.substring(0, this.CONTEXT_CONTENT_LIMIT),
          score: fileInfo.maxScore
        });
      } catch (error) {
        logger.debug('Error reading file for context:', fileInfo.filePath, error);
      }
    }
    
    logger.debug('RAG: Context retrieved', { 
      filesCount: context.length,
      avgScore: context.length > 0 ? (context.reduce((sum, c) => sum + c.score, 0) / context.length).toFixed(3) : '0',
      topScore: context.length > 0 ? context[0].score.toFixed(3) : '0'
    });
    
    return context;
  }

  /**
   * Обновляет индекс для одного файла
   */
  async updateFileIndex(projectPath: string, filePath: string): Promise<void> {
    // Обновляем базовый индекс
    await codebaseIndexService.updateFileIndex(projectPath, filePath);
    
    // Удаляем старые чанки этого файла
    for (const [chunkId, chunk] of Array.from(this.chunks.entries())) {
      if (chunk.filePath === filePath) {
        this.chunks.delete(chunkId);
        this.embeddings.delete(chunkId);
      }
    }
    
    // Переиндексируем файл
    const baseIndex = codebaseIndexService.getIndex(projectPath);
    if (baseIndex) {
      const fileIndex = baseIndex.files.get(filePath);
      if (fileIndex) {
        const newChunks = await this.chunkFile(filePath, fileIndex, projectPath);
        
        for (const chunk of newChunks) {
          const embedding = await this.generateEmbedding(chunk);
          this.chunks.set(chunk.id, chunk);
          this.embeddings.set(chunk.id, embedding);
        }
      }
    }
  }

  /**
   * Очищает кэш
   */
  clearCache(projectPath?: string): void {
    if (projectPath && this.projectPath === projectPath) {
      this.chunks.clear();
      this.embeddings.clear();
      this.searchCache.clear();
      this.projectPath = null;
    } else if (!projectPath) {
      this.chunks.clear();
      this.embeddings.clear();
      this.searchCache.clear();
      this.projectPath = null;
    }
    logger.debug('RAG: Cache cleared', { projectPath });
  }

  /**
   * Получает статистику RAG индекса
   */
  getStats(): {
    chunksCount: number;
    embeddingsCount: number;
    cacheSize: number;
    projectPath: string | null;
  } {
    return {
      chunksCount: this.chunks.size,
      embeddingsCount: this.embeddings.size,
      cacheSize: this.searchCache.size,
      projectPath: this.projectPath
    };
  }

  /**
   * Получает язык из пути файла
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
}

export const ragService = new RAGService();
