import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createLogger } from './logger';
import { createHttpMetrics } from './metrics';
import { instrument } from './instrument';
import { currentTrace } from './context';

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736';
const PARENT = '00f067aa0ba902b7';
const SCRAPE_KEY = 'x'.repeat(24);

interface Harness { base: string; server: Server; lines: string[] }

async function start(handler: (req: IncomingMessage, res: ServerResponse) => void, metricsToken?: string): Promise<Harness> {
  const lines: string[] = [];
  const logger = createLogger({ app: 'demo-api', destination: { write: (s: string) => lines.push(s) } });
  const metrics = createHttpMetrics({ app: 'demo-api', defaultMetrics: false });
  const listener = instrument(handler, { routes: ['/api/items/:id', '/api/health'], skipPaths: ['/api/health'], logger, metrics, metricsToken });
  const server = createServer(listener);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, server, lines };
}

const ok = (_req: IncomingMessage, res: ServerResponse): void => {
  res.writeHead(201);
  res.end(JSON.stringify(currentTrace()));
};

describe('instrument', () => {
  let h: Harness;
  afterEach(async () => new Promise<void>((r) => h.server.close(() => r())));

  it('records Metrics.Client names and labels with the templated route', async () => {
    h = await start(ok);
    await fetch(`${h.base}/api/items/7`, { method: 'POST' });
    const text = await (await fetch(`${h.base}/metrics`)).text();
    expect(text).toContain('http_requests_total{app="demo-api",method="POST",http_route="/api/items/:id",status_code="201"} 1');
    expect(text).toContain('http_request_duration_seconds_bucket{le="0.005",app="demo-api",method="POST",http_route="/api/items/:id",status_code="201"}');
    expect(text).toContain('http_requests_in_flight{app="demo-api"} 0');
  });

  it('counts an unknown path once as unmatched, never by its URL', async () => {
    h = await start(ok);
    await fetch(`${h.base}/wp-login.php`);
    const text = await (await fetch(`${h.base}/metrics`)).text();
    expect(text).toContain('http_unmatched_requests_total{app="demo-api",method="GET"} 1');
    expect(text).not.toContain('wp-login');
  });

  it('records and logs nothing for /metrics and the skipped health path', async () => {
    h = await start(ok);
    await fetch(`${h.base}/api/health`);
    await fetch(`${h.base}/metrics`);
    const text = await (await fetch(`${h.base}/metrics`)).text();
    expect(text).not.toContain('http_requests_total{');
    expect(h.lines).toHaveLength(0);
  });

  it('continues the caller trace, returns traceparent, and logs TraceId on the access line', async () => {
    h = await start(ok);
    const res = await fetch(`${h.base}/api/items/1`, { headers: { traceparent: `00-${TRACE}-${PARENT}-01` } });
    const seen = (await res.json()) as { traceId: string; spanId: string };
    expect(seen.traceId).toBe(TRACE);
    expect(res.headers.get('traceparent')).toBe(`00-${TRACE}-${seen.spanId}-01`);
    const line = JSON.parse(h.lines[0] ?? '{}');
    expect(line).toMatchObject({ app: 'demo-api', TraceId: TRACE, SpanId: seen.spanId, method: 'GET', route: '/api/items/:id', status: 201 });
  });

  it('with an inbound request, returns the trace id in X-Trace-Id and logs trace_id and span_id', async () => {
    h = await start(ok);

    const res = await fetch(`${h.base}/api/items/1`, { headers: { traceparent: `00-${TRACE}-${PARENT}-01` } });

    const seen = (await res.json()) as { spanId: string };
    expect(res.headers.get('x-trace-id')).toBe(TRACE);
    expect(JSON.parse(h.lines[0] ?? '{}')).toMatchObject({ trace_id: TRACE, span_id: seen.spanId });
  });

  it('with an inbound X-Correlation-Id, logs it as correlation_id', async () => {
    h = await start(ok);

    await fetch(`${h.base}/api/items/1`, { headers: { 'x-correlation-id': 'partner-42' } });

    expect(JSON.parse(h.lines[0] ?? '{}')).toMatchObject({ correlation_id: 'partner-42' });
  });

  it('with no inbound X-Correlation-Id, logs no correlation_id', async () => {
    h = await start(ok);

    await fetch(`${h.base}/api/items/1`);

    expect(JSON.parse(h.lines[0] ?? '{}')).not.toHaveProperty('correlation_id');
  });

  it('with a handler that throws, returns the trace id in the error body', async () => {
    h = await start(() => {
      throw new Error('boom');
    });

    const res = await fetch(`${h.base}/api/items/1`, { headers: { traceparent: `00-${TRACE}-${PARENT}-01` } });

    expect(await res.json()).toMatchObject({ traceId: TRACE });
  });

  it('refuses /metrics without the scrape token when one is set', async () => {
    h = await start(ok, SCRAPE_KEY);
    expect((await fetch(`${h.base}/metrics`)).status).toBe(401);
    const good = await fetch(`${h.base}/metrics`, { headers: { authorization: `Bearer ${SCRAPE_KEY}` } });
    expect(good.status).toBe(200);
  });

  it('answers 500 and logs the error when the handler throws', async () => {
    h = await start(() => {
      throw new Error('boom');
    });
    expect((await fetch(`${h.base}/api/items/1`)).status).toBe(500);
    const parsed = h.lines.map((l) => JSON.parse(l) as { level: string; err?: { message: string } });
    expect(parsed.some((l) => l.level === 'error' && l.err?.message === 'boom')).toBe(true);
  });
});
