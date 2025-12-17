import { logger } from './logger';

/**
 * Список моделей, которые поддерживают function calling
 */
const MODELS_WITH_FUNCTION_CALLING = [
  // OpenAI models
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini',
  
  // Ollama models with function calling support
  'qwen2.5-coder',
  'qwen3-vl',
  'qwen3-vl-2b-instruct',
  'qwen',
  'deepseek-coder',
  'llama3.2',
  'llama3.1',
  'llama3',
  'mistral',
  'mixtral',
  'codellama',
  'phi3',
  
  // LM Studio models (usually OpenAI-compatible)
  'openai',
  'anthropic'
];

/**
 * Проверяет, поддерживает ли модель function calling
 */
export function modelSupportsFunctionCalling(modelName: string, provider: 'ollama' | 'lmstudio'): boolean {
  if (!modelName) {
    return false;
  }

  const lowerModelName = modelName.toLowerCase();
  
  // LM Studio обычно поддерживает function calling для OpenAI-совместимых моделей
  if (provider === 'lmstudio') {
    // Большинство моделей в LM Studio поддерживают function calling
    return true;
  }

  // Для Ollama проверяем по списку
  return MODELS_WITH_FUNCTION_CALLING.some(supportedModel => 
    lowerModelName.includes(supportedModel.toLowerCase())
  );
}

/**
 * Получает сообщение о поддержке function calling для модели
 */
export function getFunctionCallingSupportMessage(
  modelName: string, 
  provider: 'ollama' | 'lmstudio'
): { supports: boolean; message: string } {
  const supports = modelSupportsFunctionCalling(modelName, provider);
  
  if (supports) {
    return {
      supports: true,
      message: `Модель "${modelName}" поддерживает автоматическое создание файлов через function calling.`
    };
  }

  return {
    supports: false,
    message: `Модель "${modelName}" может не поддерживать автоматическое создание файлов через function calling. Система будет использовать альтернативный метод (парсинг ответов), который менее надежен.`
  };
}
