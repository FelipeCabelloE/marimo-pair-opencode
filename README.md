# opencode-marimo-pair

OpenCode plugin for marimo notebook pair programming.

## What It Does

This plugin extends OpenCode with:

- **Custom tools** - Execute code in live marimo kernels and discover running servers
- **Structured error handling** - Reliable tool execution with error objects
- **Script path caching** - Resolves paths once, reuses on subsequent calls
- **Console logging** - Errors are logged with `[marimo-pair]` prefix

## Prerequisites

- `bash`, `curl`, and `jq` on PATH
- OpenCode installed

## Installation

```bash
# Install the plugin
bun add -d opencode-marimo-pair
```

## Configuration

Add to `opencode.json`:

```json
{
  "plugin": ["opencode-marimo-pair"]
}
```

## Available Tools

### `execute_code`

Execute Python code in a live marimo kernel via the scratchpad.

**Arguments:**
- `url` (string, required) - Marimo server URL
- `code` (string, required) - Python code to execute
- `file` (string, optional) - Notebook file key

**Returns:**
- `string` - Execution output on success
- `{ title, output, metadata }` - Error result on failure

### `discover_servers`

Discover running marimo notebook instances from the server registry.

**Returns:**
- `string` - JSON with server info for each live server
- `{ title, output, metadata }` - Error result on failure

## Error Handling

All tools return structured error results on failure:

```typescript
interface PluginError {
  error: true;
  message: string;
  code: 'SCRIPT_NOT_FOUND' | 'EXECUTION_FAILED';
  details?: Record<string, unknown>;
}
```

Errors are also logged to console with `[marimo-pair]` prefix.

## Development

```bash
bun install          # Install dependencies
mise run build       # Build the module
mise run test        # Run tests
mise run lint        # Lint code
mise run typecheck   # Type-check
```

## License

MIT
