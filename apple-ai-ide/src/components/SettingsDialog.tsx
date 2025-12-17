import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Monitor, Moon, Sun, Type, Cpu, Zap, Globe, Save } from 'lucide-react';
import { IDESettings } from '../types';
import { aiService } from '../services/aiService';
import { logger } from '../utils/logger';

interface SettingsDialogProps {
  settings: IDESettings;
  onSettingsChange: (settings: IDESettings) => void;
  onClose: () => void;
}

interface SettingsSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, icon: Icon, children }) => {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <Icon size={16} style={{ color: 'var(--accent-blue)' }} />
        <h3 style={{ 
          fontSize: '14px', 
          fontWeight: '600', 
          color: 'var(--text-primary)',
          margin: 0
        }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
};

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  settings,
  onSettingsChange,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'editor' | 'ai'>('general');
  const [testingConnection, setTestingConnection] = useState<'ollama' | 'lmstudio' | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ [key: string]: boolean }>({});
  const [connectionError, setConnectionError] = useState<{ [key: string]: { error?: string; hint?: string } }>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const handleSettingChange = <K extends keyof IDESettings>(
    key: K,
    value: IDESettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

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
    { id: 'general', label: 'Общие', icon: Monitor },
    { id: 'editor', label: 'Редактор', icon: Type },
    { id: 'ai', label: 'ИИ-помощник', icon: Zap }
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
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
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
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
              <X size={16} />
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
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    className={`btn btn-ghost ${activeTab === tab.id ? 'text-primary' : 'text-secondary'}`}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '8px 16px',
                      gap: '8px',
                      fontSize: '13px',
                      backgroundColor: activeTab === tab.id ? 'var(--bg-active)' : 'transparent'
                    }}
                    onClick={() => setActiveTab(tab.id as 'general' | 'editor' | 'ai')}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Settings Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {activeTab === 'general' && (
                <>
                  <SettingsSection title="Внешний вид" icon={Monitor}>
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
                          { value: 'light', label: 'Светлая', icon: Sun },
                          { value: 'dark', label: 'Тёмная', icon: Moon },
                          { value: 'auto', label: 'Авто', icon: Monitor }
                        ].map((theme) => {
                          const Icon = theme.icon;
                          return (
                            <button
                              key={theme.value}
                              className={`btn btn-sm ${settings.theme === theme.value ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                fontSize: '12px'
                              }}
                              onClick={() => handleSettingChange('theme', theme.value as 'light' | 'dark' | 'auto')}
                            >
                              <Icon size={12} />
                              {theme.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </SettingsSection>

                  <SettingsSection title="Управление файлами" icon={Save}>
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

                    {settings.autoSave && (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '12px', 
                          fontWeight: '500', 
                          color: 'var(--text-primary)',
                          marginBottom: '8px'
                        }}>
                          Задержка автосохранения (мс)
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={settings.autoSaveDelay}
                          onChange={(e) => handleSettingChange('autoSaveDelay', parseInt(e.target.value) || 3000)}
                          style={{ fontSize: '12px', width: '120px' }}
                        />
                      </div>
                    )}
                  </SettingsSection>
                </>
              )}

              {activeTab === 'editor' && (
                <>
                  <SettingsSection title="Текстовый редактор" icon={Type}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '12px', 
                        fontWeight: '500', 
                        color: 'var(--text-primary)',
                        marginBottom: '8px'
                      }}>
                        Размер шрифта
                      </label>
                      <input
                        className="input"
                        type="range"
                        min="10"
                        max="20"
                        value={settings.fontSize}
                        onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
                        style={{ width: '200px' }}
                      />
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '12px', 
                        color: 'var(--text-secondary)' 
                      }}>
                        {settings.fontSize}px
                      </span>
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
                          checked={settings.minimap}
                          onChange={(e) => handleSettingChange('minimap', e.target.checked)}
                          style={{ margin: 0 }}
                        />
                        Показать мини-карту
                      </label>
                    </div>
                  </SettingsSection>
                </>
              )}

              {activeTab === 'ai' && (
                <>
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
                  
                  <SettingsSection title="Провайдер ИИ" icon={Cpu}>
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
                  </SettingsSection>

                  <SettingsSection title="Выбор модели" icon={Globe}>
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
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                          className="input"
                          value={settings.selectedModel}
                          onChange={(e) => handleSettingChange('selectedModel', e.target.value)}
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
                  </SettingsSection>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};