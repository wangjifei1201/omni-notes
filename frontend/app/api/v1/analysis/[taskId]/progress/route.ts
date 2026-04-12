/**
 * SSE streaming proxy for analysis progress.
 *
 * Next.js rewrites buffer responses which breaks SSE streaming.
 * This route handler explicitly streams from the backend chunk-by-chunk.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: Request,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;

  // Forward cookies from browser for auth
  const cookie = request.headers.get('cookie') || '';
  const backendUrl = `${BACKEND_URL}/api/v1/analysis/${taskId}/progress`;

  try {
    const backendResponse = await fetch(backendUrl, {
      headers: {
        cookie,
        Accept: 'text/event-stream',
      },
      cache: 'no-store',
      signal: request.signal,
    });

    if (!backendResponse.ok) {
      const text = await backendResponse.text();
      return new Response(text, {
        status: backendResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create a TransformStream to relay SSE data chunk by chunk
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Read from backend and write to client in background
    (async () => {
      const reader = backendResponse.body?.getReader();
      if (!reader) {
        await writer.close();
        return;
      }

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch (_err) {
        // Client disconnected or read error - expected
        void _err;
      } finally {
        try { await writer.close(); } catch { /* ignore */ }
        try { reader.releaseLock(); } catch { /* ignore */ }
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('SSE proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to connect to backend' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
