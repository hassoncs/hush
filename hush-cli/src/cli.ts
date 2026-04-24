#!/usr/bin/env node
import { createRequire } from 'node:module';
import pc from 'picocolors';
import type { Environment, StoreMode } from './types.js';
import { defaultContext } from './context.js';
import { encryptCommand } from './commands/encrypt.js';
import { decryptCommand } from './commands/decrypt.js';
import { editCommand } from './commands/edit.js';
import { setCommand } from './commands/set.js';
import { runCommand } from './commands/run.js';
import { statusCommand } from './commands/status.js';
import { pushCommand } from './commands/push.js';
import { initCommand } from './commands/init.js';
import { bootstrapCommand } from './commands/bootstrap.js';
import { configCommand } from './commands/config.js';
import { listCommand } from './commands/list.js';
import { inspectCommand } from './commands/inspect.js';
import { hasCommand } from './commands/has.js';
import { checkCommand } from './commands/check.js';
import { skillCommand } from './commands/skill.js';
import { keysCommand } from './commands/keys.js';
import { resolveCommand } from './commands/resolve.js';
import { traceCommand } from './commands/trace.js';
import { diffCommand } from './commands/diff.js';
import { exportExampleCommand } from './commands/export-example.js';
import { materializeCommand } from './commands/materialize.js';
import { templateCommand } from './commands/template.js';
import { expansionsCommand } from './commands/expansions.js';
import { migrateCommand } from './commands/migrate.js';
import { findProjectRoot } from './config/loader.js';
import { resolveStoreContext } from './store.js';
import { checkForUpdate } from './utils/version-check.js';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json');

function printHelp(): void {
  console.log(`
${pc.bold('hush')} - AI-native encrypted config for projects and teams

${pc.bold('Usage:')}
  hush <command> [options]

${pc.bold('Commands:')}
  bootstrap         Bootstrap a v3 .hush repository
  config            Inspect or update v3 repository config
  init              Deprecated alias for bootstrap
  encrypt           Retired legacy helper; use hush migrate --from v2
  run -- <cmd>      Run command with secrets in memory (AI-safe)
  set <KEY> [VALUE] Set a single secret (AI-safe, prompts if no value)
  edit [file]       Edit all secrets in $EDITOR
  list              List all variables (shows values)
  inspect           List all variables (masked values, AI-safe)
  has <key>         Check if a secret exists (exit 0 if set, 1 if not)
  check             Verify secrets are encrypted (for pre-commit hooks)
  push              Push secrets to Cloudflare (Workers and Pages)
  status            Show configuration and status
  skill             Install Claude Code / OpenCode skill
  keys <cmd>        Manage SOPS age keys (setup, generate, pull, push, list)
  migrate           Migrate a legacy hush.yaml repo to v3
  materialize       Write target or bundle artifacts to disk for CI/tooling

${pc.bold('Debugging Commands:')}
  resolve <target>  Show what variables a target receives (AI-safe)
  trace <key>       Trace a variable through sources and targets (AI-safe)
  diff              Compare current v3 state against HEAD or --ref (AI-safe)
  export-example    Emit a redacted target or bundle example (AI-safe)
  template          Retired legacy helper; use hush migrate --from v2
  expansions        Retired legacy helper; use hush migrate --from v2

${pc.bold('Advanced Commands:')}
  decrypt --force   Write secrets to disk (requires confirmation, last resort)

${pc.bold('Options:')}
  -e, --env <env>   Environment: development or production (default: development)
  -r, --root <dir>  Start directory for project mode, execution directory for run (default: current directory)
  -t, --target <t>  Target name from the v3 repository (run/resolve/push)
  -q, --quiet       Suppress output (has/check commands)
  --dry-run         Preview changes without applying
  --verbose         Show detailed output (push --dry-run only)
  --warn            Warn but exit 0 on drift (check only)
  --json            Output machine-readable JSON (check only)
  --only-changed    Only check git-modified files (check only)
  --require-source  Fail if source file is missing (check only)
  --allow-plaintext Allow plaintext .env files (check only, not recommended)
  --global          Use explicit global store at ~/.hush (or install skill globally)
  --local           Install skill to ./.claude/skills/ (skill/set only)
  --gui             Use macOS dialog for input (set only, for AI agents)
  --ref <git-ref>   Compare diff output against a git ref (diff only)
  --bundle <name>   Resolve a specific bundle (diff/export-example only)
  --from <version>  Legacy repo version to migrate from (migrate only)
  --cleanup         Remove validated v2 leftovers after migration (migrate only)
  --output-root <d> Destination root for materialized files (materialize only)
  --to <dir>        Alias for --output-root (materialize only)
  -h, --help        Show this help message
  -v, --version     Show version number

${pc.bold('Repository Model (current v3):')}
  Hush stores repo authority in encrypted-at-rest v3 docs:

    .hush/manifest.encrypted
    .hush/files/**.encrypted

  Use ${pc.cyan('hush bootstrap')} to create a repo and ${pc.cyan('hush migrate --from v2')} to convert
  a legacy ${pc.cyan('hush.yaml')} repo. Normal runtime commands do not use hush.yaml.

${pc.bold('Examples:')}
  hush bootstrap                Bootstrap a v3 repo + active identity
  hush config show             Show v3 config structure
  hush config active-identity  Show or switch the active identity
  hush init                     Deprecated alias for bootstrap
  hush migrate --from v2        Inventory or convert a legacy hush.yaml repo to v3
  hush run -- npm start         Run with secrets in memory (AI-safe!)
  hush run -e prod -- npm build Run with production secrets
  hush run -t api -- wrangler dev  Run a specific v3 target
  hush set DATABASE_URL         Set a secret interactively (prompts for value)
  hush set API_KEY "myvalue"    Set a secret inline (no prompt)
  echo "val" | hush set KEY     Set a secret from piped input
  hush set API_KEY --gui        Set secret via GUI dialog (for AI agents)
  hush set --global OPENAI_API_KEY  Set a global secret in ~/.hush
  hush run --global -- npm start    Run with global secrets only
  hush set API_KEY -e prod      Set a production secret
  hush keys setup               Pull key from 1Password or verify local
  hush keys generate            Generate new key + backup to 1Password
  hush edit                     Edit all shared secrets in $EDITOR
  hush edit development         Edit development secrets in $EDITOR
  hush edit local               Edit personal local overrides
  hush inspect                  List all variables (masked, AI-safe)
  hush has DATABASE_URL         Check if DATABASE_URL is set
  hush has API_KEY -q && echo "API_KEY is configured"
  hush check                    Verify secrets are encrypted
  hush push --dry-run           Preview push to Cloudflare
  hush push -t app              Push only the 'app' target
  hush status                   Show current status
  hush diff                     Compare current runtime target against HEAD
  hush diff --ref HEAD~1        Compare current runtime target against HEAD~1
  hush diff --bundle project    Compare a bundle against HEAD
  hush export-example           Emit a safe example for the default target
  hush export-example --bundle project  Emit a safe example from a bundle
  hush materialize -t runtime --json --to /tmp/hush-out
  hush materialize -t ios-signing --to /tmp/fitbot-signing -- bash scripts/ci/install-ios-signing.sh /tmp/fitbot-signing
  hush materialize --bundle fitbot-signing --to /tmp/fitbot-signing
  hush skill                    Install Claude skill (interactive)
`);
}

type FileKey = 'shared' | 'development' | 'production' | 'local';

export interface ParsedArgs {
  command: string;
  subcommand?: string;
  env: Environment;
  envExplicit: boolean;
  root: string;
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  warn: boolean;
  json: boolean;
  onlyChanged: boolean;
  requireSource: boolean;
  allowPlaintext: boolean;
  global: boolean;
  local: boolean;
  force: boolean;
  gui: boolean;
  vault?: string;
  roles?: string;
  identities?: string;
  ref?: string;
  bundle?: string;
  from?: string;
  cleanup: boolean;
  outputRoot?: string;
  file?: FileKey;
  key?: string;
  value?: string;
  target?: string;
  positionalArgs: string[];
  cmdArgs: string[];
}

function parseEnvironment(value: string): Environment | null {
  if (value === 'development' || value === 'dev') return 'development';
  if (value === 'production' || value === 'prod') return 'production';
  return null;
}

function parseFileKey(value: string): FileKey | null {
  if (value === 'shared' || value === 'development' || value === 'production' || value === 'local') return value;
  if (value === 'dev') return 'development';
  if (value === 'prod') return 'production';
  return null;
}

export function parseArgs(args: string[]): ParsedArgs {
  let command = '';
  let subcommand: string | undefined;
  let env: Environment = 'development';
  let envExplicit = false;
  let root = process.cwd();
  let dryRun = false;
  let verbose = false;
  let quiet = false;
  let warn = false;
  let json = false;
  let onlyChanged = false;
  let requireSource = false;
  let allowPlaintext = false;
  let global = false;
  let local = false;
  let force = false;
  let gui = false;
  let vault: string | undefined;
  let roles: string | undefined;
  let identities: string | undefined;
  let ref: string | undefined;
  let bundle: string | undefined;
  let from: string | undefined;
  let cleanup = false;
  let outputRoot: string | undefined;
  let file: FileKey | undefined;
  let key: string | undefined;
  let value: string | undefined;
  let target: string | undefined;
  let positionalArgs: string[] = [];
  let cmdArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }

    if (arg === '-v' || arg === '--version') {
      console.log(VERSION);
      process.exit(0);
    }

    if (arg === '-e' || arg === '--env') {
      const nextArg = args[++i];
      const parsed = parseEnvironment(nextArg);
      if (parsed) {
        env = parsed;
        envExplicit = true;
      } else {
        console.error(pc.red(`Invalid environment: ${nextArg}`));
        console.error(pc.dim('Use: development, dev, production, or prod'));
        process.exit(1);
      }
      continue;
    }

    if (arg === '-r' || arg === '--root' || arg === '--cwd') {
      root = args[++i];
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--verbose') {
      verbose = true;
      continue;
    }

    if (arg === '-q' || arg === '--quiet') {
      quiet = true;
      continue;
    }

    if (arg === '--warn') {
      warn = true;
      continue;
    }

    if (arg === '--json') {
      json = true;
      continue;
    }

    if (arg === '--only-changed') {
      onlyChanged = true;
      continue;
    }

    if (arg === '--require-source') {
      requireSource = true;
      continue;
    }

    if (arg === '--allow-plaintext') {
      allowPlaintext = true;
      continue;
    }

    if (arg === '--global') {
      global = true;
      continue;
    }

    if (arg === '--local') {
      local = true;
      continue;
    }

    if (arg === '--force' || arg === '-f') {
      force = true;
      continue;
    }

    if (arg === '--gui') {
      gui = true;
      continue;
    }

    if (arg === '--vault') {
      vault = args[++i];
      continue;
    }

    if (arg === '--roles') {
      roles = args[++i];
      continue;
    }

    if (arg === '--identities') {
      identities = args[++i];
      continue;
    }

    if (arg === '--ref') {
      ref = args[++i];
      continue;
    }

    if (arg === '--bundle') {
      bundle = args[++i];
      continue;
    }

    if (arg === '--from') {
      from = args[++i];
      continue;
    }

    if (arg === '--cleanup') {
      cleanup = true;
      continue;
    }

    if (arg === '--output-root' || arg === '--to') {
      outputRoot = args[++i];
      continue;
    }

    if (arg === '-t' || arg === '--target') {
      target = args[++i];
      continue;
    }

    if (arg === '--') {
      cmdArgs = args.slice(i + 1);
      break;
    }

    if (!command && !arg.startsWith('-')) {
      command = arg;
      continue;
    }

    if (command === 'edit' && !arg.startsWith('-')) {
      const parsed = parseFileKey(arg);
      if (parsed) {
        file = parsed;
      } else {
        console.error(pc.red(`Invalid file: ${arg}`));
        console.error(pc.dim('Use: shared, development, production, or local'));
        process.exit(1);
      }
      continue;
    }

    if (command === 'set' && !arg.startsWith('-')) {
      if (!key) {
        key = arg;
      } else if (!value) {
        // Second positional arg is the value
        // Syntax: hush set <KEY> <VALUE>
        value = arg;
      }
      continue;
    }

    if (command === 'has' && !arg.startsWith('-') && !key) {
      key = arg;
      continue;
    }

    if (command === 'trace' && !arg.startsWith('-') && !key) {
      key = arg;
      continue;
    }

    if (command === 'resolve' && !arg.startsWith('-') && !target) {
      target = arg;
      continue;
    }

    if (command === 'keys' && !arg.startsWith('-') && !subcommand) {
      subcommand = arg;
      continue;
    }

    if (command === 'config' && !arg.startsWith('-')) {
      if (!subcommand) {
        subcommand = arg;
      } else {
        positionalArgs.push(arg);
      }
      continue;
    }
  }

  return {
    command,
    subcommand,
    env,
    envExplicit,
    root,
    dryRun,
    verbose,
    quiet,
    warn,
    json,
    onlyChanged,
    requireSource,
    allowPlaintext,
    global,
    local,
    force,
    gui,
    vault,
    roles,
    identities,
    ref,
    bundle,
    from,
    cleanup,
    outputRoot,
    file,
    key,
    value,
    target,
    positionalArgs,
    cmdArgs,
  };
}

function checkMigrationNeeded(root: string, command: string): void {
  const skipCommands = ['', 'help', 'version', 'bootstrap', 'config', 'init', 'skill', 'migrate'];
  if (skipCommands.includes(command)) return;

  const project = findProjectRoot(root);
  if (project?.repositoryKind === 'legacy-v2') {
    console.log('');
    console.log(pc.yellow('━'.repeat(60)));
    console.log(pc.yellow(pc.bold('  Migration Required')));
    console.log(pc.yellow('━'.repeat(60)));
    console.log('');
    console.log(`  This repository still uses ${pc.cyan('hush.yaml')} legacy runtime authority.`);
    console.log(`  Hush ${VERSION} expects a ${pc.bold('.hush/')} v3 repository for normal runtime commands.`);
    console.log('');
    console.log(pc.dim('  Run this first:'));
    console.log(`  ${pc.cyan('hush migrate --from v2 --dry-run')}`);
    console.log(`  ${pc.cyan('hush migrate --from v2')}`);
    console.log('');
    console.log(pc.yellow('━'.repeat(60)));
    console.log('');
  }
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const { command, subcommand, env, envExplicit, root, dryRun, verbose, quiet, warn, json, onlyChanged, requireSource, allowPlaintext, global, local, force, gui, vault, roles, identities, ref, bundle, from, cleanup, outputRoot, file, key, value, target, positionalArgs, cmdArgs } = parseArgs(args);
  const storeMode: StoreMode = global && command !== 'skill' ? 'global' : 'project';
  const store = resolveStoreContext(root, storeMode);

  if (command !== 'run' && !json && !quiet) {
    checkForUpdate(VERSION);
  }

  checkMigrationNeeded(store.root, command);

  try {
    switch (command) {
      case 'init':
        await initCommand(defaultContext, { store });
        break;

      case 'bootstrap':
        await bootstrapCommand(defaultContext, { store });
        break;

      case 'config':
        await configCommand(defaultContext, { store, subcommand, args: positionalArgs, roles, identities });
        break;

      case 'encrypt':
        await encryptCommand(defaultContext, { store });
        break;

      case 'decrypt':
        await decryptCommand(defaultContext, { store, env, force });
        break;

      case 'run':
        await runCommand(defaultContext, { store, cwd: root, env, target, command: cmdArgs });
        break;

      case 'set': {
        let setFile: FileKey = 'shared';
        if (local) {
          setFile = 'local';
        } else if (envExplicit) {
          setFile = env;
        }
        await setCommand(defaultContext, { store, file: setFile, key, value, gui });
        break;
      }

      case 'edit':
        await editCommand(defaultContext, { store, file });
        break;

      case 'list':
        await listCommand(defaultContext, { store, env });
        break;

      case 'inspect':
        await inspectCommand(defaultContext, { store, env });
        break;

      case 'has':
        if (!key) {
          console.error(pc.red('Usage: hush has <KEY>'));
          process.exit(1);
        }
        await hasCommand(defaultContext, { store, env, key, quiet });
        break;

      case 'check':
        await checkCommand(defaultContext, { store, warn, json, quiet, onlyChanged, requireSource, allowPlaintext });
        break;



      case 'push':
        await pushCommand(defaultContext, { store, dryRun, verbose, target });
        break;

      case 'status':
        await statusCommand(defaultContext, { store });
        break;

      case 'skill':
        await skillCommand(defaultContext, { root, global, local });
        break;

      case 'keys':
        if (!subcommand) {
          console.error(pc.red('Usage: hush keys <command>'));
          console.error(pc.dim('Commands: setup, generate, pull, push, list'));
          process.exit(1);
        }
        await keysCommand(defaultContext, { store, subcommand, vault, force });
        break;

      case 'resolve':
        if (!target) {
          console.error(pc.red('Usage: hush resolve <target>'));
          console.error(pc.dim('Example: hush resolve api-workers'));
          process.exit(1);
        }
        await resolveCommand(defaultContext, { store, env, target });
        break;

      case 'trace':
        if (!key) {
          console.error(pc.red('Usage: hush trace <KEY>'));
          console.error(pc.dim('Example: hush trace DATABASE_URL'));
          process.exit(1);
        }
        await traceCommand(defaultContext, { store, env, key });
        break;

      case 'diff':
        await diffCommand(defaultContext, { store, env, target, bundle, ref });
        break;

      case 'export-example':
        await exportExampleCommand(defaultContext, { store, env, target, bundle });
        break;

      case 'template':
        await templateCommand(defaultContext, { root, env });
        break;

      case 'expansions':
        await expansionsCommand(defaultContext, { root, env });
        break;

      case 'migrate':
        await migrateCommand(defaultContext, { root, dryRun, from, cleanup });
        break;

      case 'materialize':
        await materializeCommand(defaultContext, { store, target, bundle, json, outputRoot, cleanup, command: cmdArgs });
        break;

      default:
        if (command) {
          console.error(pc.red(`Unknown command: ${command}`));
        }
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    const err = error as Error;
    console.error(pc.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

await main();
