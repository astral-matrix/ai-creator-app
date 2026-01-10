import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo } from '@/lib/db/repositories';

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || 'http://localhost:4050';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { anonUserId, daemonId, command, workingDir } = body as {
      anonUserId: string;
      daemonId: string;
      command: string;
      workingDir?: string;
    };

    if (!anonUserId || !daemonId || !command) {
      return NextResponse.json(
        { error: 'Missing anonUserId, daemonId, or command' },
        { status: 400 }
      );
    }

    const workspace = await workspaceRepo.findById(id);

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    if (workspace.userId !== anonUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (workspace.status !== 'running') {
      return NextResponse.json(
        { error: 'Workspace is not running' },
        { status: 400 }
      );
    }

    // Start daemon via runner
    const runnerResponse = await fetch(
      `${RUNNER_BASE_URL}/runner/workspaces/${id}/daemon/start`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daemonId, command, workingDir }),
      }
    );

    if (!runnerResponse.ok) {
      const errorData = await runnerResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to start daemon' },
        { status: runnerResponse.status }
      );
    }

    const result = await runnerResponse.json();

    return NextResponse.json({
      success: true,
      daemonId: result.daemonId,
      pid: result.pid,
    });
  } catch (error) {
    console.error('Start daemon error:', error);
    return NextResponse.json(
      { error: 'Failed to start daemon' },
      { status: 500 }
    );
  }
}
