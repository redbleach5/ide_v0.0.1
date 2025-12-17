import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Send, 
  MessageSquare, 
  Code, 
  Search, 
  Plus,
  Bot,
  User,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  XCircle as CancelIcon
} from 'lucide-react';
import { AIChatSession, Tab, IDESettings, AIMessage } from '../types';
import { aiService } from '../services/aiService';
import { logger } from '../utils/logger';
import { MarkdownRenderer } from './MarkdownRenderer';
import { parseCodeFromResponse, isCodeGenerationRequest, responseContainsCode } from '../utils/codeParser';
import { executeToolCall, AIToolCall } from '../services/aiFunctionCalling';
import { getFunctionCallingSupportMessage } from '../utils/modelCapabilities';
import { agentService, AgentTask } from '../services/agentService';
import { generateIds } from '../utils/idGenerator';
import { inlineCompletionService } from '../services/inlineCompletionService';

interface AIPanelProps {
  sessions: AIChatSession[];
  activeSession: AIChatSession | null;
  onSessionSelect: (session: AIChatSession) => void;
  onNewSession: () => void;
  onClose: () => void;
  onSessionUpdate: (sessionId: string, messages: AIMessage[]) => void;
  projectContext: {
    files: Tab[];
    projectPath?: string;
  };
  settings: IDESettings;
  onFileCreate?: (filePath: string, content: string) => Promise<void>;
  onFileOpen?: (filePath: string) => Promise<void>;
}

export const AIPanel: React.FC<AIPanelProps> = ({
  sessions,
  activeSession,
  onSessionSelect,
  onNewSession,
  onClose,
  onSessionUpdate,
  projectContext,
  settings,
  onFileCreate,
  onFileOpen
}) => {
  // Use ref to track current sessions for streaming updates
  const sessionsRef = React.useRef(sessions);
  React.useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeAction, setActiveAction] = useState<'chat' | 'code' | 'analysis'>('chat');
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showFunctionCallingWarning, setShowFunctionCallingWarning] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<(() => void) | null>(null);
  const [fileOperations, setFileOperations] = useState<Array<{
    filePath: string;
    operation: 'creating' | 'created' | 'error';
    error?: string;
  }>>([]);
  const [agentMode, setAgentMode] = useState(false);
  const [agentTask, setAgentTask] = useState<AgentTask | null>(null);

  // Вспомогательная функция для проверки, нужно ли создавать файлы
  const shouldCreateFilesFromResponse = (action: 'chat' | 'code' | 'analysis', message: string, response?: string): boolean => {
    // Всегда создаем файлы в режиме code
    if (action === 'code') {
      return true;
    }
    
    // В режиме chat создаем файлы, если:
    // 1. Запрос явно просит создать код
    // 2. ИЛИ ответ содержит код (блоки кода)
    if (action === 'chat') {
      const isExplicitRequest = isCodeGenerationRequest(message);
      const hasCodeInResponse = response ? responseContainsCode(response) : false;
      
      logger.debug('Checking if should create files', {
        action,
        isExplicitRequest,
        hasCodeInResponse,
        message: message.substring(0, 50)
      });
      
      return isExplicitRequest || hasCodeInResponse;
    }
    
    return false;
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages]);

  // Очищаем кеши при смене сессии для чистого контекста
  useEffect(() => {
    if (activeSession) {
      // Очищаем inline completion кеш при смене сессии
      inlineCompletionService.clearCache();
      logger.debug('Cleared inline completion cache for session switch', { sessionId: activeSession.id });
    }
  }, [activeSession?.id]);

  // Check connection when panel opens
  useEffect(() => {
    const checkConnection = async () => {
      aiService.setOllamaEndpoint(settings.ollamaEndpoint);
      aiService.setLMStudioEndpoint(settings.lmStudioEndpoint);
      const result = await aiService.testConnection(settings.aiProvider);
      setIsConnected(result.success);
      setConnectionChecked(true);
    };
    checkConnection();
  }, [settings.aiProvider, settings.ollamaEndpoint, settings.lmStudioEndpoint]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !activeSession) return;

    // Check connection first
    if (connectionChecked && !isConnected) {
      const providerName = settings.aiProvider === 'ollama' ? 'Ollama' : 'LM Studio';
      const hint = settings.aiProvider === 'ollama'
        ? 'Убедитесь, что Ollama запущен. Установите с https://ollama.com если еще не установлен.'
        : 'Убедитесь, что LM Studio запущен и локальный сервер активен.';
      
      const errorMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: `❌ **Подключение к ${providerName} не установлено**\n\n${hint}\n\nОткройте настройки (⚙️) и нажмите "Проверить" для проверки подключения.`,
        timestamp: new Date(),
        type: activeAction
      };
      onSessionUpdate(activeSession.id, [...activeSession.messages, errorMessage]);
      return;
    }

    // Check if model is selected
    if (!settings.selectedModel) {
      const errorMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: '❌ **Модель не выбрана**\n\nПожалуйста, выберите модель в настройках перед использованием чата:\n1. Откройте настройки (⚙️)\n2. Перейдите на вкладку "ИИ-помощник"\n3. Выберите модель из списка или введите название вручную\n4. Нажмите "Проверить" для проверки подключения',
        timestamp: new Date(),
        type: activeAction
      };
      onSessionUpdate(activeSession.id, [...activeSession.messages, errorMessage]);
      return;
    }

    const userMessage: AIMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user' as const,
      content: inputValue,
      timestamp: new Date(),
      type: activeAction
    };

    const messageContent = inputValue;
    
    // Функция для выполнения запроса
    const sendMessageInternal = async () => {
      if (!activeSession) return;
      
      // Add user message using callback (immutable update)
      const updatedMessages = [...activeSession.messages, userMessage];
      onSessionUpdate(activeSession.id, updatedMessages);
      setInputValue('');
      setIsTyping(true);

      // ВАЖНО: Используем CodeAct-агент как единое ядро для всех запросов
      // Определяем режим работы
      const agentModeToUse = agentMode ? 'agent' : 
                            (activeAction === 'code' ? 'agent' : 'auto');
      
      const shouldUseStreaming = settings.streamingResponses && activeAction !== 'code';

      try {
        const controller = new AbortController();
        setAbortController(controller);

        aiService.setOllamaEndpoint(settings.ollamaEndpoint);
        aiService.setLMStudioEndpoint(settings.lmStudioEndpoint);
        aiService.setCurrentModel(settings.selectedModel);

        // ВАЖНО: Используем только файлы из текущего проекта
        const filesWithContent = projectContext.files
          .filter(file => {
            if (!projectContext.projectPath) return true;
            const filePath = file.path.replace(/\\/g, '/');
            const projectPath = projectContext.projectPath.replace(/\\/g, '/');
            return filePath.startsWith(projectPath);
          })
          .map(file => ({
            path: file.path,
            content: file.content || ''
          }));

        // Используем универсальный метод агента
        let agentResponse: AIMessage;
        
        if (shouldUseStreaming) {
          // Streaming режим с использованием агента
          const streamingMessageId = generateIds.streamingMessage();
          const streamingMessage: AIMessage = {
            id: streamingMessageId,
            role: 'assistant' as const,
            content: '',
            timestamp: new Date(),
            type: activeAction
          };
          
          const cleanedMessages = updatedMessages.filter(msg => 
            !(msg.id.startsWith('streaming-') && msg.content === '' && msg.role === 'assistant')
          );
          
          const messagesWithPlaceholder = [...cleanedMessages, streamingMessage];
          onSessionUpdate(activeSession.id, messagesWithPlaceholder);
          
          let accumulatedContent = '';
          let lastUpdateTime = 0;
          const UPDATE_THROTTLE = 50;
          
          const result = await agentService.executeRequest(
            messageContent,
            {
              files: filesWithContent,
              projectPath: projectContext.projectPath
            },
            settings.aiProvider,
            {
              mode: agentModeToUse as 'auto' | 'fast' | 'agent',
              onStreamChunk: (chunk: string) => {
                accumulatedContent += chunk;
                const now = Date.now();
                
                if (now - lastUpdateTime < UPDATE_THROTTLE && chunk.length < 10) {
                  return;
                }
                lastUpdateTime = now;
                
                const currentSession = sessions.find(s => s.id === activeSession.id);
                if (currentSession) {
                  const messageIndex = currentSession.messages.findIndex(msg => 
                    msg.id === streamingMessageId || (msg.id.startsWith('streaming-') && msg.role === 'assistant')
                  );
                  
                  if (messageIndex !== -1) {
                    const updatedMessagesList = currentSession.messages.map((msg, idx) => 
                      idx === messageIndex 
                        ? { ...msg, id: streamingMessageId, content: accumulatedContent }
                        : msg
                    );
                    
                    const cleanedMessages = updatedMessagesList.filter((msg, idx) => 
                      !(msg.id.startsWith('streaming-') && msg.content === '' && idx !== messageIndex)
                    );
                    
                    onSessionUpdate(activeSession.id, cleanedMessages);
                  }
                }
              },
              onToolCall: async (toolCall: AIToolCall) => {
                if (toolCall.function.name === 'create_file' || toolCall.function.name === 'edit_file') {
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const filePath = args.file_path;
                    
                    setFileOperations(prev => [...prev, { 
                      filePath, 
                      operation: 'creating' 
                    }]);
                    
                    const result = await executeToolCall(
                      toolCall,
                      projectContext.projectPath,
                      async (path: string, content: string) => {
                        setFileOperations(prev => prev.map(op => 
                          op.filePath === path ? { ...op, operation: 'created' } : op
                        ));
                        
                        if (onFileCreate) {
                          await onFileCreate(path, content);
                        }
                      },
                      onFileOpen
                    );
                    
                    return result.result;
                  } catch (error) {
                    const args = JSON.parse(toolCall.function.arguments);
                    const filePath = args.file_path;
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    
                    setFileOperations(prev => prev.map(op => 
                      op.filePath === filePath ? { ...op, operation: 'error', error: errorMessage } : op
                    ));
                    
                    throw error;
                  }
                } else {
                  const result = await executeToolCall(
                    toolCall,
                    projectContext.projectPath,
                    onFileCreate,
                    onFileOpen
                  );
                  return result.result;
                }
              },
              abortSignal: controller.signal,
              useStreaming: true,
              onProgress: (task) => {
                if (task.status === 'in_progress') {
                  setAgentTask(task);
                }
              }
            }
          );

          // Финальное обновление
          const finalMessages = updatedMessages.map(msg => 
            msg.id === streamingMessageId 
              ? { ...msg, content: accumulatedContent }
              : msg
          ).filter(msg => 
            !(msg.id.startsWith('streaming-') && msg.content === '' && msg.role === 'assistant')
          );
          
          if (!finalMessages.some(msg => msg.id === streamingMessageId)) {
            agentResponse = {
              id: streamingMessageId,
              role: 'assistant',
              content: accumulatedContent,
              timestamp: new Date(),
              type: activeAction,
              tool_calls: result.tool_calls
            };
            onSessionUpdate(activeSession.id, [...updatedMessages, agentResponse]);
          } else {
            onSessionUpdate(activeSession.id, finalMessages);
          }
        } else {
          // Non-streaming режим
          const result = await agentService.executeRequest(
            messageContent,
            {
              files: filesWithContent,
              projectPath: projectContext.projectPath
            },
            settings.aiProvider,
            {
              mode: agentModeToUse as 'auto' | 'fast' | 'agent',
              onToolCall: async (toolCall: AIToolCall) => {
                if (toolCall.function.name === 'create_file' || toolCall.function.name === 'edit_file') {
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const filePath = args.file_path;
                    
                    setFileOperations(prev => [...prev, { 
                      filePath, 
                      operation: 'creating' 
                    }]);
                    
                    const result = await executeToolCall(
                      toolCall,
                      projectContext.projectPath,
                      async (path: string, content: string) => {
                        setFileOperations(prev => prev.map(op => 
                          op.filePath === path ? { ...op, operation: 'created' } : op
                        ));
                        
                        if (onFileCreate) {
                          await onFileCreate(path, content);
                        }
                      },
                      onFileOpen
                    );
                    
                    return result.result;
                  } catch (error) {
                    const args = JSON.parse(toolCall.function.arguments);
                    const filePath = args.file_path;
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    
                    setFileOperations(prev => prev.map(op => 
                      op.filePath === filePath ? { ...op, operation: 'error', error: errorMessage } : op
                    ));
                    
                    throw error;
                  }
                } else {
                  const result = await executeToolCall(
                    toolCall,
                    projectContext.projectPath,
                    onFileCreate,
                    onFileOpen
                  );
                  return result.result;
                }
              },
              abortSignal: controller.signal,
              onProgress: (task) => {
                setAgentTask(task);
              }
            }
          );

          // Формируем ответ
          if (result.task && result.task.status === 'completed') {
            agentResponse = {
              id: Date.now().toString(),
              role: 'assistant',
              content: result.content,
              timestamp: new Date(),
              type: activeAction,
              tool_calls: result.tool_calls
            };
          } else {
            agentResponse = {
              id: Date.now().toString(),
              role: 'assistant',
              content: result.content,
              timestamp: new Date(),
              type: activeAction,
              tool_calls: result.tool_calls
            };
          }

          onSessionUpdate(activeSession.id, [...updatedMessages, agentResponse]);
        }

        // Очищаем индикацию операций через 3 секунды
        if (fileOperations.length > 0) {
          setTimeout(() => {
            setFileOperations([]);
          }, 3000);
        }

        setAgentTask(null);
        setIsTyping(false);
        return;

      } catch (error) {
        logger.error('Agent request failed:', error);
        const errorMessage: AIMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `❌ **Ошибка**\n\n${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
          timestamp: new Date(),
          type: activeAction
        };
        onSessionUpdate(activeSession.id, [...updatedMessages, errorMessage]);
        setAgentTask(null);
        setIsTyping(false);
        return;
      }
    };
    
    // Выполняем запрос напрямую через универсального агента
    sendMessageInternal();
  };

  const handleCancelRequest = () => {
    if (abortController) {
      abortController.abort();
      setIsTyping(false);
      setAbortController(null);
      logger.debug('AI request cancelled by user');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    {
      id: 'chat',
      label: 'Чат',
      icon: MessageSquare,
      description: 'Задавайте вопросы и получайте помощь'
    },
    {
      id: 'code',
      label: 'Генерация',
      icon: Code,
      description: 'Генерировать фрагменты кода'
    },
    {
      id: 'analyze',
      label: 'Анализ',
      icon: Search,
      description: 'Анализировать ваш проект'
    }
  ];

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 360, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{
        height: '100%',
        width: '360px',
        minWidth: '360px',
        maxWidth: '360px',
        flexShrink: 0,
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div 
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '48px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
            ИИ-помощник
          </span>
          {connectionChecked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
              {isConnected ? (
                <>
                  <CheckCircle2 size={12} style={{ color: 'var(--accent-green)' }} />
                  <span style={{ fontSize: '10px', color: 'var(--accent-green)' }}>
                    {settings.selectedModel ? 'Готов' : 'Нет модели'}
                  </span>
                </>
              ) : (
                <>
                  <XCircle size={12} style={{ color: 'var(--accent-red)' }} />
                  <span style={{ fontSize: '10px', color: 'var(--accent-red)' }}>
                    Не подключено
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        
        <button
          className="btn btn-ghost btn-sm"
          onClick={onClose}
          style={{ padding: '4px' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Quick Actions */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '4px',
          flexDirection: 'column'
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                className={`btn btn-ghost btn-sm ${activeAction === action.id ? 'text-primary' : 'text-secondary'}`}
                style={{ 
                  padding: '6px 8px',
                  fontSize: '11px',
                  backgroundColor: activeAction === action.id ? 'var(--bg-active)' : 'transparent',
                  borderRadius: 'var(--radius-sm)'
                }}
                onClick={() => setActiveAction(action.id as 'chat' | 'code' | 'analysis')}
                title={action.description}
              >
                <Icon size={12} />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
        
        {/* Agent Mode Toggle */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginTop: '8px',
          padding: '6px 8px',
          backgroundColor: agentMode ? 'var(--bg-active)' : 'transparent',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer'
        }}
        onClick={() => setAgentMode(!agentMode)}
        title="Агентский режим: AI будет планировать и выполнять задачи автономно"
        >
          <Sparkles size={14} style={{ color: agentMode ? 'var(--color-primary)' : 'var(--text-secondary)' }} />
          <span style={{ 
            fontSize: '11px', 
            color: agentMode ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: agentMode ? '500' : '400'
          }}>
            Агентский режим {agentMode ? 'включен' : 'выключен'}
          </span>
        </div>
      </div>

      {/* Sessions */}
      {sessions.length > 1 && (
        <div 
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}
        >
          <button
            className="btn btn-ghost btn-sm"
            onClick={onNewSession}
            style={{ padding: '4px' }}
          >
            <Plus size={12} />
          </button>
          
          <div style={{ flex: 1, display: 'flex', gap: '4px', overflow: 'auto' }}>
            {sessions.map((session) => (
              <button
                key={session.id}
                className={`btn btn-ghost btn-sm truncate ${activeSession?.id === session.id ? 'text-primary' : 'text-secondary'}`}
                style={{ 
                  maxWidth: '100px',
                  backgroundColor: activeSession?.id === session.id ? 'var(--bg-active)' : 'transparent'
                }}
                onClick={() => onSessionSelect(session)}
              >
                {session.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {activeSession ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeSession.messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <Bot size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
                  Готов помочь!
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                  Спросите меня о вашем коде или проекте
                </div>
                
                {/* Quick tips */}
                <div style={{ 
                  marginTop: '24px',
                  padding: '12px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'left',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ fontWeight: '500', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    💡 Быстрые подсказки:
                  </div>
                  <div style={{ lineHeight: '1.6' }}>
                    • <strong>Ctrl+K</strong> в редакторе - контекстный чат с выделенным кодом<br/>
                    • <strong>💡</strong> рядом с кодом - предложения AI для улучшения<br/>
                    • <strong>Tab</strong> - принять автодополнение AI<br/>
                    • Автодополнения работают автоматически при печати
                  </div>
                </div>
                
                {/* Connection status hint */}
                {connectionChecked && !isConnected && (
                  <div style={{ 
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '16px',
                    textAlign: 'left',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <AlertCircle size={14} style={{ color: 'var(--accent-orange)' }} />
                      <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>Требуется настройка</span>
                    </div>
                    <div style={{ lineHeight: '1.5', marginTop: '6px' }}>
                      {settings.aiProvider === 'ollama' ? (
                        <>
                          Подключение к Ollama не установлено. Установите Ollama с{' '}
                          <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>
                            ollama.com
                          </a>
                          {' '}и запустите его.
                        </>
                      ) : (
                        <>
                          Подключение к LM Studio не установлено. Запустите LM Studio и включите локальный сервер.
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {connectionChecked && isConnected && !settings.selectedModel && (
                  <div style={{ 
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '16px',
                    textAlign: 'left',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <AlertCircle size={14} style={{ color: 'var(--accent-orange)' }} />
                      <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>Выберите модель</span>
                    </div>
                    <div style={{ lineHeight: '1.5', marginTop: '6px' }}>
                      Откройте настройки (⚙️) и выберите модель для работы с ИИ-помощником.
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeSession.messages
              .filter((message, index, self) => {
                // Remove duplicates by keeping only the first occurrence of each ID
                const firstIndex = self.findIndex(m => m.id === message.id);
                // Also remove empty streaming messages if there's a non-empty one with same base ID
                if (message.id.startsWith('streaming-') && message.content === '') {
                  const hasNonEmpty = self.some(m => 
                    m.id.startsWith('streaming-') && 
                    m.content !== '' && 
                    m.role === 'assistant'
                  );
                  return !hasNonEmpty || index === firstIndex;
                }
                return index === firstIndex;
              })
              .sort((a, b) => {
                // Сортируем по timestamp для правильного порядка
                const timeA = a.timestamp?.getTime() || 0;
                const timeB = b.timestamp?.getTime() || 0;
                return timeA - timeB;
              })
              .map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: message.role === 'user' ? 'var(--accent-blue)' : 'var(--accent-purple)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {message.role === 'user' ? (
                    <User size={12} style={{ color: 'white' }} />
                  ) : (
                    <Bot size={12} style={{ color: 'white' }} />
                  )}
                </div>
                
                <div
                  style={{
                    backgroundColor: message.role === 'user' ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    maxWidth: '80%',
                    fontSize: '13px',
                    lineHeight: '1.4'
                  }}
                >
                  {message.role === 'assistant' ? (
                    message.content ? (
                      <MarkdownRenderer content={message.content} className="markdown-body" />
                    ) : (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <div className="typing-dot" style={{ width: '4px', height: '4px', backgroundColor: 'var(--text-tertiary)', borderRadius: '50%' }} />
                        <div className="typing-dot" style={{ width: '4px', height: '4px', backgroundColor: 'var(--text-tertiary)', borderRadius: '50%', animationDelay: '0.1s' }} />
                        <div className="typing-dot" style={{ width: '4px', height: '4px', backgroundColor: 'var(--text-tertiary)', borderRadius: '50%', animationDelay: '0.2s' }} />
                      </div>
                    )
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            
            {isTyping && !activeSession.messages.some(msg => msg.id.startsWith('streaming-') && msg.role === 'assistant') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', gap: '8px' }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-purple)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Bot size={12} style={{ color: 'white' }} />
                </div>
                
                <div
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <div className="typing-dot" style={{ width: '4px', height: '4px', backgroundColor: 'var(--text-tertiary)', borderRadius: '50%' }} />
                    <div className="typing-dot" style={{ width: '4px', height: '4px', backgroundColor: 'var(--text-tertiary)', borderRadius: '50%', animationDelay: '0.1s' }} />
                    <div className="typing-dot" style={{ width: '4px', height: '4px', backgroundColor: 'var(--text-tertiary)', borderRadius: '50%', animationDelay: '0.2s' }} />
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <MessageSquare size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Начните разговор
            </div>
            <button className="btn btn-primary btn-sm" onClick={onNewSession}>
              Новый чат
            </button>
          </div>
        )}
      </div>

      {/* Agent Progress */}
      {agentTask && (
        <div 
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <Sparkles size={16} style={{ color: 'var(--accent-blue)' }} />
            <div style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              flex: 1
            }}>
              Агент выполняет задачу...
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: 'var(--text-secondary)',
              padding: '2px 8px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)'
            }}>
              {agentTask.steps.filter(s => s.status === 'completed').length} / {agentTask.steps.length}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agentTask.steps.map((step, index) => (
              <div 
                key={step.id}
                style={{
                  padding: '8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '11px'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  {step.status === 'completed' && (
                    <CheckCircle2 size={12} style={{ color: 'var(--accent-green)' }} />
                  )}
                  {step.status === 'in_progress' && (
                    <div className="typing-dot" style={{ width: '8px', height: '8px', backgroundColor: 'var(--accent-blue)', borderRadius: '50%' }} />
                  )}
                  {step.status === 'failed' && (
                    <XCircle size={12} style={{ color: 'var(--accent-red)' }} />
                  )}
                  {step.status === 'pending' && (
                    <div style={{ width: '8px', height: '8px', backgroundColor: 'var(--text-tertiary)', borderRadius: '50%' }} />
                  )}
                  <span style={{ 
                    color: step.status === 'completed' ? 'var(--accent-green)' : 
                           step.status === 'failed' ? 'var(--accent-red)' : 
                           step.status === 'in_progress' ? 'var(--accent-blue)' : 
                           'var(--text-secondary)',
                    fontWeight: step.status === 'in_progress' ? '500' : '400'
                  }}>
                    Шаг {index + 1}: {step.description}
                  </span>
                </div>
                {step.error && (
                  <div style={{ 
                    marginTop: '4px', 
                    padding: '4px 8px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--accent-red)',
                    fontSize: '10px'
                  }}>
                    {step.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Operations Progress */}
      {fileOperations.length > 0 && (
        <div 
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            maxHeight: '120px',
            overflowY: 'auto'
          }}
        >
          <div style={{ 
            fontSize: '12px', 
            fontWeight: '500', 
            color: 'var(--text-secondary)',
            marginBottom: '8px'
          }}>
            Операции с файлами:
          </div>
          {fileOperations.map((op, index) => (
            <div 
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 0',
                fontSize: '11px'
              }}
            >
              {op.operation === 'creating' && (
                <>
                  <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: 'var(--accent-blue)', borderRadius: '50%' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Создание: {op.filePath.split(/[/\\]/).pop()}
                  </span>
                </>
              )}
              {op.operation === 'created' && (
                <>
                  <CheckCircle2 size={12} style={{ color: 'var(--accent-green)' }} />
                  <span style={{ color: 'var(--accent-green)' }}>
                    Создан: {op.filePath.split(/[/\\]/).pop()}
                  </span>
                </>
              )}
              {op.operation === 'error' && (
                <>
                  <XCircle size={12} style={{ color: 'var(--accent-red)' }} />
                  <span style={{ color: 'var(--accent-red)' }}>
                    Ошибка: {op.filePath.split(/[/\\]/).pop()} - {op.error}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div 
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-primary)'
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="input"
            type="text"
            placeholder={activeAction === 'code' ? 'Попросите меня сгенерировать код...' : activeAction === 'analysis' ? 'Попросите меня проанализировать...' : 'Спросите что угодно...'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{ fontSize: '13px' }}
            disabled={isTyping}
          />
          {isTyping && abortController ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCancelRequest}
              style={{ padding: '0 12px' }}
              title="Отменить запрос"
            >
              <CancelIcon size={14} />
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              style={{ padding: '0 12px' }}
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes typing {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
        .typing-dot {
          animation: typing 1.4s infinite;
        }
      `}</style>

      {/* Function Calling Warning Dialog */}
      <AnimatePresence>
        {showFunctionCallingWarning && (
          <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000
          }}
          onClick={() => {
            setShowFunctionCallingWarning(false);
            setPendingRequest(null);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            style={{
              width: '500px',
              maxWidth: '90vw',
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
                gap: '12px'
              }}
            >
              <AlertCircle size={20} style={{ color: 'var(--accent-orange)' }} />
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: 'var(--text-primary)',
                margin: 0 
              }}>
                Предупреждение о поддержке модели
              </h3>
            </div>

            {/* Content */}
            <div style={{ padding: '20px' }}>
              <p style={{ 
                fontSize: '14px', 
                color: 'var(--text-secondary)',
                marginBottom: '16px',
                lineHeight: '1.5'
              }}>
                {getFunctionCallingSupportMessage(settings.selectedModel, settings.aiProvider).message}
              </p>
              
              <div style={{
                backgroundColor: 'var(--bg-tertiary)',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px'
              }}>
                <p style={{ 
                  fontSize: '13px', 
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  <strong>Что это значит?</strong><br />
                  Система попытается автоматически создать файлы, парся ответ AI. 
                  Это может работать менее надежно, чем прямое создание файлов через function calling.
                </p>
              </div>

              <p style={{ 
                fontSize: '13px', 
                color: 'var(--text-tertiary)',
                margin: 0
              }}>
                Хотите продолжить?
              </p>
            </div>

            {/* Actions */}
            <div 
              style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end'
              }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowFunctionCallingWarning(false);
                  setPendingRequest(null);
                }}
                style={{ fontSize: '13px' }}
              >
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowFunctionCallingWarning(false);
                  if (pendingRequest) {
                    pendingRequest();
                    setPendingRequest(null);
                  }
                }}
                style={{ fontSize: '13px' }}
              >
                Продолжить
              </button>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};