import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { HttpMetrics } from './metrics';
import { normalisePath } from './route';

export type HealthCheck = () => boolean | Promise<boolean>;

export interface ManagementServerOptions {
  metrics: HttpMetrics;
  port?: number;
  host?: string;
  health?: { live?: HealthCheck; ready?: HealthCheck };
}

export const DEFAULT_MANAGEMENT_PORT = 8081;
export const MANAGEMENT_PATHS: readonly string[] = ['/metrics', '/health/live', '/health/ready'];

const isManagementPath = (path: string): boolean => MANAGEMENT_PATHS.includes(path);

function reply(res: ServerResponse, status: number, body: string, contentType = 'text/plain'): void {
  res.writeHead(status, { 'content-type': contentType });
  res.end(body);
}

async function probe(res: ServerResponse, check: HealthCheck | undefined): Promise<void> {
  let healthy = true;
  try {
    healthy = check ? await check() : true;
  } catch {
    healthy = false;
  }
  reply(res, healthy ? 200 : 503, healthy ? 'Healthy' : 'Unhealthy');
}

async function route(req: IncomingMessage, res: ServerResponse, options: ManagementServerOptions): Promise<void> {
  const path = normalisePath(req.url);
  if (req.method !== 'GET' || !isManagementPath(path)) return reply(res, 404, 'not found');
  if (path === '/metrics') return reply(res, 200, await options.metrics.register.metrics(), options.metrics.register.contentType);
  return probe(res, path === '/health/live' ? options.health?.live : options.health?.ready);
}

/** Starts the management listener serving only metrics and the two health paths. */
export function startManagementServer(options: ManagementServerOptions): Server {
  const server = createServer((req, res) => {
    route(req, res, options).catch(() => {
      if (!res.headersSent) reply(res, 500, 'error');
      else res.end();
    });
  });
  server.listen(options.port ?? DEFAULT_MANAGEMENT_PORT, options.host);
  return server;
}

/** Wraps the public listener so the management paths answer 404 there. */
export function hideManagementPaths<H extends (req: IncomingMessage, res: ServerResponse) => unknown>(handler: H): H {
  const guarded = (req: IncomingMessage, res: ServerResponse): unknown => {
    if (!isManagementPath(normalisePath(req.url))) return handler(req, res);
    return reply(res, 404, 'not found');
  };
  return guarded as H;
}
