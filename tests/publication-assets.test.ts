import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PUBLICATION_IMAGE_BYTES, resolvedRemoteImage } from "../src/publication-assets";

test("embeds an OSS image into a self-contained publication task image", () => {
  const image = resolvedRemoteImage(
    { kind: "remote", source: "https://bucket.oss-cn.example.com/path/demo.png?signature=secret", alt: "demo" },
    Uint8Array.from([1, 2, 3]).buffer,
    { "Content-Type": "image/png; charset=binary" }
  );

  assert.equal(image.fileName, "demo.png");
  assert.equal(image.mimeType, "image/png");
  assert.equal(image.dataUrl, "data:image/png;base64,AQID");
});

test("rejects non-image and oversized remote resources", () => {
  assert.throws(() => resolvedRemoteImage(
    { kind: "remote", source: "https://example.com/not-image", alt: "" },
    new ArrayBuffer(1),
    { "content-type": "text/html" }
  ), /不是图片/);

  assert.throws(() => resolvedRemoteImage(
    { kind: "remote", source: "https://example.com/large.png", alt: "" },
    new ArrayBuffer(MAX_PUBLICATION_IMAGE_BYTES + 1),
    { "content-type": "image/png" }
  ), /超过 15 MB/);
});
