import pc from 'picocolors';
import { appendAuditEvent } from '../v3/audit.js';
import { requireActiveIdentity } from '../v3/identity.js';
import { loadV3Repository } from '../v3/repository.js';
import { resolveV3Target } from '../v3/resolver.js';
import { isIdentityAllowed, type HushFileIndexEntry } from '../v3/domain.js';
import type { HushContext, HushResolvedNode, TraceOptions } from '../types.js';

function canReadFile(file: HushFileIndexEntry, identity: string, roles: readonly string[]): boolean {
  return roles.some((role) => isIdentityAllowed(file.readers, identity, role as never));
}

function formatReaders(file: Pick<HushFileIndexEntry, 'readers'>): string {
  return `roles=${file.readers.roles.join(',') || '-'} identities=${file.readers.identities.join(',') || '-'}`;
}

function matchLogicalPath(selector: string, logicalPath: string): boolean {
  return logicalPath === selector || logicalPath.split('/').filter(Boolean).at(-1) === selector;
}

function formatNodeSummary(logicalPath: string, node: HushResolvedNode): string[] {
  const lines = [`    ${logicalPath}`];

  for (const record of node.provenance) {
    const importLabel = record.import
      ? ` imported-from=${record.import.project}${record.import.bundle ? `:${record.import.bundle}` : ''}${record.import.file ? `:${record.import.file}` : ''}`
      : '';
    lines.push(`      ${pc.dim(`file=${record.filePath}${importLabel}`)}`);
  }

  if (node.interpolation?.dependencies.length) {
    for (const dependency of node.interpolation.dependencies) {
      lines.push(`      ${pc.dim(`interpolation=${dependency.path}${dependency.filePath ? ` <- ${dependency.filePath}` : ''}`)}`);
    }
  }

  return lines;
}

function extractUnreadableFilePaths(message: string): string[] {
  const match = message.match(/: (.+)$/);
  return match?.[1]?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
}

export async function traceCommand(ctx: HushContext, options: TraceOptions): Promise<void> {
  const repository = loadV3Repository(options.store.root, { keyIdentity: options.store.keyIdentity });
  const identity = requireActiveIdentity(ctx, options.store, repository.manifest.identities, {
    name: 'trace',
    args: [options.key],
  });
  const roles = repository.manifest.identities[identity]?.roles ?? [];
  const matchedFiles = repository.files
    .map((file) => ({
      file,
      matches: file.logicalPaths.filter((logicalPath) => matchLogicalPath(options.key, logicalPath)).sort(),
      readable: canReadFile(file, identity, roles),
    }))
    .filter((entry) => entry.matches.length > 0)
    .sort((left, right) => left.file.path.localeCompare(right.file.path));
  const allMatchedLogicalPaths = Array.from(new Set(matchedFiles.flatMap((entry) => entry.matches))).sort();
  const lines: string[] = [];

  appendAuditEvent(ctx, options.store, {
    type: 'read_attempt',
    activeIdentity: identity,
    success: true,
    command: { name: 'trace', args: [options.key] },
    files: matchedFiles.map((entry) => entry.file.path),
    logicalPaths: allMatchedLogicalPaths,
  });

  lines.push(pc.blue('Hush trace\n'));
  lines.push(`Selector: ${pc.cyan(options.key)}`);
  lines.push(`Active identity: ${pc.green(identity)}`);
  lines.push(`Matched logical paths: ${pc.cyan(String(allMatchedLogicalPaths.length))}`);

  if (matchedFiles.length === 0) {
    lines.push('');
    lines.push(pc.yellow('No matching logical path found in the repository.'));
    ctx.logger.log(lines.join('\n'));
    return;
  }

  lines.push('');
  lines.push('Repository files:');
  for (const entry of matchedFiles) {
    const status = entry.readable ? pc.green('readable') : pc.red('unreadable');
    lines.push(`  ${pc.cyan(entry.file.path)} ${pc.dim(`(${status}; ${formatReaders(entry.file)})`)}`);
    for (const logicalPath of entry.matches) {
      lines.push(`    ${logicalPath}`);
    }
  }

  lines.push('');
  lines.push('Targets:');
  const targetNames = Object.keys(repository.manifest.targets ?? {}).sort();

  for (const targetName of targetNames) {
    try {
      const resolution = resolveV3Target(ctx, {
        store: options.store,
        repository,
        targetName,
        command: { name: 'trace', args: [options.key] },
      });
      const matchedNodes = [
        ...Object.entries(resolution.values),
        ...Object.entries(resolution.artifacts),
      ].filter(([logicalPath]) => allMatchedLogicalPaths.includes(logicalPath));

      if (matchedNodes.length === 0) {
        lines.push(`  ${pc.cyan(targetName)} ${pc.dim('(not selected by target bundle)')}`);
        continue;
      }

      lines.push(`  ${pc.cyan(targetName)} ${pc.green('(resolved)')}`);
      for (const [logicalPath, node] of matchedNodes.sort(([left], [right]) => left.localeCompare(right))) {
        lines.push(...formatNodeSummary(logicalPath, node));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('requires unreadable file')) {
        lines.push(`  ${pc.cyan(targetName)} ${pc.red(`(${message})`)}`);
        continue;
      }

      lines.push(`  ${pc.cyan(targetName)} ${pc.red('(acl denied)')}`);
      for (const filePath of extractUnreadableFilePaths(message)) {
        const file = repository.filesByPath[filePath];
        lines.push(`    ${pc.yellow(filePath)}${file ? ` ${pc.dim(`(${formatReaders(file)})`)}` : ''}`);
      }
    }
  }

  ctx.logger.log(lines.join('\n'));
}
