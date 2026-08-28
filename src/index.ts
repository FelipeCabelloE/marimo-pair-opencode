import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import { resolve } from 'path';
import { existsSync } from 'fs';

interface PluginError {
  error: true;
  message: string;
  code: 'SCRIPT_NOT_FOUND' | 'EXECUTION_FAILED';
  details?: Record<string, unknown>;
}

function createError(
  code: PluginError['code'],
  message: string,
  details?: Record<string, unknown>
): PluginError {
  return { error: true, message, code, details };
}

function errorToResult(error: PluginError): {
  title: string;
  output: string;
  metadata: PluginError;
} {
  return {
    title: `[${error.code}] ${error.message}`,
    output: error.message,
    metadata: error,
  };
}

const scriptPathCache = new Map<string, string>();

function getScriptPath(scriptName: string): string {
  if (scriptPathCache.has(scriptName)) {
    return scriptPathCache.get(scriptName)!;
  }

  const scriptPath = resolve(import.meta.dir, 'scripts', scriptName);
  scriptPathCache.set(scriptName, scriptPath);
  return scriptPath;
}

function verifyScriptExists(scriptName: string): PluginError | null {
  const scriptPath = getScriptPath(scriptName);
  if (!existsSync(scriptPath)) {
    return createError('SCRIPT_NOT_FOUND', `Script not found: ${scriptPath}`, {
      script: scriptName,
      expectedPath: scriptPath,
    });
  }
  return null;
}

export const MarimoPairPlugin: Plugin = async ({ $ }) => {
  return {
    tool: {
      execute_code: tool({
        description:
          'Execute Python code in a live marimo kernel via the scratchpad. ' +
          'The code runs in a temporary namespace with access to notebook variables. ' +
          'Use marimo._code_mode (cm) to persist changes.',
        args: {
          url: tool.schema.string().describe('Marimo server URL (e.g., http://localhost:2718)'),
          code: tool.schema.string().describe('Python code to execute'),
          file: tool.schema
            .string()
            .optional()
            .describe('Notebook file key for multi-notebook servers'),
        },
        async execute(args) {
          const scriptError = verifyScriptExists('execute-code.sh');
          if (scriptError) {
            // eslint-disable-next-line no-console
            console.error(`[marimo-pair] ${scriptError.message}`);
            return errorToResult(scriptError);
          }

          const script = getScriptPath('execute-code.sh');
          const cmd = ['bash', script, '--url', args.url];
          if (args.file) cmd.push('--file', args.file);
          cmd.push('-c', args.code);

          try {
            const result = await $`${cmd}`;
            const stdout = result.text();
            const stderr = result.stderr.toString();
            return stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
          } catch (err) {
            const error = createError('EXECUTION_FAILED', `Script execution failed`, {
              script: 'execute-code.sh',
              url: args.url,
              error: err instanceof Error ? err.message : String(err),
            });
            // eslint-disable-next-line no-console
            console.error(`[marimo-pair] ${error.message}`);
            return errorToResult(error);
          }
        },
      }),

      discover_servers: tool({
        description:
          'Discover running marimo notebook instances from the server registry. ' +
          'Returns JSON with server_id, url, origin, and version for each live server.',
        args: {},
        async execute() {
          const scriptError = verifyScriptExists('discover-servers.sh');
          if (scriptError) {
            // eslint-disable-next-line no-console
            console.error(`[marimo-pair] ${scriptError.message}`);
            return errorToResult(scriptError);
          }

          const script = getScriptPath('discover-servers.sh');

          try {
            const result = await $`bash ${script}`;
            return result.text();
          } catch (err) {
            const error = createError('EXECUTION_FAILED', `Script execution failed`, {
              script: 'discover-servers.sh',
              error: err instanceof Error ? err.message : String(err),
            });
            // eslint-disable-next-line no-console
            console.error(`[marimo-pair] ${error.message}`);
            return errorToResult(error);
          }
        },
      }),
    },
  };
};

export default MarimoPairPlugin;
