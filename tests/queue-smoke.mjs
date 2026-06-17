import assert from "node:assert/strict";
import path from "node:path";
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true
});

try {
  const page = await browser.newPage();
  await page.setContent("<html><body></body></html>");
  await page.evaluateOnNewDocument(() => {});
  await page.evaluate(() => {
    window.__storage = {};
    window.VaultRelayLicense = {
      getQueueLimit: async () => 100
    };
    window.chrome = {
      storage: {
        local: {
          get: async (key) => {
            if (typeof key === "string") return { [key]: window.__storage[key] };
            return window.__storage;
          },
          set: async (value) => Object.assign(window.__storage, value)
        }
      }
    };
  });
  await page.addScriptTag({ path: path.resolve("chrome-extension/queue.js") });

  const result = await page.evaluate(async () => {
    const task = {
      id: "queue-test",
      platform: "x",
      title: "Queue test",
      createdAt: "2026-06-11T00:00:00.000Z",
      issues: [],
      content: {
        plainText: "queue",
        images: [{ source: "large.png", dataUrl: `data:image/png;base64,${"A".repeat(500000)}` }]
      }
    };
    await VaultRelayQueue.enqueue(task);
    await VaultRelayQueue.mark(task, "filling", "first");
    await VaultRelayQueue.mark(task, "waiting", "retry");
    await VaultRelayQueue.mark(task, "filling", "second");
    await VaultRelayQueue.mark(task, "ready", "done");
    await VaultRelayQueue.markPublished(task);
    return VaultRelayQueue.list();
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].status, "published");
  assert.equal(result[0].attempts, 2);
  assert.ok(result[0].publishedAt);
  assert.equal(result[0].task.content.plainText, "");
  assert.equal(result[0].task.content.imageCount, 1);
  assert.doesNotMatch(JSON.stringify(result), /AAAAAA/);
  console.log("ok - queue preserves task state and retry count");
} finally {
  await browser.close();
}
