import { logger } from '../utils/logger';

export interface GitStatus {
  branch: string;
  isClean: boolean;
  modifiedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
  conflictedFiles: string[];
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | 'conflicted' | 'staged';
  originalPath?: string; // For renamed files
}

export interface GitDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
}

class GitService {
  /**
   * Check if Git is available on the system
   */
  async isGitAvailable(projectPath?: string): Promise<boolean> {
    if (!window.electronAPI?.git) {
      return false;
    }

    try {
      // Try to execute a simple git command to check if git is available
      // Use projectPath if provided, otherwise try to get current working directory
      // Fallback to '.' if process.cwd is not available (browser environment)
      let testPath: string;
      if (projectPath) {
        testPath = projectPath;
      } else if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
        testPath = process.cwd();
      } else {
        // Browser environment - use current directory as fallback
        testPath = '.';
      }
      const result = await this.executeGitCommand(testPath, '--version');
      return result.success;
    } catch (error) {
      logger.debug('Git is not available:', error);
      return false;
    }
  }

  /**
   * Check if a directory is a git repository
   */
  async isGitRepository(projectPath: string): Promise<boolean> {
    if (!window.electronAPI?.git) {
      return false;
    }

    try {
      const result = await window.electronAPI.git.isRepository(projectPath);
      return result?.isRepository || false;
    } catch (error) {
      logger.debug('Error checking git repository:', error);
      return false;
    }
  }

  /**
   * Get git status for the repository
   */
  async getStatus(projectPath: string): Promise<GitStatus | null> {
    if (!window.electronAPI?.git) {
      logger.warn('Git API not available');
      return null;
    }

    try {
      const isRepo = await this.isGitRepository(projectPath);
      if (!isRepo) {
        return null;
      }

      // Execute git status command
      const statusResult = await this.executeGitCommand(projectPath, 'status --porcelain');
      if (!statusResult.success) {
        // If git command failed (e.g., git not installed), return null gracefully
        logger.debug('Git status command failed:', statusResult.error);
        return null;
      }

      const branchResult = await this.executeGitCommand(projectPath, 'branch --show-current');
      const branch = branchResult.success && branchResult.output 
        ? branchResult.output.trim() 
        : 'main';

      const lines = (statusResult.output || '').split('\n').filter(Boolean);
      const modifiedFiles: string[] = [];
      const untrackedFiles: string[] = [];
      const stagedFiles: string[] = [];
      const conflictedFiles: string[] = [];

      lines.forEach(line => {
        const status = line.substring(0, 2);
        const filePath = line.substring(3).trim();

        if (status.includes('U') || (status.includes('A') && status.includes('A'))) {
          conflictedFiles.push(filePath);
        } else if (status.startsWith('??')) {
          untrackedFiles.push(filePath);
        } else if (status.startsWith(' ')) {
          // Modified but not staged
          modifiedFiles.push(filePath);
        } else if (status.startsWith('M') || status.startsWith('A') || status.startsWith('D')) {
          // Staged changes
          stagedFiles.push(filePath);
          if (status.charAt(1) === 'M' || status.charAt(1) === 'D') {
            modifiedFiles.push(filePath);
          }
        }
      });

      return {
        branch,
        isClean: lines.length === 0,
        modifiedFiles,
        untrackedFiles,
        stagedFiles,
        conflictedFiles
      };
    } catch (error) {
      logger.error('Error getting git status:', error);
      return null;
    }
  }

  /**
   * Get file status
   */
  async getFileStatus(projectPath: string, filePath: string): Promise<GitFileStatus | null> {
    const status = await this.getStatus(projectPath);
    if (!status) return null;

    const relativePath = filePath.replace(projectPath + '/', '').replace(projectPath + '\\', '');

    if (status.conflictedFiles.includes(relativePath)) {
      return { path: filePath, status: 'conflicted' };
    }
    if (status.stagedFiles.includes(relativePath)) {
      return { path: filePath, status: 'staged' };
    }
    if (status.modifiedFiles.includes(relativePath)) {
      return { path: filePath, status: 'modified' };
    }
    if (status.untrackedFiles.includes(relativePath)) {
      return { path: filePath, status: 'untracked' };
    }

    return null;
  }

  /**
   * Get diff for a file
   */
  async getDiff(projectPath: string, filePath: string): Promise<GitDiff | null> {
    if (!window.electronAPI?.terminal) {
      return null;
    }

    try {
      const relativePath = filePath.replace(projectPath + '/', '').replace(projectPath + '\\', '');
      const result = await this.executeGitCommand(projectPath, `diff ${relativePath}`);

      if (!result.success || !result.output) {
        return null;
      }

      const diff = result.output;
      const additions = (diff.match(/^\+/gm) || []).length;
      const deletions = (diff.match(/^-/gm) || []).length;

      return {
        path: filePath,
        diff,
        additions,
        deletions
      };
    } catch (error) {
      logger.error('Error getting git diff:', error);
      return null;
    }
  }

  /**
   * Stage a file
   */
  async stageFile(projectPath: string, filePath: string): Promise<boolean> {
    const relativePath = filePath.replace(projectPath + '/', '').replace(projectPath + '\\', '');
    const result = await this.executeGitCommand(projectPath, `add "${relativePath}"`);
    return result.success;
  }

  /**
   * Unstage a file
   */
  async unstageFile(projectPath: string, filePath: string): Promise<boolean> {
    const relativePath = filePath.replace(projectPath + '/', '').replace(projectPath + '\\', '');
    const result = await this.executeGitCommand(projectPath, `reset HEAD "${relativePath}"`);
    return result.success;
  }

  /**
   * Commit changes
   */
  async commit(projectPath: string, message: string): Promise<boolean> {
    const result = await this.executeGitCommand(projectPath, `commit -m "${message.replace(/"/g, '\\"')}"`);
    return result.success;
  }

  /**
   * Push changes to remote
   */
  async push(projectPath: string, branch?: string, remote: string = 'origin'): Promise<boolean> {
    const branchArg = branch ? ` ${remote} ${branch}` : '';
    const result = await this.executeGitCommand(projectPath, `push${branchArg}`);
    return result.success;
  }

  /**
   * Pull changes from remote
   */
  async pull(projectPath: string, branch?: string, remote: string = 'origin'): Promise<boolean> {
    const branchArg = branch ? ` ${remote} ${branch}` : '';
    const result = await this.executeGitCommand(projectPath, `pull${branchArg}`);
    return result.success;
  }

  /**
   * Get list of branches
   */
  async getBranches(projectPath: string): Promise<{ local: string[]; remote: string[]; current: string }> {
    const localResult = await this.executeGitCommand(projectPath, 'branch --format="%(refname:short)"');
    const remoteResult = await this.executeGitCommand(projectPath, 'branch -r --format="%(refname:short)"');
    const currentResult = await this.executeGitCommand(projectPath, 'branch --show-current');

    const local = localResult.success && localResult.output
      ? localResult.output.trim().split('\n').filter(Boolean)
      : [];
    
    const remote = remoteResult.success && remoteResult.output
      ? remoteResult.output.trim().split('\n').filter(Boolean).map(b => b.replace(/^origin\//, ''))
      : [];

    const current = currentResult.success && currentResult.output
      ? currentResult.output.trim()
      : 'main';

    return { local, remote, current };
  }

  /**
   * Switch branch
   */
  async switchBranch(projectPath: string, branchName: string): Promise<boolean> {
    const result = await this.executeGitCommand(projectPath, `checkout ${branchName}`);
    return result.success;
  }

  /**
   * Create new branch
   */
  async createBranch(projectPath: string, branchName: string): Promise<boolean> {
    const result = await this.executeGitCommand(projectPath, `checkout -b ${branchName}`);
    return result.success;
  }

  /**
   * Get git blame for a file
   */
  async getBlame(projectPath: string, filePath: string): Promise<Array<{ line: number; commit: string; author: string; date: string; content: string }> | null> {
    try {
      const relativePath = filePath.replace(projectPath + '/', '').replace(projectPath + '\\', '');
      const result = await this.executeGitCommand(projectPath, `blame -w -M -C "${relativePath}"`);

      if (!result.success || !result.output) {
        return null;
      }

      const lines = result.output.split('\n');
      const blameData: Array<{ line: number; commit: string; author: string; date: string; content: string }> = [];

      lines.forEach((line, index) => {
        // Git blame format: commit author date line content
        const match = line.match(/^(\S+)\s+\((.+?)\s+(\d{4}-\d{2}-\d{2})\s+\d+\)\s+(.+)$/);
        if (match) {
          blameData.push({
            line: index + 1,
            commit: match[1],
            author: match[2],
            date: match[3],
            content: match[4]
          });
        }
      });

      return blameData;
    } catch (error) {
      logger.error('Error getting git blame:', error);
      return null;
    }
  }

  /**
   * Get commit history
   */
  async getCommitHistory(projectPath: string, limit: number = 20): Promise<Array<{ hash: string; author: string; date: string; message: string }> | null> {
    try {
      const result = await this.executeGitCommand(
        projectPath,
        `log --pretty=format:"%H|%an|%ad|%s" --date=short -n ${limit}`
      );

      if (!result.success || !result.output) {
        return null;
      }

      const lines = result.output.trim().split('\n');
      return lines.map(line => {
        const [hash, author, date, ...messageParts] = line.split('|');
        return {
          hash: hash || '',
          author: author || '',
          date: date || '',
          message: messageParts.join('|') || ''
        };
      });
    } catch (error) {
      logger.error('Error getting commit history:', error);
      return null;
    }
  }

  /**
   * Execute git command
   */
  private async executeGitCommand(
    projectPath: string,
    command: string
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    if (!window.electronAPI?.git) {
      return { success: false, error: 'Git API not available' };
    }

    try {
      const result = await window.electronAPI.git.execute(projectPath, command);
      return {
        success: result.success,
        output: result.output,
        error: result.error
      };
    } catch (error) {
      logger.error('Error executing git command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const gitService = new GitService();
