#!/usr/bin/env node
import pc from 'picocolors';
import type { Environment } from './types.js';
import { decryptCommand } from './commands/decrypt.js';
import { encryptCommand } from './commands/encrypt.js';
import { editCommand } from './commands/edit.js';
import { setCommand } from './commands/set.js';
import { runCommand } from './commands/run.js';
import { statusCommand } from './commands/status.js';
import { pushCommand } from './commands/push.js';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { inspectCommand } from './commands/inspect.js';
import { hasCommand } from './commands/has.js';
import { checkCommand } from './commands/check.js';
import { skillCommand } from './commands/skill.js';

const VERSION = '2.1.0';

function printHelp(): void {
  console.log(`
${pc.bold('hush')} - SOPS-based secrets management for monorepos

${pc.bold('Usage:')}
  hush <command> [options]

${pc.bold('Commands:')}
  init              Initialize hush.yaml config
  encrypt           Encrypt source .env files
  run -- <cmd>      Run command with secrets in memory (AI-safe)
  set <KEY>         Set a single secret interactively (AI-safe)
  edit [file]       Edit all secrets in $EDITOR
  list              List all variables (shows values)
  inspect           List all variables (masked values, AI-safe)
  has <key>         Check if a secret exists (exit 0 if set, 1 if not)
  check             Verify secrets are encrypted (for pre-commit hooks)
  push              Push secrets to Cloudflare Workers
  status            Show configuration and status
  skill             Install Claude Code / OpenCode skill
  
${pc.bold('Deprecated Commands:')}
  decrypt           Write secrets to disk (unsafe - use 'run' instead)

${pc.bold('Options:')}
  -e, --env <env>   Environment: development or production (default: development)
  -r, --root <dir>  Root directory (default: current directory)
  -t, --target <t>  Target name from hush.yaml (run only)
  -q, --quiet       Suppress output (has/check commands)
  --dry-run         Preview changes without applying (push only)
  --warn            Warn but exit 0 on drift (check only)
  --json            Output machine-readable JSON (check only)
  --only-changed    Only check git-modified files (check only)
  --require-source  Fail if source file is missing (check only)
  --global          Install skill to ~/.claude/skills/ (skill only)
  --local           Install skill to ./.claude/skills/ (skill/set only)
  -h, --help        Show this help message
  -v, --version     Show version number

${pc.bold('Examples:')}
  hush init                     Initialize hush.yaml config
  hush encrypt                  Encrypt .env files
  hush run -- npm start         Run with secrets in memory (AI-safe!)
  hush run -e prod -- npm build Run with production secrets
  hush run -t api -- wrangler dev  Run filtered for 'api' target
  hush set DATABASE_URL         Set a secret interactively (AI-safe)
  hush set API_KEY -e prod      Set a production secret
  hush set API_KEY --local      Set a personal local override
  hush edit                     Edit all shared secrets in $EDITOR
  hush edit development         Edit development secrets in $EDITOR
  hush edit local               Edit personal local overrides
  hush inspect                  List all variables (masked, AI-safe)
  hush has DATABASE_URL         Check if DATABASE_URL is set
  hush has API_KEY -q && echo "API_KEY is configured"
  hush check                    Verify secrets are encrypted
  hush push --dry-run           Preview push to Cloudflare
  hush status                   Show current status
  hush skill                    Install Claude skill (interactive)
`);
}

type FileKey = 'shared' | 'development' | 'production' | 'local';

interface ParsedArgs {
  command: string;
  env: Environment;
  envExplicit: boolean;
  root: string;
  dryRun: boolean;
  quiet: boolean;
  warn: boolean;
  json: boolean;
  onlyChanged: boolean;
  requireSource: boolean;
  global: boolean;
  local: boolean;
  file?: FileKey;
  key?: string;
  target?: string;
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

function parseArgs(args: string[]): ParsedArgs {
  let command = '';
  let env: Environment = 'development';
  let envExplicit = false;
  let root = process.cwd();
  let dryRun = false;
  let quiet = false;
  let warn = false;
  let json = false;
  let onlyChanged = false;
  let requireSource = false;
  let global = false;
  let local = false;
  let file: FileKey | undefined;
  let key: string | undefined;
  let target: string | undefined;
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

    if (arg === '-r' || arg === '--root') {
      root = args[++i];
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
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

    if (arg === '--global') {
      global = true;
      continue;
    }

    if (arg === '--local') {
      local = true;
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

    if (command === 'set' && !arg.startsWith('-') && !key) {
      key = arg;
      continue;
    }

    if (command === 'has' && !arg.startsWith('-') && !key) {
      key = arg;
      continue;
    }
  }

  return { command, env, envExplicit, root, dryRun, quiet, warn, json, onlyChanged, requireSource, global, local, file, key, target, cmdArgs };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const { command, env, envExplicit, root, dryRun, quiet, warn, json, onlyChanged, requireSource, global, local, file, key, target, cmdArgs } = parseArgs(args);

  try {
    switch (command) {
      case 'init':
        await initCommand({ root });
        break;

      case 'encrypt':
        await encryptCommand({ root });
        break;

      case 'decrypt':
        console.warn(pc.yellow('⚠️  Warning: "hush decrypt" is deprecated and writes unencrypted secrets to disk.'));
        console.warn(pc.yellow('   Use "hush run -- <command>" instead for better security.'));
        console.warn(pc.dim('   To suppress this warning, use "hush unsafe:decrypt"'));
        console.warn('');
        await decryptCommand({ root, env });
        break;

      case 'unsafe:decrypt':
        console.warn(pc.red('⚠️  UNSAFE MODE: Writing unencrypted secrets to disk.'));
        console.warn(pc.red('   These files will be readable by AI assistants and other tools.'));
        console.warn('');
        await decryptCommand({ root, env });
        break;

      case 'run':
        await runCommand({ root, env, target, command: cmdArgs });
        break;

      case 'set': {
        let setFile: FileKey = 'shared';
        if (local) {
          setFile = 'local';
        } else if (envExplicit) {
          setFile = env;
        }
        await setCommand({ root, file: setFile, key });
        break;
      }

      case 'edit':
        await editCommand({ root, file });
        break;

      case 'list':
        await listCommand({ root, env });
        break;

      case 'inspect':
        await inspectCommand({ root, env });
        break;

      case 'has':
        if (!key) {
          console.error(pc.red('Usage: hush has <KEY>'));
          process.exit(1);
        }
        await hasCommand({ root, env, key, quiet });
        break;

      case 'check':
        await checkCommand({ root, warn, json, quiet, onlyChanged, requireSource });
        break;

      case 'push':
        await pushCommand({ root, dryRun });
        break;

      case 'status':
        await statusCommand({ root });
        break;

      case 'skill':
        await skillCommand({ root, global, local });
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

main();
