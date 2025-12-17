import { logger } from '../utils/logger';
import { generateIds } from '../utils/idGenerator';

export interface Bookmark {
  id: string;
  filePath: string;
  lineNumber: number;
  column: number;
  label?: string;
  description?: string;
  createdAt: number;
}

class BookmarkService {
  private bookmarks: Map<string, Bookmark[]> = new Map(); // projectPath -> bookmarks
  private listeners: Set<(bookmarks: Bookmark[]) => void> = new Set();

  /**
   * Add a bookmark
   */
  addBookmark(
    projectPath: string,
    filePath: string,
    lineNumber: number,
    column: number,
    label?: string,
    description?: string
  ): Bookmark {
    const bookmark: Bookmark = {
      id: generateIds.bookmark(),
      filePath,
      lineNumber,
      column,
      label,
      description,
      createdAt: Date.now()
    };

    const bookmarks = this.getBookmarks(projectPath);
    bookmarks.push(bookmark);
    this.bookmarks.set(projectPath, bookmarks);
    this.notifyListeners(projectPath);
    
    logger.debug('Bookmark added:', bookmark);
    return bookmark;
  }

  /**
   * Remove a bookmark
   */
  removeBookmark(projectPath: string, bookmarkId: string): void {
    const bookmarks = this.getBookmarks(projectPath);
    const filtered = bookmarks.filter(b => b.id !== bookmarkId);
    this.bookmarks.set(projectPath, filtered);
    this.notifyListeners(projectPath);
    logger.debug('Bookmark removed:', bookmarkId);
  }

  /**
   * Toggle bookmark (add if not exists, remove if exists)
   */
  toggleBookmark(
    projectPath: string,
    filePath: string,
    lineNumber: number,
    column: number
  ): { bookmark: Bookmark | null; removed: boolean } {
    const bookmarks = this.getBookmarks(projectPath);
    const existing = bookmarks.find(
      b => b.filePath === filePath && b.lineNumber === lineNumber
    );

    if (existing) {
      this.removeBookmark(projectPath, existing.id);
      return { bookmark: null, removed: true };
    } else {
      const bookmark = this.addBookmark(projectPath, filePath, lineNumber, column);
      return { bookmark, removed: false };
    }
  }

  /**
   * Get all bookmarks for a project
   */
  getBookmarks(projectPath: string): Bookmark[] {
    return this.bookmarks.get(projectPath) || [];
  }

  /**
   * Get bookmark at specific location
   */
  getBookmarkAt(
    projectPath: string,
    filePath: string,
    lineNumber: number
  ): Bookmark | null {
    const bookmarks = this.getBookmarks(projectPath);
    return bookmarks.find(
      b => b.filePath === filePath && b.lineNumber === lineNumber
    ) || null;
  }

  /**
   * Update bookmark
   */
  updateBookmark(
    projectPath: string,
    bookmarkId: string,
    updates: Partial<Pick<Bookmark, 'label' | 'description'>>
  ): Bookmark | null {
    const bookmarks = this.getBookmarks(projectPath);
    const index = bookmarks.findIndex(b => b.id === bookmarkId);
    
    if (index === -1) return null;

    const updated = { ...bookmarks[index], ...updates };
    bookmarks[index] = updated;
    this.bookmarks.set(projectPath, bookmarks);
    this.notifyListeners(projectPath);
    
    logger.debug('Bookmark updated:', updated);
    return updated;
  }

  /**
   * Clear all bookmarks for a project
   */
  clearBookmarks(projectPath: string): void {
    this.bookmarks.delete(projectPath);
    this.notifyListeners(projectPath);
    logger.debug('Bookmarks cleared for project:', projectPath);
  }

  /**
   * Subscribe to bookmark changes
   */
  subscribe(
    projectPath: string,
    callback: (bookmarks: Bookmark[]) => void
  ): () => void {
    this.listeners.add(callback);
    
    // Initial call
    callback(this.getBookmarks(projectPath));

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(projectPath: string): void {
    const bookmarks = this.getBookmarks(projectPath);
    this.listeners.forEach(callback => {
      try {
        callback(bookmarks);
      } catch (error) {
        logger.error('Error in bookmark listener:', error);
      }
    });
  }
}

export const bookmarkService = new BookmarkService();
