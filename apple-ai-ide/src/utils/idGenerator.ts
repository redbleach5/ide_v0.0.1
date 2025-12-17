/**
 * Утилита для генерации уникальных ID
 * Использует crypto.randomUUID() если доступно, иначе fallback
 */

/**
 * Генерирует уникальный ID используя crypto.randomUUID() если доступно
 * Иначе использует fallback с timestamp и случайными символами
 */
export function generateId(prefix?: string): string {
  let id: string;
  
  // Используем crypto.randomUUID() если доступно (современные браузеры и Node.js)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    id = crypto.randomUUID();
  } else {
    // Fallback для старых окружений
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    id = `${timestamp}-${random}`;
  }
  
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Генерирует ID для конкретных типов сущностей
 */
export const generateIds = {
  tab: () => generateId('tab'),
  bookmark: () => generateId('bookmark'),
  breakpoint: () => generateId('bp'),
  watch: () => generateId('watch'),
  snippet: () => generateId('snippet'),
  toolCall: () => generateId('call'),
  streamingMessage: () => generateId('streaming'),
  userSnippet: () => generateId('user'),
};
