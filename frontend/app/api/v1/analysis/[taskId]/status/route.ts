/**
 * Proxy for analysis status polling endpoint.
 * Ensures cookies are properly forwarded for auth.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: Request,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;
  const cookie = request.headers.get('cookie') || '';

  const backendUrl = `${BACKEND_URL}/api/v1/analysis/${taskId}/status`;

  try {
    const backendResponse = await fetch(backendUrl, {
      headers: { cookie },
      cache: 'no-store',
    });

    const data = await backendResponse.text();
    return new Response(data, {
      status: backendResponse.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Status proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to connect to backend' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
