import { promises as fs } from 'fs';
import path from 'path';

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

interface ListResult {
  path: string;
  entries: FileEntry[];
}

interface ReadResult {
  path: string;
  content: string;
  size: number;
}

export async function listFiles(workspacePath: string, relativePath: string): Promise<ListResult> {
  // Security: validate path
  const normalizedPath = path.normalize(relativePath);
  if (normalizedPath.startsWith('..')) {
    throw new Error('Invalid path');
  }

  const fullPath = path.join(workspacePath, normalizedPath);
  if (!fullPath.startsWith(workspacePath)) {
    throw new Error('Path traversal detected');
  }

  const entries: FileEntry[] = [];
  const dirents = await fs.readdir(fullPath, { withFileTypes: true });

  for (const dirent of dirents) {
    // Skip hidden files and common ignore patterns
    if (dirent.name.startsWith('.') || dirent.name === 'node_modules') {
      continue;
    }

    const entryPath = path.join(fullPath, dirent.name);
    const stats = await fs.stat(entryPath);

    entries.push({
      name: dirent.name,
      type: dirent.isDirectory() ? 'directory' : 'file',
      size: dirent.isFile() ? stats.size : undefined,
      modifiedAt: stats.mtime.toISOString(),
    });
  }

  // Sort: directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return {
    path: normalizedPath,
    entries,
  };
}

export async function readFile(workspacePath: string, relativePath: string): Promise<ReadResult> {
  // Security: validate path
  const normalizedPath = path.normalize(relativePath);
  if (normalizedPath.startsWith('..')) {
    throw new Error('Invalid path');
  }

  const fullPath = path.join(workspacePath, normalizedPath);
  if (!fullPath.startsWith(workspacePath)) {
    throw new Error('Path traversal detected');
  }

  const stats = await fs.stat(fullPath);
  
  // Limit file size to 1MB
  if (stats.size > 1024 * 1024) {
    throw new Error('File too large');
  }

  const content = await fs.readFile(fullPath, 'utf-8');

  return {
    path: normalizedPath,
    content,
    size: stats.size,
  };
}

export async function writeFile(workspacePath: string, relativePath: string, content: string): Promise<void> {
  // Security: validate path
  const normalizedPath = path.normalize(relativePath);
  if (normalizedPath.startsWith('..')) {
    throw new Error('Invalid path');
  }

  const fullPath = path.join(workspacePath, normalizedPath);
  if (!fullPath.startsWith(workspacePath)) {
    throw new Error('Path traversal detected');
  }

  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  await fs.writeFile(fullPath, content, 'utf-8');
}

export async function deleteFile(workspacePath: string, relativePath: string): Promise<void> {
  // Security: validate path
  const normalizedPath = path.normalize(relativePath);
  if (normalizedPath.startsWith('..')) {
    throw new Error('Invalid path');
  }

  const fullPath = path.join(workspacePath, normalizedPath);
  if (!fullPath.startsWith(workspacePath)) {
    throw new Error('Path traversal detected');
  }

  await fs.unlink(fullPath);
}

export async function ensureWorkspaceDir(workspacePath: string): Promise<void> {
  await fs.mkdir(workspacePath, { recursive: true });
}
