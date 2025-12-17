import React from 'react';

// Simple SVG Icon Components
export const FolderIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M10 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6H12L10 4Z" 
          fill="currentColor" />
  </svg>
);

export const FolderOpenIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M3 7C3 5.89543 3.89543 5 5 5H11L13 7H19C20.1046 7 21 7.89543 21 9V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V7Z" 
          fill="currentColor" />
  </svg>
);

export const FileIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" 
          stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

export const FileCodeIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" 
          stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M10 12L8 14L10 16M14 12L16 14L14 16" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const ChevronRightIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 12, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const SearchIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 14, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const PlusIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 12, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const XIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const CircleFilledIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 8, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
    <circle cx="12" cy="12" r="8" />
  </svg>
);

export const MessageSquareIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 14, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" 
          stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const SettingsIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 14, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M12.22 2H11.78L11 7H13L12.22 2Z" stroke="currentColor" strokeWidth="2" />
    <path d="M18.88 6.12L18.46 5.71L14.83 9.34L16.24 10.75L19.88 7.12C19.64 6.75 19.3 6.4 18.88 6.12Z" stroke="currentColor" strokeWidth="2" />
    <path d="M22 11.78V12.22L17 13V11L22 11.78Z" stroke="currentColor" strokeWidth="2" />
    <path d="M17.88 18.88C18.25 18.64 18.6 18.3 18.88 17.88L15.24 14.24L13.83 15.65L17.46 19.28L17.88 18.88Z" stroke="currentColor" strokeWidth="2" />
    <path d="M12.22 22H11.78L11 17H13L12.22 22Z" stroke="currentColor" strokeWidth="2" />
    <path d="M5.12 17.88L5.54 18.29L9.17 14.66L7.76 13.25L4.12 16.88C4.36 17.25 4.7 17.6 5.12 17.88Z" stroke="currentColor" strokeWidth="2" />
    <path d="M2 12.22V11.78L7 11V13L2 12.22Z" stroke="currentColor" strokeWidth="2" />
    <path d="M6.12 5.12C5.75 5.36 5.4 5.7 5.12 6.12L8.76 9.76L10.17 8.35L6.54 4.72L6.12 5.12Z" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const GitBranchIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 11, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M6 3V15" stroke="currentColor" strokeWidth="2" />
    <path d="M18 9V21" stroke="currentColor" strokeWidth="2" />
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M6 12C6 10.8954 6.89543 10 8 10H16C17.1046 10 18 10.8954 18 12" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const CheckCircleIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 10, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M9 11L12 14L22 4" stroke="currentColor" strokeWidth="2" />
    <path d="M21 12V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const AlertCircleIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 10, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 8V12" stroke="currentColor" strokeWidth="2" />
    <path d="M12 16H12.01" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const ClockIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 10, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const CpuIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 11, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M9 4V2M15 4V2M9 20V22M15 20V22M4 9H2M4 15H2M20 9H22M20 15H22" stroke="currentColor" strokeWidth="2" />
    <rect x="8" y="8" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const TerminalIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 14, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M6 8L10 12L6 16M14 16H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// File format icons
export const FileJsonIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* Left curly brace - elegant and detailed */}
    <path d="M7.5 5.5C6.8 6.8 6.5 8.2 7 9.5C7.2 10 7.2 10.8 7.2 11.5C7.2 12.2 7.2 12.5 7.2 13.2C7.2 14 7.2 14.5 7 15C6.5 16.3 6.8 17.7 7.5 19" 
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Right curly brace - elegant and detailed */}
    <path d="M16.5 5.5C17.2 6.8 17.5 8.2 17 9.5C16.8 10 16.8 10.8 16.8 11.5C16.8 12.2 16.8 12.5 16.8 13.2C16.8 14 16.8 14.5 17 15C17.5 16.3 17.2 17.7 16.5 19" 
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const FileMarkdownIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* Main arrow */}
    <path d="M8 7L12 11.5L16 7M12 11.5V4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    {/* M letter at top */}
    <path d="M10 4H14M10 4V7M14 4V7M11 5.5H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    {/* Bottom line */}
    <path d="M6 19H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const FileEnvIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* Gear outer circle */}
    <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2.2" fill="none" />
    {/* Gear teeth */}
    <rect x="11" y="6.5" width="2" height="3" rx="0.5" fill="currentColor" />
    <rect x="11" y="14.5" width="2" height="3" rx="0.5" fill="currentColor" />
    <rect x="6.5" y="11" width="3" height="2" rx="0.5" fill="currentColor" />
    <rect x="14.5" y="11" width="3" height="2" rx="0.5" fill="currentColor" />
    {/* Inner circle */}
    <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

export const FilePowershellIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* PowerShell prompt symbol - detailed > with PS */}
    <path d="M7.5 7.5L11.5 11.5L7.5 15.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Prompt line */}
    <path d="M14.5 14.5H17.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* PS indicator dots */}
    <circle cx="14.5" cy="9.5" r="0.8" fill="currentColor" />
    <circle cx="17" cy="9.5" r="0.8" fill="currentColor" />
  </svg>
);

export const FileTypeScriptConfigIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M6 7C6 7 5.5 8 6 9C6.5 10 6 11 6 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M18 7C18 7 18.5 8 18 9C17.5 10 18 11 18 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <circle cx="12" cy="9" r="1.5" fill="currentColor" />
  </svg>
);

export const FileJavaScriptIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* Left brace - more detailed */}
    <path d="M6 6.5C6 6.5 5.2 7 5.2 8.5C5.2 10 6 10.5 6 10.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M6 13.5C6 13.5 5.2 14 5.2 15.5C5.2 17 6 17.5 6 17.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Right brace - more detailed */}
    <path d="M18 6.5C18 6.5 18.8 7 18.8 8.5C18.8 10 18 10.5 18 10.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M18 13.5C18 13.5 18.8 14 18.8 15.5C18.8 17 18 17.5 18 17.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* JS letters */}
    <circle cx="10.2" cy="9.2" r="1.4" fill="currentColor" />
    <circle cx="13.8" cy="9.2" r="1.4" fill="currentColor" />
  </svg>
);

export const FileTypeScriptIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* Left brace - more detailed */}
    <path d="M6 6.5C6 6.5 5.2 7 5.2 8.5C5.2 10 6 10.5 6 10.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M6 13.5C6 13.5 5.2 14 5.2 15.5C5.2 17 6 17.5 6 17.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Right brace - more detailed */}
    <path d="M18 6.5C18 6.5 18.8 7 18.8 8.5C18.8 10 18 10.5 18 10.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M18 13.5C18 13.5 18.8 14 18.8 15.5C18.8 17 18 17.5 18 17.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* TS dot - larger and more prominent */}
    <circle cx="12" cy="9.2" r="2.2" fill="currentColor" />
  </svg>
);

export const FileTypeScriptJSXIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* Left brace - more detailed */}
    <path d="M6 6.5C6 6.5 5.2 7 5.2 8.5C5.2 10 6 10.5 6 10.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M6 13.5C6 13.5 5.2 14 5.2 15.5C5.2 17 6 17.5 6 17.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Right brace - more detailed */}
    <path d="M18 6.5C18 6.5 18.8 7 18.8 8.5C18.8 10 18 10.5 18 10.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M18 13.5C18 13.5 18.8 14 18.8 15.5C18.8 17 18 17.5 18 17.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* TS dot */}
    <circle cx="12" cy="9.2" r="2.2" fill="currentColor" />
    {/* JSX indicator - angle brackets more detailed */}
    <path d="M8.5 13.5L10.5 11.5L8.5 9.5M15.5 13.5L13.5 11.5L15.5 9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const FilePythonIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* Left snake head */}
    <circle cx="9.5" cy="11.5" r="2.8" stroke="currentColor" strokeWidth="2.3" fill="none" />
    {/* Right snake head */}
    <circle cx="14.5" cy="12.5" r="2.8" stroke="currentColor" strokeWidth="2.3" fill="none" />
    {/* Top connecting curve */}
    <path d="M9.5 8.7C9.5 8.7 10.2 7.2 12 7.2C13.8 7.2 14.5 8.7 14.5 8.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    {/* Bottom connecting curve */}
    <path d="M9.5 14.3C9.5 14.3 10.2 15.8 12 15.8C13.8 15.8 14.5 14.3 14.5 14.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    {/* Eye dots */}
    <circle cx="10" cy="10.5" r="0.6" fill="currentColor" />
    <circle cx="14" cy="11.5" r="0.6" fill="currentColor" />
  </svg>
);

export const FileTextIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* Text lines with more detail */}
    <path d="M6.5 8.5H17.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    <path d="M6.5 11.5H17.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    <path d="M6.5 14.5H15" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    <path d="M6.5 17.5H13" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    {/* Document corner indicator */}
    <path d="M15 5L18 8H15V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const FileImageIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* Image frame */}
    <rect x="6.5" y="7.5" width="11" height="9" rx="1.8" stroke="currentColor" strokeWidth="2.3" fill="none" />
    {/* Mountain peaks in background */}
    <path d="M7.5 14.5L9.5 12L11.5 13.5L14 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* Sun/circle */}
    <circle cx="9.5" cy="10" r="1.8" fill="currentColor" />
    {/* Landscape elements */}
    <path d="M7.5 16.5L16 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    {/* Corner fold effect */}
    <path d="M15 7.5L17.5 7.5L17.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const FileConfigIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    {/* Outer gear circle */}
    <circle cx="12" cy="12" r="4.8" stroke="currentColor" strokeWidth="2.2" fill="none" />
    {/* Gear teeth - 8 teeth */}
    <rect x="11" y="6" width="2" height="3.5" rx="0.6" fill="currentColor" />
    <rect x="11" y="14.5" width="2" height="3.5" rx="0.6" fill="currentColor" />
    <rect x="6" y="11" width="3.5" height="2" rx="0.6" fill="currentColor" />
    <rect x="14.5" y="11" width="3.5" height="2" rx="0.6" fill="currentColor" />
    {/* Diagonal teeth */}
    <rect x="14.8" y="7.8" width="2" height="3.5" rx="0.6" fill="currentColor" transform="rotate(45 15.8 9.55)" />
    <rect x="7.2" y="12.7" width="2" height="3.5" rx="0.6" fill="currentColor" transform="rotate(45 8.2 14.45)" />
    <rect x="14.8" y="12.7" width="2" height="3.5" rx="0.6" fill="currentColor" transform="rotate(-45 15.8 14.45)" />
    <rect x="7.2" y="7.8" width="2" height="3.5" rx="0.6" fill="currentColor" transform="rotate(-45 8.2 9.55)" />
    {/* Inner circle */}
    <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);