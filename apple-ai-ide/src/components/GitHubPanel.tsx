import React, { useState, useEffect, useCallback } from 'react';
import {
  Github,
  X,
  RefreshCw,
  Download,
  GitPullRequest,
  AlertCircle,
  Code,
  Star,
  GitFork,
  ExternalLink,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { githubService, GitHubRepository, GitHubPullRequest, GitHubIssue, GitHubBranch } from '../services/githubService';
import { logger } from '../utils/logger';

interface GitHubPanelProps {
  githubToken?: string;
  onClose: () => void;
  onProjectOpen?: (projectPath: string) => void;
}

type ViewMode = 'repositories' | 'repository-detail' | 'authenticate';

export const GitHubPanel: React.FC<GitHubPanelProps> = ({
  githubToken,
  onClose,
  onProjectOpen
}) => {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('repositories');
  const [user, setUser] = useState<{ login: string; avatar_url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prState, setPrState] = useState<'open' | 'closed' | 'all'>('open');
  const [issueState, setIssueState] = useState<'open' | 'closed' | 'all'>('open');

  const loadUser = useCallback(async () => {
    try {
      const userData = await githubService.getUser();
      setUser(userData);
    } catch (error) {
      logger.error('Error loading GitHub user:', error);
    }
  }, []);

  const loadRepositories = useCallback(async () => {
    if (!githubToken) return;

    setLoading(true);
    setError(null);
    try {
      const repos = await githubService.getRepositories();
      setRepositories(repos);
      setViewMode('repositories');
    } catch (error) {
      logger.error('Error loading repositories:', error);
      setError(error instanceof Error ? error.message : 'Не удалось загрузить репозитории');
    } finally {
      setLoading(false);
    }
  }, [githubToken]);

  useEffect(() => {
    if (githubToken) {
      githubService.setToken(githubToken);
      loadUser();
      loadRepositories();
    } else {
      setViewMode('authenticate');
    }
  }, [githubToken, loadUser, loadRepositories]);

  const handleRepoClick = useCallback(async (repo: GitHubRepository) => {
    setSelectedRepo(repo);
    setLoading(true);
    setError(null);

    try {
      const [owner, name] = repo.full_name.split('/');
      
      const [prs, iss, brs] = await Promise.all([
        githubService.getPullRequests(owner, name, prState).catch(() => []),
        githubService.getIssues(owner, name, issueState).catch(() => []),
        githubService.getBranches(owner, name).catch(() => [])
      ]);

      setPullRequests(prs);
      setIssues(iss);
      setBranches(brs);
      setViewMode('repository-detail');
    } catch (error) {
      logger.error('Error loading repository details:', error);
      setError(error instanceof Error ? error.message : 'Не удалось загрузить информацию о репозитории');
    } finally {
      setLoading(false);
    }
  }, [prState, issueState]);

  const handleClone = useCallback(async (repo: GitHubRepository) => {
    if (!onProjectOpen) {
      logger.warn('onProjectOpen callback is not provided');
      return;
    }

    try {
      // Open a dialog to select directory for cloning
      if (window.electronAPI?.showOpenDialog) {
        const result = await window.electronAPI.showOpenDialog({
          properties: ['openDirectory']
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          return;
        }

        const targetPath = result.filePaths[0];
        const clonePath = `${targetPath}/${repo.name}`;

        // Use terminal to clone the repository
        if (window.electronAPI?.terminal) {
          const ptyId = await window.electronAPI.terminal.create({ cwd: targetPath });
          await window.electronAPI.terminal.write(ptyId, `git clone ${repo.clone_url} ${repo.name}\n`);
          
          // Wait a bit and then open the project
          setTimeout(() => {
            if (onProjectOpen) {
              onProjectOpen(clonePath);
            }
          }, 2000);
        }
      }
    } catch (error) {
      logger.error('Error cloning repository:', error);
      setError(error instanceof Error ? error.message : 'Не удалось клонировать репозиторий');
    }
  }, [onProjectOpen]);

  const handleBack = () => {
    setSelectedRepo(null);
    setViewMode('repositories');
    setPullRequests([]);
    setIssues([]);
    setBranches([]);
  };

  if (viewMode === 'authenticate') {
    return (
      <div
        style={{
          width: '400px',
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
            <Github size={16} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              GitHub
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
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            textAlign: 'center'
          }}
        >
          <Github size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Необходима аутентификация
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
            Для работы с GitHub необходимо указать Personal Access Token в настройках.
          </p>
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--accent-blue)',
              fontSize: '13px',
              textDecoration: 'none'
            }}
          >
            Создать токен
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '400px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {viewMode === 'repository-detail' && (
            <button
              className="btn btn-ghost"
              style={{ padding: '4px', marginRight: '4px' }}
              onClick={handleBack}
              title="Назад к списку"
            >
              ←
            </button>
          )}
          <Github size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {viewMode === 'repository-detail' ? selectedRepo?.name : 'GitHub'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {user && (
            <img
              src={user.avatar_url}
              alt={user.login}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                marginRight: '8px'
              }}
            />
          )}
          {viewMode === 'repositories' && (
            <button
              className="btn btn-ghost"
              style={{ padding: '4px', width: '24px', height: '24px' }}
              onClick={loadRepositories}
              title="Обновить"
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ padding: '4px', width: '24px', height: '24px' }}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--accent-red)',
            color: 'var(--text-inverse)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && viewMode === 'repositories' ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--border-subtle)',
                borderTop: '2px solid var(--accent-blue)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
            Загрузка...
          </div>
        ) : viewMode === 'repositories' ? (
          <div style={{ padding: '8px 0' }}>
            {repositories.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontSize: '12px'
                }}
              >
                Нет репозиториев
              </div>
            ) : (
              repositories.map((repo) => (
                <div
                  key={repo.id}
                  onClick={() => handleRepoClick(repo)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background-color 0.1s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {repo.name}
                        </span>
                        {repo.private && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              backgroundColor: 'var(--bg-tertiary)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-tertiary)'
                            }}
                          >
                            Private
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            marginBottom: '8px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}
                        >
                          {repo.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {repo.language && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Code size={12} />
                            {repo.language}
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Star size={12} />
                          {repo.stargazers_count}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <GitFork size={12} />
                          {repo.forks_count}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '4px', flexShrink: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClone(repo);
                      }}
                      title="Клонировать репозиторий"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : viewMode === 'repository-detail' && selectedRepo ? (
          <div style={{ padding: '16px' }}>
            {/* Repository Info */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selectedRepo.full_name}
                </h3>
                <a
                  href={selectedRepo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-blue)' }}
                >
                  <ExternalLink size={16} />
                </a>
              </div>
              {selectedRepo.description && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {selectedRepo.description}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={14} />
                  {selectedRepo.stargazers_count}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <GitFork size={14} />
                  {selectedRepo.forks_count}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Code size={14} />
                  {selectedRepo.language || 'N/A'}
                </span>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '12px', fontSize: '12px' }}
                onClick={() => handleClone(selectedRepo)}
              >
                <Download size={14} />
                Клонировать репозиторий
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPrState('open')}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  backgroundColor: prState === 'open' ? 'var(--bg-hover)' : 'transparent',
                  borderRadius: '0'
                }}
              >
                Pull Requests ({pullRequests.length})
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setIssueState('open')}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  backgroundColor: issueState === 'open' ? 'var(--bg-hover)' : 'transparent',
                  borderRadius: '0'
                }}
              >
                Issues ({issues.length})
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  borderRadius: '0'
                }}
              >
                Branches ({branches.length})
              </button>
            </div>

            {/* Pull Requests */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {pullRequests.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                  Нет pull requests
                </div>
              ) : (
                pullRequests.map((pr) => (
                  <div
                    key={pr.id}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onClick={() => window.open(`${selectedRepo.html_url}/pull/${pr.number}`, '_blank')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                      <GitPullRequest
                        size={14}
                        style={{
                          color:
                            pr.state === 'merged'
                              ? 'var(--accent-purple)'
                              : pr.state === 'closed'
                              ? 'var(--accent-red)'
                              : 'var(--accent-green)',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {pr.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          #{pr.number} by {pr.user.login} • {new Date(pr.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {pr.state === 'merged' && (
                        <CheckCircle size={14} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
                      )}
                      {pr.state === 'closed' && (
                        <AlertTriangle size={14} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Issues */}
            {issues.length > 0 && (
              <div style={{ marginTop: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onClick={() => window.open(`${selectedRepo.html_url}/issues/${issue.number}`, '_blank')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <AlertCircle
                        size={14}
                        style={{
                          color: issue.state === 'closed' ? 'var(--accent-red)' : 'var(--accent-orange)',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {issue.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          #{issue.number} by {issue.user.login} • {new Date(issue.created_at).toLocaleDateString()}
                        </div>
                        {issue.labels.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {issue.labels.map((label, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  backgroundColor: `#${label.color}20`,
                                  color: `#${label.color}`,
                                  borderRadius: 'var(--radius-xs)',
                                  border: `1px solid #${label.color}40`
                                }}
                              >
                                {label.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
