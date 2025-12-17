import { aiService } from './aiService';
import { logger } from '../utils/logger';
import { IDESettings } from '../types';

export interface InlineCompletionContext {
  textBeforeCursor: string;
  textAfterCursor: string;
  language: string;
  filePath?: string;
  lineNumber: number;
  column: number;
}

export interface InlineCompletion {
  text: string;
  range: {
    startLineNumber: number;
    endLineNumber: number;
    startColumn: number;
    endColumn: number;
  };
  command?: {
    id: string;
    title: string;
  };
}

interface CompletionCache {
  key: string;
  completion: InlineCompletion | null;
  timestamp: number;
}

class InlineCompletionService {
  private cache: Map<string, CompletionCache> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private pendingRequests: Map<string, AbortController> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Generate a cache key from context
   */
  private getCacheKey(context: InlineCompletionContext): string {
    // Use last 50 lines before cursor for cache key
    const lines = context.textBeforeCursor.split('\n');
    const relevantLines = lines.slice(-50).join('\n');
    return `${context.language}:${relevantLines.substring(relevantLines.length - 500)}`;
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const cacheEntries = Array.from(this.cache.entries());
    for (const [key, entry] of cacheEntries) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get completion from cache if available
   */
  private getCachedCompletion(context: InlineCompletionContext): InlineCompletion | null {
    this.cleanCache();
    const key = this.getCacheKey(context);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      logger.debug('Using cached inline completion');
      return cached.completion;
    }
    
    return null;
  }

  /**
   * Cache a completion result
   */
  private cacheCompletion(context: InlineCompletionContext, completion: InlineCompletion | null): void {
    const key = this.getCacheKey(context);
    this.cache.set(key, {
      key,
      completion,
      timestamp: Date.now()
    });
  }

  /**
   * Extract relevant context around cursor
   */
  private getRelevantContext(context: InlineCompletionContext): string {
    const lines = context.textBeforeCursor.split('\n');
    // Get last 100 lines or all if less
    const relevantLines = lines.slice(-100);
    return relevantLines.join('\n');
  }

  /**
   * Generate inline completion using AI
   */
  async generateCompletion(
    context: InlineCompletionContext,
    settings: IDESettings,
    abortSignal?: AbortSignal
  ): Promise<InlineCompletion | null> {
    try {
      // Check cache first
      const cached = this.getCachedCompletion(context);
      if (cached !== null) {
        return cached;
      }

      // Check if model is selected
      if (!settings.selectedModel) {
        logger.debug('No model selected for inline completion');
        return null;
      }

      // Configure AI service
      aiService.setOllamaEndpoint(settings.ollamaEndpoint);
      aiService.setLMStudioEndpoint(settings.lmStudioEndpoint);
      aiService.setCurrentModel(settings.selectedModel);

      // Get relevant context
      const codeContext = this.getRelevantContext(context);
      
      // Build prompt for inline completion
      const prompt = `Complete the following ${context.language} code. Return ONLY the completion text that should appear after the cursor, without repeating the existing code. Do not include explanations or markdown formatting.

Code before cursor:
\`\`\`${context.language}
${codeContext}
\`\`\`

Provide a concise, natural continuation of the code.`;

      logger.debug('Generating inline completion', {
        language: context.language,
        line: context.lineNumber,
        column: context.column
      });

      // Call AI service
      const response = await aiService.chat(
        [
          {
            id: 'system',
            role: 'system',
            content: `You are an expert code completion assistant. Provide ONLY the code continuation without explanations, markdown, or code blocks. Return just the text that should appear after the cursor.`,
            timestamp: new Date(),
            type: 'code'
          },
          {
            id: 'user',
            role: 'user',
            content: prompt,
            timestamp: new Date(),
            type: 'code'
          }
        ],
        {
          projectPath: context.filePath ? context.filePath.split('/').slice(0, -1).join('/') : undefined
        },
        settings.aiProvider,
        abortSignal
      );

      // Clean up the response - remove markdown code blocks if present
      let completionText = response.content.trim();
      
      // Remove markdown code blocks
      completionText = completionText.replace(/^```[\w]*\n?/gm, '');
      completionText = completionText.replace(/```$/gm, '');
      completionText = completionText.trim();

      // If empty or too long, return null
      if (!completionText || completionText.length > 500) {
        logger.debug('Completion text is empty or too long');
        return null;
      }

      // Create completion object
      const completion: InlineCompletion = {
        text: completionText,
        range: {
          startLineNumber: context.lineNumber,
          endLineNumber: context.lineNumber,
          startColumn: context.column,
          endColumn: context.column
        }
      };

      // Cache the result
      this.cacheCompletion(context, completion);

      logger.debug('Inline completion generated successfully', {
        length: completionText.length
      });

      return completion;
    } catch (error) {
      // Don't log if request was cancelled
      if (error instanceof Error && error.message.includes('cancelled')) {
        logger.debug('Inline completion request cancelled');
        return null;
      }

      logger.error('Error generating inline completion:', error);
      return null;
    }
  }

  /**
   * Generate completion with debounce
   */
  async generateCompletionDebounced(
    context: InlineCompletionContext,
    settings: IDESettings,
    abortSignal?: AbortSignal
  ): Promise<InlineCompletion | null> {
    const cacheKey = this.getCacheKey(context);
    const debounceDelay = settings.inlineCompletionsDelay || 500;

    // Cancel previous debounce timer
    const existingTimer = this.debounceTimers.get(cacheKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Cancel previous request if any
    const existingRequest = this.pendingRequests.get(cacheKey);
    if (existingRequest) {
      existingRequest.abort();
      this.pendingRequests.delete(cacheKey);
    }

    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.debounceTimers.delete(cacheKey);
        
        // Create new abort controller
        const controller = new AbortController();
        this.pendingRequests.set(cacheKey, controller);

        // Combine abort signals
        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            controller.abort();
          });
        }

        try {
          const completion = await this.generateCompletion(context, settings, controller.signal);
          this.pendingRequests.delete(cacheKey);
          resolve(completion);
        } catch (error) {
          this.pendingRequests.delete(cacheKey);
          resolve(null);
        }
      }, debounceDelay);

      this.debounceTimers.set(cacheKey, timer);
    });
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    // Cancel all debounce timers
    const timers = Array.from(this.debounceTimers.values());
    for (const timer of timers) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Cancel all pending requests
    const controllers = Array.from(this.pendingRequests.values());
    for (const controller of controllers) {
      controller.abort();
    }
    this.pendingRequests.clear();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Inline completion cache cleared');
  }
}

export const inlineCompletionService = new InlineCompletionService();
