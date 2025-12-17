import { logger } from '../utils/logger';
import { codebaseIndexService, CodeSymbol } from './codebaseIndexService';
import { fileService } from './fileService';

export interface DefinitionLocation {
  uri: string;
  filePath: string; // Original file path
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export interface ReferenceLocation {
  uri: string;
  filePath: string; // Original file path
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  text: string;
}

export interface RenameLocation {
  uri: string;
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  newText: string;
}

/**
 * Service for code navigation: Go to Definition, Find References, Rename Symbol
 */
export class NavigationService {
  /**
   * Find definition of symbol at given position
   */
  async findDefinition(
    filePath: string,
    lineNumber: number,
    column: number,
    projectPath?: string
  ): Promise<DefinitionLocation | null> {
    if (!projectPath) {
      logger.debug('No project path provided for findDefinition');
      return null;
    }

    try {
      const index = codebaseIndexService.getIndex(projectPath);
      if (!index) {
        logger.debug('No index available for findDefinition');
        return null;
      }

      // Get file content to find symbol at position
      const content = await fileService.readFile(filePath, false);
      const lines = content.split('\n');
      const currentLine = lines[lineNumber - 1] || '';
      
      // Extract symbol name at cursor position
      const symbolName = this.extractSymbolAtPosition(currentLine, column);
      if (!symbolName) {
        logger.debug('No symbol found at position', { filePath, lineNumber, column });
        return null;
      }

      logger.debug('Finding definition for symbol:', { symbolName, filePath, lineNumber, column });

      // Search for symbol definition in index
      const symbolEntries = Array.from(index.symbols.entries());
      for (const [, symbols] of symbolEntries) {
        for (const symbol of symbols) {
          if (symbol.name === symbolName) {
            // Found definition
            const definition: DefinitionLocation = {
              uri: `file://${symbol.filePath}`,
              filePath: symbol.filePath,
              range: {
                startLineNumber: symbol.lineNumber,
                startColumn: 1,
                endLineNumber: symbol.lineNumber,
                endColumn: 1
              }
            };
            logger.debug('Definition found:', definition);
            return definition;
          }
        }
      }

      // If not found in index, try to find in current file
      const localDefinition = this.findLocalDefinition(content, symbolName, lineNumber);
      if (localDefinition) {
        return {
          uri: `file://${filePath}`,
          filePath: filePath,
          range: localDefinition
        };
      }

      return null;
    } catch (error) {
      logger.error('Error finding definition:', error);
      return null;
    }
  }

  /**
   * Find all references to symbol at given position
   */
  async findReferences(
    filePath: string,
    lineNumber: number,
    column: number,
    projectPath?: string
  ): Promise<ReferenceLocation[]> {
    if (!projectPath) {
      logger.debug('No project path provided for findReferences');
      return [];
    }

    try {
      const index = codebaseIndexService.getIndex(projectPath);
      if (!index) {
        logger.debug('No index available for findReferences');
        return [];
      }

      // Get symbol name at position
      const content = await fileService.readFile(filePath, false);
      const lines = content.split('\n');
      const currentLine = lines[lineNumber - 1] || '';
      const symbolName = this.extractSymbolAtPosition(currentLine, column);
      
      if (!symbolName) {
        logger.debug('No symbol found at position for findReferences');
        return [];
      }

      logger.debug('Finding references for symbol:', { symbolName, filePath, lineNumber, column });

      const references: ReferenceLocation[] = [];

      // Search in all files
      const filesArray = Array.from(index.files.entries());
      for (const [filePath, fileIndex] of filesArray) {
        try {
          const fileContent = await fileService.readFile(filePath, false);
          const fileLines = fileContent.split('\n');
          
          // Search for symbol usage in file
          for (let i = 0; i < fileLines.length; i++) {
            const line = fileLines[i];
            const regex = new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`, 'g');
            let match;
            
            while ((match = regex.exec(line)) !== null) {
              const column = match.index + 1;
              
              // Skip if this is the definition itself
              const isDefinition = fileIndex.symbols.some(
                s => s.name === symbolName && s.lineNumber === i + 1
              );
              
              // Skip if this is the definition itself (only for the original file)
              const isCurrentFile = filePath === filePath;
              const isCurrentLine = i + 1 === lineNumber;
              
              if (!isDefinition || !isCurrentFile || !isCurrentLine) {
                references.push({
                  uri: `file://${filePath}`,
                  filePath: filePath,
                  range: {
                    startLineNumber: i + 1,
                    startColumn: column,
                    endLineNumber: i + 1,
                    endColumn: column + symbolName.length
                  },
                  text: line.trim()
                });
              }
            }
          }
        } catch (error) {
          logger.debug('Error reading file for references:', filePath, error);
        }
      }

      logger.debug('Found references:', { count: references.length });
      return references;
    } catch (error) {
      logger.error('Error finding references:', error);
      return [];
    }
  }

  /**
   * Get rename locations for symbol at given position
   */
  async getRenameLocations(
    filePath: string,
    lineNumber: number,
    column: number,
    newName: string,
    projectPath?: string
  ): Promise<RenameLocation[]> {
    if (!projectPath) {
      logger.debug('No project path provided for getRenameLocations');
      return [];
    }

    try {
      // Get all references (same logic as findReferences)
      const references = await this.findReferences(filePath, lineNumber, column, projectPath);
      
      // Convert to rename locations
      const renameLocations: RenameLocation[] = references.map(ref => ({
        uri: ref.uri,
        range: ref.range,
        newText: newName
      }));

      // Also add definition location
      const definition = await this.findDefinition(filePath, lineNumber, column, projectPath);
      if (definition) {
        renameLocations.push({
          uri: definition.uri,
          range: definition.range,
          newText: newName
        });
      }

      logger.debug('Rename locations:', { count: renameLocations.length });
      return renameLocations;
    } catch (error) {
      logger.error('Error getting rename locations:', error);
      return [];
    }
  }

  /**
   * Extract symbol name at given column position in line
   */
  private extractSymbolAtPosition(line: string, column: number): string | null {
    // Find word boundaries around column
    const before = line.substring(0, column - 1);
    const after = line.substring(column - 1);
    
    // Match identifier (letters, numbers, underscore, $)
    const beforeMatch = before.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
    const afterMatch = after.match(/^([a-zA-Z0-9_$]*)/);
    
    if (beforeMatch && afterMatch) {
      return beforeMatch[1] + afterMatch[1];
    }
    
    return null;
  }

  /**
   * Find local definition in file content
   */
  private findLocalDefinition(
    content: string,
    symbolName: string,
    currentLine: number
  ): { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number } | null {
    const lines = content.split('\n');
    
    // Search backwards from current line
    for (let i = currentLine - 1; i >= 0; i--) {
      const line = lines[i];
      
      // Check for function/class/interface/type definitions
      const patterns = [
        new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${this.escapeRegex(symbolName)}\\b`),
        new RegExp(`(?:export\\s+)?class\\s+${this.escapeRegex(symbolName)}\\b`),
        new RegExp(`(?:export\\s+)?interface\\s+${this.escapeRegex(symbolName)}\\b`),
        new RegExp(`(?:export\\s+)?type\\s+${this.escapeRegex(symbolName)}\\b`),
        new RegExp(`const\\s+${this.escapeRegex(symbolName)}\\s*=`),
        new RegExp(`let\\s+${this.escapeRegex(symbolName)}\\s*=`),
        new RegExp(`var\\s+${this.escapeRegex(symbolName)}\\s*=`),
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          const match = line.match(new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`));
          if (match && match.index !== undefined) {
            return {
              startLineNumber: i + 1,
              startColumn: match.index + 1,
              endLineNumber: i + 1,
              endColumn: match.index + 1 + symbolName.length
            };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const navigationService = new NavigationService();
