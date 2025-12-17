import { IDESettings } from '../types';
import { logger } from './logger';

const defaultSettings: IDESettings = {
  theme: 'light',
  fontSize: 14,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  aiProvider: 'ollama',
  ollamaEndpoint: 'http://localhost:11434',
  lmStudioEndpoint: 'http://localhost:1234',
  selectedModel: '',
  autoSave: true,
  autoSaveDelay: 3000,
  inlineCompletions: true,
  inlineCompletionsDelay: 500,
  streamingResponses: true
};

/**
 * Validates and sanitizes settings loaded from localStorage
 * Returns valid settings with defaults for invalid/missing fields
 */
export function validateSettings(settings: any): IDESettings {
  if (!settings || typeof settings !== 'object') {
    logger.warn('Invalid settings object, using defaults');
    return defaultSettings;
  }

  const validated: IDESettings = { ...defaultSettings };

  // Validate theme
  if (settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'auto') {
    validated.theme = settings.theme;
  }

  // Validate fontSize
  if (typeof settings.fontSize === 'number' && settings.fontSize >= 8 && settings.fontSize <= 72) {
    validated.fontSize = settings.fontSize;
  }

  // Validate fontFamily
  if (typeof settings.fontFamily === 'string' && settings.fontFamily.length > 0) {
    validated.fontFamily = settings.fontFamily;
  }

  // Validate tabSize
  if (typeof settings.tabSize === 'number' && settings.tabSize >= 1 && settings.tabSize <= 8) {
    validated.tabSize = settings.tabSize;
  }

  // Validate boolean fields
  if (typeof settings.wordWrap === 'boolean') {
    validated.wordWrap = settings.wordWrap;
  }
  if (typeof settings.minimap === 'boolean') {
    validated.minimap = settings.minimap;
  }
  if (typeof settings.autoSave === 'boolean') {
    validated.autoSave = settings.autoSave;
  }
  if (typeof settings.inlineCompletions === 'boolean') {
    validated.inlineCompletions = settings.inlineCompletions;
  }
  if (typeof settings.streamingResponses === 'boolean') {
    validated.streamingResponses = settings.streamingResponses;
  }

  // Validate AI provider
  if (settings.aiProvider === 'ollama' || settings.aiProvider === 'lmstudio') {
    validated.aiProvider = settings.aiProvider;
  }

  // Validate endpoints (basic URL validation)
  if (typeof settings.ollamaEndpoint === 'string' && settings.ollamaEndpoint.length > 0) {
    try {
      new URL(settings.ollamaEndpoint);
      validated.ollamaEndpoint = settings.ollamaEndpoint;
    } catch {
      logger.warn('Invalid ollamaEndpoint, using default');
    }
  }

  if (typeof settings.lmStudioEndpoint === 'string' && settings.lmStudioEndpoint.length > 0) {
    try {
      new URL(settings.lmStudioEndpoint);
      validated.lmStudioEndpoint = settings.lmStudioEndpoint;
    } catch {
      logger.warn('Invalid lmStudioEndpoint, using default');
    }
  }

  // Validate selectedModel
  if (typeof settings.selectedModel === 'string') {
    validated.selectedModel = settings.selectedModel;
  }

  // Validate autoSaveDelay
  if (typeof settings.autoSaveDelay === 'number' && settings.autoSaveDelay >= 1000 && settings.autoSaveDelay <= 60000) {
    validated.autoSaveDelay = settings.autoSaveDelay;
  }

  // Validate inlineCompletionsDelay
  if (typeof settings.inlineCompletionsDelay === 'number' && settings.inlineCompletionsDelay >= 100 && settings.inlineCompletionsDelay <= 5000) {
    validated.inlineCompletionsDelay = settings.inlineCompletionsDelay;
  }

  // Validate githubToken (optional field)
  if (typeof settings.githubToken === 'string') {
    validated.githubToken = settings.githubToken;
  }

  return validated;
}

/**
 * Loads and validates settings from localStorage
 */
export function loadSettingsFromStorage(): IDESettings {
  try {
    const savedSettings = localStorage.getItem('ide-settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      const validated = validateSettings(parsed);
      logger.debug('Settings loaded and validated from localStorage');
      return validated;
    }
  } catch (error) {
    logger.error('Failed to load settings from localStorage:', error);
  }
  return defaultSettings;
}
