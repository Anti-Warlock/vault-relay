import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ffmpegPath from "ffmpeg-static";
import puppeteer from "puppeteer-core";

const root = path.resolve(import.meta.dirname, "..");
const frameDir = path.join(root, "promo", ".frames");
const outputPath = path.join(root, "promo", "vault-relay-demo.mp4");
const posterPath = path.join(root, "promo", "vault-relay-poster.png");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const fps = 8;
const durationSeconds = 54;

if (!frameDir.startsWith(root)) throw new Error("Frame directory escaped workspace.");
await rm(frameDir, { recursive: true, force: true });
await mkdir(frameDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(root, "promo", "demo", "index.html")).href, {
    waitUntil: "networkidle0"
  });
  await page.screenshot({ path: posterPath });

  const frameCount = fps * durationSeconds;
  const startedAt = Date.now();
  for (let index = 0; index < frameCount; index += 1) {
    const targetTime = startedAt + index * (1000 / fps);
    const wait = targetTime - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    await page.screenshot({
      path: path.join(frameDir, `frame-${String(index).padStart(5, "0")}.jpg`),
      type: "jpeg",
      quality: 86
    });
  }
} finally {
  await browser.close();
}

if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an executable.");
await run(ffmpegPath, [
  "-y",
  "-framerate", String(fps),
  "-i", path.join(frameDir, "frame-%05d.jpg"),
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "20",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  outputPath
]);

await rm(frameDir, { recursive: true, force: true });
console.log(`Created ${outputPath}`);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
  });
}
