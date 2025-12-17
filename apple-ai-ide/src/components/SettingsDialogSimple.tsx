import React, { useState } from 'react';
import { XIcon, SettingsIcon } from './Icons';
import { Github, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { IDESettings } from '../types';
import { aiService } from '../services/aiService';
import { githubService } from '../services/githubService';
import { logger } from '../utils/logger';

interface SettingsDialogProps {
  settings: IDESettings;
  onSettingsChange: (settings: IDESettings) => void;
  onClose: () => void;
}

export const SettingsDialogSimple: React.FC<SettingsDialogProps> = ({
  settings,
  onSettingsChange,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'editor' | 'ai'>('general');
  const [testingConnection, setTestingConnection] = useState<'ollama' | 'lmstudio' | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ [key: string]: boolean }>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testingGitHubToken, setTestingGitHubToken] = useState(false);
  const [githubTokenValid, setGithubTokenValid] = useState<boolean | null>(null);

  // Load models when switching to AI tab if we have a saved model (indicates connection was successful before)
  React.useEffect(() => {
    if (activeTab === 'ai' && settings.selectedModel && availableModels.length === 0) {
      // Try to load models if we have a selected model (connection was likely successful before)
      loadAvailableModels(settings.aiProvider);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally limited deps: only react to activeTab change, not to settings changes
  }, [activeTab]);

  const handleSettingChange = <K extends keyof IDESettings>(
    key: K,
    value: IDESettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const [connectionError, setConnectionError] = useState<{ [key: string]: { error?: string; hint?: string } }>({});

  const testConnection = async (provider: 'ollama' | 'lmstudio') => {
    setTestingConnection(provider);
    setConnectionError({ ...connectionError, [provider]: {} });
    
    try {
      // Update endpoints before testing
      if (provider === 'ollama') {
        aiService.setOllamaEndpoint(settings.ollamaEndpoint);
      } else {
        aiService.setLMStudioEndpoint(settings.lmStudioEndpoint);
      }
      
      const result = await aiService.testConnection(provider);
      setConnectionStatus({ ...connectionStatus, [provider]: result.success });
      
      if (result.success) {
        setConnectionError({ ...connectionError, [provider]: {} });
        // If connected, load available models
        loadAvailableModels(provider);
      } else {
        setConnectionError({ ...connectionError, [provider]: { error: result.error, hint: result.hint } });
        setAvailableModels([]);
      }
    } catch (error) {
      setConnectionStatus({ ...connectionStatus, [provider]: false });
      setConnectionError({ 
        ...connectionError, 
        [provider]: { 
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          hint: provider === 'ollama' 
            ? 'Убедитесь, что Ollama установлен и запущен'
            : 'Убедитесь, что LM Studio запущен и локальный сервер активен'
        } 
      });
      setAvailableModels([]);
    } finally {
      setTestingConnection(null);
    }
  };

  const loadAvailableModels = async (provider: 'ollama' | 'lmstudio') => {
    setLoadingModels(true);
    try {
      // Update endpoints before fetching models
      if (provider === 'ollama') {
        aiService.setOllamaEndpoint(settings.ollamaEndpoint);
      } else {
        aiService.setLMStudioEndpoint(settings.lmStudioEndpoint);
      }
      
      const models = await aiService.getAvailableModels(provider);
      setAvailableModels(models);
    } catch (error) {
      logger.error('Error loading models:', error);
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'Общие' },
    { id: 'editor', label: 'Редактор' },
    { id: 'ai', label: 'ИИ-помощник' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h2 style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: 'var(--text-primary)',
            margin: 0 
          }}>
            Настройки
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '4px' }}
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div 
            style={{
              width: '160px',
              backgroundColor: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border-color)',
              padding: '12px 0'
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`btn btn-ghost ${activeTab === tab.id ? 'text-primary' : 'text-secondary'}`}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '8px 16px',
                  fontSize: '13px',
                  backgroundColor: activeTab === tab.id ? 'var(--bg-active)' : 'transparent'
                }}
                onClick={() => setActiveTab(tab.id as 'general' | 'editor' | 'ai')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Settings Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            {activeTab === 'general' && (
              <div>
                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <SettingsIcon size={16} style={{ color: 'var(--accent-blue)' }} />
                  Внешний вид
                </h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    marginBottom: '8px'
                  }}>
                    Тема
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { value: 'light', label: 'Светлая' },
                      { value: 'dark', label: 'Тёмная' },
                      { value: 'auto', label: 'Авто' }
                    ].map((theme) => (
                      <button
                        key={theme.value}
                        className={`btn btn-sm ${settings.theme === theme.value ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12px' }}
                        onClick={() => handleSettingChange('theme', theme.value as any)}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>

                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  marginBottom: '16px'
                }}>
                  Управление файлами
                </h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={settings.autoSave}
                      onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                      style={{ margin: 0 }}
                    />
                    Автосохранение файлов
                  </label>
                  <p style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    marginTop: '4px',
                    marginLeft: '20px'
                  }}>
                    Автоматически сохранять файлы при их изменении
                  </p>
                </div>

                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  marginTop: '32px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Github size={16} style={{ color: 'var(--accent-blue)' }} />
                  GitHub
                </h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    marginBottom: '8px'
                  }}>
                    Personal Access Token
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      className="input"
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxx"
                      value={settings.githubToken || ''}
                      onChange={(e) => handleSettingChange('githubToken', e.target.value)}
                      style={{ fontSize: '12px', flex: 1, fontFamily: 'var(--font-mono)' }}
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        if (!settings.githubToken) {
                          setGithubTokenValid(false);
                          return;
                        }
                        setTestingGitHubToken(true);
                        try {
                          const isValid = await githubService.validateToken(settings.githubToken);
                          setGithubTokenValid(isValid);
                          if (isValid) {
                            githubService.setToken(settings.githubToken);
                          }
                        } catch (error) {
                          setGithubTokenValid(false);
                        } finally {
                          setTestingGitHubToken(false);
                        }
                      }}
                      disabled={testingGitHubToken || !settings.githubToken}
                      style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                      {testingGitHubToken ? '...' : 'Проверить'}
                    </button>
                  </div>
                  {githubTokenValid === true && (
                    <p style={{ 
                      fontSize: '11px', 
                      color: 'var(--accent-green)', 
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <CheckCircle size={12} />
                      Токен действителен
                    </p>
                  )}
                  {githubTokenValid === false && (
                    <p style={{ 
                      fontSize: '11px', 
                      color: 'var(--accent-red)', 
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertCircle size={12} />
                      Неверный токен
                    </p>
                  )}
                  <p style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    marginTop: '8px',
                    lineHeight: '1.4'
                  }}>
                    Токен используется для доступа к GitHub API. 
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--accent-blue)',
                        textDecoration: 'none',
                        marginLeft: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      Создать токен
                      <ExternalLink size={10} />
                    </a>
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'editor' && (
              <div>
                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  marginBottom: '16px'
                }}>
                  Текстовый редактор
                </h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    marginBottom: '8px'
                  }}>
                    Размер шрифта: {settings.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="20"
                    value={settings.fontSize}
                    onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
                    style={{ width: '200px' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    marginBottom: '8px'
                  }}>
                    Размер табуляции
                  </label>
                  <input
                    className="input"
                    type="number"
                    min="2"
                    max="8"
                    value={settings.tabSize}
                    onChange={(e) => handleSettingChange('tabSize', parseInt(e.target.value) || 2)}
                    style={{ fontSize: '12px', width: '80px' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={settings.wordWrap}
                      onChange={(e) => handleSettingChange('wordWrap', e.target.checked)}
                      style={{ margin: 0 }}
                    />
                    Перенос строк
                  </label>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={settings.inlineCompletions}
                      onChange={(e) => handleSettingChange('inlineCompletions', e.target.checked)}
                      style={{ margin: 0 }}
                    />
                    AI автодополнение (Inline Completions)
                  </label>
                  <p style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    marginTop: '4px',
                    marginLeft: '20px'
                  }}>
                    AI предлагает завершения кода в реальном времени
                  </p>
                </div>

                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  marginTop: '32px',
                  marginBottom: '16px'
                }}>
                  Форматирование и Линтинг
                </h3>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={settings.formatOnSave ?? false}
                      onChange={(e) => handleSettingChange('formatOnSave', e.target.checked)}
                      style={{ margin: 0 }}
                    />
                    Форматировать при сохранении
                  </label>
                  <p style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    marginTop: '4px',
                    marginLeft: '20px'
                  }}>
                    Автоматически форматировать код при сохранении файла
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={settings.lintOnSave ?? true}
                      onChange={(e) => handleSettingChange('lintOnSave', e.target.checked)}
                      style={{ margin: 0 }}
                    />
                    Автоисправление при сохранении
                  </label>
                  <p style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    marginTop: '4px',
                    marginLeft: '20px'
                  }}>
                    Автоматически исправлять проблемы кода при сохранении
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div>
                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  marginBottom: '16px'
                }}>
                  Провайдер ИИ
                </h3>
                
                {/* Info panel with tips */}
                <div style={{ 
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '20px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ fontSize: '11px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      💡 Рекомендации:
                    </div>
                    {settings.aiProvider === 'ollama' ? (
                      <div>
                        • <strong>Ollama</strong> — рекомендуемый вариант, быстрее на 34% чем LM Studio<br/>
                        • Установите с <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>ollama.com</a><br/>
                        • Установите модель: <code style={{ fontSize: '10px', backgroundColor: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: '3px' }}>ollama pull deepseek-coder</code><br/>
                        • Ollama автоматически использует GPU при наличии
                      </div>
                    ) : (
                      <div>
                        • <strong>LM Studio</strong> — альтернативный вариант с GUI<br/>
                        • Установите с <a href="https://lmstudio.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>lmstudio.ai</a><br/>
                        • Запустите LM Studio и включите локальный сервер<br/>
                        • Загрузите нужную модель через интерфейс
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={settings.streamingResponses}
                      onChange={(e) => handleSettingChange('streamingResponses', e.target.checked)}
                      style={{ margin: 0 }}
                    />
                    Потоковые ответы (Streaming)
                  </label>
                  <p style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    marginTop: '4px',
                    marginLeft: '20px'
                  }}>
                    Ответы AI появляются постепенно, по мере генерации
                  </p>
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    marginBottom: '8px'
                  }}>
                    Провайдер ИИ
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { value: 'ollama', label: 'Ollama' },
                      { value: 'lmstudio', label: 'LM Studio' }
                    ].map((provider) => (
                      <button
                        key={provider.value}
                        className={`btn btn-sm ${settings.aiProvider === provider.value ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12px' }}
                        onClick={() => handleSettingChange('aiProvider', provider.value as 'ollama' | 'lmstudio')}
                      >
                        {provider.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    marginBottom: '8px'
                  }}>
                    {settings.aiProvider === 'ollama' ? 'Ollama' : 'LM Studio'} Endpoint
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="input"
                      type="text"
                      value={settings.aiProvider === 'ollama' ? settings.ollamaEndpoint : settings.lmStudioEndpoint}
                      onChange={(e) => {
                        if (settings.aiProvider === 'ollama') {
                          handleSettingChange('ollamaEndpoint', e.target.value);
                        } else {
                          handleSettingChange('lmStudioEndpoint', e.target.value);
                        }
                      }}
                      style={{ fontSize: '12px', flex: 1 }}
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => testConnection(settings.aiProvider)}
                      disabled={testingConnection === settings.aiProvider}
                      style={{ fontSize: '12px' }}
                    >
                      {testingConnection === settings.aiProvider ? 'Проверка...' : 'Проверить'}
                    </button>
                  </div>
                  
                  {connectionStatus[settings.aiProvider] !== undefined && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ 
                        fontSize: '11px', 
                        color: connectionStatus[settings.aiProvider] ? 'var(--accent-green)' : 'var(--accent-red)', 
                        marginBottom: connectionStatus[settings.aiProvider] ? '0' : '4px',
                        fontWeight: '500'
                      }}>
                        {connectionStatus[settings.aiProvider] ? '✓ Подключение успешно' : '✗ Подключение не удалось'}
                      </p>
                      {!connectionStatus[settings.aiProvider] && connectionError[settings.aiProvider]?.hint && (
                        <div style={{ 
                          fontSize: '10px', 
                          color: 'var(--text-secondary)',
                          backgroundColor: 'var(--bg-tertiary)',
                          padding: '8px',
                          borderRadius: 'var(--radius-sm)',
                          marginTop: '4px',
                          lineHeight: '1.4'
                        }}>
                          <div style={{ fontWeight: '500', marginBottom: '4px' }}>💡 Подсказка:</div>
                          <div>{connectionError[settings.aiProvider].hint}</div>
                          {settings.aiProvider === 'ollama' && (
                            <div style={{ marginTop: '6px', fontSize: '9px', opacity: '0.8' }}>
                              📥 Скачать: <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>ollama.com</a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    marginBottom: '8px'
                  }}>
                    Выбранная модель
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexDirection: 'column' }}>
                    {availableModels.length > 0 ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                        <select
                          className="input"
                          value={settings.selectedModel}
                          onChange={(e) => {
                            handleSettingChange('selectedModel', e.target.value);
                          }}
                          style={{ fontSize: '12px', flex: 1 }}
                          disabled={loadingModels}
                        >
                          <option value="">-- Выберите модель --</option>
                          {availableModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                        {connectionStatus[settings.aiProvider] && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => loadAvailableModels(settings.aiProvider)}
                            disabled={loadingModels}
                            style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                            title="Обновить список моделей"
                          >
                            {loadingModels ? 'Загрузка...' : 'Обновить'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <input
                        className="input"
                        type="text"
                        value={settings.selectedModel}
                        onChange={(e) => {
                          handleSettingChange('selectedModel', e.target.value);
                        }}
                        placeholder="Введите название модели вручную"
                        style={{ fontSize: '12px', width: '100%' }}
                      />
                    )}
                  </div>
                  {availableModels.length === 0 && connectionStatus[settings.aiProvider] && !loadingModels && (
                    <p style={{ 
                      fontSize: '11px', 
                      color: 'var(--text-secondary)', 
                      marginTop: '4px' 
                    }}>
                      Модели не найдены. Проверьте, что {settings.aiProvider === 'ollama' ? 'Ollama' : 'LM Studio'} запущен и модели загружены.
                    </p>
                  )}
                  {!connectionStatus[settings.aiProvider] && (
                    <p style={{ 
                      fontSize: '11px', 
                      color: 'var(--text-secondary)', 
                      marginTop: '4px' 
                    }}>
                      Сначала проверьте подключение к {settings.aiProvider === 'ollama' ? 'Ollama' : 'LM Studio'}
                    </p>
                  )}
                  {availableModels.length > 0 && (
                    <p style={{ 
                      fontSize: '11px', 
                      color: 'var(--accent-green)', 
                      marginTop: '4px' 
                    }}>
                      Найдено моделей: {availableModels.length}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};