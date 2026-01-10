import { NextResponse } from 'next/server';
import { MODELS, MODE_DEFAULTS } from '@/lib/types';

export async function GET() {
  return NextResponse.json({
    models: MODELS,
    defaults: MODE_DEFAULTS,
  });
}
