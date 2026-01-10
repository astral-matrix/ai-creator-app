import { NextRequest, NextResponse } from 'next/server';

// Redirect /preview/* to /api/preview/* for backwards compatibility
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; path?: string[] }> }
) {
  const { workspaceId, path } = await params;
  const pathStr = path?.join('/') || '';
  const newUrl = new URL(`/api/preview/${workspaceId}/${pathStr}`, request.url);
  
  // Preserve query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    newUrl.searchParams.set(key, value);
  });
  
  return NextResponse.redirect(newUrl);
}

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
