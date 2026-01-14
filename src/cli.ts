#!/usr/bin/env node
import { resolve } from 'node:path';
import pc from 'picocolors';
import { decryptCommand } from './commands/decrypt.js';
import { editCommand } from './commands/edit.js';
import { encryptCommand } from './commands/encrypt.js';
import { pushCommand } from './commands/push.js';
import { statusCommand } from './commands/status.js';
import type { Environment } from './types.js';

const HELP = `
${pc.bold('hush')} - SOPS-based secrets management for monorepos

${pc.bold('Usage:')}
  hush <command> [options]

${pc.bold('Commands:')}
  decrypt     Decrypt .env.encrypted and generate env files for all packages
  encrypt     Encrypt .env to .env.encrypted
  push        Push production secrets to Cloudflare Workers
  edit        Open .env.encrypted in editor (SOPS inline edit)
  status      Show discovered packages and their styles
  help        Show this help message

${pc.bold('Options:')}
  --env <dev|prod>   Target environment (default: dev)
  --dry-run          Don't make changes, just show what would happen
  --root <path>      Monorepo root directory (default: cwd)

${pc.bold('Examples:')}
  hush decrypt              Decrypt for development
  hush decrypt --env prod   Decrypt for production
  hush encrypt              Encrypt .env file
  hush push                 Push prod secrets to Wrangler
  hush push --dry-run       Preview what would be pushed
  hush edit                 Edit encrypted file in $EDITOR
  hush status               Show package detection info
`;

interface ParsedArgs {
  command: string;
  env: Environment;
  dryRun: boolean;
  root: string;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: 'help',
    env: 'dev',
    dryRun: false,
    root: process.cwd(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--env' && args[i + 1]) {
      const envArg = args[i + 1];
      if (envArg === 'dev' || envArg === 'prod') {
        result.env = envArg;
      } else {
        console.error(pc.red(`Invalid environment: ${envArg}`));
        console.error(pc.dim('Valid values: dev, prod'));
        process.exit(1);
      }
      i++;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--root' && args[i + 1]) {
      result.root = resolve(args[i + 1]);
      i++;
    } else if (!arg.startsWith('-') && !result.command) {
      result.command = arg;
    } else if (!arg.startsWith('-')) {
      result.command = arg;
    }
  }

  return result;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  switch (parsed.command) {
    case 'decrypt':
      await decryptCommand({ root: parsed.root, env: parsed.env });
      break;

    case 'encrypt':
      await encryptCommand({ root: parsed.root });
      break;

    case 'push':
      await pushCommand({ root: parsed.root, dryRun: parsed.dryRun });
      break;

    case 'edit':
      await editCommand({ root: parsed.root });
      break;

    case 'status':
      await statusCommand({ root: parsed.root });
      break;

    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      break;

    default:
      console.error(pc.red(`Unknown command: ${parsed.command}`));
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(pc.red('Fatal error:'), error.message);
  process.exit(1);
});
