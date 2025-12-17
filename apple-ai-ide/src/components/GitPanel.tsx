import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  GitBranch, 
  X, 
  CheckCircle, 
  AlertCircle, 
  FileText,
  Plus,
  Minus,
  RefreshCw,
  GitCommit,
  ArrowUp,
  ArrowDown,
  GitMerge,
  Eye,
  History
} from 'lucide-react';
import { gitService, GitStatus } from '../services/gitService';
import { logger } from '../utils/logger';

interface GitPanelProps {
  projectPath?: string;
  onClose: () => void;
  onFileOpen?: (filePath: string) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({
  projectPath,
  onClose,
  onFileOpen
}) => {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [branches, setBranches] = useState<{ local: string[]; remote: string[]; current: string } | null>(null);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [showDiff, setShowDiff] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!projectPath) return;

    setLoading(true);
    try {
      const gitStatus = await gitService.getStatus(projectPath);
      setStatus(gitStatus);
      // If gitStatus is null, it means either not a git repo or git is not available
      // This is handled in the render logic
    } catch (error) {
      logger.error('Error loading git status:', error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  const loadBranches = useCallback(async () => {
    if (!projectPath) return;
    try {
      const branchData = await gitService.getBranches(projectPath);
      setBranches(branchData);
    } catch (error) {
      logger.error('Error loading branches:', error);
    }
  }, [projectPath]);

  useEffect(() => {
    if (projectPath) {
      // Check if git is available before trying to load status
      gitService.isGitAvailable(projectPath).then(isAvailable => {
        if (isAvailable) {
          loadStatus();
          loadBranches();
        } else {
          setLoading(false);
          setStatus(null);
        }
      }).catch(() => {
        setLoading(false);
        setStatus(null);
      });
    }
  }, [projectPath, loadStatus, loadBranches]);

  const handleStageFile = async (filePath: string) => {
    if (!projectPath) return;

    try {
      await gitService.stageFile(projectPath, filePath);
      await loadStatus();
    } catch (error) {
      logger.error('Error staging file:', error);
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    if (!projectPath) return;

    try {
      await gitService.unstageFile(projectPath, filePath);
      await loadStatus();
    } catch (error) {
      logger.error('Error unstaging file:', error);
    }
  };

  const handleCommit = async () => {
    if (!projectPath || !commitMessage.trim()) return;

    setCommitting(true);
    try {
      const success = await gitService.commit(projectPath, commitMessage);
      if (success) {
        setCommitMessage('');
        setShowCommitDialog(false);
        await loadStatus();
        await loadBranches();
      }
    } catch (error) {
      logger.error('Error committing:', error);
    } finally {
      setCommitting(false);
    }
  };

  const handlePush = async () => {
    if (!projectPath || !status) return;

    setPushing(true);
    try {
      const success = await gitService.push(projectPath, status.branch);
      if (success) {
        await loadStatus();
        await loadBranches();
      }
    } catch (error) {
      logger.error('Error pushing:', error);
    } finally {
      setPushing(false);
    }
  };

  const handlePull = async () => {
    if (!projectPath || !status) return;

    setPulling(true);
    try {
      const success = await gitService.pull(projectPath, status.branch);
      if (success) {
        await loadStatus();
        await loadBranches();
      }
    } catch (error) {
      logger.error('Error pulling:', error);
    } finally {
      setPulling(false);
    }
  };

  const handleSwitchBranch = async (branchName: string) => {
    if (!projectPath) return;

    try {
      const success = await gitService.switchBranch(projectPath, branchName);
      if (success) {
        await loadStatus();
        await loadBranches();
        setShowBranchDialog(false);
      }
    } catch (error) {
      logger.error('Error switching branch:', error);
    }
  };

  const handleCreateBranch = async () => {
    if (!projectPath || !newBranchName.trim()) return;

    try {
      const success = await gitService.createBranch(projectPath, newBranchName.trim());
      if (success) {
        setNewBranchName('');
        await loadBranches();
        setShowBranchDialog(false);
      }
    } catch (error) {
      logger.error('Error creating branch:', error);
    }
  };

  const handleShowDiff = async (filePath: string) => {
    if (!projectPath) return;

    try {
      const diff = await gitService.getDiff(projectPath, filePath);
      if (diff) {
        setShowDiff(filePath);
        setDiffContent(diff.diff);
      }
    } catch (error) {
      logger.error('Error showing diff:', error);
    }
  };

  if (!projectPath) {
    return (
      <div
        style={{
          width: '300px',
          backgroundColor: 'var(--bg-sidebar)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={16} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Git
            </span>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px', width: '24px', height: '24px' }}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '13px'
          }}
        >
          Проект не открыт
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div
        style={{
          width: '300px',
          backgroundColor: 'var(--bg-sidebar)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={16} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Git
            </span>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px', width: '24px', height: '24px' }}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '13px'
          }}
        >
          {loading ? 'Загрузка...' : (
            <div>
              <div style={{ marginBottom: '8px' }}>Не является Git репозиторием</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Или Git не установлен в системе
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const allChangedFiles = [
    ...status.stagedFiles.map(f => ({ path: f, staged: true })),
    ...status.modifiedFiles.filter(f => !status.stagedFiles.includes(f)).map(f => ({ path: f, staged: false })),
    ...status.untrackedFiles.map(f => ({ path: f, staged: false }))
  ];

  return (
    <div
      style={{
        width: '300px',
        backgroundColor: 'var(--bg-sidebar)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitBranch size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Git
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px', width: '24px', height: '24px' }}
            onClick={loadStatus}
            title="Обновить"
          >
            <RefreshCw size={14} />
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px', width: '24px', height: '24px' }}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Branch Info */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {status.branch}
            </span>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px', fontSize: '11px' }}
            onClick={() => setShowBranchDialog(true)}
            title="Переключить ветку"
          >
            <GitMerge size={12} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          {status.isClean ? (
            <>
              <CheckCircle size={12} style={{ color: 'var(--accent-green)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Рабочая директория чиста
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={12} style={{ color: 'var(--accent-orange)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Есть изменения
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, padding: '4px 8px', fontSize: '11px' }}
            onClick={handlePull}
            disabled={pulling}
            title="Получить изменения (Pull)"
          >
            <ArrowDown size={12} />
            {pulling ? '...' : 'Pull'}
          </button>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, padding: '4px 8px', fontSize: '11px' }}
            onClick={handlePush}
            disabled={pushing}
            title="Отправить изменения (Push)"
          >
            <ArrowUp size={12} />
            {pushing ? '...' : 'Push'}
          </button>
        </div>
      </div>

      {/* Changes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {allChangedFiles.length === 0 ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: '12px'
            }}
          >
            Нет изменений
          </div>
        ) : (
          <>
            {status.stagedFiles.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    padding: '4px 16px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.5px'
                  }}
                >
                  Индексированные изменения
                </div>
                {status.stagedFiles.map(file => (
                  <div
                    key={file}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 16px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onClick={() => {
                      if (onFileOpen) {
                        onFileOpen(`${projectPath}/${file}`);
                      }
                    }}
                  >
                    <FileText size={12} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                    <span
                      style={{
                        flex: 1,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={file}
                    >
                      {file}
                    </span>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '2px', width: '20px', height: '20px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnstageFile(file);
                      }}
                      title="Убрать из индекса"
                    >
                      <Minus size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(status.modifiedFiles.length > 0 || status.untrackedFiles.length > 0) && (
              <div>
                <div
                  style={{
                    padding: '4px 16px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.5px'
                  }}
                >
                  Неиндексированные изменения
                </div>
                {allChangedFiles
                  .filter(f => !f.staged)
                  .map(({ path }) => (
                    <div
                      key={path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 16px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      onClick={() => {
                        if (onFileOpen) {
                          onFileOpen(`${projectPath}/${path}`);
                        }
                      }}
                    >
                      <FileText size={12} style={{ color: 'var(--accent-orange)', flexShrink: 0 }} />
                      <span
                        style={{
                          flex: 1,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={path}
                      >
                        {path}
                      </span>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '2px', width: '20px', height: '20px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStageFile(path);
                        }}
                        title="Добавить в индекс"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Commit Button */}
      {status.stagedFiles.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)'
          }}
        >
          <button
            className="btn btn-primary"
            style={{ width: '100%', fontSize: '12px' }}
            onClick={() => setShowCommitDialog(true)}
          >
            <GitCommit size={14} />
            Создать коммит ({status.stagedFiles.length})
          </button>
        </div>
      )}

      {/* Commit Dialog */}
      {showCommitDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setShowCommitDialog(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              width: '500px',
              maxWidth: '90vw',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
              padding: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Создать коммит
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {status.stagedFiles.length} файл(ов) готовы к коммиту
              </p>
            </div>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Сообщение коммита..."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                resize: 'vertical',
                marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowCommitDialog(false);
                  setCommitMessage('');
                }}
                disabled={committing}
              >
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCommit}
                disabled={!commitMessage.trim() || committing}
              >
                {committing ? 'Создание...' : 'Создать коммит'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Branch Dialog */}
      {showBranchDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setShowBranchDialog(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              width: '400px',
              maxWidth: '90vw',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
              padding: '20px',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Ветки
              </h3>
            </div>
            
            {branches && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Локальные ветки
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {branches.local.map(branch => (
                    <button
                      key={branch}
                      onClick={() => handleSwitchBranch(branch)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'left',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: branch === branches.current ? 'var(--bg-selected)' : 'transparent',
                        color: branch === branches.current ? 'var(--text-inverse)' : 'var(--text-primary)',
                        fontSize: '12px',
                        marginBottom: '4px',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (branch !== branches.current) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (branch !== branches.current) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {branch === branches.current && '✓ '}
                      {branch}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Создать новую ветку
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="Имя ветки..."
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '12px'
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateBranch()}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim()}
                  style={{ fontSize: '12px' }}
                >
                  Создать
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowBranchDialog(false);
                  setNewBranchName('');
                }}
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Diff Dialog */}
      {showDiff && diffContent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => {
            setShowDiff(null);
            setDiffContent(null);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              width: '80vw',
              maxWidth: '1200px',
              height: '80vh',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Diff: {showDiff.split(/[/\\]/).pop()}
              </h3>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowDiff(null);
                  setDiffContent(null);
                }}
              >
                <X size={16} />
              </button>
            </div>
            <pre
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '16px',
                margin: 0,
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {diffContent}
            </pre>
          </motion.div>
        </div>
      )}
    </div>
  );
};
