import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bookmark as BookmarkIcon, FileText, Edit2, Trash2, Navigation } from 'lucide-react';
import { bookmarkService, Bookmark } from '../services/bookmarkService';

interface BookmarksPanelProps {
  projectPath?: string;
  onClose: () => void;
  onNavigateToBookmark: (bookmark: Bookmark) => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  projectPath,
  onClose,
  onNavigateToBookmark
}) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (!projectPath) return;

    const unsubscribe = bookmarkService.subscribe(projectPath, (newBookmarks) => {
      setBookmarks(newBookmarks);
    });

    return unsubscribe;
  }, [projectPath]);

  const handleEdit = (bookmark: Bookmark) => {
    setEditingId(bookmark.id);
    setEditLabel(bookmark.label || '');
    setEditDescription(bookmark.description || '');
  };

  const handleSaveEdit = () => {
    if (!projectPath || !editingId) return;

    bookmarkService.updateBookmark(projectPath, editingId, {
      label: editLabel || undefined,
      description: editDescription || undefined
    });

    setEditingId(null);
    setEditLabel('');
    setEditDescription('');
  };

  const handleDelete = (bookmarkId: string) => {
    if (!projectPath) return;
    bookmarkService.removeBookmark(projectPath, bookmarkId);
  };

  const getFileName = (filePath: string): string => {
    return filePath.split(/[/\\]/).pop() || filePath;
  };

  const groupedBookmarks = bookmarks.reduce((acc, bookmark) => {
    const filePath = bookmark.filePath;
    if (!acc[filePath]) {
      acc[filePath] = [];
    }
    acc[filePath].push(bookmark);
    return acc;
  }, {} as Record<string, Bookmark[]>);

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
          <BookmarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Закладки ({bookmarks.length})
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
        {bookmarks.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <BookmarkIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Нет закладок</p>
            <p className="text-sm mt-2">Используйте Ctrl+Alt+K для добавления закладки</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedBookmarks).map(([filePath, fileBookmarks]) => (
              <div key={filePath} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* File header */}
                <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {getFileName(filePath)}
                    </span>
                  </div>
                </div>

                {/* Bookmarks list */}
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {fileBookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group"
                    >
                      {editingId === bookmark.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Название (необязательно)"
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            autoFocus
                          />
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Описание (необязательно)"
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Сохранить
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditLabel('');
                                setEditDescription('');
                              }}
                              className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => onNavigateToBookmark(bookmark)}
                            className="flex-1 text-left min-w-0"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <BookmarkIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                {bookmark.lineNumber}:{bookmark.column}
                              </span>
                              {bookmark.label && (
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {bookmark.label}
                                </span>
                              )}
                            </div>
                            {bookmark.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {bookmark.description}
                              </p>
                            )}
                          </button>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(bookmark)}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                              title="Редактировать"
                            >
                              <Edit2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                            </button>
                            <button
                              onClick={() => handleDelete(bookmark.id)}
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900"
                              title="Удалить"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
