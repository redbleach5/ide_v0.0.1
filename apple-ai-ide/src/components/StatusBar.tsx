import React, { useState, useEffect } from 'react';
import { GitBranch, CheckCircle, AlertCircle, Clock, Cpu } from 'lucide-react';
import { Project, Tab, IDESettings } from '../types';

interface StatusBarProps {
  project: Project | null;
  activeTab: Tab | null;
  settings: IDESettings;
}

export const StatusBar: React.FC<StatusBarProps> = ({ project, activeTab, settings }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [gitBranch, setGitBranch] = useState<string>('main');
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
    
    // This would be handled by Monaco editor's position tracking
    // For now, return a placeholder
    return 'Стр 1, Кол 1';
  };

  const getEncoding = () => {
    return 'UTF-8';
  };

  const getLineEnding = () => {
    return 'LF';
  };

  const getSelectionInfo = () => {
    // This would be handled by Monaco editor's selection tracking
    return '';
  };

  const getGitStatus = () => {
    // This would integrate with git service
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
            <GitBranch size={11} />
            <span>{gitBranch}</span>
            <span style={{ 
              color: getGitStatus() === 'clean' ? 'var(--accent-green)' : 'var(--accent-orange)',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}>
              {getGitStatus() === 'clean' ? (
                <CheckCircle size={10} />
              ) : (
                <AlertCircle size={10} />
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
            {getSelectionInfo() && (
              <span>{getSelectionInfo()}</span>
            )}
          </>
        )}

        {/* AI Status */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          color: 'var(--accent-purple)'
        }}>
          <Cpu size={11} />
          <span>ИИ: {settings.selectedModel || 'Не выбран'}</span>
        </div>
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
            <CheckCircle size={10} />
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
          <Clock size={10} />
          <span>{formatTime(currentTime)}</span>
        </div>
      </div>
    </div>
  );
};