import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { filterVarsForTarget } from '../core/filter.js';
import { interpolateVars, getUnresolvedVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent, parseEnvFile } from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import { formatVars } from '../formats/index.js';
import type { DecryptOptions, EnvVar } from '../types.js';
import { FORMAT_OUTPUT_FILES } from '../types.js';

function getEncryptedPath(sourcePath: string): string {
  return sourcePath + '.encrypted';
}

async function confirmDangerousOperation(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(pc.red('\nError: decrypt --force requires interactive confirmation.'));
    console.error(pc.dim('This command cannot be run in non-interactive environments.'));
    console.error(pc.dim('\nUse "hush run -- <command>" instead to inject secrets into memory.'));
    return false;
  }

  console.log('');
  console.log(pc.red('━'.repeat(70)));
  console.log(pc.red(pc.bold('  ⚠️  WARNING: WRITING PLAINTEXT SECRETS TO DISK')));
  console.log(pc.red('━'.repeat(70)));
  console.log('');
  console.log(pc.yellow('  This will create unencrypted .env files that:'));
  console.log(pc.dim('    • Can be read by AI assistants, scripts, and other tools'));
  console.log(pc.dim('    • May accidentally be committed to git'));
  console.log(pc.dim('    • Defeat the "encrypted at rest" security model'));
  console.log('');
  console.log(pc.green('  Recommended alternative:'));
  console.log(pc.cyan('    hush run -- <your-command>'));
  console.log(pc.dim('    Decrypts to memory only, secrets never touch disk.'));
  console.log('');
  console.log(pc.red('━'.repeat(70)));
  console.log('');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${pc.bold('Type "yes" to proceed:')} `, (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'yes') {
        console.log('');
        resolve(true);
      } else {
        console.log(pc.dim('\nAborted. No files were written.'));
        resolve(false);
      }
    });
  });
}

export async function decryptCommand(options: DecryptOptions): Promise<void> {
  const { root, env, force } = options;

  if (!force) {
    console.error(pc.red('Error: decrypt requires --force flag'));
    console.error('');
    console.error(pc.dim('This command writes plaintext secrets to disk, which is generally unsafe.'));
    console.error(pc.dim('Use "hush run -- <command>" instead for memory-only decryption.'));
    console.error('');
    console.error(pc.dim('If you really need plaintext files:'));
    console.error(pc.cyan('  hush decrypt --force'));
    process.exit(1);
  }

  const confirmed = await confirmDangerousOperation();
  if (!confirmed) {
    process.exit(0);
  }

  const config = loadConfig(root);

  console.log(pc.yellow(`⚠️  Writing unencrypted secrets for ${env}...`));

  const sharedEncrypted = join(root, getEncryptedPath(config.sources.shared));
  const envEncrypted = join(root, getEncryptedPath(config.sources[env]));
  const localPath = join(root, '.env.local');

  const varSources: EnvVar[][] = [];

  if (existsSync(sharedEncrypted)) {
    const content = sopsDecrypt(sharedEncrypted);
    const vars = parseEnvContent(content);
    varSources.push(vars);
    console.log(pc.dim(`  ${config.sources.shared}.encrypted: ${vars.length} vars`));
  }

  if (existsSync(envEncrypted)) {
    const content = sopsDecrypt(envEncrypted);
    const vars = parseEnvContent(content);
    varSources.push(vars);
    console.log(pc.dim(`  ${config.sources[env]}.encrypted: ${vars.length} vars`));
  }

  if (existsSync(localPath)) {
    const vars = parseEnvFile(localPath);
    varSources.push(vars);
    console.log(pc.dim(`  .env.local: ${vars.length} vars (overrides)`));
  }

  if (varSources.length === 0) {
    console.error(pc.red('No encrypted files found'));
    console.error(pc.dim(`Expected: ${sharedEncrypted}`));
    process.exit(1);
  }

  const merged = mergeVars(...varSources);
  const interpolated = interpolateVars(merged);

  const unresolved = getUnresolvedVars(interpolated);
  if (unresolved.length > 0) {
    console.warn(pc.yellow(`  Warning: ${unresolved.length} vars have unresolved references`));
  }

  console.log(pc.yellow(`\n⚠️  Writing to ${config.targets.length} targets:`));

  for (const target of config.targets) {
    const targetDir = join(root, target.path);
    const filtered = filterVarsForTarget(interpolated, target);

    if (filtered.length === 0) {
      console.log(pc.dim(`  ${target.path}/ - no matching vars, skipped`));
      continue;
    }

    const outputFilename = FORMAT_OUTPUT_FILES[target.format][env];
    const outputPath = join(targetDir, outputFilename);

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const content = formatVars(filtered, target.format);
    writeFileSync(outputPath, content, 'utf-8');

    const relativePath = target.path === '.' ? outputFilename : `${target.path}/${outputFilename}`;
    console.log(
      pc.yellow(`  ⚠️  ${relativePath}`) +
      pc.dim(` (${target.format}, ${filtered.length} vars)`)
    );
  }

  console.log('');
  console.log(pc.yellow('⚠️  Decryption complete - plaintext secrets on disk'));
  console.log(pc.dim('   Delete these files when done, or use "hush run" next time.'));
}
