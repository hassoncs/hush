import { createInterface } from 'node:readline';
import { join } from 'node:path';
import pc from 'picocolors';
import { filterVarsForTarget } from '../core/filter.js';
import { interpolateVars, getUnresolvedVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent, parseEnvFile } from '../core/parse.js';
import { formatVars } from '../formats/index.js';
import type { DecryptOptions, EnvVar, HushContext } from '../types.js';
import { FORMAT_OUTPUT_FILES } from '../types.js';

function getEncryptedPath(sourcePath: string): string {
  return sourcePath + '.encrypted';
}

async function confirmDangerousOperation(ctx: HushContext): Promise<boolean> {
  if (!ctx.process.stdin.isTTY) {
    ctx.logger.error('\nError: decrypt --force requires interactive confirmation.');
    ctx.logger.error('This command cannot be run in non-interactive environments.');
    ctx.logger.error('\nUse "hush run -- <command>" instead to inject secrets into memory.');
    return false;
  }

  ctx.logger.log('');
  ctx.logger.log(pc.red('━'.repeat(70)));
  ctx.logger.log(pc.red(pc.bold('  ⚠️  WARNING: WRITING PLAINTEXT SECRETS TO DISK')));
  ctx.logger.log(pc.red('━'.repeat(70)));
  ctx.logger.log('');
  ctx.logger.log(pc.yellow('  This will create unencrypted .env files that:'));
  ctx.logger.log(pc.dim('    • Can be read by AI assistants, scripts, and other tools'));
  ctx.logger.log(pc.dim('    • May accidentally be committed to git'));
  ctx.logger.log(pc.dim('    • Defeat the "encrypted at rest" security model'));
  ctx.logger.log('');
  ctx.logger.log(pc.green('  Recommended alternative:'));
  ctx.logger.log(pc.cyan('    hush run -- <command>'));
  ctx.logger.log(pc.dim('    Decrypts to memory only, secrets never touch disk.'));
  ctx.logger.log('');
  ctx.logger.log(pc.red('━'.repeat(70)));
  ctx.logger.log('');

  const rl = createInterface({
    input: ctx.process.stdin,
    output: ctx.process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${pc.bold('Type "yes" to proceed:')} `, (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'yes') {
        ctx.logger.log('');
        resolve(true);
      } else {
        ctx.logger.log(pc.dim('\nAborted. No files were written.'));
        resolve(false);
      }
    });
  });
}

export async function decryptCommand(ctx: HushContext, options: DecryptOptions): Promise<void> {
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

  const confirmed = await confirmDangerousOperation(ctx);
  if (!confirmed) {
    ctx.process.exit(0);
  }

  const config = ctx.config.loadConfig(root);

  ctx.logger.log(pc.yellow(`⚠️  Writing unencrypted secrets for ${env}...`));

  const sharedEncrypted = join(root, getEncryptedPath(config.sources.shared));
  const envEncrypted = join(root, getEncryptedPath(config.sources[env]));
  const localPath = join(root, config.sources.local);

  const varSources: EnvVar[][] = [];

  if (ctx.fs.existsSync(sharedEncrypted)) {
    const content = ctx.sops.decrypt(sharedEncrypted);
    const vars = parseEnvContent(content);
    varSources.push(vars);
    ctx.logger.log(pc.dim(`  ${config.sources.shared}.encrypted: ${vars.length} vars`));
  }

  if (ctx.fs.existsSync(envEncrypted)) {
    const content = ctx.sops.decrypt(envEncrypted);
    const vars = parseEnvContent(content);
    varSources.push(vars);
    ctx.logger.log(pc.dim(`  ${config.sources[env]}.encrypted: ${vars.length} vars`));
  }

  if (ctx.fs.existsSync(localPath)) {
    const vars = parseEnvFile(localPath);
    varSources.push(vars);
    ctx.logger.log(pc.dim(`  ${config.sources.local}: ${vars.length} vars (overrides)`));
  }

  if (varSources.length === 0) {
    ctx.logger.error(pc.red('No encrypted files found'));
    ctx.logger.error(pc.dim(`Expected: ${sharedEncrypted}`));
    ctx.process.exit(1);
  }

  const merged = mergeVars(...varSources);
  const interpolated = interpolateVars(merged);

  const unresolved = getUnresolvedVars(interpolated);
  if (unresolved.length > 0) {
    ctx.logger.warn(pc.yellow(`  Warning: ${unresolved.length} vars have unresolved references`));
  }

  ctx.logger.log(pc.yellow(`\n⚠️  Writing to ${config.targets.length} targets:`));

  for (const target of config.targets) {
    const targetDir = join(root, target.path);
    const filtered = filterVarsForTarget(interpolated, target);

    if (filtered.length === 0) {
      ctx.logger.log(pc.dim(`  ${target.path}/ - no matching vars, skipped`));
      continue;
    }

    const outputFilename = FORMAT_OUTPUT_FILES[target.format][env];
    const outputPath = join(targetDir, outputFilename);

    if (!ctx.fs.existsSync(targetDir)) {
      ctx.fs.mkdirSync(targetDir, { recursive: true });
    }

    const content = formatVars(filtered, target.format);
    ctx.fs.writeFileSync(outputPath, content, 'utf-8');

    const relativePath = target.path === '.' ? outputFilename : `${target.path}/${outputFilename}`;
    ctx.logger.log(
      pc.yellow(`  ⚠️  ${relativePath}`) +
      pc.dim(` (${target.format}, ${filtered.length} vars)`)
    );
  }

  ctx.logger.log('');
  ctx.logger.log(pc.yellow('⚠️  Decryption complete - plaintext secrets on disk'));
  ctx.logger.log(pc.dim('   Delete these files when done, or use "hush run" next time.'));
}
