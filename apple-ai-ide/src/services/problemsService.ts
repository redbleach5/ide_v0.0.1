import { Problem } from '../components/ProblemsPanel';
import { logger } from '../utils/logger';

class ProblemsService {
  private problems: Map<string, Problem[]> = new Map();
  private listeners: Set<(problems: Problem[]) => void> = new Set();

  /**
   * Update problems for a file
   */
  updateProblems(filePath: string, diagnostics: any[]): void {
    const problems: Problem[] = diagnostics.map((diagnostic, index) => {
      const severity = diagnostic.severity === 1 
        ? 'error' 
        : diagnostic.severity === 2 
        ? 'warning' 
        : 'info';

      return {
        id: `${filePath}-${diagnostic.startLineNumber}-${diagnostic.startColumn}-${index}`,
        file: filePath,
        line: diagnostic.startLineNumber || 1,
        column: diagnostic.startColumn || 1,
        severity,
        message: diagnostic.message || 'Unknown problem',
        source: diagnostic.source,
        code: diagnostic.code
      };
    });

    this.problems.set(filePath, problems);
    this.notifyListeners();
  }

  /**
   * Remove problems for a file
   */
  removeProblems(filePath: string): void {
    this.problems.delete(filePath);
    this.notifyListeners();
  }

  /**
   * Get all problems
   */
  getAllProblems(): Problem[] {
    const allProblems: Problem[] = [];
    this.problems.forEach(problems => {
      allProblems.push(...problems);
    });
    return allProblems.sort((a, b) => {
      // Sort by file, then by line, then by column
      if (a.file !== b.file) {
        return a.file.localeCompare(b.file);
      }
      if (a.line !== b.line) {
        return a.line - b.line;
      }
      return a.column - b.column;
    });
  }

  /**
   * Get problems for a specific file
   */
  getProblemsForFile(filePath: string): Problem[] {
    return this.problems.get(filePath) || [];
  }

  /**
   * Subscribe to problems changes
   */
  subscribe(callback: (problems: Problem[]) => void): () => void {
    this.listeners.add(callback);
    // Immediately call with current problems
    callback(this.getAllProblems());

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const allProblems = this.getAllProblems();
    this.listeners.forEach(callback => {
      try {
        callback(allProblems);
      } catch (error) {
        logger.error('Error in problems listener:', error);
      }
    });
  }

  /**
   * Clear all problems
   */
  clear(): void {
    this.problems.clear();
    this.notifyListeners();
  }
}

export const problemsService = new ProblemsService();
