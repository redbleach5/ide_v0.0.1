import React, { useRef } from 'react';
import { X, CircleDot } from 'lucide-react';
import { Tab, IDESettings } from '../types';

interface EditorPanelProps {
  tabs: Tab[];
  activeTab: Tab | null;
  onTabClose: (tabId: string) => void;
  onTabSelect: (tab: Tab) => void;
  onTabContentChange: (tabId: string, content: string) => void;
  settings: IDESettings;
}

export const EditorPanelSimple: React.FC<EditorPanelProps> = ({
  tabs,
  activeTab,
  onTabClose,
  onTabSelect,
  onTabContentChange,
  settings
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEditorChange = (value: string) => {
    if (activeTab) {
      onTabContentChange(activeTab.id, value);
    }
  };

  if (!activeTab && tabs.length === 0) {
    return (
      <div 
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={32} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Файл не открыт
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Откройте файл из боковой панели, чтобы начать редактирование
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* Tabs */}
      {tabs.length > 0 && (
        <div 
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            overflowX: 'auto',
            minWidth: 0,
            flex: 1
          }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: activeTab?.id === tab.id ? 'var(--bg-primary)' : 'transparent',
                borderBottom: activeTab?.id === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                minWidth: '80px', // Минимальная ширина для кликабельности
                maxWidth: '200px', // Максимальная ширина одной вкладки
                flex: '0 1 auto', // Может сжиматься, но не растягиваться
                cursor: 'pointer',
                position: 'relative',
                height: '32px'
              }}
              onClick={() => onTabSelect(tab)}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 12px',
                  flex: 1,
                  height: '100%'
                }}
              >
                <CircleDot 
                  size={8} 
                  style={{ 
                    color: tab.isDirty ? 'var(--accent-orange)' : 'transparent',
                    flexShrink: 0
                  }} 
                />
                <span 
                  style={{ 
                    fontSize: '12px',
                    color: activeTab?.id === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0
                  }}
                  title={tab.path}
                >
                  {(() => {
                    // Всегда показываем только имя файла, даже если title содержит путь
                    const fileName = tab.path.split(/[/\\]/).pop() || tab.title.split(/[/\\]/).pop() || tab.title || 'Без названия';
                    return fileName;
                  })()}
                </span>
              </div>
              
              <button
                className="btn btn-ghost"
                style={{
                  height: '20px',
                  width: '20px',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '4px',
                  opacity: activeTab?.id === tab.id ? 1 : 0,
                  transition: 'opacity 0.2s ease'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                title="Закрыть вкладку"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Simple Editor */}
      {activeTab && (
        <div style={{ flex: 1, padding: '12px' }}>
          <div style={{ 
            fontSize: '11px', 
            color: 'var(--text-tertiary)', 
            marginBottom: '8px',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={activeTab.path}
          >
            {(() => {
              // Показываем только последние 2 сегмента пути для компактности
              const segments = activeTab.path.split(/[/\\]/).filter(Boolean);
              const maxSegments = 2;
              const startIndex = Math.max(0, segments.length - maxSegments);
              const displayPath = segments.length > maxSegments 
                ? '...' + segments.slice(startIndex).join(' / ')
                : segments.join(' / ');
              return `${displayPath} • ${activeTab.language}`;
            })()}
          </div>
          <textarea
            ref={textareaRef}
            value={activeTab.content}
            onChange={(e) => handleEditorChange(e.target.value)}
            style={{
              width: '100%',
              height: 'calc(100% - 24px)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              fontFamily: settings.fontFamily,
              fontSize: `${settings.fontSize}px`,
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              resize: 'none',
              outline: 'none',
              lineHeight: '1.5'
            }}
            placeholder="Начните вводить..."
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
};