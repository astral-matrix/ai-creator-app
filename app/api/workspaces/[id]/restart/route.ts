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
    const { anonUserId } = body;

    if (!anonUserId) {
      return NextResponse.json(
        { error: 'Missing anonUserId' },
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

    // Restart container via runner (stop then start)
    try {
      await fetch(`${RUNNER_BASE_URL}/runner/workspaces/${id}/stop`, {
        method: 'POST',
      });
    } catch (error) {
      // Ignore stop errors
    }

    const runnerResponse = await fetch(
      `${RUNNER_BASE_URL}/runner/workspaces/${id}/start`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostPath: workspace.hostPath }),
      }
    );

    if (!runnerResponse.ok) {
      const errorText = await runnerResponse.text();
      await workspaceRepo.updateStatus(id, 'error');
      return NextResponse.json(
        { error: `Failed to restart workspace: ${errorText}` },
        { status: 500 }
      );
    }

    const result = await runnerResponse.json();

    // Update workspace status
    await workspaceRepo.updateStatus(
      id,
      'running',
      result.containerId,
      result.exposedPort
    );

    return NextResponse.json({
      success: true,
      containerId: result.containerId,
      exposedPort: result.exposedPort,
      previewUrl: `/preview/${id}/`,
    });
  } catch (error) {
    console.error('Restart workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to restart workspace' },
      { status: 500 }
    );
  }
}
