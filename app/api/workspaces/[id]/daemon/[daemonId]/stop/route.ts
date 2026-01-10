import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo } from '@/lib/db/repositories';

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || 'http://localhost:4050';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; daemonId: string }> }
) {
  try {
    const { id, daemonId } = await params;
    const body = await request.json();
    const { anonUserId } = body as { anonUserId: string };

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

    // Stop daemon via runner
    const runnerResponse = await fetch(
      `${RUNNER_BASE_URL}/runner/workspaces/${id}/daemon/${daemonId}/stop`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!runnerResponse.ok) {
      const errorData = await runnerResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to stop daemon' },
        { status: runnerResponse.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Stop daemon error:', error);
    return NextResponse.json(
      { error: 'Failed to stop daemon' },
      { status: 500 }
    );
  }
}
