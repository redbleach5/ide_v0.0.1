import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ChevronRight
} from 'lucide-react';
import { Tab, Project } from '../types';

export interface Command {
  id: string;
  label: string;
  category: string;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  project?: Project | null;
  activeTab?: Tab | null;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
  project,
  activeTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on search query
  const filteredCommands = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return commands;
    }

    const query = searchQuery.toLowerCase();
    return commands.filter(cmd => {
      const labelMatch = cmd.label.toLowerCase().includes(query);
      const categoryMatch = cmd.category.toLowerCase().includes(query);
      const keywordMatch = cmd.keywords?.some(kw => kw.toLowerCase().includes(query));
      
      return labelMatch || categoryMatch || keywordMatch;
    });
  }, [commands, searchQuery]);

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Group commands by category
  const groupedCommands = React.useMemo(() => {
    const groups: { [key: string]: Command[] } = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  if (!isOpen) return null;

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
          paddingTop: '10vh'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          style={{
            width: '600px',
            maxWidth: '90vw',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '70vh'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)'
            }}
          >
            <Search size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Введите команду..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'var(--font-sans)'
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)'
              }}
            >
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

          {/* Commands List */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px 0'
            }}
          >
            {filteredCommands.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '13px'
                }}
              >
                Команды не найдены
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, categoryCommands]) => (
                <div key={category}>
                  <div
                    style={{
                      padding: '8px 16px 4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      color: 'var(--text-tertiary)',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {category}
                  </div>
                  {categoryCommands.map((cmd, index) => {
                    const globalIndex = filteredCommands.indexOf(cmd);
                    const isSelected = globalIndex === selectedIndex;
                    const Icon = cmd.icon;

                    return (
                      <div
                        key={cmd.id}
                        onClick={() => {
                          cmd.action();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '8px 16px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                          transition: 'background-color 0.1s ease'
                        }}
                      >
                        {Icon && (
                          <Icon 
                            size={16} 
                            style={{ 
                              color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                              flexShrink: 0
                            }} 
                          />
                        )}
                        <span
                          style={{
                            flex: 1,
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontSize: '13px'
                          }}
                        >
                          {cmd.label}
                        </span>
                        {cmd.shortcut && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '11px',
                              color: 'var(--text-tertiary)',
                              fontFamily: 'var(--font-mono)'
                            }}
                          >
                            {cmd.shortcut.split('+').map((key, i, arr) => (
                              <React.Fragment key={i}>
                                <kbd style={{ 
                                  padding: '2px 6px',
                                  backgroundColor: 'var(--bg-tertiary)',
                                  borderRadius: '3px',
                                  border: '1px solid var(--border-subtle)',
                                  fontSize: '10px'
                                }}>
                                  {key.trim()}
                                </kbd>
                                {i < arr.length - 1 && (
                                  <span style={{ margin: '0 2px' }}>+</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                        {isSelected && (
                          <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                        )}
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
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <kbd style={{ 
                  padding: '2px 4px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '2px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  ↑↓
                </kbd>
                {' '}навигация
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <kbd style={{ 
                  padding: '2px 4px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '2px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  Enter
                </kbd>
                {' '}выполнить
              </div>
            </div>
            <div>
              {filteredCommands.length} {filteredCommands.length === 1 ? 'команда' : 'команд'}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
