import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo } from '@/lib/db/repositories';

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || 'http://localhost:4050';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const anonUserId = searchParams.get('anonUserId');

    if (!anonUserId) {
      return NextResponse.json(
        { error: 'Missing anonUserId' },
        { status: 400 }
      );
    }

    const workspace = await workspaceRepo.findById(params.id);

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

    // Try to get live status from runner
    try {
      const runnerResponse = await fetch(
        `${RUNNER_BASE_URL}/runner/workspaces/${params.id}/status`,
        { method: 'GET' }
      );

      if (runnerResponse.ok) {
        const runnerStatus = await runnerResponse.json();
        // Update local status if different
        if (runnerStatus.status !== workspace.status) {
          await workspaceRepo.updateStatus(
            params.id,
            runnerStatus.status,
            runnerStatus.containerId,
            runnerStatus.exposedPort
          );
        }
        return NextResponse.json({
          ...workspace,
          status: runnerStatus.status,
          containerId: runnerStatus.containerId,
          exposedPort: runnerStatus.exposedPort,
          lastCommandAt: workspace.lastCommandAt?.toISOString() || null,
          createdAt: workspace.createdAt.toISOString(),
          updatedAt: workspace.updatedAt.toISOString(),
        });
      }
    } catch (error) {
      // Runner not available, return cached status
    }

    return NextResponse.json({
      id: workspace.id,
      userId: workspace.userId,
      name: workspace.name,
      status: workspace.status,
      containerId: workspace.containerId,
      hostPath: workspace.hostPath,
      exposedPort: workspace.exposedPort,
      previewUrlPath: workspace.previewUrlPath,
      lastCommandAt: workspace.lastCommandAt?.toISOString() || null,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Get workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to get workspace' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { anonUserId } = body;

    if (!anonUserId) {
      return NextResponse.json(
        { error: 'Missing anonUserId' },
        { status: 400 }
      );
    }

    const workspace = await workspaceRepo.findById(params.id);

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

    // Stop container in runner
    try {
      await fetch(`${RUNNER_BASE_URL}/runner/workspaces/${params.id}/stop`, {
        method: 'POST',
      });
    } catch (error) {
      // Ignore runner errors
    }

    // Delete from database
    await workspaceRepo.delete(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to delete workspace' },
      { status: 500 }
    );
  }
}
