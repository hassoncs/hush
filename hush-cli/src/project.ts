import { join } from 'node:path';
import { fs } from './lib/fs.js';

export function getProjectIdentifier(root: string): string | undefined {
  const pkgPath = join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return undefined;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8') as string);
    if (typeof pkg.repository === 'string') {
      const match = pkg.repository.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) {
        return match[1];
      }
    }

    if (pkg.repository?.url) {
      const match = pkg.repository.url.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) {
        return match[1];
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}
