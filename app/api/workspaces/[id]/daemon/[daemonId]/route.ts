import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo } from '@/lib/db/repositories';

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || 'http://localhost:4050';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; daemonId: string }> }
) {
  try {
    const { id, daemonId } = await params;
    const { searchParams } = new URL(request.url);
    const anonUserId = searchParams.get('anonUserId');

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

    // Get daemon status via runner
    const runnerResponse = await fetch(
      `${RUNNER_BASE_URL}/runner/workspaces/${id}/daemon/${daemonId}`
    );

    if (!runnerResponse.ok) {
      const errorData = await runnerResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to get daemon status' },
        { status: runnerResponse.status }
      );
    }

    const result = await runnerResponse.json();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get daemon status error:', error);
    return NextResponse.json(
      { error: 'Failed to get daemon status' },
      { status: 500 }
    );
  }
}
