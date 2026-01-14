import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pc from 'picocolors';
import { discoverPackages } from '../core/discover.js';
import {
  expandVariables,
  formatEnvFile,
  getVarsForEnvironment,
  mergeEnvVars,
  parseEnvContent,
  parseEnvFile,
} from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import type { Environment, EnvVar, Package } from '../types.js';

interface DecryptOptions {
  root: string;
  env?: Environment;
}

/**
 * Get output files for a package based on its style and environment
 */
function getOutputFiles(
  pkg: Package,
  env: Environment
): { path: string; env: Environment }[] {
  if (pkg.style === 'wrangler') {
    // Wrangler always uses .dev.vars (even for "prod" we generate dev vars for local testing)
    return [{ path: '.dev.vars', env }];
  }

  // Standard style outputs environment-specific files
  if (env === 'dev') {
    return [{ path: '.env.development', env: 'dev' }];
  } else {
    return [{ path: '.env.production', env: 'prod' }];
  }
}

/**
 * Filter variables for a package based on naming conventions
 * - EXPO_PUBLIC_* vars only go to non-wrangler packages
 * - Other vars go to wrangler packages
 */
function filterVarsForPackage(vars: EnvVar[], pkg: Package): EnvVar[] {
  if (pkg.style === 'wrangler') {
    // Wrangler gets everything EXCEPT EXPO_PUBLIC_* vars
    return vars.filter((v) => !v.key.startsWith('EXPO_PUBLIC_'));
  }

  // Standard packages get all vars (including EXPO_PUBLIC_*)
  return vars;
}

/**
 * Decrypt command - decrypt .env.encrypted and generate env files for all packages
 */
export async function decryptCommand(options: DecryptOptions): Promise<void> {
  const { root, env = 'dev' } = options;

  const encryptedPath = join(root, '.env.encrypted');
  const localPath = join(root, '.env.local');

  // Check encrypted file exists
  if (!existsSync(encryptedPath)) {
    console.error(pc.red(`Error: ${encryptedPath} not found`));
    console.error(
      pc.dim('Create it with: pnpm secrets encrypt (after creating .env)')
    );
    process.exit(1);
  }

  console.log(pc.blue('Decrypting secrets...'));

  // Decrypt the encrypted file
  let decryptedContent: string;
  try {
    decryptedContent = sopsDecrypt(encryptedPath);
  } catch (error) {
    console.error(pc.red((error as Error).message));
    process.exit(1);
  }

  // Parse decrypted content
  const allVars = parseEnvContent(decryptedContent);
  console.log(pc.dim(`  Parsed ${allVars.length} variables from .env.encrypted`));

  // Get vars for the target environment
  const envVars = getVarsForEnvironment(allVars, env);
  console.log(pc.dim(`  ${envVars.length} variables for ${env} environment`));

  // Load local overrides if they exist
  const localVars = parseEnvFile(localPath);
  if (localVars.length > 0) {
    console.log(pc.dim(`  ${localVars.length} local overrides from .env.local`));
  }

  // Merge and expand
  const mergedVars = mergeEnvVars(envVars, localVars);
  const expandedVars = expandVariables(mergedVars);

  // Discover packages
  const packages = await discoverPackages(root);
  console.log(pc.blue(`\nDiscovered ${packages.length} packages:`));

  // Generate output files for each package
  for (const pkg of packages) {
    const pkgDir = pkg.path ? join(root, pkg.path) : root;
    const outputFiles = getOutputFiles(pkg, env);
    const pkgVars = filterVarsForPackage(expandedVars, pkg);

    if (pkgVars.length === 0) {
      console.log(
        pc.dim(`  ${pkg.path || '.'} (${pkg.style}) - no applicable vars, skipped`)
      );
      continue;
    }

    for (const output of outputFiles) {
      const outputPath = join(pkgDir, output.path);

      // Ensure directory exists
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write the file
      const content = formatEnvFile(pkgVars);
      writeFileSync(outputPath, content, 'utf-8');

      const relativePath = pkg.path ? `${pkg.path}/${output.path}` : output.path;
      console.log(
        pc.green(`  ${relativePath}`) +
          pc.dim(` (${pkg.style}, ${pkgVars.length} vars)`)
      );
    }
  }

  // Also write root .env with shared vars (useful for scripts)
  const rootEnvPath = join(root, '.env');
  writeFileSync(rootEnvPath, formatEnvFile(expandedVars), 'utf-8');
  console.log(pc.green(`  .env`) + pc.dim(` (root, ${expandedVars.length} vars)`));

  console.log(pc.green('\nDecryption complete'));
}
