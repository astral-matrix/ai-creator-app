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

    // Stop container via runner
    try {
      const runnerResponse = await fetch(
        `${RUNNER_BASE_URL}/runner/workspaces/${id}/stop`,
        { method: 'POST' }
      );

      if (!runnerResponse.ok) {
        console.error('Runner stop error:', await runnerResponse.text());
      }
    } catch (error) {
      console.error('Failed to contact runner:', error);
    }

    // Update workspace status
    await workspaceRepo.updateStatus(id, 'stopped', null, null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Stop workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to stop workspace' },
      { status: 500 }
    );
  }
}
