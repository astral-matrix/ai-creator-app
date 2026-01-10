import { Router, Request, Response } from 'express';
import {
  createWorkspace,
  startContainer,
  stopContainer,
  getContainerStatus,
  execCommand,
  startDaemon,
  stopDaemon,
  getDaemonLogs,
  listDaemons,
  getDaemonStatus,
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
    const { patch, hostPath } = req.body;

    if (!patch) {
      return res.status(400).json({ error: 'Missing patch' });
    }

    // Use provided hostPath or fall back to default
    const workspacePath = hostPath || `${WORKSPACE_BASE_PATH}/${req.params.id}`;

    console.log(`Applying patch to workspace: ${workspacePath}`);
    
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
    const hostPath = req.query.hostPath as string;
    const workspacePath = hostPath || `${WORKSPACE_BASE_PATH}/${req.params.id}`;

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
    const hostPath = req.query.hostPath as string;

    if (!relativePath) {
      return res.status(400).json({ error: 'Missing path' });
    }

    const workspacePath = hostPath || `${WORKSPACE_BASE_PATH}/${req.params.id}`;
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
    const { path: relativePath, content, hostPath } = req.body;

    if (!relativePath || content === undefined) {
      return res.status(400).json({ error: 'Missing path or content' });
    }

    const workspacePath = hostPath || `${WORKSPACE_BASE_PATH}/${req.params.id}`;
    await writeFile(workspacePath, relativePath, content);
    res.json({ success: true });
  } catch (error) {
    console.error('Write file error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ==================== DAEMON ROUTES ====================

// Start a daemon process
router.post('/:id/daemon/start', async (req: Request, res: Response) => {
  try {
    const { daemonId, command, workingDir } = req.body;
    const workspaceId = req.params.id;

    if (!daemonId || !command) {
      return res.status(400).json({ error: 'Missing daemonId or command' });
    }

    const result = await startDaemon(workspaceId, daemonId, command, workingDir);
    res.json(result);
  } catch (error) {
    console.error('Start daemon error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Stop a daemon process
router.post('/:id/daemon/:daemonId/stop', async (req: Request, res: Response) => {
  try {
    const { id: workspaceId, daemonId } = req.params;

    await stopDaemon(workspaceId, daemonId);
    res.json({ success: true });
  } catch (error) {
    console.error('Stop daemon error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Get daemon logs
router.get('/:id/daemon/:daemonId/logs', async (req: Request, res: Response) => {
  try {
    const { id: workspaceId, daemonId } = req.params;
    const tail = req.query.tail ? parseInt(req.query.tail as string, 10) : undefined;

    const logs = await getDaemonLogs(workspaceId, daemonId, tail);
    res.json({ logs });
  } catch (error) {
    console.error('Get daemon logs error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Get daemon status
router.get('/:id/daemon/:daemonId', async (req: Request, res: Response) => {
  try {
    const { id: workspaceId, daemonId } = req.params;

    const status = getDaemonStatus(workspaceId, daemonId);
    if (!status) {
      return res.status(404).json({ error: 'Daemon not found' });
    }
    res.json(status);
  } catch (error) {
    console.error('Get daemon status error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// List all daemons for a workspace
router.get('/:id/daemons', async (req: Request, res: Response) => {
  try {
    const daemons = listDaemons(req.params.id);
    res.json({ daemons });
  } catch (error) {
    console.error('List daemons error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export { router as workspaceRouter };
