import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  X, 
  Sparkles, 
  Lightbulb, 
  RefreshCw, 
  Bug, 
  Code,
  Copy,
  Check
} from 'lucide-react';
import { aiService } from '../services/aiService';
import { logger } from '../utils/logger';
import { IDESettings, Tab } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface InlineChatProps {
  selectedCode: string;
  language: string;
  filePath?: string;
  position: { lineNumber: number; column: number };
  onClose: () => void;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  settings: IDESettings;
  projectContext?: {
    files?: Tab[];
    projectPath?: string;
  };
}

type QuickAction = 'explain' | 'refactor' | 'fix' | 'optimize' | 'custom';

export const InlineChat: React.FC<InlineChatProps> = ({
  selectedCode,
  language,
  filePath,
  position,
  onClose,
  onInsert,
  onReplace,
  settings,
  projectContext
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [response, setResponse] = useState<string>('');
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input when component mounts
    inputRef.current?.focus();
    
    // Check if there's a pre-set action from context menu
    const action = window.__inlineChatAction;
    if (action && action !== 'custom') {
      const quickAction = quickActions.find(a => a.id === action);
      if (quickAction) {
        setTimeout(() => {
          setActiveAction(action as QuickAction);
          setInputValue(quickAction.prompt);
          // Clear the action
          delete window.__inlineChatAction;
          // Auto-send after a short delay
          setTimeout(() => {
            handleSendMessage(quickAction.prompt);
          }, 300);
        }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally empty deps: this effect should run only once on mount to check for pre-set action
  }, []);

  const quickActions = [
    {
      id: 'explain' as QuickAction,
      label: 'Объяснить',
      icon: Lightbulb,
      prompt: `Объясни этот ${language} код подробно, что он делает и как работает:`
    },
    {
      id: 'refactor' as QuickAction,
      label: 'Рефакторить',
      icon: RefreshCw,
      prompt: `Отрефакторь этот ${language} код, улучшив его читаемость и структуру, сохранив функциональность:`
    },
    {
      id: 'fix' as QuickAction,
      label: 'Исправить',
      icon: Bug,
      prompt: `Найди и исправь ошибки в этом ${language} коде:`
    },
    {
      id: 'optimize' as QuickAction,
      label: 'Оптимизировать',
      icon: Code,
      prompt: `Оптимизируй этот ${language} код для улучшения производительности:`
    }
  ];

  const handleQuickAction = (action: QuickAction, prompt: string) => {
    setActiveAction(action);
    setInputValue(prompt);
    handleSendMessage(prompt);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const prompt = customPrompt || inputValue.trim();
    if (!prompt) return;

    // Check if model is selected
    if (!settings.selectedModel) {
      setResponse('❌ **Модель не выбрана**\n\nПожалуйста, выберите модель в настройках.');
      return;
    }

    setInputValue('');
    setIsTyping(true);
    setResponse('');

    // Create abort controller
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Configure AI service
      aiService.setOllamaEndpoint(settings.ollamaEndpoint);
      aiService.setLMStudioEndpoint(settings.lmStudioEndpoint);
      aiService.setCurrentModel(settings.selectedModel);

      // Build context with selected code
      const codeContext = `\`\`\`${language}\n${selectedCode}\n\`\`\``;
      const fullPrompt = `${prompt}\n\n${codeContext}`;

      // Get file context if available
      const filesWithContent = projectContext?.files?.map(file => ({
        path: file.path,
        content: file.content || ''
      })) || [];

      // Use streaming if enabled
      if (settings.streamingResponses) {
        let accumulatedContent = '';
        await aiService.chatStream(
          [
            {
              id: 'user',
              role: 'user',
              content: fullPrompt,
              timestamp: new Date(),
              type: 'code'
            }
          ],
          (chunk: string) => {
            accumulatedContent += chunk;
            setResponse(accumulatedContent);
          },
          {
            files: filesWithContent,
            projectPath: projectContext?.projectPath
          },
          settings.aiProvider,
          controller.signal
        );
      } else {
        // Non-streaming mode
        const aiResponse = await aiService.chat(
          [
            {
              id: 'user',
              role: 'user',
              content: fullPrompt,
              timestamp: new Date(),
              type: 'code'
            }
          ],
          {
            files: filesWithContent,
            projectPath: projectContext?.projectPath
          },
          settings.aiProvider,
          controller.signal
        );

        setResponse(aiResponse.content);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        logger.debug('Inline chat request cancelled');
        return;
      }

      logger.error('Error in inline chat:', error);
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setResponse(`❌ **Ошибка:** ${errorMsg}\n\nПроверьте подключение к AI и настройки.`);
    } finally {
      setIsTyping(false);
      setAbortController(null);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setIsTyping(false);
      setAbortController(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInsert = () => {
    if (response) {
      // Extract code from markdown if present
      let codeToInsert = response;
      
      // Try to extract code block
      const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        codeToInsert = codeBlockMatch[1].trim();
      } else {
        // Remove markdown formatting
        codeToInsert = codeToInsert
          .replace(/^\*\*.*?\*\*:?\s*/gm, '')
          .replace(/^#+\s*/gm, '')
          .trim();
      }

      onInsert(codeToInsert);
      onClose();
    }
  };

  const handleReplace = () => {
    if (response) {
      // Extract code from markdown if present
      let codeToReplace = response;
      
      const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        codeToReplace = codeBlockMatch[1].trim();
      } else {
        codeToReplace = codeToReplace
          .replace(/^\*\*.*?\*\*:?\s*/gm, '')
          .replace(/^#+\s*/gm, '')
          .trim();
      }

      onReplace(codeToReplace);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          maxWidth: '90%',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary)',
            borderTopLeftRadius: 'var(--radius-lg)',
            borderTopRightRadius: 'var(--radius-lg)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              AI Помощник
            </span>
            {selectedCode && (
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-tertiary)',
                marginLeft: '8px',
                padding: '2px 6px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)'
              }}>
                {selectedCode.split('\n').length} строк
              </span>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '4px' }}
            title="Закрыть (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {/* Quick Actions */}
        {!response && !isTyping && (
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}
          >
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickAction(action.id, action.prompt)}
                  style={{
                    fontSize: '11px',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Icon size={12} />
                  {action.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Selected Code Preview */}
        {selectedCode && !response && !isTyping && (
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              maxHeight: '150px',
              overflow: 'auto'
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
              Выделенный код:
            </div>
            <pre
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                margin: 0,
                padding: '8px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {selectedCode.length > 200 ? selectedCode.substring(0, 200) + '...' : selectedCode}
            </pre>
          </div>
        )}

        {/* Response */}
        {response && (
          <div
            style={{
              padding: '16px',
              flex: 1,
              overflow: 'auto',
              maxHeight: '400px'
            }}
          >
            <div style={{ marginBottom: '12px' }}>
              <MarkdownRenderer content={response} className="markdown-body" />
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)'
              }}
            >
              <button
                className="btn btn-primary btn-sm"
                onClick={handleInsert}
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                Вставить после курсора
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleReplace}
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                Заменить выделенное
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleCopy}
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                {copied ? (
                  <>
                    <Check size={12} /> Скопировано
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Копировать
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div
            style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--text-secondary)'
            }}
          >
            <div style={{ display: 'flex', gap: '4px' }}>
              <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: 'var(--text-tertiary)', borderRadius: '50%' }} />
              <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: 'var(--text-tertiary)', borderRadius: '50%', animationDelay: '0.1s' }} />
              <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: 'var(--text-tertiary)', borderRadius: '50%', animationDelay: '0.2s' }} />
            </div>
            <span style={{ fontSize: '12px' }}>AI думает...</span>
            {abortController && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleCancel}
                style={{ marginLeft: 'auto', fontSize: '11px', padding: '4px 8px' }}
              >
                Отменить
              </button>
            )}
          </div>
        )}

        {/* Input */}
        {!isTyping && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              borderBottomLeftRadius: 'var(--radius-lg)',
              borderBottomRightRadius: 'var(--radius-lg)'
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={inputRef}
                className="input"
                type="text"
                placeholder={activeAction ? 'Или задайте свой вопрос...' : 'Спросите AI о выделенном коде...'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                style={{ fontSize: '12px', flex: 1 }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim()}
                style={{ padding: '0 12px' }}
              >
                <Send size={14} />
              </button>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
              Enter - отправить • Esc - закрыть
            </div>
          </div>
        )}

        <style>{`
          @keyframes typing {
            0%, 60%, 100% { opacity: 0.3; }
            30% { opacity: 1; }
          }
          .typing-dot {
            animation: typing 1.4s infinite;
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
};
