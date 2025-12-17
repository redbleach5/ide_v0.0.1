import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  Replace,
  FileText,
  ChevronRight
} from 'lucide-react';
import { fileService } from '../services/fileService';
import { logger } from '../utils/logger';
import { Project } from '../types';

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string;
  lineContent: string;
}

interface GlobalSearchProps {
  project?: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onFileOpen?: (filePath: string) => void;
}

type SearchMode = 'search' | 'replace';

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  project,
  isOpen,
  onClose,
  onFileOpen
}) => {
  const [mode, setMode] = useState<SearchMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [fileFilter, setFileFilter] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const performSearch = useCallback(async () => {
    if (!project || !searchQuery.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    setResults([]);

    try {
      const searchResults: SearchResult[] = [];
      const regex = useRegex 
        ? new RegExp(searchQuery, caseSensitive ? 'g' : 'gi')
        : new RegExp(
            searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            caseSensitive ? 'g' : 'gi'
          );

      // Filter files by fileFilter if provided
      const filesToSearch = project.files.filter(file => {
        if (!file.isDirectory) {
          if (fileFilter) {
            const filterRegex = new RegExp(fileFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            return filterRegex.test(file.path);
          }
          return true;
        }
        return false;
      });

      // Limit to first 100 files for performance
      const filesToProcess = filesToSearch.slice(0, 100);

      for (const file of filesToProcess) {
        try {
          const content = await fileService.readFile(file.path, false);
          const lines = content.split('\n');

          lines.forEach((line, lineIndex) => {
            let match;
            while ((match = regex.exec(line)) !== null) {
              const startColumn = match.index + 1;
              
              // Get context (50 chars before and after)
              const contextStart = Math.max(0, match.index - 50);
              const contextEnd = Math.min(line.length, match.index + match[0].length + 50);
              const context = line.substring(contextStart, contextEnd);

              searchResults.push({
                file: file.path,
                line: lineIndex + 1,
                column: startColumn,
                match: match[0],
                context,
                lineContent: line
              });

              // Reset regex lastIndex for non-global regex
              if (!regex.global) break;
            }
            // Reset regex for next line
            regex.lastIndex = 0;
          });
        } catch (error) {
          logger.debug(`Error reading file ${file.path}:`, error);
          // Skip files that can't be read
        }
      }

      setResults(searchResults);
    } catch (error) {
      logger.error('Error performing search:', error);
    } finally {
      setSearching(false);
    }
  }, [project, searchQuery, useRegex, caseSensitive, fileFilter]);

  const handleReplace = async () => {
    if (!project || !searchQuery.trim() || !replaceQuery) {
      return;
    }

    // Group results by file
    const filesToReplace: { [key: string]: SearchResult[] } = {};
    results.forEach(result => {
      if (!filesToReplace[result.file]) {
        filesToReplace[result.file] = [];
      }
      filesToReplace[result.file].push(result);
    });

    // Replace in each file
    for (const [filePath, fileResults] of Object.entries(filesToReplace)) {
      try {
        const content = await fileService.readFile(filePath, false);
        const lines = content.split('\n');
        
        // Sort results by line number (descending) to avoid offset issues
        const sortedResults = [...fileResults].sort((a, b) => b.line - a.line);
        
        sortedResults.forEach(result => {
          const lineIndex = result.line - 1;
          if (lines[lineIndex]) {
            const regex = useRegex
              ? new RegExp(searchQuery, caseSensitive ? 'g' : 'gi')
              : new RegExp(
                  searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                  caseSensitive ? 'g' : 'gi'
                );
            
            lines[lineIndex] = lines[lineIndex].replace(regex, replaceQuery);
          }
        });

        const newContent = lines.join('\n');
        await fileService.writeFile(filePath, newContent);
      } catch (error) {
        logger.error(`Error replacing in file ${filePath}:`, error);
      }
    }

    // Refresh search results
    await performSearch();
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        performSearch();
      }, 300); // Debounce search

      return () => clearTimeout(timeoutId);
    } else {
      setResults([]);
    }
  }, [searchQuery, useRegex, caseSensitive, fileFilter, project, performSearch]);

  if (!isOpen) return null;

  const groupedResults: { [key: string]: SearchResult[] } = {};
  results.forEach(result => {
    if (!groupedResults[result.file]) {
      groupedResults[result.file] = [];
    }
    groupedResults[result.file].push(result);
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '5vh'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          style={{
            width: '800px',
            maxWidth: '90vw',
            maxHeight: '85vh',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {mode === 'search' ? 'Найти в файлах' : 'Заменить в файлах'}
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

            {/* Search Input */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)'
                  }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-sans)'
                  }}
                />
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: '8px 12px', fontSize: '12px' }}
                onClick={() => setMode(mode === 'search' ? 'replace' : 'search')}
              >
                {mode === 'search' ? <Replace size={14} /> : <Search size={14} />}
              </button>
            </div>

            {/* Replace Input */}
            {mode === 'replace' && (
              <div style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Заменить на..."
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-sans)'
                  }}
                />
              </div>
            )}

            {/* Options */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Учитывать регистр</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useRegex}
                  onChange={(e) => setUseRegex(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Регулярные выражения</span>
              </label>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  placeholder="Фильтр файлов (например: *.ts, *.js)"
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-sans)'
                  }}
                />
              </div>
              {mode === 'replace' && (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={handleReplace}
                  disabled={!replaceQuery || searching}
                >
                  Заменить все
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {searching ? (
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
                Поиск...
              </div>
            ) : results.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontSize: '12px'
                }}
              >
                {searchQuery.trim() ? 'Результаты не найдены' : 'Введите запрос для поиска'}
              </div>
            ) : (
              Object.entries(groupedResults).map(([file, fileResults]) => (
                <div key={file} style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      padding: '8px 16px',
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
                      {fileResults.length} {fileResults.length === 1 ? 'совпадение' : 'совпадений'}
                    </span>
                  </div>
                  {fileResults.map((result, index) => {
                    const resultIndex = results.indexOf(result);
                    const isSelected = selectedResult === resultIndex;
                    
                    return (
                      <div
                        key={`${result.line}-${result.column}-${index}`}
                        onClick={() => {
                          setSelectedResult(resultIndex);
                          if (onFileOpen) {
                            onFileOpen(result.file);
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                          transition: 'background-color 0.1s ease',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <span
                          style={{
                            color: 'var(--text-tertiary)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            minWidth: '60px',
                            textAlign: 'right'
                          }}
                        >
                          {result.line}:{result.column}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={result.lineContent}
                          >
                            {result.context}
                          </div>
                        </div>
                        <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                      </div>
                    );
                  })}
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
              {results.length} {results.length === 1 ? 'совпадение' : 'совпадений'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <kbd style={{ 
                padding: '2px 4px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '2px',
                border: '1px solid var(--border-subtle)'
              }}>
                Esc
              </kbd>
              {' '}закрыть
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
