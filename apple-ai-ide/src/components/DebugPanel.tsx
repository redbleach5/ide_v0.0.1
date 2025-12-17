import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  StepForward, 
  ArrowRight, 
  ArrowLeft, 
  Square, 
  Bug, 
  X,
  ChevronDown,
  ChevronRight,
  Circle,
  Settings
} from 'lucide-react';
import { 
  debugService, 
  DebugSession, 
  Breakpoint, 
  WatchExpression,
  DebugConfiguration 
} from '../services/debugService';
import { logger } from '../utils/logger';

interface DebugPanelProps {
  projectPath?: string;
  onClose: () => void;
  onNavigateToFile: (filePath: string, line: number) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  projectPath,
  onClose,
  onNavigateToFile
}) => {
  const [session, setSession] = useState<DebugSession | null>(null);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [watchExpressions, setWatchExpressions] = useState<WatchExpression[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    variables: true,
    watch: true,
    callStack: true,
    breakpoints: true
  });
  const [newWatchExpression, setNewWatchExpression] = useState('');

  useEffect(() => {
    const activeSession = debugService.getActiveSession();
    setSession(activeSession);
    setBreakpoints(debugService.getAllBreakpoints());
    
    if (activeSession) {
      setWatchExpressions(debugService.getWatchExpressions(activeSession.id));
    }
  }, []);

  const handleStart = async () => {
    if (!projectPath) {
      logger.warn('No project path for debugging');
      return;
    }

    // Create default configuration
    const config: DebugConfiguration = {
      type: 'node',
      name: 'Launch',
      request: 'launch',
      program: '${workspaceFolder}/index.js',
      console: 'integratedTerminal'
    };

    const newSession = debugService.createSession(config);
    await debugService.startSession(newSession.id);
    setSession(newSession);
    setBreakpoints(debugService.getAllBreakpoints());
  };

  const handleStop = async () => {
    if (!session) return;
    await debugService.stopSession(session.id);
    setSession(null);
  };

  const handleContinue = async () => {
    if (!session) return;
    await debugService.continue(session.id);
    setSession(debugService.getSession(session.id));
  };

  const handlePause = async () => {
    if (!session) return;
    await debugService.pause(session.id);
    setSession(debugService.getSession(session.id));
  };

  const handleStepOver = async () => {
    if (!session) return;
    await debugService.stepOver(session.id);
    setSession(debugService.getSession(session.id));
  };

  const handleStepInto = async () => {
    if (!session) return;
    await debugService.stepInto(session.id);
    setSession(debugService.getSession(session.id));
  };

  const handleStepOut = async () => {
    if (!session) return;
    await debugService.stepOut(session.id);
    setSession(debugService.getSession(session.id));
  };

  const handleAddWatch = () => {
    if (!session || !newWatchExpression.trim()) return;
    debugService.addWatchExpression(session.id, newWatchExpression.trim());
    setWatchExpressions(debugService.getWatchExpressions(session.id));
    setNewWatchExpression('');
  };

  const handleRemoveWatch = (watchId: string) => {
    if (!session) return;
    debugService.removeWatchExpression(session.id, watchId);
    setWatchExpressions(debugService.getWatchExpressions(session.id));
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getFileName = (filePath: string): string => {
    return filePath.split(/[/\\]/).pop() || filePath;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Отладка
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {!session ? (
          <button
            onClick={handleStart}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Начать отладку (F5)"
          >
            <Play className="w-4 h-4 text-green-600 dark:text-green-400" />
          </button>
        ) : (
          <>
            {session.status === 'running' ? (
              <button
                onClick={handlePause}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Приостановить (Ctrl+Shift+F5)"
              >
                <Pause className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              </button>
            ) : (
              <button
                onClick={handleContinue}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Продолжить (F5)"
              >
                <Play className="w-4 h-4 text-green-600 dark:text-green-400" />
              </button>
            )}
            <button
              onClick={handleStepOver}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Шаг с обходом (F10)"
              disabled={session.status !== 'paused'}
            >
              <StepForward className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleStepInto}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Шаг с заходом (F11)"
              disabled={session.status !== 'paused'}
            >
              <ArrowRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleStepOut}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Шаг с выходом (Shift+F11)"
              disabled={session.status !== 'paused'}
            >
              <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleStop}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Остановить (Shift+F5)"
            >
              <Square className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Variables */}
        {session && (
          <div>
            <button
              onClick={() => toggleSection('variables')}
              className="w-full flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {expandedSections.variables ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Переменные
            </button>
            {expandedSections.variables && (
              <div className="ml-6 space-y-1">
                {session.variables.length === 0 ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Нет переменных</div>
                ) : (
                  session.variables.map((variable, index) => (
                    <div key={index} className="text-xs font-mono">
                      <span className="text-gray-600 dark:text-gray-400">{variable.name}:</span>{' '}
                      <span className="text-gray-800 dark:text-gray-200">{variable.value}</span>
                      {variable.type && (
                        <span className="text-gray-500 dark:text-gray-500 ml-2">({variable.type})</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Watch */}
        {session && (
          <div>
            <button
              onClick={() => toggleSection('watch')}
              className="w-full flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {expandedSections.watch ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Наблюдение
            </button>
            {expandedSections.watch && (
              <div className="ml-6 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWatchExpression}
                    onChange={(e) => setNewWatchExpression(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddWatch()}
                    placeholder="Выражение..."
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={handleAddWatch}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    +
                  </button>
                </div>
                {watchExpressions.map((watch) => (
                  <div key={watch.id} className="flex items-center justify-between text-xs">
                    <div className="flex-1">
                      <div className="font-mono text-gray-700 dark:text-gray-300">{watch.expression}</div>
                      {watch.value && (
                        <div className="text-gray-500 dark:text-gray-400">{watch.value}</div>
                      )}
                      {watch.error && (
                        <div className="text-red-500">{watch.error}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveWatch(watch.id)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Call Stack */}
        {session && (
          <div>
            <button
              onClick={() => toggleSection('callStack')}
              className="w-full flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {expandedSections.callStack ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Стек вызовов
            </button>
            {expandedSections.callStack && (
              <div className="ml-6 space-y-1">
                {session.stackFrames.length === 0 ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Стек пуст</div>
                ) : (
                  session.stackFrames.map((frame) => (
                    <button
                      key={frame.id}
                      onClick={() => onNavigateToFile(frame.file, frame.line)}
                      className="w-full text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-900 p-1 rounded"
                    >
                      <div className="font-medium text-gray-700 dark:text-gray-300">{frame.name}</div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {getFileName(frame.file)}:{frame.line}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Breakpoints */}
        <div>
          <button
            onClick={() => toggleSection('breakpoints')}
            className="w-full flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {expandedSections.breakpoints ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Точки останова ({breakpoints.length})
          </button>
          {expandedSections.breakpoints && (
            <div className="ml-6 space-y-1">
              {breakpoints.length === 0 ? (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Нет точек останова. Кликните слева от номера строки для добавления.
                </div>
              ) : (
                breakpoints.map((bp) => (
                  <button
                    key={bp.id}
                    onClick={() => onNavigateToFile(bp.filePath, bp.lineNumber)}
                    className="w-full text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-900 p-1 rounded flex items-center gap-2"
                  >
                    <Circle className="w-3 h-3 fill-red-500 text-red-500" />
                    <div>
                      <div className="font-medium text-gray-700 dark:text-gray-300">
                        {getFileName(bp.filePath)}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        Строка {bp.lineNumber}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
