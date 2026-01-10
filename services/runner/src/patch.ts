import * as Diff from 'diff';
import { promises as fs } from 'fs';
import path from 'path';

interface PatchResult {
  success: boolean;
  filesChanged: string[];
  errors: string[];
}

interface ParsedPatch {
  oldFileName: string;
  newFileName: string;
  hunks: Diff.Hunk[];
}

export async function applyPatch(workspacePath: string, patchContent: string): Promise<PatchResult> {
  const result: PatchResult = {
    success: true,
    filesChanged: [],
    errors: [],
  };

  // Parse the unified diff
  const patches = Diff.parsePatch(patchContent);

  for (const patch of patches) {
    const oldFile = patch.oldFileName?.replace(/^a\//, '') || '';
    const newFile = patch.newFileName?.replace(/^b\//, '') || '';
    
    // Determine the target file
    let targetFile = newFile || oldFile;
    
    // Handle /dev/null for new files
    if (oldFile === '/dev/null' || oldFile === 'dev/null') {
      targetFile = newFile;
    }

    if (!targetFile || targetFile === '/dev/null' || targetFile === 'dev/null') {
      result.errors.push(`Could not determine target file from patch`);
      result.success = false;
      continue;
    }

    // Security: validate path
    const normalizedPath = path.normalize(targetFile);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      result.errors.push(`Invalid path: ${targetFile}`);
      result.success = false;
      continue;
    }

    const fullPath = path.join(workspacePath, normalizedPath);

    // Ensure the path is still within workspace
    if (!fullPath.startsWith(workspacePath)) {
      result.errors.push(`Path traversal detected: ${targetFile}`);
      result.success = false;
      continue;
    }

    try {
      // Check if this is a new file
      const isNewFile = oldFile === '/dev/null' || oldFile === 'dev/null';
      
      let originalContent = '';
      if (!isNewFile) {
        try {
          originalContent = await fs.readFile(fullPath, 'utf-8');
        } catch (err: any) {
          if (err.code === 'ENOENT') {
            // File doesn't exist, treat as new file
          } else {
            throw err;
          }
        }
      }

      // Apply the patch
      const patchedContent = Diff.applyPatch(originalContent, patch);

      if (patchedContent === false) {
        result.errors.push(`Failed to apply patch to ${targetFile}`);
        result.success = false;
        continue;
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Check if this is a file deletion
      if (newFile === '/dev/null' || newFile === 'dev/null') {
        await fs.unlink(fullPath);
        result.filesChanged.push(`${targetFile} (deleted)`);
      } else {
        // Write the patched content
        await fs.writeFile(fullPath, patchedContent, 'utf-8');
        result.filesChanged.push(targetFile);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Error processing ${targetFile}: ${message}`);
      result.success = false;
    }
  }

  return result;
}

// Alternative: apply patch by reconstructing file content from hunks
export async function applyPatchDirect(workspacePath: string, patchContent: string): Promise<PatchResult> {
  const result: PatchResult = {
    success: true,
    filesChanged: [],
    errors: [],
  };

  // Split into individual file patches
  const filePatchRegex = /^diff --git a\/.+ b\/.+$|^--- .+$[\s\S]*?(?=^diff --git|^--- |\Z)/gm;
  const patches = patchContent.split(/(?=^---\s)/m).filter(p => p.trim());

  for (const patchSection of patches) {
    // Extract file names
    const oldMatch = patchSection.match(/^---\s+(?:a\/)?(.+)$/m);
    const newMatch = patchSection.match(/^\+\+\+\s+(?:b\/)?(.+)$/m);

    if (!oldMatch || !newMatch) continue;

    const oldFile = oldMatch[1].trim();
    const newFile = newMatch[1].trim();

    // Determine target
    let targetFile = newFile;
    if (oldFile === '/dev/null') {
      targetFile = newFile;
    } else if (newFile === '/dev/null') {
      targetFile = oldFile;
    }

    if (!targetFile || targetFile === '/dev/null') continue;

    // Security check
    const normalizedPath = path.normalize(targetFile);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      result.errors.push(`Invalid path: ${targetFile}`);
      result.success = false;
      continue;
    }

    const fullPath = path.join(workspacePath, normalizedPath);
    if (!fullPath.startsWith(workspacePath)) {
      result.errors.push(`Path traversal detected: ${targetFile}`);
      result.success = false;
      continue;
    }

    try {
      const parsed = Diff.parsePatch(patchSection)[0];
      if (!parsed) {
        result.errors.push(`Could not parse patch for ${targetFile}`);
        result.success = false;
        continue;
      }

      let originalContent = '';
      if (oldFile !== '/dev/null') {
        try {
          originalContent = await fs.readFile(fullPath, 'utf-8');
        } catch (err: any) {
          if (err.code !== 'ENOENT') throw err;
        }
      }

      const patchedContent = Diff.applyPatch(originalContent, parsed);
      if (patchedContent === false) {
        result.errors.push(`Failed to apply patch to ${targetFile}`);
        result.success = false;
        continue;
      }

      if (newFile === '/dev/null') {
        await fs.unlink(fullPath);
        result.filesChanged.push(`${targetFile} (deleted)`);
      } else {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, patchedContent, 'utf-8');
        result.filesChanged.push(targetFile);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Error processing ${targetFile}: ${message}`);
      result.success = false;
    }
  }

  return result;
}
