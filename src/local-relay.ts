import { randomUUID } from "crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import type { PublicationPlatform, PublicationTask } from "./publication";

const RELAY_HOST = "127.0.0.1";
export const RELAY_PORT = 27124;

export class LocalRelay {
  private readonly tasks: Array<{ claimCode: string; task: PublicationTask }> = [];
  private readonly claimWaiters = new Map<string, Set<(claimed: boolean) => void>>();
  private server?: Server;

  constructor(private readonly port = RELAY_PORT) {}

  get listeningPort(): number {
    const address = this.server?.address();
    return typeof address === "object" && address ? address.port : this.port;
  }

  async start(): Promise<void> {
    if (this.server?.listening) return;
    const server = createServer((request, response) => this.handleRequest(request, response));
    this.server = server;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(this.port, RELAY_HOST, () => {
          server.off("error", reject);
          resolve();
        });
      });
    } catch (error) {
      this.server = undefined;
      server.close();
      throw error;
    }
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const waiters of this.claimWaiters.values()) {
      for (const resolve of waiters) resolve(false);
    }
    this.claimWaiters.clear();
  }

  enqueue(task: PublicationTask): string {
    if (!this.server?.listening) throw new Error("VaultRelay 本地中继未运行");
    const claimCode = randomUUID();
    this.tasks.unshift({ claimCode, task });
    if (this.tasks.length > 10) this.tasks.length = 10;
    return claimCode;
  }

  waitForClaim(claimCode: string, timeoutMs = 15000): Promise<boolean> {
    return new Promise((resolve) => {
      const waiters = this.claimWaiters.get(claimCode) ?? new Set<(claimed: boolean) => void>();
      this.claimWaiters.set(claimCode, waiters);
      const finish = (claimed: boolean) => {
        clearTimeout(timer);
        waiters.delete(finish);
        if (!waiters.size) this.claimWaiters.delete(claimCode);
        resolve(claimed);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      waiters.add(finish);
    });
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse): void {
    const origin = request.headers.origin ?? "";
    if (origin && !origin.startsWith("chrome-extension://")) {
      this.send(response, 403, { error: "Relay only accepts browser-extension requests." });
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", origin || "*");
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${RELAY_HOST}:${this.listeningPort}`);
    if (request.method === "GET" && url.pathname === "/health") {
      this.send(response, 200, { ok: true, queued: this.tasks.length });
      return;
    }
    if (request.method === "GET" && url.pathname === "/tasks/claim") {
      const platform = url.searchParams.get("platform") as PublicationPlatform | null;
      const claimCode = url.searchParams.get("claim");
      const index = this.tasks.findIndex((entry) =>
        entry.task.platform === platform && entry.claimCode === claimCode
      );
      if (index < 0) {
        response.writeHead(204).end();
        return;
      }
      const [{ task }] = this.tasks.splice(index, 1);
      this.resolveClaim(claimCode ?? "");
      this.send(response, 200, { task });
      return;
    }
    this.send(response, 404, { error: "Not found." });
  }

  private send(response: ServerResponse, status: number, body: unknown): void {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.writeHead(status).end(JSON.stringify(body));
  }

  private resolveClaim(claimCode: string): void {
    for (const resolve of this.claimWaiters.get(claimCode) ?? []) resolve(true);
  }
}

export function editorUrlWithRelayClaim(editorUrl: string, claimCode: string): string {
  const url = new URL(editorUrl);
  const fragment = new URLSearchParams(url.hash.slice(1));
  fragment.set("vault-relay-claim", claimCode);
  url.hash = fragment.toString();
  return url.toString();
}
