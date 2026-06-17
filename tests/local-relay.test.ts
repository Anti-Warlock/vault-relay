import assert from "node:assert/strict";
import test from "node:test";
import { editorUrlWithRelayClaim, LocalRelay } from "../src/local-relay";
import { createPublicationTask } from "../src/publication";

test("local relay hands off a platform task only with its one-time claim", async () => {
  const relay = new LocalRelay(0);
  await relay.start();
  try {
    const port = relay.listeningPort;
    const task = createPublicationTask("x", "# Relay\n\n正文", "Relay", "relay.md", "0.9.1");
    const claimCode = relay.enqueue(task);
    const claimedPromise = relay.waitForClaim(claimCode, 500);

    const claimUrl = `http://127.0.0.1:${port}/tasks/claim?platform=x&claim=${encodeURIComponent(claimCode)}`;
    assert.equal((await fetch(`http://127.0.0.1:${port}/tasks/claim?platform=x&claim=wrong`)).status, 204);
    const claimResponse = await fetch(claimUrl);
    assert.equal(claimResponse.status, 200);
    const claimed = await claimResponse.json() as { task: { id: string } };
    assert.equal(claimed.task.id, task.id);
    assert.equal(await claimedPromise, true);
    assert.equal((await fetch(claimUrl)).status, 204);

    const response = await fetch(`http://127.0.0.1:${port}/pair`, {
      headers: { Origin: "https://example.com" }
    });
    assert.equal(response.status, 403);
  } finally {
    await relay.stop();
  }
});

test("local relay hands off four platform tasks independently during a batch Push", async () => {
  const relay = new LocalRelay(0);
  await relay.start();
  try {
    const platforms = ["x", "zhihu", "wechat", "xiaohongshu"] as const;
    const entries = platforms.map((platform) => {
      const task = createPublicationTask(platform, `# ${platform}\n\n${platform} 正文`, platform, `${platform}.md`, "0.16.0");
      return { platform, task, claimCode: relay.enqueue(task) };
    });
    const port = relay.listeningPort;
    const claimed = await Promise.all(entries.map(async ({ platform, task, claimCode }) => {
      const response = await fetch(
        `http://127.0.0.1:${port}/tasks/claim?platform=${platform}&claim=${encodeURIComponent(claimCode)}`
      );
      assert.equal(response.status, 200);
      const result = await response.json() as { task: { id: string; platform: string } };
      assert.equal(result.task.id, task.id);
      return result.task.platform;
    }));
    assert.deepEqual(claimed, platforms);
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
    assert.equal(((await (await fetch(`http://127.0.0.1:${port}/health`)).json()) as { queued: number }).queued, 0);
  } finally {
    await relay.stop();
  }
});

test("local relay rejects tasks when it is not listening", () => {
  const relay = new LocalRelay(0);
  const task = createPublicationTask("x", "# Relay\n\n正文", "Relay", "relay.md", "0.9.3");
  assert.throws(() => relay.enqueue(task), /本地中继未运行/);
});

test("local relay reports when a companion does not claim the task", async () => {
  const relay = new LocalRelay(0);
  await relay.start();
  try {
    const task = createPublicationTask("x", "# Relay\n\n正文", "Relay", "relay.md", "0.9.3");
    const claimCode = relay.enqueue(task);
    assert.equal(await relay.waitForClaim(claimCode, 10), false);
  } finally {
    await relay.stop();
  }
});

test("relay claim is placed in a URL fragment and is not sent to the platform server", () => {
  const url = editorUrlWithRelayClaim("https://x.com/compose/post", "one-time-secret");
  assert.equal(new URL(url).origin + new URL(url).pathname, "https://x.com/compose/post");
  assert.equal(new URL(url).search, "");
  assert.equal(new URLSearchParams(new URL(url).hash.slice(1)).get("vault-relay-claim"), "one-time-secret");
});
