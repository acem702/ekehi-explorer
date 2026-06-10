// Direct JSON-RPC client — calls the Rust node endpoints, no SDK dependency.

const EVM_URL    = process.env.EVM_RPC_URL    ?? 'http://localhost:8545';
const NATIVE_URL = process.env.NATIVE_RPC_URL ?? 'http://localhost:9944';
const TIMEOUT_MS = 15_000;

let _id = 1;

async function call(url: string, method: string, params: unknown[]): Promise<unknown> {
  const id = _id++;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { result?: unknown; error?: { code: number; message: string } };
    if (json.error) throw new Error(`RPC ${method}: [${json.error.code}] ${json.error.message}`);
    return json.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}

export const evm    = <T = unknown>(method: string, params: unknown[] = []) =>
  call(EVM_URL, method, params) as Promise<T>;

export const native = <T = unknown>(method: string, params: unknown[] = []) =>
  call(NATIVE_URL, method, params) as Promise<T>;

// Convenience: try a native call, return null on failure (node may not implement all methods)
export async function tryNative<T = unknown>(method: string, params: unknown[] = []): Promise<T | null> {
  try { return await native<T>(method, params); } catch { return null; }
}
