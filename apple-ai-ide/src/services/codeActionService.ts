import { aiService } from './aiService';
import { logger } from '../utils/logger';
import { IDESettings } from '../types';

export interface CodeActionContext {
  code: string;
  language: string;
  lineNumber: number;
  column: number;
  filePath?: string;
  selection?: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
}

export interface AICodeAction {
  title: string;
  kind: 'refactor' | 'quickfix' | 'source' | 'source.organizeImports';
  edit: {
    text: string;
    range: {
      startLineNumber: number;
      endLineNumber: number;
      startColumn: number;
      endColumn: number;
    };
  };
  description?: string;
  command?: {
    id: string;
    title: string;
  };
}

class CodeActionService {
  /**
   * Analyze code and suggest improvements
   */
  async analyzeCode(
    context: CodeActionContext,
    settings: IDESettings,
    abortSignal?: AbortSignal
  ): Promise<AICodeAction[]> {
    try {
      if (!settings.selectedModel) {
        return [];
      }

      // Configure AI service
      aiService.setOllamaEndpoint(settings.ollamaEndpoint);
      aiService.setLMStudioEndpoint(settings.lmStudioEndpoint);
      aiService.setCurrentModel(settings.selectedModel);

      // Build prompt for code analysis
      const codeSnippet = context.selection
        ? context.code.split('\n').slice(context.selection.startLine - 1, context.selection.endLine).join('\n')
        : context.code.split('\n')[context.lineNumber - 1] || '';

      const prompt = `Analyze this ${context.language} code and suggest improvements. Return ONLY a JSON array of code actions in this exact format:

[
  {
    "title": "Action title (e.g., 'Add JSDoc comment', 'Simplify function', 'Fix potential bug')",
    "kind": "refactor|quickfix|source",
    "description": "Brief description",
    "edit": {
      "text": "The improved code",
      "range": {
        "startLineNumber": ${context.selection?.startLine || context.lineNumber},
        "endLineNumber": ${context.selection?.endLine || context.lineNumber},
        "startColumn": ${context.selection?.startColumn || 1},
        "endColumn": ${context.selection?.endColumn || 1000}
      }
    }
  }
]

Code to analyze:
\`\`\`${context.language}
${codeSnippet}
\`\`\`

Focus on:
- Adding missing documentation
- Simplifying complex code
- Fixing potential bugs
- Optimizing performance
- Improving code style

Return ONLY the JSON array, no explanations.`;

      logger.debug('Analyzing code for actions', {
        language: context.language,
        line: context.lineNumber
      });

      const response = await aiService.chat(
        [
          {
            id: 'system',
            role: 'system',
            content: 'You are an expert code analyzer. Return ONLY valid JSON array of code actions, no markdown, no explanations.',
            timestamp: new Date(),
            type: 'code'
          },
          {
            id: 'user',
            role: 'user',
            content: prompt,
            timestamp: new Date(),
            type: 'code'
          }
        ],
        {
          projectPath: context.filePath ? context.filePath.split('/').slice(0, -1).join('/') : undefined
        },
        settings.aiProvider,
        abortSignal
      );

      // Parse JSON response
      let actions: AICodeAction[] = [];
      try {
        // Extract JSON from markdown code blocks if present
        let jsonText = response.content.trim();
        const jsonMatch = jsonText.match(/```(?:json)?\s*(\[[\s\S]*?\])/);
        if (jsonMatch) {
          jsonText = jsonMatch[1];
        } else {
          // Try to find JSON array in the text
          const arrayMatch = jsonText.match(/(\[[\s\S]*?\])/);
          if (arrayMatch) {
            jsonText = arrayMatch[1];
          }
        }

        actions = JSON.parse(jsonText);
        
        // Validate and normalize actions
        actions = actions
          .filter(action => action.title && action.edit && action.edit.text && action.edit.range)
          .map(action => ({
            ...action,
            kind: action.kind || 'refactor',
            edit: {
              ...action.edit,
              range: {
                startLineNumber: action.edit.range.startLineNumber || context.lineNumber,
                endLineNumber: action.edit.range.endLineNumber || context.lineNumber,
                startColumn: action.edit.range.startColumn || 1,
                endColumn: action.edit.range.endColumn || 1000
              }
            }
          }))
          .slice(0, 5); // Limit to 5 actions

        logger.debug('Code actions generated', { count: actions.length });
      } catch (parseError) {
        logger.error('Failed to parse code actions JSON:', parseError);
        // Fallback: create a generic action
        actions = this.createFallbackActions(context, codeSnippet);
      }

      return actions;
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        logger.debug('Code action analysis cancelled');
        return [];
      }

      logger.error('Error analyzing code for actions:', error);
      return [];
    }
  }

  /**
   * Create fallback actions when AI parsing fails
   */
  private createFallbackActions(context: CodeActionContext, code: string): AICodeAction[] {
    const actions: AICodeAction[] = [];

    // Add comment action if code doesn't have comments
    if (!code.includes('//') && !code.includes('/*') && !code.includes('*')) {
      const commentText = `// TODO: Add description\n${code}`;
      actions.push({
        title: 'Добавить комментарий',
        kind: 'source',
        description: 'Добавить комментарий к коду',
        edit: {
          text: commentText,
          range: {
            startLineNumber: context.lineNumber,
            endLineNumber: context.lineNumber,
            startColumn: 1,
            endColumn: 1000
          }
        }
      });
    }

    return actions;
  }

  /**
   * Generate specific action type
   */
  async generateAction(
    context: CodeActionContext,
    actionType: 'comment' | 'simplify' | 'optimize' | 'fix',
    settings: IDESettings,
    abortSignal?: AbortSignal
  ): Promise<AICodeAction | null> {
    try {
      if (!settings.selectedModel) {
        return null;
      }

      aiService.setOllamaEndpoint(settings.ollamaEndpoint);
      aiService.setLMStudioEndpoint(settings.lmStudioEndpoint);
      aiService.setCurrentModel(settings.selectedModel);

      const codeSnippet = context.selection
        ? context.code.split('\n').slice(context.selection.startLine - 1, context.selection.endLine).join('\n')
        : context.code.split('\n')[context.lineNumber - 1] || '';

      const prompts = {
        comment: `Add a clear, concise ${context.language} comment explaining what this code does. Return ONLY the code with comment, no explanations:\n\n\`\`\`${context.language}\n${codeSnippet}\n\`\`\``,
        simplify: `Simplify this ${context.language} code while maintaining functionality. Return ONLY the simplified code:\n\n\`\`\`${context.language}\n${codeSnippet}\n\`\`\``,
        optimize: `Optimize this ${context.language} code for better performance. Return ONLY the optimized code:\n\n\`\`\`${context.language}\n${codeSnippet}\n\`\`\``,
        fix: `Find and fix any bugs or issues in this ${context.language} code. Return ONLY the fixed code:\n\n\`\`\`${context.language}\n${codeSnippet}\n\`\`\``
      };

      const titles = {
        comment: 'Добавить комментарий',
        simplify: 'Упростить код',
        optimize: 'Оптимизировать',
        fix: 'Исправить ошибки'
      };

      const response = await aiService.chat(
        [
          {
            id: 'user',
            role: 'user',
            content: prompts[actionType],
            timestamp: new Date(),
            type: 'code'
          }
        ],
        {},
        settings.aiProvider,
        abortSignal
      );

      // Extract code from response
      let improvedCode = response.content.trim();
      const codeMatch = improvedCode.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeMatch) {
        improvedCode = codeMatch[1].trim();
      }

      return {
        title: titles[actionType],
        kind: actionType === 'fix' ? 'quickfix' : 'refactor',
        description: `AI ${titles[actionType].toLowerCase()}`,
        edit: {
          text: improvedCode,
          range: {
            startLineNumber: context.selection?.startLine || context.lineNumber,
            endLineNumber: context.selection?.endLine || context.lineNumber,
            startColumn: context.selection?.startColumn || 1,
            endColumn: context.selection?.endColumn || 1000
          }
        }
      };
    } catch (error) {
      logger.error(`Error generating ${actionType} action:`, error);
      return null;
    }
  }
}

export const codeActionService = new CodeActionService();
