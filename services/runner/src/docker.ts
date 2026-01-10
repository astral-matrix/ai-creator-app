import Docker from 'dockerode';
import { Writable } from 'stream';

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

// Track running containers
const containers = new Map<string, Docker.Container>();
const containerPorts = new Map<string, number>();

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
  // Check if already running
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

  const exposedPort = allocatePort();

  // Create container
  const container = await docker.createContainer({
    Image: SANDBOX_IMAGE,
    name: `workspace-${workspaceId}`,
    Hostname: 'sandbox',
    User: 'sandbox',
    WorkingDir: '/workspace',
    Env: [
      'NODE_ENV=development',
      'HOME=/home/sandbox',
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
    User: 'sandbox',
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
    User: 'sandbox',
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

export { docker };
