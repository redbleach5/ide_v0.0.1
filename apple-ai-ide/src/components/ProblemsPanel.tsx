import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertCircle, 
  AlertTriangle, 
  Info,
  FileText,
  ChevronRight
} from 'lucide-react';

export interface Problem {
  id: string;
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
  code?: string | number;
}

interface ProblemsPanelProps {
  problems: Problem[];
  onClose: () => void;
  onProblemClick?: (problem: Problem) => void;
}

type FilterType = 'all' | 'error' | 'warning' | 'info';

export const ProblemsPanel: React.FC<ProblemsPanelProps> = ({
  problems,
  onClose,
  onProblemClick
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [groupedProblems, setGroupedProblems] = useState<{ [key: string]: Problem[] }>({});

  useEffect(() => {
    const filtered = filter === 'all' 
      ? problems 
      : problems.filter(p => p.severity === filter);

    const grouped: { [key: string]: Problem[] } = {};
    filtered.forEach(problem => {
      if (!grouped[problem.file]) {
        grouped[problem.file] = [];
      }
      grouped[problem.file].push(problem);
    });

    setGroupedProblems(grouped);
  }, [problems, filter]);

  const getSeverityIcon = (severity: Problem['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertCircle size={14} style={{ color: 'var(--accent-red)' }} />;
      case 'warning':
        return <AlertTriangle size={14} style={{ color: 'var(--accent-orange)' }} />;
      case 'info':
        return <Info size={14} style={{ color: 'var(--accent-blue)' }} />;
    }
  };

  const getSeverityCount = (severity: Problem['severity']) => {
    return problems.filter(p => p.severity === severity).length;
  };

  const errorCount = getSeverityCount('error');
  const warningCount = getSeverityCount('warning');
  const infoCount = getSeverityCount('info');

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Проблемы
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

      {/* Filters */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}
      >
        <button
          className={`btn btn-ghost btn-sm ${filter === 'all' ? 'active' : ''}`}
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            backgroundColor: filter === 'all' ? 'var(--bg-hover)' : 'transparent'
          }}
          onClick={() => setFilter('all')}
        >
          Все ({problems.length})
        </button>
        <button
          className={`btn btn-ghost btn-sm ${filter === 'error' ? 'active' : ''}`}
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            backgroundColor: filter === 'error' ? 'var(--bg-hover)' : 'transparent',
            color: errorCount > 0 ? 'var(--accent-red)' : 'var(--text-secondary)'
          }}
          onClick={() => setFilter('error')}
        >
          <AlertCircle size={12} />
          Ошибки ({errorCount})
        </button>
        <button
          className={`btn btn-ghost btn-sm ${filter === 'warning' ? 'active' : ''}`}
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            backgroundColor: filter === 'warning' ? 'var(--bg-hover)' : 'transparent',
            color: warningCount > 0 ? 'var(--accent-orange)' : 'var(--text-secondary)'
          }}
          onClick={() => setFilter('warning')}
        >
          <AlertTriangle size={12} />
          Предупреждения ({warningCount})
        </button>
        <button
          className={`btn btn-ghost btn-sm ${filter === 'info' ? 'active' : ''}`}
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            backgroundColor: filter === 'info' ? 'var(--bg-hover)' : 'transparent',
            color: infoCount > 0 ? 'var(--accent-blue)' : 'var(--text-secondary)'
          }}
          onClick={() => setFilter('info')}
        >
          <Info size={12} />
          Информация ({infoCount})
        </button>
      </div>

      {/* Problems List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {Object.keys(groupedProblems).length === 0 ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: '12px'
            }}
          >
            {problems.length === 0 ? 'Нет проблем' : 'Нет проблем с выбранным фильтром'}
          </div>
        ) : (
          Object.entries(groupedProblems).map(([file, fileProblems]) => (
            <div key={file} style={{ marginBottom: '16px' }}>
              <div
                style={{
                  padding: '6px 16px',
                  fontSize: '11px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                  letterSpacing: '0.5px',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileText size={12} />
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={file}
                >
                  {file.split(/[/\\]/).pop() || file}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                  {fileProblems.length}
                </span>
              </div>
              {fileProblems.map((problem) => (
                <div
                  key={problem.id}
                  onClick={() => onProblemClick?.(problem)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'background-color 0.1s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>
                    {getSeverityIcon(problem.severity)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '2px'
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--text-primary)',
                          fontWeight: '500'
                        }}
                      >
                        {problem.message}
                      </span>
                      {problem.code && (
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--text-tertiary)',
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: 'var(--bg-tertiary)',
                            padding: '1px 4px',
                            borderRadius: 'var(--radius-xs)'
                          }}
                        >
                          {problem.code}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>
                        Строка {problem.line}, Колонка {problem.column}
                      </span>
                      {problem.source && (
                        <>
                          <span>•</span>
                          <span>{problem.source}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span>
          {problems.length} {problems.length === 1 ? 'проблема' : 'проблем'}
        </span>
        {errorCount > 0 && (
          <span style={{ color: 'var(--accent-red)' }}>
            {errorCount} {errorCount === 1 ? 'ошибка' : 'ошибок'}
          </span>
        )}
      </div>
    </div>
  );
};
