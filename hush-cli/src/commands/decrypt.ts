import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { filterVarsForTarget, describeFilter } from '../core/filter.js';
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

export async function decryptCommand(options: DecryptOptions): Promise<void> {
  const { root, env } = options;
  const config = loadConfig(root);

  console.log(pc.blue(`Decrypting for ${env}...`));

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

  console.log(pc.blue(`\nWriting to ${config.targets.length} targets:`));

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
      pc.green(`  ${relativePath}`) +
      pc.dim(` (${target.format}, ${filtered.length} vars)`)
    );
  }

  console.log(pc.green('\nDecryption complete'));
}
