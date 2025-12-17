import React, { useState } from 'react';
import { XIcon, FolderOpenIcon } from './Icons';
import { logger } from '../utils/logger';

interface NewProjectDialogProps {
  onClose: () => void;
  onCreate: (projectPath: string, projectName: string) => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
  onClose,
  onCreate
}) => {
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    if (!window.electronAPI || !window.electronAPI.showOpenDialog) {
      setError('Electron API не доступен');
      return;
    }

    try {
      const result = await window.electronAPI.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
      });

      if (result.success && !result.canceled && result.filePaths && result.filePaths.length > 0) {
        setProjectPath(result.filePaths[0]);
        setError(null);
      }
    } catch (error) {
      logger.error('Failed to select folder:', error);
      setError('Не удалось выбрать папку');
    }
  };

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError('Введите название проекта');
      return;
    }

    if (!projectPath) {
      setError('Выберите папку для проекта');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const fullPath = projectPath.endsWith(projectName) 
        ? projectPath 
        : `${projectPath}/${projectName}`;

      // Создаем проект через IPC
      if (window.electronAPI && window.electronAPI.createProject) {
        const result = await window.electronAPI.createProject(fullPath, projectName);
        
        if (result.success) {
          onCreate(fullPath, projectName);
          onClose();
        } else {
          setError(result.error || 'Не удалось создать проект');
        }
      } else {
        setError('Electron API не доступен');
      }
    } catch (error) {
      logger.error('Failed to create project:', error);
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          width: '100%',
          maxWidth: '500px',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Создать новый проект
          </h2>
          <button
            className="btn btn-ghost"
            style={{ height: '32px', width: '32px', padding: 0 }}
            onClick={onClose}
            title="Закрыть"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Project Name */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '8px'
              }}
            >
              Название проекта
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Мой проект"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
          </div>

          {/* Project Path */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '8px'
              }}
            >
              Расположение
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={projectPath}
                readOnly
                placeholder="Выберите папку для проекта"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
                onClick={handleSelectFolder}
              />
              <button
                className="btn btn-secondary"
                onClick={handleSelectFolder}
                style={{ padding: '8px 16px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}
              >
                <FolderOpenIcon size={16} style={{ marginRight: '6px' }} />
                Выбрать
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-error)',
                border: '1px solid var(--border-error)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-error)',
                fontSize: '13px'
              }}
            >
              {error}
            </div>
          )}

          {/* Info */}
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: '1.5'
            }}
          >
            Будет создана новая папка с базовой структурой проекта (README.md, .gitignore и т.д.)
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isCreating}
            style={{ padding: '8px 16px' }}
          >
            Отмена
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={isCreating || !projectName.trim() || !projectPath}
            style={{ padding: '8px 16px' }}
          >
            {isCreating ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
};
