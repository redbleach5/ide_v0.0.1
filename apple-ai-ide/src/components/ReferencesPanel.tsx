import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, ExternalLink } from 'lucide-react';
import { ReferenceLocation } from '../services/navigationService';

interface ReferencesPanelProps {
  references: ReferenceLocation[];
  onClose: () => void;
  onNavigateToReference: (reference: ReferenceLocation) => void;
}

export const ReferencesPanel: React.FC<ReferencesPanelProps> = ({
  references,
  onClose,
  onNavigateToReference
}) => {
  const [groupedReferences, setGroupedReferences] = useState<Map<string, ReferenceLocation[]>>(new Map());

  useEffect(() => {
    // Group references by file
    const grouped = new Map<string, ReferenceLocation[]>();
    for (const ref of references) {
      const filePath = ref.uri;
      if (!grouped.has(filePath)) {
        grouped.set(filePath, []);
      }
      grouped.get(filePath)!.push(ref);
    }
    setGroupedReferences(grouped);
  }, [references]);

  const getFileName = (filePath: string): string => {
    return filePath.split(/[/\\]/).pop() || filePath;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Найдено использований: {references.length}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {groupedReferences.size === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              Использования не найдены
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(groupedReferences.entries()).map(([filePath, fileReferences]) => (
                <div key={filePath} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* File header */}
                  <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {getFileName(filePath)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        ({fileReferences.length})
                      </span>
                    </div>
                  </div>

                  {/* References list */}
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {fileReferences.map((ref, index) => (
                      <button
                        key={index}
                        onClick={() => onNavigateToReference(ref)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                {ref.range.startLineNumber}:{ref.range.startColumn}
                              </span>
                              <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 font-mono truncate">
                              {ref.text || '...'}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
