import { Router, Application } from 'express';
import { execCommandStreaming, getContainerStatus } from '../docker.js';

export function createStreamRouter(app: Application) {
  const router = Router();

  // WebSocket endpoint for streaming command output
  // @ts-ignore - express-ws adds ws method
  app.ws('/runner/workspaces/:id/stream', (ws: any, req: any) => {
    const workspaceId = req.params.id;
    let isAlive = true;

    ws.on('pong', () => {
      isAlive = true;
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    ws.on('close', () => {
      clearInterval(heartbeat);
    });

    ws.on('message', async (data: any) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'exec') {
          const { command, workingDir } = message;

          // Check container is running
          const status = await getContainerStatus(workspaceId);
          if (status.status !== 'running') {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Container is not running',
            }));
            return;
          }

          // Start streaming execution
          ws.send(JSON.stringify({ type: 'start', command }));

          try {
            const result = await execCommandStreaming(
              workspaceId,
              command,
              (type, data) => {
                ws.send(JSON.stringify({ type, data }));
              },
              workingDir
            );

            ws.send(JSON.stringify({
              type: 'exit',
              exitCode: result.exitCode,
            }));
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            ws.send(JSON.stringify({
              type: 'error',
              message: errorMessage,
            }));
          }
        } else if (message.type === 'status') {
          const status = await getContainerStatus(workspaceId);
          ws.send(JSON.stringify({ type: 'status', ...status }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });
  });

  return router;
}
