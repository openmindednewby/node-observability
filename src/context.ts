import { AsyncLocalStorage } from 'node:async_hooks';
import { formatTraceparent, type TraceContext } from './traceparent';

const storage = new AsyncLocalStorage<TraceContext>();

/** Runs `fn` with `ctx` as the current trace. */
export function runWithTrace<T>(ctx: TraceContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** The trace of the request being handled, if any. */
export function currentTrace(): TraceContext | undefined {
  return storage.getStore();
}

/** The `traceparent` value to send on an outgoing call made while handling a request. */
export function outgoingTraceparent(): string | undefined {
  const ctx = storage.getStore();
  return ctx ? formatTraceparent(ctx) : undefined;
}
