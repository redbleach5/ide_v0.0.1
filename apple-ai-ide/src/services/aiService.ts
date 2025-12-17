import { AIMessage, AICodeSuggestion } from '../types';
import { logger } from '../utils/logger';
import { codebaseIndexService } from './codebaseIndexService';
import { ragService } from './ragService';
import { 
  AI_TOOLS, 
  formatToolsForAPI, 
  extractToolCallsFromResponse,
  AIToolCall 
} from './aiFunctionCalling';
import { isCodeGenerationRequest } from '../utils/codeParser';
import { generateIds } from '../utils/idGenerator';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
}

interface ChatCompletionRequestBody {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  tools?: unknown;
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

export class AIService {
  private ollamaEndpoint: string = 'http://localhost:11434';
  private lmStudioEndpoint: string = 'http://localhost:1234';
  private currentModel: string = '';
  private defaultTimeout: number = 30000; // 30 seconds
  private defaultMaxRetries: number = 3;
  private defaultRetryDelay: number = 1000; // 1 second
  
  // Константы для конфигурации
  private readonly EXPONENTIAL_BACKOFF_BASE = 2; // База для exponential backoff
  private readonly MAX_FILE_CONTENT_PREVIEW = 1000; // Максимальная длина превью файла
  private readonly MAX_CONTEXT_FILES = 5; // Максимальное количество файлов в контексте
  private readonly MAX_SYMBOLS_TO_SHOW = 10; // Максимальное количество символов для показа
  private readonly MAX_RAG_CONTENT_PREVIEW = 800; // Максимальная длина превью RAG контента
  private readonly MAX_CHAT_CONTEXT_FILES = 5; // Максимальное количество файлов для чата
  private readonly MAX_MESSAGE_PREVIEW = 50; // Максимальная длина превью сообщения
  private readonly MAX_RESPONSE_PREVIEW = 200; // Максимальная длина превью ответа

  setOllamaEndpoint(endpoint: string) {
    this.ollamaEndpoint = endpoint;
  }

  setLMStudioEndpoint(endpoint: string) {
    this.lmStudioEndpoint = endpoint;
  }

  setCurrentModel(model: string) {
    this.currentModel = model;
  }

  async getAvailableModels(provider: 'ollama' | 'lmstudio'): Promise<string[]> {
    try {
      let endpoint: string;
      let modelsPath: string;

      if (provider === 'ollama') {
        endpoint = this.ollamaEndpoint;
        modelsPath = '/api/tags';
      } else {
        endpoint = this.lmStudioEndpoint;
        modelsPath = '/v1/models';
      }

      logger.debug('Fetching available models:', { provider, endpoint });

      const response = await this.withRetry(
        () => this.fetchWithTimeout(
          `${endpoint}${modelsPath}`,
          { method: 'GET' },
          this.defaultTimeout
        )
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const models = provider === 'ollama'
        ? data.models?.map((model: any) => model.name) || []
        : data.data?.map((model: any) => model.id) || [];
      
      logger.debug('Models fetched successfully:', { provider, count: models.length });
      return models;
    } catch (error) {
      logger.error(`Error fetching ${provider} models:`, error);
      return [];
    }
  }

  async testConnection(provider: 'ollama' | 'lmstudio'): Promise<{ success: boolean; error?: string; hint?: string }> {
    try {
      const endpoint = provider === 'ollama' ? this.ollamaEndpoint : this.lmStudioEndpoint;
      const testPath = provider === 'ollama' ? '/api/tags' : '/v1/models';
      
      logger.debug('Testing connection:', { provider, endpoint });
      
      const response = await this.fetchWithTimeout(
        `${endpoint}${testPath}`,
        { method: 'GET' },
        5000
      );
      
      if (response.ok) {
        logger.debug('Connection test result: success', { provider });
        return { success: true };
      } else {
        const error = `HTTP ${response.status}: ${response.statusText}`;
        const hint = provider === 'ollama' 
          ? 'Убедитесь, что Ollama запущен. Запустите Ollama или установите его с https://ollama.com'
          : 'Убедитесь, что LM Studio запущен и локальный сервер активен';
        logger.warn('Connection test failed:', { provider, error });
        return { success: false, error, hint };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      const hint = provider === 'ollama'
        ? 'Ollama не запущен или недоступен. Установите Ollama с https://ollama.com и запустите его.'
        : 'LM Studio не запущен или локальный сервер не активен. Запустите LM Studio и включите локальный сервер.';
      
      logger.warn('Connection test failed:', { provider, error: errorMessage });
      return { success: false, error: errorMessage, hint };
    }
  }

  async generateCode(
    prompt: string, 
    context?: { 
      files?: Array<{ path: string; content?: string }> | string[], 
      projectPath?: string 
    },
    provider: 'ollama' | 'lmstudio' = 'ollama',
    abortSignal?: AbortSignal
  ): Promise<AICodeSuggestion> {
    try {
      // Build context from files
      let fileContext = '';
      if (context?.files && context.files.length > 0) {
        const files = context.files;
        const fileContents: Array<{ path: string; content: string }> = [];
        
        // Handle both string[] and {path, content}[]
        for (const file of files) {
          if (typeof file === 'string') {
            // Just a path, no content available
            fileContents.push({ path: file, content: '' });
          } else {
            // Object with path and optional content
            fileContents.push({ 
              path: file.path, 
              content: file.content || '' 
            });
          }
        }
        
        // Build context string with file contents
        const relevantFiles = fileContents
          .filter(f => f.content) // Only include files with content
          .slice(0, this.MAX_SYMBOLS_TO_SHOW); // Limit to avoid token overflow
        
        if (relevantFiles.length > 0) {
          fileContext = '\n\n## Project Context:\n\n' + 
            relevantFiles.map(file => 
              `### File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`
            ).join('\n');
        }
      }

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: this.getSystemPrompt('code_generation', context) + fileContext
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const response = await this.chatCompletion(messages, provider, {
        timeout: 60000, // 60 seconds for code generation
        maxRetries: 2
      }, abortSignal);
      
      return {
        type: 'generation',
        content: response.content,
        description: 'AI generated code',
        confidence: 0.8
      };
    } catch (error) {
      logger.error('Error generating code:', error);
      throw error;
    }
  }

  async analyzeProject(
    files: Array<{ path: string, content: string }>,
    provider: 'ollama' | 'lmstudio' = 'ollama',
    abortSignal?: AbortSignal
  ): Promise<string> {
    try {
      const fileContext = files.map(file => 
        `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``
      ).join('\n\n');

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert software architect and code reviewer. Analyze the provided project files and give a comprehensive analysis of the codebase, including architecture, patterns, potential issues, and improvement suggestions.'
        },
        {
          role: 'user',
          content: `Please analyze this project:\n\n${fileContext}`
        }
      ];

      const response = await this.chatCompletion(messages, provider, {
        timeout: 90000, // 90 seconds for project analysis
        maxRetries: 2
      }, abortSignal);
      return response.content;
    } catch (error) {
      logger.error('Error analyzing project:', error);
      throw error;
    }
  }

  async refactorCode(
    code: string,
    instruction: string,
    provider: 'ollama' | 'lmstudio' = 'ollama'
  ): Promise<AICodeSuggestion> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert code refactoring specialist. Improve the provided code according to the given instructions while maintaining functionality. Return only the refactored code without explanations.'
        },
        {
          role: 'user',
          content: `Refactor this code: ${instruction}\n\nCode:\n\`\`\`\n${code}\n\`\`\``
        }
      ];

      const response = await this.chatCompletion(messages, provider, {
        timeout: 60000,
        maxRetries: 2
      });
      
      return {
        type: 'refactor',
        content: response.content,
        description: 'Refactored code',
        confidence: 0.85
      };
    } catch (error) {
      logger.error('Error refactoring code:', error);
      throw error;
    }
  }

  async explainCode(
    code: string,
    language: string,
    provider: 'ollama' | 'lmstudio' = 'ollama'
  ): Promise<string> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are an expert programming instructor. Explain the provided ${language} code in a clear, concise manner. Focus on what the code does, how it works, and any important patterns or concepts used.`
        },
        {
          role: 'user',
          content: `Explain this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``
        }
      ];

      const response = await this.chatCompletion(messages, provider, {
        timeout: 45000,
        maxRetries: 2
      });
      return response.content;
    } catch (error) {
      logger.error('Error explaining code:', error);
      throw error;
    }
  }

  async completeCode(
    currentCode: string,
    cursorPosition: number,
    provider: 'ollama' | 'lmstudio' = 'ollama'
  ): Promise<AICodeSuggestion[]> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert code completion AI. Provide intelligent code completions based on the current context. Return only the completion code without explanations. Provide multiple options if applicable.'
        },
        {
          role: 'user',
          content: `Complete this code:\n\`\`\`\n${currentCode}\n\`\`\`\n\nProvide completions for the code at the end.`
        }
      ];

      const response = await this.chatCompletion(messages, provider, {
        timeout: 30000,
        maxRetries: 2
      });
      const completions = response.content.split('\n')
        .filter(line => line.trim())
        .map((completion, index) => ({
          type: 'completion' as const,
          content: completion.trim(),
          description: `Completion ${index + 1}`,
          confidence: 0.7
        }));

      return completions;
    } catch (error) {
      logger.error('Error completing code:', error);
      return [];
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch with timeout and optional abort signal
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number,
    abortSignal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine abort signals if provided
    let abortHandler: (() => void) | null = null;
    if (abortSignal) {
      // Check if signal is already aborted
      if (abortSignal.aborted) {
        clearTimeout(timeoutId);
        controller.abort();
        throw new Error('Request was cancelled by user');
      }
      
      // Listen for abort event
      abortHandler = () => {
        clearTimeout(timeoutId);
        controller.abort();
      };
      abortSignal.addEventListener('abort', abortHandler);
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      // Clean up abort handler
      if (abortSignal && abortHandler) {
        abortSignal.removeEventListener('abort', abortHandler);
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      // Clean up abort handler
      if (abortSignal && abortHandler) {
        abortSignal.removeEventListener('abort', abortHandler);
      }
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        if (abortSignal?.aborted) {
          throw new Error('Request was cancelled by user');
        }
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Retry wrapper for network requests
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries;
    const retryDelay = options.retryDelay ?? this.defaultRetryDelay;
    
    let lastError: Error | unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(this.EXPONENTIAL_BACKOFF_BASE, attempt); // Exponential backoff
          logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
          await this.sleep(delay);
        } else {
          logger.error('Request failed after all retries:', error);
        }
      }
    }

    throw lastError;
  }

  private async chatCompletion(
    messages: ChatMessage[],
    provider: 'ollama' | 'lmstudio',
    options: RetryOptions = {},
    abortSignal?: AbortSignal,
    enableFunctionCalling: boolean = true
  ): Promise<AIMessage & { tool_calls?: AIToolCall[] }> {
    const endpoint = provider === 'ollama' ? this.ollamaEndpoint : this.lmStudioEndpoint;
    const model = this.currentModel || (provider === 'ollama' ? 'codellama' : 'codellama-7b-instruct');
    const timeout = options.timeout ?? this.defaultTimeout;

    let apiPath: string;
    let requestBody: ChatCompletionRequestBody;

    const tools = enableFunctionCalling ? formatToolsForAPI(AI_TOOLS, provider) : undefined;

    if (provider === 'ollama') {
      apiPath = '/api/chat';
      requestBody = {
        model,
        messages,
        stream: false,
        tools: tools,
        tool_choice: enableFunctionCalling ? 'auto' : undefined,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 2048
        }
      };
    } else {
      // LM Studio uses OpenAI-compatible API
      apiPath = '/v1/chat/completions';
      requestBody = {
        model,
        messages,
        stream: false,
        tools: tools,
        tool_choice: enableFunctionCalling ? 'auto' : undefined,
        temperature: 0.3,
        max_tokens: 2048
      };
    }

    logger.debug('Sending chat completion request:', { 
      provider, 
      model, 
      messageCount: messages.length, 
      apiPath,
      endpoint,
      hasTools: !!tools,
      functionCallingEnabled: enableFunctionCalling,
      timeout
    });
    
    // Проверка, что модель установлена
    if (!model || model.trim() === '') {
      logger.error('Model is not set!', { provider, endpoint });
      throw new Error('Модель не выбрана. Пожалуйста, выберите модель в настройках.');
    }

    return this.withRetry(async () => {
      const response = await this.fetchWithTimeout(
        `${endpoint}${apiPath}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        },
        timeout,
        abortSignal
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.error('Chat completion HTTP error:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          endpoint,
          model,
          provider
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json().catch(async (parseError) => {
        const text = await response.text().catch(() => 'Unable to read response');
        logger.error('Failed to parse response JSON:', {
          parseError,
          responseText: text.substring(0, 500),
          endpoint,
          model,
          provider
        });
        throw new Error(`Failed to parse response: ${parseError.message}. Response: ${text.substring(0, 200)}`);
      });
      
      // Извлекаем tool calls если есть
      const toolCalls = extractToolCallsFromResponse(data, provider);
      
      // Ollama format: data.message.content
      // OpenAI/LM Studio format: data.choices[0].message.content
      const content = data.message?.content || data.choices?.[0]?.message?.content || '';
      
      logger.debug('Chat completion successful:', { 
        provider, 
        contentLength: content.length,
        toolCallsCount: toolCalls.length,
        hasToolCallsInResponse: !!(data.message?.tool_calls || data.choices?.[0]?.message?.tool_calls),
        contentPreview: content.substring(0, this.MAX_RESPONSE_PREVIEW)
      });
      
      // Если tool calls найдены через парсинг текста, логируем это
      if (toolCalls.length > 0 && !(data.message?.tool_calls || data.choices?.[0]?.message?.tool_calls)) {
        logger.info('Tool calls extracted from text (fallback parsing):', {
          count: toolCalls.length,
          toolNames: toolCalls.map(tc => tc.function.name)
        });
      }
      
      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        type: 'chat',
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
      };
    }, options);
  }

  private getSystemPrompt(type: string, context?: { projectPath?: string; files?: Array<{ path: string; content?: string }> | string[] }): string {
    const basePrompt = 'You are an expert AI programming assistant integrated into AI IDE (not "Apple AI IDE" - the project is called "AI IDE").';

    const prompts = {
      code_generation: `${basePrompt} Generate high-quality, clean, and efficient code based on the user's requirements. Follow best practices and modern patterns. Use the provided project context to understand the codebase structure and coding style.

CRITICAL: You have access to create_file() function. When generating code, you MUST call create_file() function for each file.

RULES:
1. ALWAYS call create_file(file_path, content) function - NEVER show code in markdown blocks
2. For multiple files, call create_file() multiple times
3. Use simple filenames like "game.js", "snake.html", "style.css"
4. DO NOT use markdown code blocks - use functions instead
5. DO NOT use "Файл: filename" format - use create_file() function

EXAMPLE:
User: "Создай игру Змейка"
You MUST: Call create_file("snake.html", "..."), create_file("style.css", "..."), create_file("snake.js", "...")
You MUST NOT: Show code in markdown code blocks or use "Файл:" format`,
      code_analysis: `${basePrompt} Analyze code thoroughly and provide insightful feedback on quality, architecture, potential issues, and improvements.`,
      code_refactoring: `${basePrompt} Refactor code to improve readability, performance, and maintainability while preserving functionality.`,
      code_explanation: `${basePrompt} Explain code concepts clearly and concisely, helping developers understand complex logic and patterns.`,
      chat: `${basePrompt} You are a helpful coding assistant integrated into AI IDE. Answer questions naturally and conversationally.

BEHAVIOR RULES:
1. When user asks if you can see their project:
   - If project context is provided below, describe the files and structure you see from the context
   - If no context is visible, use list_files() function to check what files exist in the project, then describe them
   - Always give a concrete answer about what files you see

2. When user asks about specific files:
   - Use read_file() to read the file contents if not already in the context
   - Explain the file contents in natural language

3. For code generation requests:
   - Call create_file() function directly, do not show code examples or function syntax
   - Use simple filenames like "index.html", "app.js", "style.css"

4. Never show function call syntax or instructions in your responses - just execute functions when needed

AVAILABLE FUNCTIONS (execute silently when needed):
- list_files(directory_path?) - Lists files in the project
- read_file(file_path) - Reads file contents  
- create_file(file_path, content) - Creates new files (only when user asks to create code)
- edit_file(file_path, content) - Updates files (only when user asks to edit)

The project context below shows files and their contents that you currently have access to.`
    };

    let prompt = (type in prompts ? prompts[type as keyof typeof prompts] : null) || basePrompt;

    if (context?.projectPath) {
      prompt += `\n\nProject location: ${context.projectPath}`;
    }

    // Note: File contents are added separately in the calling methods
    // to avoid duplication and allow better control over context size

    return prompt;
  }

  /**
   * Chat with streaming support
   */
  async chatStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    context?: { 
      files?: Array<{ path: string; content?: string }> | string[], 
      projectPath?: string 
    },
    provider: 'ollama' | 'lmstudio' = 'ollama',
    abortSignal?: AbortSignal
  ): Promise<string> {
    try {
      // Build context from files for chat
      let fileContext = '';
      if (context?.files && context.files.length > 0) {
        const files = context.files;
        const fileContents: Array<{ path: string; content: string }> = [];
        
        for (const file of files) {
          if (typeof file === 'string') {
            fileContents.push({ path: file, content: '' });
          } else {
            fileContents.push({ 
              path: file.path, 
              content: file.content || '' 
            });
          }
        }
        
        const relevantFiles = fileContents
          .filter(f => f.content)
          .slice(0, this.MAX_CONTEXT_FILES);
        
        if (relevantFiles.length > 0) {
          fileContext = '\n\n## Current Project Context:\n\n' + 
            relevantFiles.map(file => 
              `**${file.path}:**\n\`\`\`\n${file.content.substring(0, this.MAX_FILE_CONTENT_PREVIEW)}${file.content.length > this.MAX_FILE_CONTENT_PREVIEW ? '...' : ''}\n\`\`\`\n`
            ).join('\n');
        }
      }

      // Add RAG context (семантический поиск) - ЯДРО СИСТЕМЫ
      if (context?.projectPath) {
        try {
          // Для streaming используем упрощенный RAG (без async await в цикле)
          const index = codebaseIndexService.getIndex(context.projectPath);
          if (index && index.symbols.size > 0) {
            const symbolSummary: string[] = [];
            const symbolEntries = Array.from(index.symbols.entries());
            for (const [type, symbols] of symbolEntries) {
              if (symbols.length > 0) {
                symbolSummary.push(`${type}: ${symbols.slice(0, this.MAX_SYMBOLS_TO_SHOW).map((s) => s.name).join(', ')}${symbols.length > this.MAX_SYMBOLS_TO_SHOW ? '...' : ''}`);
              }
            }
            
            if (symbolSummary.length > 0) {
              fileContext += '\n\n## Project Structure:\n\n';
              fileContext += `Files indexed: ${index.files.size}\n`;
              fileContext += `Symbols: ${symbolSummary.join('\n')}\n`;
            }
          }
        } catch (error) {
          logger.debug('Error getting codebase index:', error);
        }
      }

      const formattedMessages: ChatMessage[] = [
        {
          role: 'system',
          content: this.getSystemPrompt('chat', context) + fileContext
        },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        }))
      ];

      return await this.chatCompletionStream(formattedMessages, onChunk, provider, {
        timeout: 60000,
        maxRetries: 1
      }, abortSignal);
    } catch (error) {
      logger.error('Error in streaming chat:', error);
      throw error;
    }
  }

  /**
   * Streaming chat completion
   */
  private async chatCompletionStream(
    messages: Array<{ role: string, content: string }>,
    onChunk: (chunk: string) => void,
    provider: 'ollama' | 'lmstudio',
    options: RetryOptions = {},
    abortSignal?: AbortSignal
  ): Promise<string> {
    const endpoint = provider === 'ollama' ? this.ollamaEndpoint : this.lmStudioEndpoint;
    const model = this.currentModel || (provider === 'ollama' ? 'codellama' : 'codellama-7b-instruct');
    const timeout = options.timeout ?? this.defaultTimeout;

    let apiPath: string;
    let requestBody: any;

    if (provider === 'ollama') {
      apiPath = '/api/chat';
      requestBody = {
        model,
        messages,
        stream: true,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 2048
        }
      };
    } else {
      // LM Studio uses OpenAI-compatible API
      apiPath = '/v1/chat/completions';
      requestBody = {
        model,
        messages,
        stream: true,
        temperature: 0.3,
        max_tokens: 2048
      };
    }

    logger.debug('Sending streaming chat completion request:', { provider, model });

    try {
      const response = await this.fetchWithTimeout(
        `${endpoint}${apiPath}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        },
        timeout,
        abortSignal
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      try {
        while (true) {
          // Check for abort before reading
          if (abortSignal?.aborted) {
            reader.cancel().catch(() => {});
            throw new Error('Request was cancelled by user');
          }
          
          const { done, value } = await reader.read();
          
          if (done) break;
          
          // Check for abort after reading
          if (abortSignal?.aborted) {
            reader.cancel().catch(() => {});
            throw new Error('Request was cancelled by user');
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            
            if (provider === 'ollama') {
              // Ollama format: {"message": {"content": "chunk"}, "done": false}
              try {
                const data = JSON.parse(line);
                if (data.message?.content) {
                  const chunk = data.message.content;
                  fullContent += chunk;
                  onChunk(chunk);
                }
                if (data.done) break;
              } catch (e) {
                // Skip invalid JSON lines
                continue;
              }
            } else {
              // LM Studio/OpenAI format: data: {"choices": [{"delta": {"content": "chunk"}}]}
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.substring(6);
                  if (jsonStr === '[DONE]') break;
                  
                  const data = JSON.parse(jsonStr);
                  const chunk = data.choices?.[0]?.delta?.content || '';
                  if (chunk) {
                    fullContent += chunk;
                    onChunk(chunk);
                  }
                } catch (e) {
                  // Skip invalid JSON
                  continue;
                }
              }
            }
          }
        }
      } catch (readError) {
        // Cancel reader if not already done
        reader.cancel().catch(() => {});
        
        // Check if error is due to abort
        if (abortSignal?.aborted || 
            (readError instanceof Error && (
              readError.message.includes('cancelled') || 
              readError.message.includes('aborted') ||
              readError.message.includes('BodyStreamBuffer')
            ))) {
          throw new Error('Request was cancelled by user');
        }
        throw readError;
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          if (provider === 'ollama') {
            const data = JSON.parse(buffer);
            if (data.message?.content) {
              const chunk = data.message.content;
              fullContent += chunk;
              onChunk(chunk);
            }
          } else if (buffer.startsWith('data: ')) {
            const jsonStr = buffer.substring(6);
            if (jsonStr !== '[DONE]') {
              const data = JSON.parse(jsonStr);
              const chunk = data.choices?.[0]?.delta?.content || '';
              if (chunk) {
                fullContent += chunk;
                onChunk(chunk);
              }
            }
          }
        } catch (e) {
          // Ignore parse errors for buffer
        }
      }

      logger.debug('Streaming chat completion finished:', { provider, contentLength: fullContent.length });
      return fullContent;
    } catch (error) {
      // Handle abort/cancellation errors gracefully
      if (error instanceof Error && (
        error.message.includes('cancelled') || 
        error.message.includes('aborted') ||
        error.message.includes('BodyStreamBuffer')
      )) {
        logger.debug('Streaming request was cancelled');
        throw new Error('Request was cancelled by user');
      }
      logger.error('Error in streaming chat completion:', error);
      throw error;
    }
  }

  async chat(
    messages: AIMessage[],
    context?: { 
      files?: Array<{ path: string; content?: string }> | string[], 
      projectPath?: string 
    },
    provider: 'ollama' | 'lmstudio' = 'ollama',
    abortSignal?: AbortSignal,
    onToolCall?: (toolCall: AIToolCall) => Promise<any>,
    timeout?: number // Опциональный таймаут для агентских задач
  ): Promise<AIMessage & { tool_calls?: AIToolCall[] }> {
    try {
      // Build context from files for chat
      let fileContext = '';
      if (context?.files && context.files.length > 0) {
        const files = context.files;
        const fileContents: Array<{ path: string; content: string }> = [];
        
        for (const file of files) {
          if (typeof file === 'string') {
            fileContents.push({ path: file, content: '' });
          } else {
            fileContents.push({ 
              path: file.path, 
              content: file.content || '' 
            });
          }
        }
        
        const relevantFiles = fileContents
          .filter(f => f.content)
          .slice(0, this.MAX_CHAT_CONTEXT_FILES); // Limit files for chat context
        
        if (relevantFiles.length > 0) {
          fileContext = '\n\n## Current Project Context:\n\n' + 
            relevantFiles.map(file => 
              `**${file.path}:**\n\`\`\`\n${file.content.substring(0, this.MAX_FILE_CONTENT_PREVIEW)}${file.content.length > this.MAX_FILE_CONTENT_PREVIEW ? '...' : ''}\n\`\`\`\n`
            ).join('\n');
        }
      }

      // Add RAG context (семантический поиск) - ЯДРО СИСТЕМЫ
      // ВАЖНО: Проверяем, что RAG индекс соответствует текущему проекту
      if (context?.projectPath) {
        try {
          // Проверяем, что RAG индекс соответствует текущему проекту
          const ragStats = ragService.getStats();
          if (ragStats.projectPath && ragStats.projectPath !== context.projectPath) {
            logger.warn('RAG index project mismatch, clearing cache', {
              ragProject: ragStats.projectPath,
              currentProject: context.projectPath
            });
            ragService.clearCache(ragStats.projectPath);
            codebaseIndexService.clearCache(ragStats.projectPath);
          }
          
          const lastUserMessage = messages[messages.length - 1];
          const userQuery = lastUserMessage?.content || '';
          
          // Используем RAG для поиска релевантного контекста
          if (userQuery.trim().length > 0) {
            try {
              const ragContext = await ragService.getRelevantContext(
                userQuery,
                context.projectPath,
                5 // Top 5 релевантных файлов
              );
              
              if (ragContext.length > 0) {
                fileContext += '\n\n## 🔍 Релевантный код (RAG):\n\n';
                for (const ctx of ragContext) {
                  fileContext += `**${ctx.path}** (релевантность: ${(ctx.score * 100).toFixed(0)}%):\n\`\`\`\n${ctx.content.substring(0, this.MAX_RAG_CONTENT_PREVIEW)}${ctx.content.length > this.MAX_RAG_CONTENT_PREVIEW ? '...' : ''}\n\`\`\`\n\n`;
                }
                logger.debug('RAG context added', { 
                  filesCount: ragContext.length,
                  avgScore: ragContext.reduce((sum, c) => sum + c.score, 0) / ragContext.length
                });
              }
            } catch (ragError) {
              logger.debug('RAG search failed, falling back to basic index', ragError);
            }
          }
          
          // Fallback: базовая индексация (если RAG не сработал)
          const index = codebaseIndexService.getIndex(context.projectPath);
          // Проверяем, что индекс соответствует текущему проекту
          if (index && index.projectPath === context.projectPath && index.symbols.size > 0 && !fileContext.includes('Релевантный код')) {
            const symbolSummary: string[] = [];
            const symbolEntries = Array.from(index.symbols.entries());
            for (const [type, symbols] of symbolEntries) {
              if (symbols.length > 0) {
                symbolSummary.push(`${type}: ${symbols.slice(0, this.MAX_SYMBOLS_TO_SHOW).map((s) => s.name).join(', ')}${symbols.length > this.MAX_SYMBOLS_TO_SHOW ? '...' : ''}`);
              }
            }
            
            if (symbolSummary.length > 0) {
              fileContext += '\n\n## Project Structure:\n\n';
              fileContext += `Files indexed: ${index.files.size}\n`;
              fileContext += `Symbols: ${symbolSummary.join('\n')}\n`;
            }
          }
        } catch (error) {
          logger.debug('Error getting codebase context:', error);
        }
      }

      const formattedMessages: ChatMessage[] = [
        {
          role: 'system',
          content: this.getSystemPrompt('chat', context) + fileContext
        },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          tool_calls: msg.tool_calls,
          tool_call_id: msg.tool_call_id
        }))
      ];

      // ВСЕГДА включаем function calling для запросов на создание кода
      const lastUserMessage = messages[messages.length - 1];
      const messageText = lastUserMessage?.content.toLowerCase() || '';
      const enableFunctionCalling = lastUserMessage && (
        isCodeGenerationRequest(lastUserMessage.content) || 
        messageText.includes('создай') ||
        messageText.includes('напиши') ||
        messageText.includes('сделай') ||
        messageText.includes('реализуй') ||
        messageText.includes('create') ||
        messageText.includes('write') ||
        messageText.includes('implement') ||
        messageText.includes('build') ||
        messageText.includes('make')
      );
      
      logger.debug('Function calling enabled:', { 
        enableFunctionCalling, 
        isCodeRequest: isCodeGenerationRequest(lastUserMessage?.content || ''),
        messagePreview: lastUserMessage?.content.substring(0, this.MAX_MESSAGE_PREVIEW)
      });

      const response = await this.chatCompletion(
        formattedMessages, 
        provider, 
        {
          timeout: timeout || 45000, // Используем переданный таймаут или дефолтный
          maxRetries: 2
        }, 
        abortSignal,
        enableFunctionCalling
      );
      
      // Если AI вызвал функции, обрабатываем их
      if (response.tool_calls && response.tool_calls.length > 0 && onToolCall) {
        logger.info('AI requested tool calls:', { 
          count: response.tool_calls.length,
          toolCalls: response.tool_calls.map(tc => tc.function.name)
        });
        
        // Выполняем все tool calls
        const toolResults = await Promise.all(
          response.tool_calls.map(toolCall => onToolCall(toolCall))
        );
        
        // Добавляем результаты обратно в контекст для следующего запроса
        const toolMessages = toolResults.map((result, index) => ({
          role: 'tool' as const,
          tool_call_id: response.tool_calls![index].id,
          content: JSON.stringify(result)
        }));
        
        // Делаем еще один запрос с результатами функций для финального ответа
        // Форматируем tool_calls в правильном формате для LM Studio/OpenAI API
        const formattedToolCalls = response.tool_calls.map(tc => ({
          id: tc.id || generateIds.toolCall(),
          type: tc.type || 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        }));
        
        const messagesWithToolResults: ChatMessage[] = [
          ...formattedMessages,
          {
            role: 'assistant',
            content: response.content || '',
            tool_calls: formattedToolCalls
          },
          ...toolMessages.map(msg => ({
            role: 'tool' as const,
            tool_call_id: msg.tool_call_id,
            content: msg.content
          }))
        ];
        
        const finalResponse = await this.chatCompletion(
          messagesWithToolResults,
          provider,
          {
            timeout: 45000,
            maxRetries: 2
          },
          abortSignal,
          false // Отключаем function calling для финального ответа
        );
        
        // Добавляем информацию о созданных файлах в ответ
        const createdFiles = toolResults
          .filter((result, index) => 
            response.tool_calls![index].function.name === 'create_file' && 
            result && typeof result === 'object' && 'success' in result && result.success
          )
          .map((result: any) => result.file_path || result.relative_path)
          .filter(Boolean);
        
        if (createdFiles.length > 0) {
          finalResponse.content = `${finalResponse.content}\n\n✅ **Файлы созданы:**\n${createdFiles.map(f => `- ${f}`).join('\n')}`;
        }
        
        return finalResponse;
      } else if (enableFunctionCalling && (!response.tool_calls || response.tool_calls.length === 0)) {
        // AI не вызвал функции, хотя должен был - логируем предупреждение
        logger.warn('Function calling was enabled but AI did not call any functions', {
          messagePreview: lastUserMessage?.content.substring(0, this.MAX_MESSAGE_PREVIEW * 2),
          responsePreview: response.content.substring(0, this.MAX_RESPONSE_PREVIEW)
        });
      }
      
      return response;
    } catch (error) {
      logger.error('Error in chat completion:', error);
      throw error;
    }
  }
}

export const aiService = new AIService();