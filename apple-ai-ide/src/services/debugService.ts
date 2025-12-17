import { logger } from '../utils/logger';
import { generateIds } from '../utils/idGenerator';

export interface Breakpoint {
  id: string;
  filePath: string;
  lineNumber: number;
  column?: number;
  condition?: string;
  hitCount?: number;
  enabled: boolean;
}

export interface DebugConfiguration {
  type: string; // 'node', 'python', 'chrome', etc.
  name: string;
  request: 'launch' | 'attach';
  program?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  port?: number;
  hostname?: string;
  stopOnEntry?: boolean;
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
}

export interface DebugSession {
  id: string;
  name: string;
  configuration: DebugConfiguration;
  status: 'initializing' | 'running' | 'paused' | 'stopped' | 'terminated';
  breakpoints: Breakpoint[];
  currentFrame?: StackFrame;
  stackFrames: StackFrame[];
  variables: Variable[];
  threads: Thread[];
}

export interface StackFrame {
  id: number;
  name: string;
  file: string;
  line: number;
  column: number;
  source?: {
    path: string;
    name: string;
  };
}

export interface Variable {
  name: string;
  value: string;
  type?: string;
  variables?: Variable[]; // For objects/arrays
  evaluateName?: string;
}

export interface Thread {
  id: number;
  name: string;
}

export interface WatchExpression {
  id: string;
  expression: string;
  value?: string;
  error?: string;
}

/**
 * Debug Service - manages debugging sessions
 * Note: This is a basic implementation. For production, integrate with VS Code Debug Protocol
 */
export class DebugService {
  private sessions: Map<string, DebugSession> = new Map();
  private breakpoints: Map<string, Breakpoint[]> = new Map(); // filePath -> breakpoints
  private watchExpressions: Map<string, WatchExpression[]> = new Map(); // sessionId -> watch expressions
  private activeSessionId: string | null = null;

  /**
   * Create a new debug session
   */
  createSession(configuration: DebugConfiguration): DebugSession {
    const session: DebugSession = {
      id: `session-${Date.now()}`,
      name: configuration.name,
      configuration,
      status: 'initializing',
      breakpoints: [],
      stackFrames: [],
      variables: [],
      threads: []
    };

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;
    
    logger.debug('Debug session created:', session.id);
    return session;
  }

  /**
   * Start debugging session
   */
  async startSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'running';
    logger.debug('Debug session started:', sessionId);
    
    // In a real implementation, this would start the debugger process
    // For now, we'll simulate it
    await this.simulateDebugStart(session);
  }

  /**
   * Stop debugging session
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.status = 'stopped';
    logger.debug('Debug session stopped:', sessionId);
  }

  /**
   * Add breakpoint
   */
  addBreakpoint(filePath: string, lineNumber: number, condition?: string): Breakpoint {
    const breakpoint: Breakpoint = {
      id: generateIds.breakpoint(),
      filePath,
      lineNumber,
      condition,
      enabled: true
    };

    if (!this.breakpoints.has(filePath)) {
      this.breakpoints.set(filePath, []);
    }
    this.breakpoints.get(filePath)!.push(breakpoint);

    // Add to active session if exists
    if (this.activeSessionId) {
      const session = this.sessions.get(this.activeSessionId);
      if (session) {
        session.breakpoints.push(breakpoint);
      }
    }

    logger.debug('Breakpoint added:', breakpoint);
    return breakpoint;
  }

  /**
   * Remove breakpoint
   */
  removeBreakpoint(filePath: string, lineNumber: number): void {
    const breakpoints = this.breakpoints.get(filePath) || [];
    const filtered = breakpoints.filter(bp => bp.lineNumber !== lineNumber);
    
    if (filtered.length === 0) {
      this.breakpoints.delete(filePath);
    } else {
      this.breakpoints.set(filePath, filtered);
    }

    // Remove from active session
    if (this.activeSessionId) {
      const session = this.sessions.get(this.activeSessionId);
      if (session) {
        session.breakpoints = session.breakpoints.filter(
          bp => !(bp.filePath === filePath && bp.lineNumber === lineNumber)
        );
      }
    }

    logger.debug('Breakpoint removed:', { filePath, lineNumber });
  }

  /**
   * Toggle breakpoint
   */
  toggleBreakpoint(filePath: string, lineNumber: number): { breakpoint: Breakpoint | null; removed: boolean } {
    const breakpoints = this.breakpoints.get(filePath) || [];
    const existing = breakpoints.find(bp => bp.lineNumber === lineNumber);

    if (existing) {
      this.removeBreakpoint(filePath, lineNumber);
      return { breakpoint: null, removed: true };
    } else {
      const breakpoint = this.addBreakpoint(filePath, lineNumber);
      return { breakpoint, removed: false };
    }
  }

  /**
   * Get breakpoints for file
   */
  getBreakpoints(filePath: string): Breakpoint[] {
    return this.breakpoints.get(filePath) || [];
  }

  /**
   * Get all breakpoints
   */
  getAllBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values()).flat();
  }

  /**
   * Add watch expression
   */
  addWatchExpression(sessionId: string, expression: string): WatchExpression {
    const watch: WatchExpression = {
      id: generateIds.watch(),
      expression
    };

    if (!this.watchExpressions.has(sessionId)) {
      this.watchExpressions.set(sessionId, []);
    }
    this.watchExpressions.get(sessionId)!.push(watch);

    logger.debug('Watch expression added:', watch);
    return watch;
  }

  /**
   * Remove watch expression
   */
  removeWatchExpression(sessionId: string, watchId: string): void {
    const watches = this.watchExpressions.get(sessionId) || [];
    const filtered = watches.filter(w => w.id !== watchId);
    this.watchExpressions.set(sessionId, filtered);
    logger.debug('Watch expression removed:', watchId);
  }

  /**
   * Get watch expressions for session
   */
  getWatchExpressions(sessionId: string): WatchExpression[] {
    return this.watchExpressions.get(sessionId) || [];
  }

  /**
   * Get active session
   */
  getActiveSession(): DebugSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): DebugSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Step over
   */
  async stepOver(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') {
      return;
    }

    logger.debug('Step over:', sessionId);
    // In real implementation, send stepOver command to debugger
  }

  /**
   * Step into
   */
  async stepInto(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') {
      return;
    }

    logger.debug('Step into:', sessionId);
    // In real implementation, send stepInto command to debugger
  }

  /**
   * Step out
   */
  async stepOut(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') {
      return;
    }

    logger.debug('Step out:', sessionId);
    // In real implementation, send stepOut command to debugger
  }

  /**
   * Continue
   */
  async continue(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') {
      return;
    }

    session.status = 'running';
    logger.debug('Continue:', sessionId);
    // In real implementation, send continue command to debugger
  }

  /**
   * Pause
   */
  async pause(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      return;
    }

    session.status = 'paused';
    logger.debug('Pause:', sessionId);
    // In real implementation, send pause command to debugger
  }

  /**
   * Simulate debug start (for demo purposes)
   */
  private async simulateDebugStart(session: DebugSession): Promise<void> {
    // Simulate hitting a breakpoint
    setTimeout(() => {
      if (session.breakpoints.length > 0) {
        const firstBreakpoint = session.breakpoints[0];
        session.status = 'paused';
        session.currentFrame = {
          id: 0,
          name: 'main',
          file: firstBreakpoint.filePath,
          line: firstBreakpoint.lineNumber,
          column: 1
        };
        session.stackFrames = [session.currentFrame];
        session.variables = [
          { name: 'this', value: 'undefined', type: 'undefined' },
          { name: 'arguments', value: '[]', type: 'Array' }
        ];
      }
    }, 1000);
  }
}

export const debugService = new DebugService();
