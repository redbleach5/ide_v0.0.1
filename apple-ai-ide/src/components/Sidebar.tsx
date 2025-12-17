import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  Search,
  Plus
} from 'lucide-react';
import {
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  FileCodeIcon,
  FileJsonIcon,
  FileMarkdownIcon,
  FileEnvIcon,
  FilePowershellIcon,
  FileTypeScriptConfigIcon,
  FileJavaScriptIcon,
  FileTypeScriptIcon,
  FileTypeScriptJSXIcon,
  FilePythonIcon,
  FileTextIcon,
  FileImageIcon,
  FileConfigIcon
} from './Icons';
import { FileNode, Project } from '../types';
import { logger } from '../utils/logger';

interface SidebarProps {
  project: Project | null;
  onFileOpen: (filePath: string) => void;
  onProjectOpen: (projectPath: string) => void;
}

interface FileTreeItemProps {
  node: FileNode;
  level: number;
  onFileOpen: (filePath: string) => void;
}

const getFileIcon = (fileName: string, isDirectory: boolean) => {
  if (isDirectory) {
    return FolderIcon;
  }

  const fileNameLower = fileName.toLowerCase();
  const extension = fileNameLower.split('.').pop()?.toLowerCase();
  
  // Special file names (check these first - use includes/startsWith for better matching)
  if (fileNameLower === '.env' || fileNameLower.startsWith('.env.')) {
    return FileEnvIcon;
  }
  if (fileNameLower === 'package.json' || fileNameLower === 'package-lock.json' || fileNameLower === 'package-simple.json') {
    return FileJsonIcon;
  }
  if (fileNameLower.startsWith('.git') || fileNameLower === '.gitignore' || fileNameLower === '.gitattributes' || fileNameLower === 'gitignore' || fileNameLower === 'gitattributes') {
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

const getFileIconColor = (fileName: string, isDirectory: boolean): string => {
  if (isDirectory) {
    return 'var(--accent-orange)';
  }

  const fileNameLower = fileName.toLowerCase();
  const extension = fileNameLower.split('.').pop()?.toLowerCase();
  
  // Special file names
  if (fileNameLower === '.env' || fileNameLower.startsWith('.env.')) {
    return 'var(--accent-green)'; // Green for env files
  }
  if (fileNameLower === 'package.json' || fileNameLower === 'package-lock.json' || fileNameLower === 'package-simple.json') {
    return 'var(--accent-orange)'; // Orange for package files
  }
  if (fileNameLower.startsWith('.git') || fileNameLower === 'gitignore' || fileNameLower === 'gitattributes') {
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

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, level, onFileOpen }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (node.isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onFileOpen(node.path);
    }
  };

  const Icon = node.isDirectory ? (isExpanded ? FolderOpenIcon : FolderIcon) : getFileIcon(node.name, node.isDirectory);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '2px 8px',
          cursor: 'pointer',
          backgroundColor: isHovered ? 'var(--bg-hover)' : 'transparent',
          borderRadius: 'var(--radius-xs)',
          paddingLeft: `${8 + level * 16}px`,
          height: '22px',
          gap: '4px'
        }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {node.isDirectory && (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />
          </motion.div>
        )}
        
        <Icon 
          size={20} 
          style={{ 
            color: getFileIconColor(node.name, node.isDirectory),
            flexShrink: 0
          }} 
        />
        
        <span 
          style={{ 
            fontSize: '12px',
            color: 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {node.name}
        </span>
      </div>

      <AnimatePresence>
        {isExpanded && node.children && node.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                level={level + 1}
                onFileOpen={onFileOpen}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ project, onFileOpen, onProjectOpen }) => {
  const [activeSection, setActiveSection] = useState<'explorer' | 'search'>('explorer');
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
          >
            Проводник
          </button>
          <button
            className={`btn btn-ghost btn-sm ${activeSection === 'search' ? 'text-primary' : 'text-secondary'}`}
            onClick={() => setActiveSection('search')}
          >
            Поиск
          </button>
        </div>

        {activeSection === 'explorer' && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleProjectOpen}
            title="Открыть проект"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeSection === 'explorer' ? (
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
                    letterSpacing: '0.5px'
                  }}
                >
                  {project.name}
                </div>
                
                {filteredFiles.map((file) => (
                  <FileTreeItem
                    key={file.path}
                    node={file}
                    level={0}
                    onFileOpen={onFileOpen}
                  />
                ))}
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
              <Search 
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