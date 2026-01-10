import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo } from '@/lib/db/repositories';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; path?: string[] }> }
) {
  try {
    const { workspaceId, path } = await params;
    const workspace = await workspaceRepo.findById(workspaceId);

    if (!workspace) {
      return new NextResponse('Workspace not found', { status: 404 });
    }

    if (workspace.status !== 'running' || !workspace.exposedPort) {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Preview Not Available</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #1a1a2e;
                color: #eee;
              }
              .container {
                text-align: center;
                padding: 2rem;
              }
              h1 { color: #00d9ff; }
              p { color: #888; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Preview Not Available</h1>
              <p>The workspace is not running. Start the preview server to view your app.</p>
            </div>
          </body>
        </html>
        `,
        {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Construct the path
    const pathStr = path?.join('/') || '';
    const targetUrl = `http://127.0.0.1:${workspace.exposedPort}/${pathStr}`;
    
    console.log(`Preview proxy: ${request.url} -> ${targetUrl}`);

    // Forward the request
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      if (!['host', 'connection'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    try {
      const proxyResponse = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' 
          ? await request.text() 
          : undefined,
      });

      // Create response with proxied content
      const responseHeaders = new Headers();
      proxyResponse.headers.forEach((value, key) => {
        // Skip hop-by-hop headers
        if (!['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
          responseHeaders.set(key, value);
        }
      });

      // Add CORS headers for preview
      responseHeaders.set('X-Frame-Options', 'SAMEORIGIN');

      return new NextResponse(proxyResponse.body, {
        status: proxyResponse.status,
        statusText: proxyResponse.statusText,
        headers: responseHeaders,
      });
    } catch (proxyError) {
      console.error('Proxy error:', proxyError);
      const errorMessage = proxyError instanceof Error ? proxyError.message : 'Unknown error';
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Connection Error</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #1a1a2e;
                color: #eee;
              }
              .container {
                text-align: center;
                padding: 2rem;
                max-width: 600px;
              }
              h1 { color: #ff6b6b; }
              p { color: #888; }
              code { background: #2a2a3e; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.9em; }
              .debug { 
                margin-top: 1.5rem; 
                padding: 1rem; 
                background: #2a2a3e; 
                border-radius: 8px; 
                text-align: left;
                font-size: 0.85em;
              }
              .debug-title { color: #00d9ff; margin-bottom: 0.5rem; }
              .debug-item { margin: 0.25rem 0; color: #aaa; }
              .debug-value { color: #fff; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Connection Error</h1>
              <p>Could not connect to the preview server.</p>
              <p>Make sure your app is running on port <code>3000</code> inside the container.</p>
              
              <div class="debug">
                <div class="debug-title">Debug Info</div>
                <div class="debug-item">Target URL: <span class="debug-value">${targetUrl}</span></div>
                <div class="debug-item">Workspace ID: <span class="debug-value">${workspaceId}</span></div>
                <div class="debug-item">Exposed Port: <span class="debug-value">${workspace.exposedPort}</span></div>
                <div class="debug-item">Error: <span class="debug-value">${errorMessage}</span></div>
              </div>
              
              <p style="margin-top: 1.5rem; font-size: 0.9em;">
                Tip: Start your server with a daemon process so it runs in the background.
              </p>
            </div>
          </body>
        </html>
        `,
        {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }
  } catch (error) {
    console.error('Preview proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handle other HTTP methods
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; path?: string[] }> }
) {
  return GET(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; path?: string[] }> }
) {
  return GET(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; path?: string[] }> }
) {
  return GET(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; path?: string[] }> }
) {
  return GET(request, context);
}
