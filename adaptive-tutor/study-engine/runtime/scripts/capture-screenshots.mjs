import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const runtimeRoot = resolve(process.cwd());
const outputRoot = resolve(
  runtimeRoot,
  "../docs/final-assembly/screenshots",
);
await mkdir(outputRoot, { recursive: true });

const server = await createServer({
  appType: "spa",
  configFile: false,
  root: runtimeRoot,
  server: {
    host: "127.0.0.1",
    port: 4329,
    strictPort: true,
  },
});
await server.listen();

const browser = await chromium.launch();
try {
  for (const capture of [
    { name: "desktop", viewport: { width: 1440, height: 960 } },
    { name: "mobile", viewport: { width: 390, height: 844 } },
  ]) {
    const page = await browser.newPage({
      colorScheme: "light",
      viewport: capture.viewport,
    });
    await page.goto("http://127.0.0.1:4329", {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      fullPage: true,
      path: resolve(outputRoot, `${capture.name}.png`),
    });
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`Captured desktop and mobile release screenshots in ${outputRoot}.`);
