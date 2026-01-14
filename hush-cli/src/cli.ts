#!/usr/bin/env node
import pc from 'picocolors';
import type { Environment } from './types.js';
import { decryptCommand } from './commands/decrypt.js';
import { encryptCommand } from './commands/encrypt.js';
import { editCommand } from './commands/edit.js';
import { statusCommand } from './commands/status.js';
import { pushCommand } from './commands/push.js';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { inspectCommand } from './commands/inspect.js';
import { hasCommand } from './commands/has.js';
import { checkCommand } from './commands/check.js';

const VERSION = '2.0.0';

function printHelp(): void {
  console.log(`
${pc.bold('hush')} - SOPS-based secrets management for monorepos

${pc.bold('Usage:')}
  hush <command> [options]

${pc.bold('Commands:')}
  init              Initialize hush.yaml config
  encrypt           Encrypt source .env files
  decrypt           Decrypt and distribute to targets
  edit [file]       Edit encrypted file in $EDITOR
  list              List all variables (shows values)
  inspect           List all variables (masked values, AI-safe)
  has <key>         Check if a secret exists (exit 0 if set, 1 if not)
  check             Verify secrets are encrypted (for pre-commit hooks)
  push              Push secrets to Cloudflare Workers
  status            Show configuration and status

${pc.bold('Options:')}
  -e, --env <env>   Environment: development or production (default: development)
  -r, --root <dir>  Root directory (default: current directory)
  -q, --quiet       Suppress output (has/check commands)
  --dry-run         Preview changes without applying (push only)
  --warn            Warn but exit 0 on drift (check only)
  --json            Output machine-readable JSON (check only)
  --only-changed    Only check git-modified files (check only)
  --require-source  Fail if source file is missing (check only)
  -h, --help        Show this help message
  -v, --version     Show version number

${pc.bold('Examples:')}
  hush init                     Initialize hush.yaml config
  hush encrypt                  Encrypt .env files
  hush decrypt                  Decrypt for development
  hush decrypt -e production    Decrypt for production
  hush edit                     Edit shared secrets
  hush edit development         Edit development secrets
  hush list                     List all variables (shows values)
  hush inspect                  List all variables (masked, AI-safe)
  hush has DATABASE_URL         Check if DATABASE_URL is set
  hush has API_KEY -q && echo "API_KEY is configured"
  hush check                    Verify secrets are encrypted
  hush check --warn             Check but don't fail on drift
  hush check --json             Output JSON for CI
  hush push --dry-run           Preview push to Cloudflare
  hush status                   Show current status
`);
}

type FileKey = 'shared' | 'development' | 'production';

interface ParsedArgs {
  command: string;
  env: Environment;
  root: string;
  dryRun: boolean;
  quiet: boolean;
  warn: boolean;
  json: boolean;
  onlyChanged: boolean;
  requireSource: boolean;
  file?: FileKey;
  key?: string;
}

function parseEnvironment(value: string): Environment | null {
  if (value === 'development' || value === 'dev') return 'development';
  if (value === 'production' || value === 'prod') return 'production';
  return null;
}

function parseFileKey(value: string): FileKey | null {
  if (value === 'shared' || value === 'development' || value === 'production') return value;
  if (value === 'dev') return 'development';
  if (value === 'prod') return 'production';
  return null;
}

function parseArgs(args: string[]): ParsedArgs {
  let command = '';
  let env: Environment = 'development';
  let root = process.cwd();
  let dryRun = false;
  let quiet = false;
  let warn = false;
  let json = false;
  let onlyChanged = false;
  let requireSource = false;
  let file: FileKey | undefined;
  let key: string | undefined;

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
        console.error(pc.dim('Use: shared, development, or production'));
        process.exit(1);
      }
      continue;
    }

    if (command === 'has' && !arg.startsWith('-') && !key) {
      key = arg;
      continue;
    }
  }

  return { command, env, root, dryRun, quiet, warn, json, onlyChanged, requireSource, file, key };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const { command, env, root, dryRun, quiet, warn, json, onlyChanged, requireSource, file, key } = parseArgs(args);

  try {
    switch (command) {
      case 'init':
        await initCommand({ root });
        break;

      case 'encrypt':
        await encryptCommand({ root });
        break;

      case 'decrypt':
        await decryptCommand({ root, env });
        break;

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
