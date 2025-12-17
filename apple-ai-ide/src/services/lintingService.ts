import { logger } from '../utils/logger';

export interface LintIssue {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule?: string;
  source?: string;
}

export interface LintResult {
  filePath: string;
  issues: LintIssue[];
  fixed?: boolean;
}

/**
 * Linting Service - provides linting and formatting capabilities
 * Note: This is a basic implementation. For production, integrate with ESLint, Prettier, etc.
 */
export class LintingService {
  /**
   * Lint a file
   */
  async lintFile(filePath: string, content: string, language: string): Promise<LintResult> {
    const issues: LintIssue[] = [];

    // Basic linting rules (can be extended with actual ESLint/Prettier)
    if (language === 'javascript' || language === 'typescript') {
      // Check for console.log (warning)
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('console.log') && !line.trim().startsWith('//')) {
          issues.push({
            line: index + 1,
            column: line.indexOf('console.log') + 1,
            severity: 'warning',
            message: 'Unexpected console.log statement',
            rule: 'no-console',
            source: 'ESLint'
          });
        }

        // Check for == instead of ===
        if (line.includes(' == ') && !line.trim().startsWith('//')) {
          issues.push({
            line: index + 1,
            column: line.indexOf(' == ') + 1,
            severity: 'warning',
            message: 'Use === instead of ==',
            rule: 'eqeqeq',
            source: 'ESLint'
          });
        }

        // Check for var instead of let/const
        const varMatch = line.match(/\bvar\s+\w+/);
        if (varMatch && !line.trim().startsWith('//')) {
          issues.push({
            line: index + 1,
            column: varMatch.index! + 1,
            severity: 'warning',
            message: 'Use let or const instead of var',
            rule: 'no-var',
            source: 'ESLint'
          });
        }
      });
    }

    return {
      filePath,
      issues
    };
  }

  /**
   * Format a file
   */
  async formatFile(filePath: string, content: string, language: string): Promise<string> {
    // Basic formatting (can be extended with Prettier)
    let formatted = content;

    // Remove trailing whitespace
    formatted = formatted.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');

    // Ensure file ends with newline
    if (!formatted.endsWith('\n')) {
      formatted += '\n';
    }

    // Basic indentation fix (simple, can be improved)
    if (language === 'javascript' || language === 'typescript') {
      // This is a very basic formatter - in production, use Prettier
      formatted = this.basicFormatJavaScript(formatted);
    }

    return formatted;
  }

  /**
   * Basic JavaScript formatter (very simple, use Prettier in production)
   */
  private basicFormatJavaScript(content: string): string {
    // Remove multiple blank lines
    content = content.replace(/\n{3,}/g, '\n\n');

    // Basic semicolon insertion (very basic)
    const lines = content.split('\n');
    const formatted: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        formatted.push('');
        continue;
      }

      // Add semicolon if missing (very basic check)
      if (
        trimmed &&
        !trimmed.endsWith(';') &&
        !trimmed.endsWith('{') &&
        !trimmed.endsWith('}') &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('if') &&
        !trimmed.startsWith('for') &&
        !trimmed.startsWith('while') &&
        !trimmed.startsWith('function') &&
        !trimmed.startsWith('const') &&
        !trimmed.startsWith('let') &&
        !trimmed.startsWith('var') &&
        !trimmed.startsWith('return') &&
        !trimmed.startsWith('export') &&
        !trimmed.startsWith('import')
      ) {
        line = line + ';';
      }

      formatted.push(line);
    }

    return formatted.join('\n');
  }

  /**
   * Fix auto-fixable issues
   */
  async fixFile(filePath: string, content: string, language: string): Promise<{ content: string; fixed: boolean }> {
    let fixed = content;
    let hasFixes = false;

    if (language === 'javascript' || language === 'typescript') {
      // Fix == to ===
      const beforeFix = fixed;
      fixed = fixed.replace(/(\w+)\s*==\s*(\w+)/g, '$1 === $2');
      if (fixed !== beforeFix) {
        hasFixes = true;
      }

      // Fix var to const (simple cases)
      fixed = fixed.replace(/\bvar\s+(\w+)\s*=/g, 'const $1 =');
      if (fixed !== content) {
        hasFixes = true;
      }
    }

    return {
      content: fixed,
      fixed: hasFixes
    };
  }
}

export const lintingService = new LintingService();
