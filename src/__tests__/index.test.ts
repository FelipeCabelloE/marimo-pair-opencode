/* eslint-disable no-undef */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

function mockContext() {
  return {
    sessionID: 's1',
    messageID: 'm1',
    agent: 'build',
    directory: '/project',
    worktree: '/project',
    abort: new AbortController().signal,
    metadata: vi.fn(),
    ask: vi.fn(),
  } as any;
}

function mockShellOutput(stdout: string, stderr = '') {
  return {
    text: () => stdout,
    stderr: Buffer.from(stderr),
    stdout,
    exitCode: 0,
  } as any;
}

async function createPlugin(mockDollar?: any) {
  const { default: plugin } = await import('../index');
  return plugin({
    $: mockDollar ?? (vi.fn() as any),
    project: { id: 'test' } as any,
    directory: '/project',
    worktree: '/project',
    client: {} as any,
    serverUrl: new URL('http://localhost:3000'),
    experimental_workspace: { register: vi.fn() } as any,
  });
}

describe('MarimoPairPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('plugin exports', () => {
    it('exports a default plugin function', async () => {
      const mod = await import('../index');
      expect(mod.default).toBeTypeOf('function');
    });

    it('exports MarimoPairPlugin', async () => {
      const { MarimoPairPlugin } = await import('../index');
      expect(MarimoPairPlugin).toBeTypeOf('function');
    });
  });

  describe('plugin initialization', () => {
    it('returns hooks with tool definitions', async () => {
      mockExistsSync.mockReturnValue(true);
      const hooks = await createPlugin();
      expect(hooks.tool).toBeDefined();
      expect(hooks.tool).toHaveProperty('execute_code');
      expect(hooks.tool).toHaveProperty('discover_servers');
    });
  });

  describe('execute_code tool', () => {
    it('has correct structure', async () => {
      mockExistsSync.mockReturnValue(true);
      const hooks = await createPlugin();
      const t = hooks.tool!.execute_code;
      expect(t).toHaveProperty('description');
      expect(t).toHaveProperty('args');
      expect(t).toHaveProperty('execute');
      expect(t.description).toContain('marimo');
    });

    it('returns error result when script not found', async () => {
      mockExistsSync.mockReturnValue(false);
      const hooks = await createPlugin();
      const result = await hooks.tool!.execute_code.execute(
        { url: 'http://localhost:2718', code: 'print("hello")' },
        mockContext()
      );
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('metadata');
      expect((result as any).metadata).toMatchObject({
        error: true,
        code: 'SCRIPT_NOT_FOUND',
      });
    });

    it('executes script and returns output', async () => {
      mockExistsSync.mockReturnValue(true);
      const mock$ = vi.fn().mockResolvedValue(mockShellOutput('output data'));
      const hooks = await createPlugin(mock$);
      const result = await hooks.tool!.execute_code.execute(
        { url: 'http://localhost:2718', code: 'print("hello")' },
        mockContext()
      );
      expect(result).toBe('output data');
      expect(mock$).toHaveBeenCalled();
    });

    it('returns error result on execution failure', async () => {
      mockExistsSync.mockReturnValue(true);
      const mock$ = vi.fn().mockRejectedValue(new Error('Command failed'));
      const hooks = await createPlugin(mock$);
      const result = await hooks.tool!.execute_code.execute(
        { url: 'http://localhost:2718', code: 'print("hello")' },
        mockContext()
      );
      expect(result).toHaveProperty('metadata');
      expect((result as any).metadata).toMatchObject({
        error: true,
        code: 'EXECUTION_FAILED',
        details: expect.objectContaining({
          script: 'execute-code.sh',
          url: 'http://localhost:2718',
        }),
      });
    });

    it('includes file argument when provided', async () => {
      mockExistsSync.mockReturnValue(true);
      const mock$ = vi.fn().mockResolvedValue(mockShellOutput('ok'));
      const hooks = await createPlugin(mock$);
      await hooks.tool!.execute_code.execute(
        { url: 'http://localhost:2718', code: 'x = 1', file: 'notebook.py' },
        mockContext()
      );
      const expressions = mock$.mock.calls[0].slice(1);
      const cmdArray = expressions.find((e: any) => Array.isArray(e));
      expect(cmdArray).toContain('--file');
      expect(cmdArray).toContain('notebook.py');
    });
  });

  describe('discover_servers tool', () => {
    it('has correct structure', async () => {
      mockExistsSync.mockReturnValue(true);
      const hooks = await createPlugin();
      const t = hooks.tool!.discover_servers;
      expect(t).toHaveProperty('description');
      expect(t).toHaveProperty('args');
      expect(t).toHaveProperty('execute');
      expect(t.description).toContain('marimo');
    });

    it('returns error result when script not found', async () => {
      mockExistsSync.mockReturnValue(false);
      const hooks = await createPlugin();
      const result = await hooks.tool!.discover_servers.execute({}, mockContext());
      expect(result).toHaveProperty('metadata');
      expect((result as any).metadata).toMatchObject({
        error: true,
        code: 'SCRIPT_NOT_FOUND',
      });
    });

    it('executes script and returns output', async () => {
      mockExistsSync.mockReturnValue(true);
      const mock$ = vi
        .fn()
        .mockResolvedValue(
          mockShellOutput('[{"server_id":"127.0.0.1:2718","url":"http://localhost:2718"}]')
        );
      const hooks = await createPlugin(mock$);
      const result = await hooks.tool!.discover_servers.execute({}, mockContext());
      expect(result).toContain('server_id');
      expect(mock$).toHaveBeenCalled();
    });

    it('returns error result on execution failure', async () => {
      mockExistsSync.mockReturnValue(true);
      const mock$ = vi.fn().mockRejectedValue(new Error('Command failed'));
      const hooks = await createPlugin(mock$);
      const result = await hooks.tool!.discover_servers.execute({}, mockContext());
      expect(result).toHaveProperty('metadata');
      expect((result as any).metadata).toMatchObject({
        error: true,
        code: 'EXECUTION_FAILED',
      });
    });
  });

  describe('error logging', () => {
    it('logs errors to console', async () => {
      mockExistsSync.mockReturnValue(false);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const hooks = await createPlugin();
      await hooks.tool!.execute_code.execute(
        { url: 'http://localhost:2718', code: 'print("hello")' },
        mockContext()
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[marimo-pair]'));
      consoleSpy.mockRestore();
    });
  });
});
