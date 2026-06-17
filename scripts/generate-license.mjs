import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign } from "node:crypto";

const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, value = "true"] = entry.replace(/^--/, "").split("=");
  return [key, value];
}));
const keyPath = args.key ?? join(homedir(), ".vault-relay", "license-private-v2.pem");
const plan = args.plan ?? "creator-pro";
const days = Number(args.days ?? 365);
const issuedAt = new Date();
const expiresAt = new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);

ensureKey(keyPath);
const privateKey = createPrivateKey(readFileSync(keyPath));
const publicJwk = createPublicKey(privateKey).export({ format: "jwk" });
const payload = {
  v: 1,
  licenseId: args.id ?? randomUUID(),
  status: "active",
  plan,
  billingInterval: args.interval ?? "annual",
  issuedAt: issuedAt.toISOString(),
  expiresAt: expiresAt.toISOString()
};
if (args.device) payload.deviceId = args.device;
const encodedPayload = base64Url(JSON.stringify(payload));
const signature = sign("sha256", Buffer.from(encodedPayload), {
  key: privateKey,
  dsaEncoding: "ieee-p1363"
});

console.log(`Public JWK: ${JSON.stringify(publicJwk)}`);
console.log(`License: VR1.${encodedPayload}.${base64Url(signature)}`);

function ensureKey(path) {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" }
  });
  writeFileSync(path, privateKey, { mode: 0o600 });
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}
