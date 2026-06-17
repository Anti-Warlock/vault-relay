import assert from "node:assert/strict";
import { generateKeyPairSync, sign, webcrypto } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const licensingSource = readFileSync(path.resolve("chrome-extension/licensing.js"), "utf8");

test("free Obsidian core does not depend on Companion runtime", () => {
  const source = readdirSync(path.resolve("src"))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => readFileSync(path.resolve("src", file), "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /from\s+["'][^"']*chrome-extension|VaultRelayLicense|companionLicense/);
});

test("new users receive a 14-day or 20-fill trial for currently available platforms", async () => {
  const license = loadLicense("2026-06-11T00:00:00+08:00");
  const entitlement = await license.api.getEntitlement();
  assert.equal(entitlement.plan, "trial-pro");
  assert.equal(entitlement.remaining, 20);
  assert.ok(entitlement.features.includes("xiaohongshu-fill"));
  assert.ok(entitlement.features.includes("wechat-fill"));
});

test("a successful fill consumes trial quota once and retries do not consume again", async () => {
  const license = loadLicense("2026-06-11T00:00:00+08:00");
  await license.api.recordSuccessfulFill("task-1", "x");
  await license.api.recordSuccessfulFill("task-1", "x");
  const entitlement = await license.api.getEntitlement();
  assert.equal(entitlement.remaining, 19);
  assert.equal(entitlement.totalSuccessfulFills, 1);
  assert.equal(entitlement.estimatedMinutesSaved, 6);
});

test("users move to Free after trial and receive three fills each month", async () => {
  const license = loadLicense("2026-07-01T00:00:00+08:00", undefined, {
    trialStartedAt: "2026-06-01T00:00:00.000Z",
    successfulFills: []
  });
  let entitlement = await license.api.getEntitlement();
  assert.equal(entitlement.plan, "free");
  assert.equal(entitlement.remaining, 3);
  await license.api.recordSuccessfulFill("free-1", "zhihu");
  await license.api.recordSuccessfulFill("free-2", "xiaohongshu");
  await license.api.recordSuccessfulFill("free-3", "x");
  entitlement = await license.api.getEntitlement();
  assert.equal(entitlement.remaining, 0);
  await assert.rejects(() => license.api.requireFeature("x-article-fill"), /本月 3 次免费/);
});

test("paid licenses unlock unlimited use and longer queue history", async () => {
  const license = loadLicense("2027-01-10T00:00:00+08:00", {
    status: "active",
    plan: "pro",
    expiresAt: "2027-12-31T23:59:59+08:00"
  });
  const entitlement = await license.api.getEntitlement();
  assert.equal(entitlement.plan, "pro");
  assert.equal(entitlement.metered, false);
  assert.equal(entitlement.remaining, null);
  assert.equal(await license.api.getQueueLimit(), 100);
});

test("X Creator plan only unlocks the X Article workflow", async () => {
  const license = loadLicense("2027-01-10T00:00:00+08:00", {
    status: "active",
    plan: "x-creator",
    expiresAt: "2027-12-31T23:59:59+08:00"
  });
  await license.api.requireFeature("x-article-fill");
  await assert.rejects(() => license.api.requireFeature("zhihu-fill"), /不包含 知乎一键草稿/);
});

test("a signed offline license code activates Founder Pro without a payment server", async () => {
  const fixture = signedLicenseFixture();
  const license = loadLicense("2026-06-12T12:00:00+08:00", undefined, undefined, fixture.publicJwk);
  await license.api.activateLicense(fixture.code);
  const entitlement = await license.api.getEntitlement();
  assert.equal(entitlement.plan, "founder-pro");
  assert.equal(entitlement.metered, false);
});

test("Companion creates and persists a customer-facing device code", async () => {
  const license = loadLicense("2026-06-12T12:00:00+08:00");
  const first = await license.api.getDeviceId();
  const second = await license.api.getDeviceId();
  assert.match(first, /^VRD-[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);
  assert.equal(second, first);
});

test("a device-bound license only activates on its matching Companion installation", async () => {
  const deviceId = "VRD-1234-5678-90AB-CDEF";
  const fixture = signedLicenseFixture(deviceId);
  const matching = loadLicense("2026-06-12T12:00:00+08:00", undefined, undefined, fixture.publicJwk, deviceId);
  await matching.api.activateLicense(fixture.code);
  assert.equal((await matching.api.getEntitlement()).plan, "founder-pro");

  const other = loadLicense("2026-06-12T12:00:00+08:00", undefined, undefined, fixture.publicJwk, "VRD-FFFF-FFFF-FFFF-FFFF");
  await assert.rejects(() => other.api.activateLicense(fixture.code), /绑定到其他设备/);
});

function loadLicense(
  now: string,
  companionLicense?: unknown,
  companionUsage?: unknown,
  publicJwk?: JsonWebKey,
  companionDeviceId?: string
): {
  api: {
    getEntitlement(): Promise<any>;
    requireFeature(feature: string): Promise<unknown>;
    recordSuccessfulFill(taskId: string, platform: string): Promise<unknown>;
    getQueueLimit(): Promise<number>;
    activateLicense(code: string): Promise<unknown>;
    getDeviceId(): Promise<string>;
  };
} {
  const NativeDate = Date;
  class FixedDate extends NativeDate {
    constructor(value?: string | number | Date) {
      super(value === undefined ? now : value);
    }

    static now(): number {
      return new NativeDate(now).getTime();
    }
  }

  const storage: Record<string, unknown> = { companionLicense, companionUsage, companionDeviceId };
  const context = {
    chrome: {
      storage: {
        local: {
          get: async (key: string | string[]) => Array.isArray(key)
            ? Object.fromEntries(key.map((entry) => [entry, storage[entry]]))
            : ({ [key]: storage[key] }),
          set: async (value: Record<string, unknown>) => Object.assign(storage, value)
        }
      }
    },
    Date: FixedDate,
    crypto: {
      subtle: webcrypto.subtle,
      randomUUID: () => "12345678-90ab-cdef-1234-567890abcdef"
    },
    atob,
    TextEncoder,
    TextDecoder,
    Uint8Array
  } as Record<string, unknown>;
  const source = publicJwk
    ? licensingSource.replace(
      /const LICENSE_PUBLIC_KEY = \{[\s\S]*?\n\};/,
      `const LICENSE_PUBLIC_KEY = ${JSON.stringify(publicJwk)};`
    )
    : licensingSource;
  vm.runInNewContext(source, context);
  return { api: context.VaultRelayLicense as any };
}

function signedLicenseFixture(deviceId?: string): { code: string; publicJwk: JsonWebKey } {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const payload = {
    v: 1,
    licenseId: "test-license",
    status: "active",
    plan: "founder-pro",
    billingInterval: "annual",
    issuedAt: "2026-06-12T00:00:00.000Z",
    expiresAt: "2027-06-12T00:00:00.000Z"
  };
  if (deviceId) Object.assign(payload, { deviceId });
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign("sha256", Buffer.from(encodedPayload), {
    key: privateKey,
    dsaEncoding: "ieee-p1363"
  }).toString("base64url");
  return {
    code: `VR1.${encodedPayload}.${signature}`,
    publicJwk: publicKey.export({ format: "jwk" })
  };
}
