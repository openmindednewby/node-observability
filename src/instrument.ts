import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Logger } from 'pino';
import { runWithTrace } from './context';
import type { HttpMetrics } from './metrics';
import { matchRoute, normalisePath } from './route';
import { formatTraceparent, startTrace, type TraceContext } from './traceparent';

/** A plain node:http request listener, sync or async. */
export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => unknown;

/** Options for {@link instrument}. */
export interface InstrumentOptions {
  routes: readonly string[];
  logger: Logger;
  metrics: HttpMetrics;
  skipPaths?: readonly string[];
  metricsPath?: string;
  metricsToken?: string;
}

const NANOS_PER_SECOND = 1e9;
const MILLIS_PER_SECOND = 1000;
const MAX_CORRELATION_ID_LENGTH = 128;

const underSegment = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`);

function authorised(req: IncomingMessage, token: string | undefined): boolean {
  if (!token) return true;
  const got = Buffer.from(req.headers.authorization ?? '');
  const want = Buffer.from(`Bearer ${token}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function serveMetrics(req: IncomingMessage, res: ServerResponse, options: InstrumentOptions): Promise<void> {
  if (!authorised(req, options.metricsToken)) {
    res.writeHead(401, { 'content-type': 'text/plain' });
    res.end('unauthorised');
    return;
  }
  const body = await options.metrics.register.metrics();
  res.writeHead(200, { 'content-type': options.metrics.register.contentType });
  res.end(body);
}

function invoke(handler: RequestHandler, req: IncomingMessage, res: ServerResponse, logger: Logger, traceId: string): void {
  const fail = (err: unknown): void => {
    logger.error({ err }, 'unhandled error');
    if (res.headersSent) {
      res.end();
      return;
    }
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error.', traceId }));
  };
  try {
    const result = handler(req, res);
    if (result instanceof Promise) result.catch(fail);
  } catch (err) {
    fail(err);
  }
}

function onFinished(res: ServerResponse, done: () => void): void {
  let called = false;
  const once = (): void => {
    if (called) return;
    called = true;
    done();
  };
  res.once('finish', once);
  res.once('close', once);
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function inboundTrace(req: IncomingMessage): TraceContext {
  const trace = startTrace(firstHeader(req.headers.traceparent));
  const correlationId = firstHeader(req.headers['x-correlation-id'])?.trim().slice(0, MAX_CORRELATION_ID_LENGTH);
  return correlationId ? { ...trace, correlationId } : trace;
}

/** Wraps a request listener with /metrics, HTTP metrics, W3C trace context, `X-Trace-Id` and an access log line. */
export function instrument(handler: RequestHandler, options: InstrumentOptions): RequestHandler {
  const resolveRoute = matchRoute(options.routes);
  const metricsPath = options.metricsPath ?? '/metrics';
  const skipped = [metricsPath, '/health', ...(options.skipPaths ?? [])];
  const { logger, metrics } = options;

  return (req, res) => {
    const path = normalisePath(req.url);
    if (path === metricsPath && req.method === 'GET') return serveMetrics(req, res, options);

    const trace = inboundTrace(req);
    res.setHeader('traceparent', formatTraceparent(trace));
    res.setHeader('x-trace-id', trace.traceId);
    const run = (): unknown => runWithTrace(trace, () => invoke(handler, req, res, logger, trace.traceId));
    if (skipped.some((p) => underSegment(path, p))) return run();

    const startedAt = process.hrtime.bigint();
    const method = req.method ?? 'GET';
    metrics.requestStarted();
    onFinished(res, () => {
      const seconds = Number(process.hrtime.bigint() - startedAt) / NANOS_PER_SECOND;
      const route = resolveRoute(req.url);
      const status = res.statusCode;
      metrics.requestFinished({ method, route, statusCode: status, seconds });
      const durationMs = Math.round(seconds * MILLIS_PER_SECOND);
      runWithTrace(trace, () => logger.info({ method, route, status, duration_ms: durationMs }, 'request'));
    });
    return run();
  };
}
