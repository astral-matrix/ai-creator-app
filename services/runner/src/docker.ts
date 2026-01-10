import Docker from 'dockerode';
import { Writable } from 'stream';
import { EventEmitter } from 'events';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE || 'ai-creator-sandbox:latest';
const WORKSPACE_BASE_PATH = process.env.WORKSPACE_BASE_PATH || '/workspaces';

// Resource limits
const MEMORY_LIMIT = 512 * 1024 * 1024; // 512MB
const CPU_PERIOD = 100000;
const CPU_QUOTA = 50000; // 50% of one CPU
const PIDS_LIMIT = 100;

interface ContainerInfo {
  containerId: string;
  exposedPort: number;
}

interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

interface DaemonProcess {
  id: string;
  command: string;
  pid: number;
  startedAt: Date;
  status: 'running' | 'exited' | 'failed';
  exitCode?: number;
  logs: string[];
  emitter: EventEmitter;
}

// Track running containers
const containers = new Map<string, Docker.Container>();
const containerPorts = new Map<string, number>();

// Track daemon processes per workspace
const workspaceDaemons = new Map<string, Map<string, DaemonProcess>>();

// Port allocation
let nextPort = 10000;
function allocatePort(): number {
  return nextPort++;
}

export async function createWorkspace(workspaceId: string, hostPath: string): Promise<void> {
  // Ensure the workspace directory exists on the host
  // This would typically be handled by the host system
  console.log(`Creating workspace: ${workspaceId} at ${hostPath}`);
}

export async function startContainer(workspaceId: string, hostPath: string): Promise<ContainerInfo> {
  // Check if already running in our map
  const existing = containers.get(workspaceId);
  if (existing) {
    try {
      const info = await existing.inspect();
      if (info.State.Running) {
        const port = containerPorts.get(workspaceId) || 3000;
        return { containerId: existing.id, exposedPort: port };
      }
    } catch {
      // Container doesn't exist anymore
      containers.delete(workspaceId);
    }
  }

  // Check for orphaned container with same name (e.g., after runner restart)
  const containerName = `workspace-${workspaceId}`;
  try {
    const orphanedContainer = docker.getContainer(containerName);
    const info = await orphanedContainer.inspect();
    
    // If it's running, reuse it
    if (info.State.Running) {
      // Find the exposed port from the container's port bindings
      const portBindings = info.NetworkSettings.Ports['3000/tcp'];
      const exposedPort = portBindings && portBindings[0] 
        ? parseInt(portBindings[0].HostPort, 10) 
        : allocatePort();
      
      containers.set(workspaceId, orphanedContainer);
      containerPorts.set(workspaceId, exposedPort);
      
      console.log(`Reattached to existing container: ${containerName} on port ${exposedPort}`);
      return { containerId: orphanedContainer.id, exposedPort };
    }
    
    // If it exists but not running, remove it
    console.log(`Removing stopped orphaned container: ${containerName}`);
    await orphanedContainer.remove({ force: true });
  } catch (error: any) {
    // 404 means container doesn't exist, which is fine
    if (error.statusCode !== 404) {
      console.error(`Error checking for orphaned container: ${error.message}`);
    }
  }

  const exposedPort = allocatePort();

  // Create container
  const container = await docker.createContainer({
    Image: SANDBOX_IMAGE,
    name: `workspace-${workspaceId}`,
    Hostname: 'sandbox',
    User: 'node',
    WorkingDir: '/workspace',
    Env: [
      'NODE_ENV=development',
      'HOME=/home/node',
    ],
    ExposedPorts: {
      '3000/tcp': {},
    },
    HostConfig: {
      Binds: [`${hostPath}:/workspace:rw`],
      PortBindings: {
        '3000/tcp': [{ HostPort: exposedPort.toString() }],
      },
      Memory: MEMORY_LIMIT,
      CpuPeriod: CPU_PERIOD,
      CpuQuota: CPU_QUOTA,
      PidsLimit: PIDS_LIMIT,
      SecurityOpt: ['no-new-privileges:true'],
      CapDrop: ['ALL'],
      CapAdd: ['CHOWN', 'SETUID', 'SETGID', 'DAC_OVERRIDE'],
      ReadonlyRootfs: false,
      NetworkMode: 'bridge',
    },
    Tty: true,
    OpenStdin: true,
  });

  await container.start();

  containers.set(workspaceId, container);
  containerPorts.set(workspaceId, exposedPort);

  return {
    containerId: container.id,
    exposedPort,
  };
}

export async function stopContainer(workspaceId: string): Promise<void> {
  const container = containers.get(workspaceId);
  if (!container) return;

  try {
    await container.stop({ t: 10 });
    await container.remove({ force: true });
  } catch (error) {
    console.error(`Error stopping container ${workspaceId}:`, error);
    // Try force remove
    try {
      await container.remove({ force: true });
    } catch {
      // Ignore
    }
  }

  containers.delete(workspaceId);
  containerPorts.delete(workspaceId);
}

export async function getContainerStatus(workspaceId: string): Promise<{
  status: 'stopped' | 'running' | 'error';
  containerId: string | null;
  exposedPort: number | null;
}> {
  const container = containers.get(workspaceId);
  if (!container) {
    return { status: 'stopped', containerId: null, exposedPort: null };
  }

  try {
    const info = await container.inspect();
    if (info.State.Running) {
      return {
        status: 'running',
        containerId: container.id,
        exposedPort: containerPorts.get(workspaceId) || null,
      };
    } else if (info.State.Error) {
      return { status: 'error', containerId: container.id, exposedPort: null };
    }
  } catch {
    containers.delete(workspaceId);
    containerPorts.delete(workspaceId);
  }

  return { status: 'stopped', containerId: null, exposedPort: null };
}

export async function execCommand(
  workspaceId: string,
  command: string,
  workingDir?: string
): Promise<ExecResult> {
  const container = containers.get(workspaceId);
  if (!container) {
    throw new Error('Container not running');
  }

  const startTime = Date.now();

  const exec = await container.exec({
    Cmd: ['bash', '-c', command],
    WorkingDir: workingDir || '/workspace',
    AttachStdout: true,
    AttachStderr: true,
    User: 'node',
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  let stdout = '';
  let stderr = '';

  return new Promise((resolve, reject) => {
    // Demux stdout/stderr from Docker stream
    docker.modem.demuxStream(
      stream,
      new Writable({
        write(chunk, encoding, callback) {
          stdout += chunk.toString();
          callback();
        },
      }),
      new Writable({
        write(chunk, encoding, callback) {
          stderr += chunk.toString();
          callback();
        },
      })
    );

    stream.on('end', async () => {
      try {
        const inspection = await exec.inspect();
        const duration = Date.now() - startTime;
        resolve({
          exitCode: inspection.ExitCode ?? 1,
          stdout,
          stderr,
          duration,
        });
      } catch (error) {
        reject(error);
      }
    });

    stream.on('error', reject);

    // Timeout after 5 minutes
    setTimeout(() => {
      stream.destroy();
      reject(new Error('Command timed out'));
    }, 5 * 60 * 1000);
  });
}

export async function execCommandStreaming(
  workspaceId: string,
  command: string,
  onData: (type: 'stdout' | 'stderr', data: string) => void,
  workingDir?: string
): Promise<{ exitCode: number }> {
  const container = containers.get(workspaceId);
  if (!container) {
    throw new Error('Container not running');
  }

  const exec = await container.exec({
    Cmd: ['bash', '-c', command],
    WorkingDir: workingDir || '/workspace',
    AttachStdout: true,
    AttachStderr: true,
    User: 'node',
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  return new Promise((resolve, reject) => {
    docker.modem.demuxStream(
      stream,
      new Writable({
        write(chunk, encoding, callback) {
          onData('stdout', chunk.toString());
          callback();
        },
      }),
      new Writable({
        write(chunk, encoding, callback) {
          onData('stderr', chunk.toString());
          callback();
        },
      })
    );

    stream.on('end', async () => {
      try {
        const inspection = await exec.inspect();
        resolve({ exitCode: inspection.ExitCode ?? 1 });
      } catch (error) {
        reject(error);
      }
    });

    stream.on('error', reject);
  });
}

// ==================== DAEMON PROCESS MANAGEMENT ====================

/**
 * Start a daemon (background) process in the container.
 * The process runs detached and persists until stopped or container stops.
 */
export async function startDaemon(
  workspaceId: string,
  daemonId: string,
  command: string,
  workingDir?: string
): Promise<{ daemonId: string; pid: number }> {
  const container = containers.get(workspaceId);
  if (!container) {
    throw new Error('Container not running');
  }

  // Initialize daemon map for this workspace if needed
  if (!workspaceDaemons.has(workspaceId)) {
    workspaceDaemons.set(workspaceId, new Map());
  }
  const daemons = workspaceDaemons.get(workspaceId)!;

  // Check if daemon with this ID already exists
  if (daemons.has(daemonId)) {
    const existing = daemons.get(daemonId)!;
    if (existing.status === 'running') {
      throw new Error(`Daemon ${daemonId} is already running`);
    }
    // Remove the old daemon entry
    daemons.delete(daemonId);
  }

  // Create exec for the daemon process
  // We use nohup and redirect output to ensure it survives
  const wrappedCommand = `nohup bash -c '${command.replace(/'/g, "'\\''")}' > /tmp/daemon-${daemonId}.log 2>&1 & echo $!`;
  
  const exec = await container.exec({
    Cmd: ['bash', '-c', wrappedCommand],
    WorkingDir: workingDir || '/workspace',
    AttachStdout: true,
    AttachStderr: true,
    User: 'node',
  });

  const stream = await exec.start({ hijack: true, stdin: false });
  
  let output = '';
  
  return new Promise((resolve, reject) => {
    docker.modem.demuxStream(
      stream,
      new Writable({
        write(chunk, encoding, callback) {
          output += chunk.toString();
          callback();
        },
      }),
      new Writable({
        write(chunk, encoding, callback) {
          output += chunk.toString();
          callback();
        },
      })
    );

    stream.on('end', async () => {
      const pid = parseInt(output.trim(), 10);
      
      if (isNaN(pid)) {
        reject(new Error(`Failed to start daemon: ${output}`));
        return;
      }

      const emitter = new EventEmitter();
      const daemon: DaemonProcess = {
        id: daemonId,
        command,
        pid,
        startedAt: new Date(),
        status: 'running',
        logs: [],
        emitter,
      };

      daemons.set(daemonId, daemon);

      // Start monitoring the daemon process
      monitorDaemon(workspaceId, daemonId);

      console.log(`Started daemon ${daemonId} with PID ${pid} in workspace ${workspaceId}`);
      resolve({ daemonId, pid });
    });

    stream.on('error', reject);
  });
}

/**
 * Monitor a daemon process and update its status when it exits
 */
async function monitorDaemon(workspaceId: string, daemonId: string): Promise<void> {
  const daemons = workspaceDaemons.get(workspaceId);
  if (!daemons) return;

  const daemon = daemons.get(daemonId);
  if (!daemon) return;

  const container = containers.get(workspaceId);
  if (!container) return;

  // Poll the process status periodically
  const checkInterval = setInterval(async () => {
    try {
      // Check if process is still running
      const exec = await container.exec({
        Cmd: ['bash', '-c', `kill -0 ${daemon.pid} 2>/dev/null && echo "running" || echo "stopped"`],
        AttachStdout: true,
        AttachStderr: true,
        User: 'node',
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      let output = '';

      docker.modem.demuxStream(
        stream,
        new Writable({
          write(chunk, encoding, callback) {
            output += chunk.toString();
            callback();
          },
        }),
        new Writable({ write(chunk, encoding, callback) { callback(); } })
      );

      stream.on('end', () => {
        if (output.trim() === 'stopped') {
          daemon.status = 'exited';
          daemon.emitter.emit('exit', { daemonId, exitCode: 0 });
          clearInterval(checkInterval);
          console.log(`Daemon ${daemonId} in workspace ${workspaceId} has exited`);
        }
      });
    } catch (error) {
      // Container might have stopped
      daemon.status = 'failed';
      daemon.emitter.emit('exit', { daemonId, exitCode: -1 });
      clearInterval(checkInterval);
    }
  }, 2000); // Check every 2 seconds

  // Store the interval so we can clear it when stopping
  (daemon as any)._checkInterval = checkInterval;
}

/**
 * Stop a daemon process
 */
export async function stopDaemon(workspaceId: string, daemonId: string): Promise<void> {
  const daemons = workspaceDaemons.get(workspaceId);
  if (!daemons) {
    throw new Error('No daemons for this workspace');
  }

  const daemon = daemons.get(daemonId);
  if (!daemon) {
    throw new Error(`Daemon ${daemonId} not found`);
  }

  const container = containers.get(workspaceId);
  if (!container) {
    throw new Error('Container not running');
  }

  // Clear the monitoring interval
  if ((daemon as any)._checkInterval) {
    clearInterval((daemon as any)._checkInterval);
  }

  // Kill the process
  const exec = await container.exec({
    Cmd: ['bash', '-c', `kill ${daemon.pid} 2>/dev/null || kill -9 ${daemon.pid} 2>/dev/null || true`],
    AttachStdout: true,
    AttachStderr: true,
    User: 'node',
  });

  await exec.start({ hijack: true, stdin: false });

  daemon.status = 'exited';
  daemon.emitter.emit('exit', { daemonId, exitCode: 0 });
  
  console.log(`Stopped daemon ${daemonId} in workspace ${workspaceId}`);
}

/**
 * Get daemon logs
 */
export async function getDaemonLogs(
  workspaceId: string,
  daemonId: string,
  tail?: number
): Promise<string> {
  const container = containers.get(workspaceId);
  if (!container) {
    throw new Error('Container not running');
  }

  const tailArg = tail ? `-n ${tail}` : '';
  const exec = await container.exec({
    Cmd: ['bash', '-c', `cat /tmp/daemon-${daemonId}.log 2>/dev/null ${tailArg ? `| tail ${tailArg}` : ''} || echo "No logs available"`],
    AttachStdout: true,
    AttachStderr: true,
    User: 'node',
  });

  const stream = await exec.start({ hijack: true, stdin: false });
  let output = '';

  return new Promise((resolve, reject) => {
    docker.modem.demuxStream(
      stream,
      new Writable({
        write(chunk, encoding, callback) {
          output += chunk.toString();
          callback();
        },
      }),
      new Writable({
        write(chunk, encoding, callback) {
          output += chunk.toString();
          callback();
        },
      })
    );

    stream.on('end', () => resolve(output));
    stream.on('error', reject);
  });
}

/**
 * List all daemons for a workspace
 */
export function listDaemons(workspaceId: string): Array<{
  id: string;
  command: string;
  pid: number;
  status: string;
  startedAt: Date;
}> {
  const daemons = workspaceDaemons.get(workspaceId);
  if (!daemons) return [];

  return Array.from(daemons.values()).map(d => ({
    id: d.id,
    command: d.command,
    pid: d.pid,
    status: d.status,
    startedAt: d.startedAt,
  }));
}

/**
 * Get a specific daemon's status
 */
export function getDaemonStatus(workspaceId: string, daemonId: string): {
  id: string;
  command: string;
  pid: number;
  status: string;
  startedAt: Date;
} | null {
  const daemons = workspaceDaemons.get(workspaceId);
  if (!daemons) return null;

  const daemon = daemons.get(daemonId);
  if (!daemon) return null;

  return {
    id: daemon.id,
    command: daemon.command,
    pid: daemon.pid,
    status: daemon.status,
    startedAt: daemon.startedAt,
  };
}

export { docker };
