import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo, processRepo, messageRepo } from '@/lib/db/repositories';

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || 'http://localhost:4050';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { anonUserId, command, workingDir, conversationId } = body as {
      anonUserId: string;
      command: string;
      workingDir?: string;
      conversationId?: string;
    };

    if (!anonUserId || !command) {
      return NextResponse.json(
        { error: 'Missing anonUserId or command' },
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

    if (workspace.status !== 'running') {
      return NextResponse.json(
        { error: 'Workspace is not running' },
        { status: 400 }
      );
    }

    // Create process record
    const process = await processRepo.create({
      workspaceId: params.id,
      command,
      status: 'running',
    });

    // Execute command via runner
    const runnerResponse = await fetch(
      `${RUNNER_BASE_URL}/runner/workspaces/${params.id}/exec`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, workingDir }),
      }
    );

    const result = await runnerResponse.json();

    // Update process record
    await processRepo.update(process.id, {
      status: result.exitCode === 0 ? 'exited' : 'failed',
      exitCode: result.exitCode,
      outputSnippet: (result.stdout + result.stderr).slice(-2000),
      endedAt: new Date(),
    });

    // Update workspace last command time
    await workspaceRepo.updateLastCommand(params.id);

    // Optionally add system message to conversation
    if (conversationId) {
      const outputPreview = (result.stdout + result.stderr).slice(-500);
      await messageRepo.create({
        conversationId,
        role: 'system',
        content: `Command executed: \`${command}\`\nExit code: ${result.exitCode}\n\n\`\`\`\n${outputPreview}\n\`\`\``,
        metadata: {
          type: 'command_execution',
          command,
          exitCode: result.exitCode,
          processId: process.id,
        },
      });
    }

    return NextResponse.json({
      processId: process.id,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      duration: result.duration,
    });
  } catch (error) {
    console.error('Exec error:', error);
    return NextResponse.json(
      { error: 'Failed to execute command' },
      { status: 500 }
    );
  }
}
