import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createLogger } from './logger';
import { createHttpMetrics } from './metrics';
import { instrument } from './instrument';
import { hideManagementPaths, startManagementServer, type HealthCheck } from './management';

const listening = (server: Server): Promise<string> =>
  new Promise((resolve) => {
    const done = (): void => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    if (server.listening) done();
    else server.once('listening', done);
  });

const close = (server: Server): Promise<void> => new Promise((resolve) => server.close(() => resolve()));

describe('startManagementServer', () => {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map(close));
  });

  const start = async (health?: { live?: HealthCheck; ready?: HealthCheck }): Promise<string> => {
    const metrics = createHttpMetrics({ app: 'demo-api', defaultMetrics: false });
    metrics.requestStarted();
    metrics.requestFinished({ method: 'GET', route: '/api/items', statusCode: 200, seconds: 0.01 });
    const server = startManagementServer({ port: 0, host: '127.0.0.1', metrics, health });
    servers.push(server);
    return listening(server);
  };

  it('on /metrics, serves the registry with 200', async () => {
    const base = await start();

    const res = await fetch(`${base}/metrics`);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('http_requests_total{app="demo-api",method="GET",http_route="/api/items",status_code="200"} 1');
  });

  it('on /health/live and /health/ready with no checks, answers 200', async () => {
    const base = await start();

    const statuses = [(await fetch(`${base}/health/live`)).status, (await fetch(`${base}/health/ready`)).status];

    expect(statuses).toEqual([200, 200]);
  });

  it('on /health/ready with a failing check, answers 503 and live stays 200', async () => {
    const base = await start({ ready: () => false });

    const statuses = [(await fetch(`${base}/health/ready`)).status, (await fetch(`${base}/health/live`)).status];

    expect(statuses).toEqual([503, 200]);
  });

  it('on /health/ready with a throwing check, answers 503', async () => {
    const base = await start({ ready: async () => { throw new Error('db down'); } });

    const res = await fetch(`${base}/health/ready`);

    expect(res.status).toBe(503);
  });

  it('on any other path or a POST, answers 404', async () => {
    const base = await start();

    const statuses = [(await fetch(`${base}/api/items`)).status, (await fetch(`${base}/metrics`, { method: 'POST' })).status];

    expect(statuses).toEqual([404, 404]);
  });
});

describe('hideManagementPaths', () => {
  let server: Server;
  afterEach(async () => close(server));

  const startPublic = async (guard: boolean): Promise<string> => {
    const logger = createLogger({ app: 'demo-api', destination: { write: () => undefined } });
    const metrics = createHttpMetrics({ app: 'demo-api', defaultMetrics: false });
    const inner = instrument((_req, res) => { res.writeHead(200); res.end('ok'); }, { routes: ['/api/items'], logger, metrics });
    server = createServer(guard ? hideManagementPaths(inner) : inner);
    server.listen(0, '127.0.0.1');
    return listening(server);
  };

  it('with the guard, answers 404 on /metrics and the health paths and 200 elsewhere', async () => {
    const base = await startPublic(true);

    const statuses = await Promise.all(['/metrics', '/health/live', '/health/ready', '/api/items'].map(async (p) => (await fetch(`${base}${p}`)).status));

    expect(statuses).toEqual([404, 404, 404, 200]);
  });

  it('without the guard, instrument still serves /metrics publicly', async () => {
    const base = await startPublic(false);

    const res = await fetch(`${base}/metrics`);

    expect(res.status).toBe(200);
  });
});
