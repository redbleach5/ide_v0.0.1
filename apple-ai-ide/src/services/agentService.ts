import { logger } from '../utils/logger';
import { aiService } from './aiService';
import { AIMessage } from '../types';
import { AIToolCall, executeToolCall } from './aiFunctionCalling';
import { isCodeGenerationRequest } from '../utils/codeParser';

export interface AgentTask {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  steps: AgentStep[];
  result?: any;
  error?: string;
}

export interface AgentStep {
  id: string;
  description: string;
  action: 'read' | 'write' | 'analyze' | 'plan';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  toolCalls?: AIToolCall[];
  result?: any;
  error?: string;
}

export interface AgentPlan {
  goal: string;
  steps: Array<{
    step: number;
    description: string;
    action: string;
    expectedOutcome: string;
  }>;
  estimatedComplexity: 'simple' | 'medium' | 'complex';
}

export class AgentService {
  private maxIterations = 10; // Максимальное количество итераций для предотвращения бесконечных циклов
  private maxReflectionAttempts = 3; // Максимальное количество попыток исправления ошибок

  /**
   * Универсальный метод для обработки всех запросов - единое ядро CodeAct-агента
   * Определяет сложность и использует либо быстрый режим, либо полное планирование
   */
  async executeRequest(
    userRequest: string,
    context: {
      files?: Array<{ path: string; content?: string }>;
      projectPath?: string;
    },
    provider: 'ollama' | 'lmstudio' = 'ollama',
    options: {
      mode?: 'auto' | 'fast' | 'agent'; // auto - определяет автоматически, fast - быстрый ответ, agent - полное планирование
      onProgress?: (task: AgentTask) => void;
      onToolCall?: (toolCall: AIToolCall) => Promise<any>;
      onStreamChunk?: (chunk: string) => void;
      abortSignal?: AbortSignal;
      useStreaming?: boolean;
    } = {}
  ): Promise<{ content: string; tool_calls?: AIToolCall[]; task?: AgentTask }> {
    const {
      mode = 'auto',
      onProgress,
      onToolCall,
      onStreamChunk,
      abortSignal,
      useStreaming = false
    } = options;

    // Определяем режим работы
    const shouldUseAgentMode = mode === 'agent' || 
      (mode === 'auto' && this.isComplexTask(userRequest));

    // Для простых запросов используем быстрый режим
    if (!shouldUseAgentMode) {
      return await this.executeQuickRequest(
        userRequest,
        context,
        provider,
        {
          onToolCall,
          onStreamChunk,
          abortSignal,
          useStreaming
        }
      );
    }

    // Для сложных задач - полное планирование и выполнение
    const task = await this.executeAgentTask(
      userRequest,
      context,
      provider,
      onProgress,
      onToolCall,
      abortSignal
    );

    return {
      content: task.result?.message || task.error || 'Задача выполнена',
      task
    };
  }

  /**
   * Быстрый режим для простых вопросов без планирования
   */
  private async executeQuickRequest(
    userRequest: string,
    context: {
      files?: Array<{ path: string; content?: string }>;
      projectPath?: string;
    },
    provider: 'ollama' | 'lmstudio',
    options: {
      onToolCall?: (toolCall: AIToolCall) => Promise<any>;
      onStreamChunk?: (chunk: string) => void;
      abortSignal?: AbortSignal;
      useStreaming?: boolean;
    }
  ): Promise<{ content: string; tool_calls?: AIToolCall[] }> {
    const { onToolCall, onStreamChunk, abortSignal, useStreaming = false } = options;

    // Используем aiService напрямую для быстрого ответа
    const messages: AIMessage[] = [
      {
        id: 'user',
        role: 'user',
        content: userRequest,
        timestamp: new Date(),
        type: 'chat'
      }
    ];

    if (useStreaming && onStreamChunk) {
      // Streaming режим
      let accumulatedContent = '';
      await aiService.chatStream(
        messages,
        (chunk: string) => {
          accumulatedContent += chunk;
          onStreamChunk(chunk);
        },
        context,
        provider,
        abortSignal
      );
      return { content: accumulatedContent };
    } else {
      // Non-streaming режим с поддержкой function calling
      const response = await aiService.chat(
        messages,
        context,
        provider,
        abortSignal,
        onToolCall
      );
      return {
        content: response.content,
        tool_calls: response.tool_calls
      };
    }
  }

  /**
   * Определяет, является ли задача сложной (требует планирования)
   */
  private isComplexTask(userRequest: string): boolean {
    const request = userRequest.toLowerCase();
    
    // Простые вопросы (не требуют планирования)
    const simplePatterns = [
      /^(видишь|видишь ли|ты видишь|can you see)/i,
      /^(что|what|как|how|почему|why|объясни|explain)/i,
      /^(привет|hello|hi|здравствуй)/i,
      /^[?]/, // Вопросы
    ];

    // Сложные задачи (требуют планирования)
    const complexPatterns = [
      /(создай|create|напиши|write|реализуй|implement|сделай|make|построй|build)/i,
      /(игра|game|приложение|app|проект|project)/i,
      /(несколько|multiple|много|many)\s+(файл|file)/i,
      /(полный|full|complete|целый|whole)/i,
    ];

    // Проверяем на сложные задачи
    if (complexPatterns.some(pattern => pattern.test(request))) {
      return true;
    }

    // Если запрос длинный (>100 символов), вероятно сложная задача
    if (userRequest.length > 100) {
      return true;
    }

    // Если есть указание на несколько действий
    if (request.includes('и') && request.split('и').length > 2) {
      return true;
    }

    return false;
  }

  /**
   * Выполняет агентскую задачу с планированием и рефлексией
   */
  async executeAgentTask(
    userRequest: string,
    context: {
      files?: Array<{ path: string; content?: string }>;
      projectPath?: string;
    },
    provider: 'ollama' | 'lmstudio' = 'ollama',
    onProgress?: (task: AgentTask) => void,
    onToolCall?: (toolCall: AIToolCall) => Promise<any>,
    abortSignal?: AbortSignal
  ): Promise<AgentTask> {
    const task: AgentTask = {
      id: `task_${Date.now()}`,
      description: userRequest,
      status: 'in_progress',
      steps: []
    };

    try {
      // Шаг 1: Планирование (с таймаутом и fallback)
      logger.info('Agent: Starting task planning', { taskId: task.id, request: userRequest });
      
      let plan: AgentPlan;
      try {
        plan = await this.createPlan(userRequest, context, provider, abortSignal);
      } catch (planError) {
        const errorMsg = planError instanceof Error ? planError.message : 'Unknown error';
        if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
          logger.warn('Agent: Planning timeout, using default plan', { taskId: task.id });
          plan = this.createDefaultPlan(userRequest);
        } else {
          throw planError;
        }
      }
      
      task.steps.push({
        id: 'plan',
        description: 'Planning task execution',
        action: 'plan',
        status: 'completed',
        result: plan
      });
      
      onProgress?.(task);

      // Шаг 2: Выполнение плана
      logger.info('Agent: Executing plan', { 
        taskId: task.id, 
        stepsCount: plan.steps.length,
        complexity: plan.estimatedComplexity
      });

      let iteration = 0;
      let lastError: string | null = null;

      for (const planStep of plan.steps) {
        if (abortSignal?.aborted) {
          throw new Error('Task was cancelled by user');
        }

        if (iteration >= this.maxIterations) {
          throw new Error(`Maximum iterations (${this.maxIterations}) reached`);
        }

        iteration++;

        const step: AgentStep = {
          id: `step_${planStep.step}_${Date.now()}`,
          description: planStep.description,
          action: this.inferActionType(planStep.action),
          status: 'in_progress'
        };

        task.steps.push(step);
        onProgress?.(task);

        try {
          // Выполняем шаг
          const stepResult = await this.executeStep(
            planStep,
            context,
            provider,
            onToolCall,
            abortSignal
          );

          step.status = 'completed';
          step.result = stepResult;
          step.toolCalls = stepResult.toolCalls;

          logger.info('Agent: Step completed', {
            taskId: task.id,
            stepId: step.id,
            stepDescription: planStep.description
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          step.status = 'failed';
          step.error = errorMessage;
          lastError = errorMessage;

          logger.warn('Agent: Step failed', {
            taskId: task.id,
            stepId: step.id,
            error: errorMessage
          });

          // Попытка рефлексии и исправления
          const reflectionResult = await this.reflectAndFix(
            task,
            step,
            errorMessage,
            context,
            provider,
            onToolCall,
            abortSignal
          );

          if (reflectionResult.success) {
            step.status = 'completed';
            step.result = reflectionResult.result;
            logger.info('Agent: Step fixed after reflection', { stepId: step.id });
          } else {
            // Если не удалось исправить, продолжаем с предупреждением
            logger.warn('Agent: Could not fix step, continuing', { stepId: step.id });
          }
        }

        onProgress?.(task);
      }

      // Шаг 3: Финальная проверка и валидация
      logger.info('Agent: Validating task completion', { taskId: task.id });
      const validation = await this.validateTaskCompletion(
        userRequest,
        task,
        context,
        provider,
        abortSignal
      );

      if (validation.success) {
        task.status = 'completed';
        task.result = {
          message: validation.message,
          stepsCompleted: task.steps.filter(s => s.status === 'completed').length,
          totalSteps: task.steps.length
        };
      } else {
        task.status = 'failed';
        task.error = validation.error || 'Task validation failed';
      }

      return task;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      task.status = 'failed';
      task.error = errorMessage;
      logger.error('Agent: Task failed', { taskId: task.id, error: errorMessage });
      return task;
    }
  }

  /**
   * Создает план выполнения задачи
   */
  private async createPlan(
    userRequest: string,
    context: any,
    provider: 'ollama' | 'lmstudio',
    abortSignal?: AbortSignal
  ): Promise<AgentPlan> {
    // Упрощенный промпт для маленьких моделей (быстрее работает)
    const planningPrompt = `Create a simple execution plan for: "${userRequest}"

Respond with JSON:
{
  "goal": "brief goal",
  "steps": [
    {"step": 1, "description": "action", "action": "create_file|read_file|edit_file", "expectedOutcome": "result"}
  ],
  "estimatedComplexity": "simple|medium|complex"
}

Keep it short - max 3-5 steps.`;

    const messages: AIMessage[] = [
      {
        id: 'planning',
        role: 'user',
        content: planningPrompt,
        timestamp: new Date(),
        type: 'chat'
      }
    ];

    try {
      // Используем увеличенный таймаут для планирования (маленькие модели работают медленнее)
      // Для маленьких моделей типа qwen3-vl-2b-instruct даем больше времени
      const response = await aiService.chat(
        messages,
        context,
        provider,
        abortSignal,
        undefined, // onToolCall не нужен для планирования
        90000 // 90 секунд для планирования (в 2 раза больше обычного)
      );

      // Пытаемся извлечь JSON из ответа
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]) as AgentPlan;
        
        // Валидация плана
        if (!plan.goal || !plan.steps || !Array.isArray(plan.steps)) {
          throw new Error('Invalid plan format');
        }

        return plan;
      } else {
        throw new Error('No JSON found in planning response');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Если таймаут - используем упрощенный план
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        logger.warn('Planning timeout, using simplified plan', { userRequest });
        return this.createDefaultPlan(userRequest);
      }
      
      logger.error('Failed to parse plan, creating default plan', error);
      
      // Fallback: создаем простой план на основе запроса
      return this.createDefaultPlan(userRequest);
    }
  }

  /**
   * Создает простой план по умолчанию
   */
  private createDefaultPlan(userRequest: string): AgentPlan {
    const isCodeGen = isCodeGenerationRequest(userRequest);
    
    if (isCodeGen) {
      return {
        goal: userRequest,
        steps: [
          {
            step: 1,
            description: 'List project structure to understand context',
            action: 'list_files',
            expectedOutcome: 'Understanding of project structure'
          },
          {
            step: 2,
            description: `Create files based on user request: ${userRequest}`,
            action: 'create_file',
            expectedOutcome: 'Files created successfully'
          }
        ],
        estimatedComplexity: 'simple'
      };
    }

    return {
      goal: userRequest,
      steps: [
        {
          step: 1,
          description: userRequest,
          action: 'analyze',
          expectedOutcome: 'Task completed'
        }
      ],
      estimatedComplexity: 'simple'
    };
  }

  /**
   * Выполняет один шаг плана
   */
  private async executeStep(
    planStep: AgentPlan['steps'][0],
    context: any,
    provider: 'ollama' | 'lmstudio',
    onToolCall?: (toolCall: AIToolCall) => Promise<any>,
    abortSignal?: AbortSignal
  ): Promise<{ toolCalls?: AIToolCall[]; result: any }> {
    logger.debug('Agent: Executing step', {
      step: planStep.step,
      description: planStep.description,
      action: planStep.action
    });

    // Упрощенный промпт для быстрой работы
    const stepPrompt = planStep.action.includes('file') || planStep.action.includes('create') || planStep.action.includes('edit')
      ? `Do: ${planStep.description}. Use create_file() function.`
      : planStep.description;

    const messages: AIMessage[] = [
      {
        id: `step_${planStep.step}`,
        role: 'user',
        content: stepPrompt,
        timestamp: new Date(),
        type: 'chat'
      }
    ];

    try {
      // Увеличенный таймаут для выполнения шагов (маленькие модели работают медленнее)
      const response = await aiService.chat(
        messages,
        context,
        provider,
        abortSignal,
        onToolCall,
        90000 // 90 секунд для выполнения шагов
      );

      return {
        toolCalls: response.tool_calls,
        result: response.content
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Если таймаут - возвращаем частичный результат
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        logger.warn('Step execution timeout', { step: planStep.step });
        return {
          result: 'Step execution timed out, but continuing...'
        };
      }
      
      throw error;
    }
  }

  /**
   * Рефлексия и исправление ошибок
   */
  private async reflectAndFix(
    task: AgentTask,
    failedStep: AgentStep,
    error: string,
    context: any,
    provider: 'ollama' | 'lmstudio',
    onToolCall?: (toolCall: AIToolCall) => Promise<any>,
    abortSignal?: AbortSignal
  ): Promise<{ success: boolean; result?: any }> {
    logger.info('Agent: Reflecting on error', {
      taskId: task.id,
      stepId: failedStep.id,
      error
    });

    // Упрощенный промпт для быстрой рефлексии
    const reflectionPrompt = `Error: "${error}". Step: "${failedStep.description}". Fix and retry using create_file() if needed.`;

    const messages: AIMessage[] = [
      {
        id: 'reflection',
        role: 'user',
        content: reflectionPrompt,
        timestamp: new Date(),
        type: 'chat'
      }
    ];

    try {
      // Увеличенный таймаут для рефлексии
      const response = await aiService.chat(
        messages,
        context,
        provider,
        abortSignal,
        onToolCall,
        60000 // 60 секунд для рефлексии
      );

      return {
        success: true,
        result: {
          content: response.content,
          toolCalls: response.tool_calls
        }
      };
    } catch (reflectionError) {
      const errorMsg = reflectionError instanceof Error ? reflectionError.message : 'Unknown error';
      
      // Если таймаут при рефлексии - пропускаем исправление
      if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        logger.warn('Agent: Reflection timeout, skipping fix', { stepId: failedStep.id });
      } else {
        logger.error('Agent: Reflection failed', reflectionError);
      }
      
      return {
        success: false
      };
    }
  }

  /**
   * Валидация завершения задачи
   */
  private async validateTaskCompletion(
    originalRequest: string,
    task: AgentTask,
    context: any,
    provider: 'ollama' | 'lmstudio',
    abortSignal?: AbortSignal
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    // Упрощенная валидация без запроса к AI (быстрее)
    const completedSteps = task.steps.filter(s => s.status === 'completed').length;
    const success = completedSteps >= task.steps.length * 0.6; // 60% шагов должны быть выполнены
    
    // Если большинство шагов выполнено, считаем успешным
    if (success) {
      return {
        success: true,
        message: `Задача выполнена: ${completedSteps} из ${task.steps.length} шагов завершено.`
      };
    }
    
    // Если меньше 60% - пытаемся получить оценку от AI (но с таймаутом)
    const validationPrompt = `Request: "${originalRequest}". Completed: ${completedSteps}/${task.steps.length}. Is it done? Answer: yes/no.`;

    const messages: AIMessage[] = [
      {
        id: 'validation',
        role: 'user',
        content: validationPrompt,
        timestamp: new Date(),
        type: 'chat'
      }
    ];

    try {
      // Упрощенная валидация с коротким таймаутом
      const response = await aiService.chat(
        messages,
        context,
        provider,
        abortSignal,
        undefined, // onToolCall не нужен для валидации
        30000 // 30 секунд для валидации (быстрая проверка)
      );

      const aiSuccess = response.content.toLowerCase().includes('yes') || 
                       response.content.toLowerCase().includes('да') ||
                       completedSteps >= task.steps.length * 0.5; // Fallback на 50%

      return {
        success: aiSuccess,
        message: response.content
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Если таймаут - используем простую проверку
      if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        logger.warn('Agent: Validation timeout, using simple check');
        return {
          success: completedSteps >= task.steps.length * 0.5,
          message: `Проверка завершена: ${completedSteps} из ${task.steps.length} шагов выполнено.`
        };
      }
      
      logger.error('Agent: Validation failed', error);
      return {
        success: completedSteps >= task.steps.length * 0.5, // Fallback
        error: errorMsg
      };
    }
  }

  /**
   * Определяет тип действия из описания
   */
  private inferActionType(action: string): AgentStep['action'] {
    const lowerAction = action.toLowerCase();
    
    if (lowerAction.includes('read') || lowerAction.includes('list')) {
      return 'read';
    } else if (lowerAction.includes('create') || lowerAction.includes('write') || lowerAction.includes('edit')) {
      return 'write';
    } else if (lowerAction.includes('analyze') || lowerAction.includes('plan')) {
      return 'analyze';
    }
    
    return 'analyze';
  }
}

export const agentService = new AgentService();
