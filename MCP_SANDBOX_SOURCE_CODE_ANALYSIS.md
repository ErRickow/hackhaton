# MCP Sandbox - Source Code Deep Dive

## File-by-File Analysis

### src/index.ts (1 line)

```typescript
export * from "./mcpSandbox";
```

**Purpose**: 
- Clean re-export pattern
- Consumers see: `import { startMcpSandbox } from '@netglade/mcp-sandbox'`
- Allows future multiple exports without changing consumer code
- Convention: main barrel file

**Pattern**: Barrel exports (index pattern)

---

### src/mcpSandbox.ts (59 lines total)

#### Complete Source Code Analysis

```typescript
import Sandbox from "@e2b/code-interpreter";
```

**Import Analysis**:
- Default import of E2B Sandbox class
- From peer dependency `@e2b/code-interpreter`
- Used to create and manage ephemeral containers

---

#### Function: startMcpSandbox (40 lines)

```typescript
export const startMcpSandbox = async ({
  command,
  apiKey,
  envs = {},
  timeoutMs = 1000 * 60 * 10,
}: {
  command: string
  apiKey: string
  envs?: Record<string, string>
  timeoutMs?: number
}) => {
```

**Parameters**:

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `command` | string | Required | MCP server command (e.g., `npx -y @modelcontextprotocol/server-brave-search`) |
| `apiKey` | string | Required | E2B API key from https://e2b.dev |
| `envs` | object | `{}` | Environment variables for MCP server process |
| `timeoutMs` | number | 600000 | Sandbox lifetime in milliseconds (10 min default) |

**Type Safety**:
- Inline object type definition
- TypeScript 5.0+ (dev dependency)
- Strict mode enabled (tsconfig.base.json)

---

#### Step 1: Sandbox Creation

```typescript
console.log("Creating sandbox...");
const sandbox = await Sandbox.create("base", {
  timeoutMs,
  apiKey,
});
```

**What happens**:
1. Async call to E2B API
2. `"base"` template = Debian + Node.js + npm pre-installed
3. Allocates container resources
4. Awaits container to be ready
5. Returns Sandbox instance

**Error handling**: 
- No explicit try/catch (caller responsibility)
- Will throw if API key invalid or quota exceeded

**Timeline**: 2-5 seconds

---

#### Step 2: Host & URL Generation

```typescript
const host = sandbox.getHost(3000);
const url = `https://${host}`;
```

**What happens**:
1. `getHost(3000)` queries E2B for public HTTPS domain
2. Format: `abc123def.sandbox.e2b.dev`
3. Automatically has valid TLS certificate
4. Unique per sandbox (never reused)
5. URL template: `https://abc123def.sandbox.e2b.dev`

**Security implications**:
- Unique per invocation
- Non-sequential (prevents enumeration)
- E2B manages certificate infrastructure
- HTTPS encryption automatic

---

#### Step 3: Command Execution

```typescript
await sandbox.commands.run(
    `npx -y supergateway --base-url ${url} --port 3000 --cors --stdio "${command}"`,
    {
      envs,
      background: true,
      onStdout: (data: string) => {
        console.log(data);
      },
      onStderr: (data: string) => {
        console.log(data);
      }
    }
);
```

**Command Structure**:

```bash
npx -y supergateway \
  --base-url https://abc123def.sandbox.e2b.dev \
  --port 3000 \
  --cors \
  --stdio "npx -y @modelcontextprotocol/server-brave-search"
```

**Flag Breakdown**:

1. **`npx -y supergateway`**
   - `npx`: npm package executor (zero-install)
   - `-y`: Auto-approve installation
   - `supergateway`: Package name

2. **`--base-url <url>`**
   - Tells supergateway its public HTTPS URL
   - Used for callback URLs, redirects
   - Critical for CORS origin checking

3. **`--port 3000`**
   - Port to listen on inside container
   - Not exposed to internet directly
   - E2B tunnels through HTTPS

4. **`--cors`**
   - Enable CORS headers in responses
   - `Access-Control-Allow-Origin: *` (or specified)
   - Critical for browser clients
   - Commit cdc0a37 fixed flag order

5. **`--stdio`**
   - Mode flag: stdio transport
   - Other modes: TCP socket, etc.
   - MCP server command follows

6. **`"<command>" (quoted)`**
   - Entire MCP server command in quotes
   - Preserves spaces and arguments
   - Example: `"npx -y @modelcontextprotocol/server-brave-search"`

**Options Object**:

```typescript
{
  envs,                     // Pass to MCP server process
  background: true,         // Non-blocking (critical!)
  onStdout: (data) => {},   // Log stream
  onStderr: (data) => {}    // Error stream
}
```

**Key points**:
- `background: true` makes function non-blocking
- Without it, would await command completion (hangs forever)
- stdout/stderr streaming for debugging
- envs passed to child process (not to supergateway)

**Timeline**: 1-2 seconds (supergateway startup)

---

#### Step 4: Logging & Return

```typescript
console.log("MCP server started at:", url + "/sse");
return new McpSandbox(sandbox);
```

**Final log message**:
```
Creating sandbox...
Starting mcp server...
MCP server started at: https://abc123def.sandbox.e2b.dev/sse
```

**Return value**:
- New `McpSandbox` instance
- Wraps E2B Sandbox instance
- Type-safe handle for consumer

---

#### Class: McpSandbox (17 lines)

```typescript
class McpSandbox {
  public sandbox: Sandbox;

  constructor(sandbox: Sandbox) {
    this.sandbox = sandbox;
  }

  getUrl(): string {
    if (!this.sandbox) {
      throw new Error("Sandbox not initialized");
    }
    const host = this.sandbox.getHost(3000);
    return `https://${host}/sse`;
  }
}

export type { McpSandbox };
```

**Class Design**:

1. **Property**: `public sandbox: Sandbox`
   - Exposes underlying E2B instance
   - Allows advanced users to access E2B API
   - Not just a wrapper (still functional)

2. **Constructor**: Takes E2B Sandbox instance
   - Stores reference
   - No initialization logic (thin wrapper)

3. **Method**: `getUrl(): string`
   - Returns SSE endpoint URL
   - Calls `getHost(3000)` each time (could cache)
   - Appends `/sse` for supergateway endpoint
   - Defensive check (sandbox not initialized)
   - **Note**: Recalculates URL (inefficient but safe)

4. **Export**: `export type { McpSandbox }`
   - TypeScript type export
   - Allows consumers to type variables: `const mcp: McpSandbox = ...`
   - Version 0.0.7 added this (commit 67ccab8)

**Design Pattern**: Thin wrapper around E2B Sandbox
- Adds semantic meaning (MCP-specific)
- Delegates heavy lifting to E2B SDK
- Future-proof for additional features

---

## Build System Deep Dive

### scripts/build.js (41 lines)

**Purpose**: Create dual ESM and CJS bundles from single source

```javascript
import {execSync} from "child_process";
import fs from "fs";

// Step 1: Clean
{
    fs.rmSync("dist", {recursive: true, force: true})
}
```

**Cleanup Phase**:
- Removes entire `dist/` directory
- `recursive: true` = delete contents
- `force: true` = don't error if doesn't exist

```javascript
// Step 2: ESM Build
{
    execSync("cross-env MODULE=esm vite build", {stdio: "inherit"})
    fs.mkdirSync('dist/esm', {recursive: true})
    for (const fileName of fs.readdirSync("dist")) {
        const filePath = `dist/${fileName}`
        if (fs.lstatSync(filePath).isFile()) {
            fs.renameSync(filePath, `dist/esm/${fileName}`)
        }
    }
    fs.writeFileSync("dist/esm/package.json", JSON.stringify({
        type: "module",
    }, null, 2))
}
```

**ESM Build Process**:
1. Set `MODULE=esm` environment variable
2. Run Vite build
3. Create `dist/esm/` directory
4. Move all files from `dist/` to `dist/esm/`
5. Write `package.json` with `type: "module"`

**Output**:
```
dist/esm/
├── mcp-sandbox.es.js      (main code)
├── mcp-sandbox.d.ts        (TypeScript types)
└── package.json            (type: module)
```

```javascript
// Step 3: CJS Build  
{
    execSync("cross-env MODULE=cjs vite build", {stdio: "inherit"})
    fs.mkdirSync('dist/cjs', {recursive: true})
    for (const fileName of fs.readdirSync("dist")) {
        const filePath = `dist/${fileName}`
        if (filePath.endsWith('.d.ts')) {
            fs.rmSync(filePath)
            continue
        }

        if (fs.lstatSync(filePath).isFile()) {
            fs.renameSync(filePath, `dist/cjs/${fileName}`)
        }
    }
    fs.writeFileSync("dist/cjs/package.json", JSON.stringify({
        type: "commonjs",
    }, null, 2))
}
```

**CJS Build Process**:
1. Set `MODULE=cjs` environment variable
2. Run Vite build
3. Create `dist/cjs/` directory
4. **Skip TypeScript definitions** (reuse ESM's .d.ts)
5. Move JS files to `dist/cjs/`
6. Write `package.json` with `type: "commonjs"`

**Output**:
```
dist/cjs/
├── mcp-sandbox.umd.js      (main code)
└── package.json            (type: commonjs)
```

**Why this approach**:
- Single TypeScript source → two bundle formats
- Vite configured to respect MODULE env var
- ESM definitions usable for both (TypeScript doesn't care about format)
- Consumers get correct format based on their module system

---

### vite.config.ts (38 lines)

```typescript
import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { builtinModules } from 'module';
import tsconfigPaths from 'vite-tsconfig-paths';
import { peerDependencies } from './package.json';

const module = process.env.MODULE || 'esm'
```

**Module Detection**:
- Reads `MODULE` environment variable
- Default: `'esm'` if not set
- Used to determine build format

```typescript
export default defineConfig({
    plugins: [
      tsconfigPaths(),
      dts({
        tsconfigPath: module === 'esm' ? 'tsconfig.json' : 'tsconfig.cjs.json',
        rollupTypes: true,
      }),
    ],
```

**Plugins**:

1. **tsconfigPaths()**
   - Resolves path aliases from tsconfig
   - Currently unused (no aliases defined)
   - Future-proofing

2. **dts()**
   - Vite plugin to generate `.d.ts` files
   - Uses appropriate tsconfig based on format
   - `rollupTypes: true` inlines all types into single file
   - Output: `mcp-sandbox.d.ts`

```typescript
    build: {
        target: module === 'esm' ? 'esnext' : 'es2015',
        lib: {
            entry: resolve(__dirname, 'src', 'index.ts'),
            name: '@netglade/mcp-sandbox',
            fileName: (format) => `mcp-sandbox.${format}.js`,
            formats: [module === 'esm' ? 'es' : 'umd'],
        },
```

**Build Configuration**:

1. **Target Compatibility**:
   - ESM: `esnext` (modern JavaScript, smaller code)
   - CJS: `es2015` (broader compatibility)

2. **Library Entry**:
   - Source file: `src/index.ts`
   - Library name: `@netglade/mcp-sandbox` (for UMD global)

3. **Output Filenames**:
   - ESM: `mcp-sandbox.es.js`
   - CJS: `mcp-sandbox.umd.js`

4. **Formats**:
   - ESM build: `'es'` (ES Module format)
   - CJS build: `'umd'` (Universal Module Definition)

```typescript
        rollupOptions: {
            external: [
                ...builtinModules,
                ...builtinModules.map((m) => `node:${m}`),
                ...Object.keys(peerDependencies),
            ],
        },
      emptyOutDir: false,
    },
})
```

**External Dependencies**:
- Don't bundle Node.js built-ins (`fs`, `path`, etc.)
- Don't bundle Node.js prefixed modules (`node:fs`, etc.)
- Don't bundle peer dependencies (`@e2b/code-interpreter`)
- These are assumed to exist in consumer's environment

**emptyOutDir**: `false`
- Don't empty dist on rebuild
- Allows ESM build to leave artifacts for CJS build to use

---

## TypeScript Configuration

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "allowJs": true,                  // Allow .js files
    "allowSyntheticDefaultImports": true,  // Enable default imports
    "baseUrl": "src",                 // Root for imports
    "declaration": true,              // Generate .d.ts
    "esModuleInterop": true,          // CJS ↔ ESM compat
    "inlineSourceMap": false,         // Keep .map files separate
    "lib": ["esnext"],                // Latest JavaScript
    "moduleResolution": "node",       // Node.js resolution
    "noFallthroughCasesInSwitch": true, // Strict switch
    "pretty": true,                   // Pretty error messages
    "resolveJsonModule": true,        // Import JSON
    "rootDir": "src",                 // Source root
    "skipLibCheck": true,             // Skip node_modules
    "strict": true,                   // All strict checks
  }
}
```

**Key Strict Settings**:
- `noImplicitAny`: true (inferred from `strict`)
- `strictNullChecks`: true
- `strictFunctionTypes`: true
- `noUnusedLocals`: true
- `noUnusedParameters`: true
- `noImplicitReturns`: true

---

## Package.json Structure

```json
{
  "name": "@netglade/mcp-sandbox",
  "version": "0.0.11",
  "description": "MCP Sandbox on E2B",
  "author": "NetGlade",
  "license": "MIT",
  "type": "module",                  // Default to ESM
  "repository": {
    "type": "git",
    "url": "git+ssh://git@github.com/netglade/mcp-sandbox.git"
  },
  "scripts": {
    "build": "node scripts/build.js",  // Dual build
    "simple-build": "cross-env MODULE=esm vite build",
    "tsc": "tsc --noEmit",            // Type check
    "run-publish": "npm i && npm run build && npm publish"
  },
  "files": [
    "dist"                             // Published files
  ],
  "main": "./dist/cjs/mcp-sandbox.umd.js",
  "module": "./dist/esm/mcp-sandbox.es.js",
  "types": "./dist/esm/mcp-sandbox.d.ts",
  "exports": {
    "import": "./dist/esm/mcp-sandbox.es.js",
    "require": "./dist/cjs/mcp-sandbox.umd.js",
    "types": "./dist/esm/mcp-sandbox.d.ts"
  },
  "peerDependencies": {
    "@e2b/code-interpreter": "^1.1.0"
  }
}
```

**Entry Points**:
- **main**: CommonJS (for `require()`)
- **module**: ES Modules (for `import`)
- **types**: TypeScript definitions
- **exports**: Modern package exports (conditional)

**Module Resolution Logic**:
```
import '@netglade/mcp-sandbox'
  → Check exports.import
  → Load dist/esm/mcp-sandbox.es.js

require('@netglade/mcp-sandbox')
  → Check main
  → Load dist/cjs/mcp-sandbox.umd.js

TypeScript
  → Check types
  → Load dist/esm/mcp-sandbox.d.ts
```

---

## Dependency Analysis

### Peer Dependencies

**@e2b/code-interpreter@^1.1.0**

Why peer dependency:
- Consumers should manage their E2B version
- May have multiple E2B packages with different needs
- Allows decoupling of version lifecycles

**What we use from E2B SDK**:

```typescript
// Sandbox creation
Sandbox.create(template, config)
  → Creates container
  → Returns Sandbox instance

// Host/URL generation
sandbox.getHost(port)
  → Returns: string (HTTPS domain)
  → Used to connect from outside

// Command execution
sandbox.commands.run(cmd, options)
  → Executes command in container
  → Supports background: true
  → Streaming stdout/stderr
```

### Development-Only Dependencies

**@types/** packages
- TypeScript type definitions for Node.js and utilities
- Not bundled (dev-only)

**cross-env**
- Cross-platform environment variable setting
- Windows/Unix compatible
- Used: `cross-env MODULE=esm vite build`

**ts-node**
- TypeScript execution (could run scripts/build.js directly)
- Not used in this project
- Possibly vestigial

**typescript**
- TypeScript compiler
- `"tsc": "tsc --noEmit"` for type checking

**vite**
- Build tool (Rollup-based)
- Handles bundling, tree-shaking, etc.

**vite-plugin-dts**
- TypeScript definition generation
- Handles .d.ts file creation and inlining

**vite-tsconfig-paths**
- Resolves tsconfig path aliases
- Currently unused but available

---

## Code Quality Observations

### Strengths

1. **Simplicity**
   - 59 lines of actual code
   - Single responsibility (wrap E2B)
   - Easy to understand and audit

2. **Type Safety**
   - Full TypeScript
   - Strict mode enabled
   - Proper type exports

3. **Build Quality**
   - Dual module support (ESM + CJS)
   - Proper TypeScript definitions
   - CI/CD pipeline for publishing

4. **Zero Runtime Dependencies**
   - Only peer dependency
   - Minimal bundle impact
   - No transitive dependency risk

### Areas for Improvement

1. **URL Caching**
   - `getUrl()` recalculates each time
   - Could cache result
   - `sandbox.getHost(3000)` is probably cheap, but...

2. **Error Handling**
   - No try/catch in startMcpSandbox
   - Errors bubble up to caller
   - Could add helpful error messages

3. **Logging**
   - Uses `console.log` directly
   - No log levels
   - Could use structured logging

4. **Timeout Management**
   - No way to extend timeout
   - No cleanup method
   - Limited control over sandbox lifecycle

5. **Documentation**
   - Only README (good)
   - Could use inline JSDoc comments
   - No example file in repo

---

## Integration Points

### With E2B SDK

```
startMcpSandbox()
    ↓
Sandbox.create("base", { timeoutMs, apiKey })
    ↓
    ├─ Creates container (async)
    ├─ Allocates resources
    └─ Returns Sandbox instance

sandbox.getHost(3000)
    ↓
    ├─ Gets public HTTPS domain
    ├─ TLS cert managed by E2B
    └─ Returns: "abc123.sandbox.e2b.dev"

sandbox.commands.run(command, options)
    ↓
    ├─ Executes in container
    ├─ Streams output
    └─ background: true = non-blocking
```

### With Supergateway

```
Supergateway (inside container)
    ↓
    ├─ Listens on port 3000
    ├─ Exposes /sse endpoint
    ├─ Spawns MCP server as child
    ├─ Pipes stdin/stdout
    └─ Converts stdio ↔ HTTP/SSE
```

### With MCP Server

```
MCP Server (inside container)
    ↓
    ├─ Spawned by Supergateway
    ├─ Reads JSON-RPC from stdin
    ├─ Writes results to stdout
    └─ Communication is stdio-based
```

---

## Security Model

### Input Validation

**Current approach**: None explicit

**Risks**:
1. Command injection via `command` parameter
   ```typescript
   // Dangerous if command comes from user input
   const cmd = userInput;  // "'; rm -rf /; echo '"
   await startMcpSandbox({ command: cmd, apiKey })
   ```

2. API key exposure
   ```typescript
   // Passed to E2B, then to environment
   apiKey → E2B auth → stored in memory
   ```

**Mitigations** (at platform level):
- E2B sandboxing restricts damage
- Ephemeral filesystem
- No persistent storage
- Auto-cleanup after timeout

**Recommendations**:
- Validate `command` comes from trusted source
- Never construct commands from user input
- Use allowlists for known MCP servers

### Data Flow

```
Client (browser/node)
    ↓ HTTP/SSE
E2B Tunnel (HTTPS)
    ↓ TLS encrypted
E2B Sandbox Container
    ↓ local pipes
Supergateway
    ↓ stdio pipes
MCP Server
```

All internal communication unencrypted (same process).

---

## Testing Considerations

### What Would Be Good to Test

1. **Integration Tests**
   - Start sandbox with valid E2B key
   - Call getUrl()
   - Make HTTP request to endpoint
   - Verify response format

2. **Type Tests**
   - TypeScript compilation
   - Exported types correct
   - Type narrowing works

3. **Error Handling**
   - Invalid API key
   - Invalid command
   - Network timeout
   - MCP server crash

4. **Resource Cleanup**
   - Sandbox auto-cleanup after timeout
   - No resource leaks
   - Multiple sandboxes isolated

### Current State

**Explicit Tests**: None in repo

**CI/CD Tests** (from .github/workflows/node.js.yml):
```yaml
- npm run tsc          # TypeScript type checking
- npm run build       # Build process
- npm publish         # (automatically on tag)
```

**Tests Implicitly Run**:
- Build process (catches syntax errors)
- TypeScript compiler (catches type errors)
- GitHub CI (catches Node.js compat issues)

---

## Version Evolution

### Key Commits

**v0.0.2** (fcb025b)
- Initial working implementation
- Basic structure established

**v0.0.5** (e65eec6)
- Made command parameter generic
- README improvements
- Better documentation

**v0.0.7** (aa5cc42)
- Exported `McpSandbox` type
- Enables TypeScript type annotations by consumers

**v0.0.9** (17e7bf0)
- **Added CORS support**
- Critical for browser clients
- Added `--cors` flag to supergateway

**v0.0.10** (cdc0a37)
- **Fixed argument order**
- `--cors` must come before `--stdio`
- Subtle but important bug fix

**v0.0.11** (2f7bdb7)
- Current stable version
- Documentation updates

### Backward Compatibility

All versions backward compatible (API hasn't changed):
- Always exported `startMcpSandbox`
- Always returned `McpSandbox` instance
- Parameter types stable

---

## Conclusion

**Code Quality**: High
- Minimal, focused code
- TypeScript strict mode
- Proper build system
- Type-safe exports

**Architecture**: Simple, elegant
- Thin wrapper over E2B
- Delegates complexity correctly
- Single responsibility

**Maintenance**: Low friction
- Few dependencies
- No bundled code to maintain
- Clear, understandable source

