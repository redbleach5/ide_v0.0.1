import React, { useState } from 'react';
import { 
  FolderIcon, 
  FolderOpenIcon, 
  FileIcon, 
  FileCodeIcon,
  FileJsonIcon,
  FileMarkdownIcon,
  FileEnvIcon,
  FilePowershellIcon,
  FileJavaScriptIcon,
  FileTypeScriptIcon,
  FileTypeScriptJSXIcon,
  FilePythonIcon,
  FileTextIcon,
  FileImageIcon,
  FileConfigIcon,
  SearchIcon,
  PlusIcon
} from './Icons';
import { FileNode, Project } from '../types';
import { AIToolsPanel } from './AIToolsPanel';
import { logger } from '../utils/logger';

interface SidebarProps {
  project: Project | null;
  onFileOpen: (filePath: string) => void;
  onProjectOpen: (projectPath: string) => void;
  onOpenInlineChat?: () => void;
  onOpenAIPanel?: () => void;
}

interface FileTreeItemProps {
  node: FileNode;
  level: number;
  onFileOpen: (filePath: string) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, level, onFileOpen }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (node.isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      // Don't open demo files - they don't exist on disk
      if (node.path.startsWith('/demo/')) {
        return;
      }
      onFileOpen(node.path);
    }
  };

  const getIcon = () => {
    if (node.isDirectory) {
      return isExpanded ? FolderOpenIcon : FolderIcon;
    }

    const fileName = node.name.toLowerCase();
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    // Special file names (check these first - use includes/startsWith for better matching)
    if (fileName === '.env' || fileName.startsWith('.env.')) {
      return FileEnvIcon;
    }
    if (fileName === 'package.json' || fileName === 'package-lock.json' || fileName === 'package-simple.json') {
      return FileJsonIcon;
    }
    if (fileName.startsWith('.git') || fileName === '.gitignore' || fileName === '.gitattributes' || fileName === 'gitignore' || fileName === 'gitattributes') {
      return FileConfigIcon;
    }
    
    // File extensions
    switch (extension) {
      case 'json':
      case 'jsonc':
        return FileJsonIcon;
      case 'md':
      case 'markdown':
        return FileMarkdownIcon;
      case 'env':
        return FileEnvIcon;
      case 'ps1':
      case 'psm1':
      case 'psd1':
        return FilePowershellIcon;
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return FileJavaScriptIcon;
      case 'ts':
        return FileTypeScriptIcon;
      case 'tsx':
        return FileTypeScriptJSXIcon;
      case 'py':
      case 'pyw':
      case 'pyc':
        return FilePythonIcon;
      case 'txt':
      case 'log':
      case 'readme':
        return FileTextIcon;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'ico':
      case 'webp':
      case 'bmp':
        return FileImageIcon;
      case 'yml':
      case 'yaml':
      case 'toml':
      case 'ini':
      case 'conf':
      case 'config':
        return FileConfigIcon;
      case 'java':
      case 'cpp':
      case 'c':
      case 'cs':
      case 'go':
      case 'rs':
      case 'php':
      case 'rb':
      case 'swift':
      case 'kt':
      case 'dart':
      case 'html':
      case 'htm':
      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
      case 'xml':
        return FileCodeIcon;
      default:
        return FileIcon;
    }
  };

  const getIconColor = () => {
    if (node.isDirectory) {
      return 'var(--accent-blue)';
    }

    const fileName = node.name.toLowerCase();
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    // Special file names
    if (fileName === '.env' || fileName.startsWith('.env.')) {
      return 'var(--accent-green)'; // Green for env files
    }
    if (fileName === 'package.json' || fileName === 'package-lock.json' || fileName === 'package-simple.json') {
      return 'var(--accent-orange)'; // Orange for package files
    }
    if (fileName.startsWith('.git') || fileName === 'gitignore' || fileName === 'gitattributes') {
      return 'var(--accent-purple)'; // Purple for git files
    }
    
    // File extensions
    switch (extension) {
      case 'json':
      case 'jsonc':
        return 'var(--accent-orange)'; // Orange for JSON
      case 'md':
      case 'markdown':
        return 'var(--accent-blue)'; // Blue for Markdown
      case 'env':
        return 'var(--accent-green)'; // Green for env
      case 'ps1':
      case 'psm1':
      case 'psd1':
        return '#0078D4'; // PowerShell blue
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return '#F7DF1E'; // JavaScript yellow
      case 'ts':
        return '#3178C6'; // TypeScript blue
      case 'tsx':
        return '#235A97'; // Darker blue for TSX (TypeScript + JSX)
      case 'py':
      case 'pyw':
      case 'pyc':
        return '#3776AB'; // Python blue
      case 'txt':
      case 'log':
      case 'readme':
        return 'var(--text-secondary)'; // Gray for text
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'ico':
      case 'webp':
      case 'bmp':
        return 'var(--accent-pink)'; // Pink for images
      case 'yml':
      case 'yaml':
      case 'toml':
      case 'ini':
      case 'conf':
      case 'config':
        return 'var(--accent-purple)'; // Purple for config
      case 'java':
        return '#ED8B00'; // Java orange
      case 'cpp':
      case 'c':
        return '#00599C'; // C/C++ blue
      case 'cs':
        return '#239120'; // C# green
      case 'go':
        return '#00ADD8'; // Go cyan
      case 'rs':
        return '#CE412B'; // Rust red-orange
      case 'php':
        return '#777BB4'; // PHP purple
      case 'rb':
        return '#CC342D'; // Ruby red
      case 'swift':
        return '#FA7343'; // Swift orange
      case 'kt':
        return '#0095D5'; // Kotlin blue
      case 'dart':
        return '#0175C2'; // Dart blue
      case 'html':
      case 'htm':
        return '#E34C26'; // HTML orange-red
      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
        return '#1572B6'; // CSS blue
      case 'xml':
        return '#FF6600'; // XML orange
      default:
        return 'var(--text-secondary)'; // Gray for unknown
    }
  };

  const Icon = getIcon();

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '2px 8px',
          cursor: node.path.startsWith('/demo/') ? 'not-allowed' : 'pointer',
          backgroundColor: isHovered && !node.path.startsWith('/demo/') ? 'var(--bg-hover)' : 'transparent',
          borderRadius: 'var(--radius-xs)',
          paddingLeft: `${8 + level * 16}px`,
          height: '22px',
          gap: '4px',
          opacity: node.path.startsWith('/demo/') ? 0.6 : 1
        }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {node.isDirectory && (
          <div
            style={{
              transition: 'transform 0.15s ease',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}
          >
            <ChevronRightIcon size={12} style={{ color: 'var(--text-tertiary)' }} />
          </div>
        )}
        
        <Icon 
          size={20} 
          style={{ 
            color: getIconColor(),
            flexShrink: 0
          }} 
        />
        
        <span 
          style={{ 
            fontSize: '12px',
            color: node.path.startsWith('/demo/') ? 'var(--text-tertiary)' : 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: node.path.startsWith('/demo/') ? 0.6 : 1,
            cursor: node.path.startsWith('/demo/') ? 'not-allowed' : 'pointer'
          }}
          title={node.path.startsWith('/demo/') ? 'Демо-файл (не существует на диске)' : node.path}
        >
          {node.name}
        </span>
      </div>

      {isExpanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onFileOpen={onFileOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ChevronRightIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 12, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const SidebarSimple: React.FC<SidebarProps> = ({ 
  project, 
  onFileOpen, 
  onProjectOpen,
  onOpenInlineChat,
  onOpenAIPanel
}) => {
  const [activeSection, setActiveSection] = useState<'explorer' | 'search' | 'ai-tools'>('explorer');
  const [searchQuery, setSearchQuery] = useState('');

  const handleProjectOpen = async () => {
    // Используем Electron API если доступен, иначе fallback на webkitdirectory
    if (window.electronAPI && window.electronAPI.showOpenDialog) {
      try {
        const result = await window.electronAPI.showOpenDialog({
          properties: ['openDirectory']
        });
        
        if (result.success && !result.canceled && result.filePaths && result.filePaths.length > 0) {
          onProjectOpen(result.filePaths[0]);
        }
      } catch (error) {
        logger.error('Failed to open project dialog:', error);
      }
    } else {
      // Fallback для браузера
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          // Extract the directory path from the first file
          const path = files[0].webkitRelativePath.split('/')[0];
          onProjectOpen(path);
        }
      };
      input.click();
    }
  };

  const filteredFiles = project?.files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div 
      style={{
        width: '240px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      {/* Header */}
      <div 
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '32px'
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className={`btn btn-ghost btn-sm ${activeSection === 'explorer' ? 'text-primary' : 'text-secondary'}`}
            onClick={() => setActiveSection('explorer')}
            title="Проводник файлов"
          >
            Проводник
          </button>
          <button
            className={`btn btn-ghost btn-sm ${activeSection === 'search' ? 'text-primary' : 'text-secondary'}`}
            onClick={() => setActiveSection('search')}
            title="Поиск файлов"
          >
            Поиск
          </button>
          <button
            className={`btn btn-ghost btn-sm ${activeSection === 'ai-tools' ? 'text-primary' : 'text-secondary'}`}
            onClick={() => setActiveSection('ai-tools')}
            title="AI Инструменты"
          >
            AI
          </button>
        </div>

        {activeSection === 'explorer' && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleProjectOpen}
            title="Открыть проект"
          >
            <PlusIcon size={12} />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeSection === 'ai-tools' ? (
          <AIToolsPanel
            onOpenInlineChat={onOpenInlineChat}
            onOpenAIPanel={onOpenAIPanel}
          />
        ) : activeSection === 'explorer' ? (
          <>
            {project ? (
              <div style={{ padding: '4px 0' }}>
                <div 
                  style={{
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }} title={project.path}>
                    {project.name}
                  </span>
                </div>
                
                {filteredFiles.length === 0 ? (
                  <div 
                    style={{
                      padding: '16px 12px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ marginBottom: '8px' }}>Файлы не найдены</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                      Возможно, проект открыт из неправильной директории
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleProjectOpen}
                      style={{ fontSize: '11px' }}
                    >
                      Переоткрыть проект
                    </button>
                  </div>
                ) : (
                  filteredFiles.map((file) => (
                    <FileTreeItem
                      key={file.path}
                      node={file}
                      level={0}
                      onFileOpen={onFileOpen}
                    />
                  ))
                )}
              </div>
            ) : (
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '200px',
                  gap: '12px',
                  padding: '20px',
                  textAlign: 'center'
                }}
              >
                <FolderIcon size={32} style={{ color: 'var(--text-tertiary)' }} />
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Проект не открыт
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleProjectOpen}
                >
                  Открыть проект
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '8px' }}>
            <div style={{ position: 'relative' }}>
              <SearchIcon 
                size={14} 
                style={{ 
                  position: 'absolute', 
                  left: '8px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)'
                }} 
              />
              <input
                className="input"
                type="text"
                placeholder="Поиск файлов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  paddingLeft: '32px',
                  fontSize: '12px',
                  height: '28px'
                }}
              />
            </div>
            
            {searchQuery && project && (
              <div style={{ marginTop: '8px' }}>
                <div 
                  style={{
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.5px'
                  }}
                >
                  Результаты поиска
                </div>
                
                {filteredFiles.length > 0 ? (
                  filteredFiles.map((file) => (
                    <FileTreeItem
                      key={file.path}
                      node={file}
                      level={0}
                      onFileOpen={onFileOpen}
                    />
                  ))
                ) : (
                  <div 
                    style={{
                      padding: '12px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      textAlign: 'center'
                    }}
                  >
                    Файлы не найдены
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};