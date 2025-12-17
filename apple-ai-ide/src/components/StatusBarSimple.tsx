import React, { useState, useEffect } from 'react';
import { 
  GitBranchIcon, 
  CheckCircleIcon, 
  AlertCircleIcon, 
  ClockIcon, 
  CpuIcon 
} from './Icons';
import { Project, Tab, IDESettings } from '../types';

interface StatusBarProps {
  project: Project | null;
  activeTab: Tab | null;
  settings: IDESettings;
  ragIndexing?: { inProgress: boolean; progress?: number; filesIndexed?: number; totalFiles?: number };
}

export const StatusBarSimple: React.FC<StatusBarProps> = ({ project, activeTab, settings, ragIndexing }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [gitBranch] = useState<string>('main');
  const [language, setLanguage] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab) {
      setLanguage(activeTab.language.toUpperCase());
    } else {
      setLanguage('');
    }
  }, [activeTab]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getPosition = () => {
    if (!activeTab) return 'Стр 1, Кол 1';
    return 'Стр 1, Кол 1';
  };

  const getEncoding = () => {
    return 'UTF-8';
  };

  const getLineEnding = () => {
    return 'LF';
  };

  const getGitStatus = () => {
    return 'clean';
  };

  return (
    <div 
      style={{
        height: '22px',
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        padding: '0 8px',
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        {/* Project Info */}
        {project && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GitBranchIcon size={11} />
            <span>{gitBranch}</span>
            <span style={{ 
              color: getGitStatus() === 'clean' ? 'var(--accent-green)' : 'var(--accent-orange)',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}>
              {getGitStatus() === 'clean' ? (
                <CheckCircleIcon size={10} />
              ) : (
                <AlertCircleIcon size={10} />
              )}
              {getGitStatus()}
            </span>
          </div>
        )}

        {/* File Info */}
        {activeTab && (
          <>
            <span>{language}</span>
            <span>{getEncoding()}</span>
            <span>{getLineEnding()}</span>
            <span>{getPosition()}</span>
          </>
        )}

        {/* AI Status */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          color: 'var(--accent-purple)'
        }}>
          <CpuIcon size={11} />
          <span>ИИ: {settings.selectedModel || 'Не выбран'}</span>
        </div>

        {/* RAG Indexing Status */}
        {ragIndexing?.inProgress && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            color: 'var(--accent-blue)'
          }}>
            <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: 'var(--accent-blue)', borderRadius: '50%' }} />
            <span>
              RAG: {ragIndexing.filesIndexed !== undefined && ragIndexing.totalFiles !== undefined 
                ? `${ragIndexing.filesIndexed}/${ragIndexing.totalFiles}` 
                : 'Индексация...'}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Auto-save indicator */}
        {settings.autoSave && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            color: 'var(--accent-green)'
          }}>
            <CheckCircleIcon size={10} />
            <span>Авто</span>
          </div>
        )}

        {/* Current time */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          color: 'var(--text-tertiary)'
        }}>
          <ClockIcon size={10} />
          <span>{formatTime(currentTime)}</span>
        </div>
      </div>
    </div>
  );
};