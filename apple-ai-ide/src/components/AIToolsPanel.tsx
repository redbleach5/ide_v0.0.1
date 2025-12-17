import React from 'react';
import { 
  MessageSquare, 
  Lightbulb, 
  Zap, 
  Sparkles,
  Code2
} from 'lucide-react';

interface AIToolsPanelProps {
  onOpenInlineChat?: () => void;
  onOpenAIPanel?: () => void;
}

export const AIToolsPanel: React.FC<AIToolsPanelProps> = ({
  onOpenInlineChat,
  onOpenAIPanel
}) => {
  const tools = [
    {
      id: 'inline-chat',
      icon: MessageSquare,
      title: 'Inline Chat',
      description: 'Контекстный чат с AI (Ctrl+K)',
      action: () => {
        // Отправляем событие для открытия Inline Chat
        window.dispatchEvent(new CustomEvent('open-inline-chat'));
        onOpenInlineChat?.();
      },
      color: 'var(--accent-blue)'
    },
    {
      id: 'code-actions',
      icon: Lightbulb,
      title: 'Code Actions',
      description: 'Предложения AI для улучшения кода',
      action: () => {
        // Code Actions появляются автоматически, но можно показать подсказку
        window.dispatchEvent(new CustomEvent('show-code-actions-hint'));
      },
      color: 'var(--accent-yellow)'
    },
    {
      id: 'inline-completions',
      icon: Zap,
      title: 'Автодополнение',
      description: 'AI предлагает завершения кода',
      action: () => {
        // Показываем подсказку
        alert('💡 Начните печатать код - AI автоматически предложит завершения!\n\nTab - принять\nEsc - отклонить');
      },
      color: 'var(--accent-purple)'
    },
    {
      id: 'ai-panel',
      icon: Sparkles,
      title: 'AI Панель',
      description: 'Открыть панель чата с AI',
      action: () => {
        window.dispatchEvent(new CustomEvent('open-ai-panel'));
        onOpenAIPanel?.();
      },
      color: 'var(--accent-green)'
    },
    {
      id: 'explain-code',
      icon: Code2,
      title: 'Объяснить код',
      description: 'Быстрое объяснение выделенного кода',
      action: () => {
        window.dispatchEvent(new CustomEvent('open-inline-chat', { 
          detail: { action: 'explain' } 
        }));
        onOpenInlineChat?.();
      },
      color: 'var(--accent-blue)'
    },
  ];

  return (
    <div style={{ padding: '12px' }}>
      <div 
        style={{
          padding: '8px 12px',
          fontSize: '11px',
          fontWeight: '600',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.5px',
          marginBottom: '8px'
        }}
      >
        AI Инструменты
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              className="btn btn-ghost"
              onClick={tool.action}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'left',
                width: '100%',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)',
                transition: 'all 0.15s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
              title={tool.description}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: `${tool.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Icon size={16} style={{ color: tool.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div 
                  style={{ 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    marginBottom: '2px'
                  }}
                >
                  {tool.title}
                </div>
                <div 
                  style={{ 
                    fontSize: '10px', 
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tool.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div 
        style={{
          marginTop: '16px',
          padding: '10px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '10px',
          color: 'var(--text-secondary)',
          lineHeight: '1.5'
        }}
      >
        <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
          💡 Совет:
        </div>
        Используйте <strong>Ctrl+K</strong> в редакторе для быстрого доступа к Inline Chat
      </div>
    </div>
  );
};
