import { glob } from 'glob';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Package, PackageStyle } from '../types.js';

/**
 * Patterns to ignore when discovering packages
 */
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.turbo/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.expo/**',
];

/**
 * Detect the style for a package directory
 * - If wrangler.toml exists -> wrangler
 * - Otherwise -> standard
 */
function detectStyle(packageDir: string): PackageStyle {
  const wranglerPath = join(packageDir, 'wrangler.toml');
  const wranglerDevPath = join(packageDir, 'wrangler.dev.toml');

  if (existsSync(wranglerPath) || existsSync(wranglerDevPath)) {
    const configPath = existsSync(wranglerPath) ? wranglerPath : wranglerDevPath;
    const content = readFileSync(configPath, 'utf-8');
    if (content.includes('pages_build_output_dir')) {
      return 'standard';
    }
    return 'wrangler';
  }

  return 'standard';
}

/**
 * Read package name from package.json
 */
function readPackageName(packageJsonPath: string): string {
  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.name || dirname(packageJsonPath);
  } catch {
    return dirname(packageJsonPath);
  }
}

/**
 * Discover all packages in the monorepo
 */
export async function discoverPackages(root: string): Promise<Package[]> {
  // Find all package.json files
  const packageJsonPaths = await glob('**/package.json', {
    cwd: root,
    ignore: IGNORE_PATTERNS,
  });

  const packages: Package[] = [];

  for (const pkgPath of packageJsonPaths) {
    const dir = dirname(pkgPath);
    const fullDir = join(root, dir);
    const style = detectStyle(fullDir);
    const name = readPackageName(join(root, pkgPath));

    if (name === '@chriscode/hush') {
      continue;
    }

    packages.push({
      name,
      path: dir === '.' ? '' : dir,
      style,
    });
  }

  // Sort by path depth (root first, then alphabetically)
  packages.sort((a, b) => {
    const depthA = a.path.split('/').length;
    const depthB = b.path.split('/').length;
    if (depthA !== depthB) return depthA - depthB;
    return a.path.localeCompare(b.path);
  });

  return packages;
}
