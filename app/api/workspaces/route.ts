import { NextRequest, NextResponse } from 'next/server';
import { userRepo, workspaceRepo, conversationRepo } from '@/lib/db/repositories';
import { v4 as uuidv4 } from 'uuid';

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || 'http://localhost:4050';
const WORKSPACE_HOST_PATH = process.env.WORKSPACE_HOST_PATH || '/tmp/ai-creator-workspaces';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { anonUserId, conversationId, name } = body as {
      anonUserId: string;
      conversationId?: string;
      name?: string;
    };

    if (!anonUserId) {
      return NextResponse.json(
        { error: 'Missing anonUserId' },
        { status: 400 }
      );
    }

    // Verify user
    const user = await userRepo.findOrCreate(anonUserId);

    // Generate unique host path for this workspace
    const workspaceId = uuidv4();
    const hostPath = `${WORKSPACE_HOST_PATH}/${workspaceId}`;

    // Create workspace in database
    const workspace = await workspaceRepo.create({
      userId: user.id,
      name: name || `Workspace ${new Date().toLocaleDateString()}`,
      hostPath,
    });

    // Create workspace in runner service
    try {
      const runnerResponse = await fetch(`${RUNNER_BASE_URL}/runner/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          hostPath,
        }),
      });

      if (!runnerResponse.ok) {
        console.error('Runner service error:', await runnerResponse.text());
        // Continue anyway - workspace is created, runner will sync later
      }
    } catch (error) {
      console.error('Failed to contact runner service:', error);
      // Continue anyway - runner might not be running in dev
    }

    // Link to conversation if provided
    if (conversationId) {
      await conversationRepo.linkWorkspace(conversationId, workspace.id);
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
    console.error('Create workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const anonUserId = searchParams.get('anonUserId');

    if (!anonUserId) {
      return NextResponse.json(
        { error: 'Missing anonUserId' },
        { status: 400 }
      );
    }

    const workspaces = await workspaceRepo.findByUser(anonUserId);

    return NextResponse.json({
      workspaces: workspaces.map((w) => ({
        id: w.id,
        userId: w.userId,
        name: w.name,
        status: w.status,
        containerId: w.containerId,
        hostPath: w.hostPath,
        exposedPort: w.exposedPort,
        previewUrlPath: w.previewUrlPath,
        lastCommandAt: w.lastCommandAt?.toISOString() || null,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('List workspaces error:', error);
    return NextResponse.json(
      { error: 'Failed to list workspaces' },
      { status: 500 }
    );
  }
}
