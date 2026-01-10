import { Router, Request, Response } from 'express';
import {
  createWorkspace,
  startContainer,
  stopContainer,
  getContainerStatus,
  execCommand,
} from '../docker.js';
import { applyPatch } from '../patch.js';
import { listFiles, readFile, writeFile, ensureWorkspaceDir } from '../files.js';

const router = Router();

const WORKSPACE_BASE_PATH = process.env.WORKSPACE_BASE_PATH || '/workspaces';

// Create workspace
router.post('/', async (req: Request, res: Response) => {
  try {
    const { workspaceId, hostPath } = req.body;

    if (!workspaceId || !hostPath) {
      return res.status(400).json({ error: 'Missing workspaceId or hostPath' });
    }

    // Ensure workspace directory exists
    await ensureWorkspaceDir(hostPath);
    await createWorkspace(workspaceId, hostPath);

    res.json({ success: true, workspaceId });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// Get workspace status
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const status = await getContainerStatus(req.params.id);
    res.json(status);
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Start workspace container
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const { hostPath } = req.body;
    const workspaceId = req.params.id;

    if (!hostPath) {
      return res.status(400).json({ error: 'Missing hostPath' });
    }

    const result = await startContainer(workspaceId, hostPath);
    res.json(result);
  } catch (error) {
    console.error('Start container error:', error);
    res.status(500).json({ error: 'Failed to start container' });
  }
});

// Stop workspace container
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    await stopContainer(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Stop container error:', error);
    res.status(500).json({ error: 'Failed to stop container' });
  }
});

// Execute command
router.post('/:id/exec', async (req: Request, res: Response) => {
  try {
    const { command, workingDir } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Missing command' });
    }

    const result = await execCommand(req.params.id, command, workingDir);
    res.json(result);
  } catch (error) {
    console.error('Exec error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Apply patch
router.post('/:id/applyPatch', async (req: Request, res: Response) => {
  try {
    const { patch } = req.body;

    if (!patch) {
      return res.status(400).json({ error: 'Missing patch' });
    }

    // Get workspace path
    const workspacePath = `${WORKSPACE_BASE_PATH}/${req.params.id}`;

    const result = await applyPatch(workspacePath, patch);
    res.json(result);
  } catch (error) {
    console.error('Apply patch error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// List files
router.get('/:id/files', async (req: Request, res: Response) => {
  try {
    const relativePath = (req.query.path as string) || '/';
    const workspacePath = `${WORKSPACE_BASE_PATH}/${req.params.id}`;

    const result = await listFiles(workspacePath, relativePath);
    res.json(result);
  } catch (error) {
    console.error('List files error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Read file
router.get('/:id/files/read', async (req: Request, res: Response) => {
  try {
    const relativePath = req.query.path as string;

    if (!relativePath) {
      return res.status(400).json({ error: 'Missing path' });
    }

    const workspacePath = `${WORKSPACE_BASE_PATH}/${req.params.id}`;
    const result = await readFile(workspacePath, relativePath);
    res.json(result);
  } catch (error) {
    console.error('Read file error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Write file
router.put('/:id/files', async (req: Request, res: Response) => {
  try {
    const { path: relativePath, content } = req.body;

    if (!relativePath || content === undefined) {
      return res.status(400).json({ error: 'Missing path or content' });
    }

    const workspacePath = `${WORKSPACE_BASE_PATH}/${req.params.id}`;
    await writeFile(workspacePath, relativePath, content);
    res.json({ success: true });
  } catch (error) {
    console.error('Write file error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export { router as workspaceRouter };
