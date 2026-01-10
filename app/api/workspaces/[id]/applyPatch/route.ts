import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo, messageRepo } from '@/lib/db/repositories';

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || 'http://localhost:4050';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { anonUserId, patch, conversationId } = body as {
      anonUserId: string;
      patch: string;
      conversationId?: string;
    };

    if (!anonUserId || !patch) {
      return NextResponse.json(
        { error: 'Missing anonUserId or patch' },
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

    // Apply patch via runner - pass the actual hostPath
    const runnerResponse = await fetch(
      `${RUNNER_BASE_URL}/runner/workspaces/${id}/applyPatch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch, hostPath: workspace.hostPath }),
      }
    );

    if (!runnerResponse.ok) {
      const errorText = await runnerResponse.text();
      return NextResponse.json(
        { error: `Failed to apply patch: ${errorText}` },
        { status: 500 }
      );
    }

    const result = await runnerResponse.json();

    // Add system message to conversation if provided
    if (conversationId && result.success) {
      const fileList = result.filesChanged.join(', ');
      await messageRepo.create({
        conversationId,
        role: 'system',
        content: `Patch applied successfully.\nFiles changed: ${fileList}`,
        metadata: {
          type: 'patch_applied',
          filesChanged: result.filesChanged,
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Apply patch error:', error);
    return NextResponse.json(
      { error: 'Failed to apply patch' },
      { status: 500 }
    );
  }
}
