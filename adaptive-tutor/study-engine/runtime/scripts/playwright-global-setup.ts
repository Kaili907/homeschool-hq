import { fileURLToPath } from "node:url";
import { createServer } from "vite";

export default async function startReleaseSurface() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const server = await createServer({
    appType: "spa",
    configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
    root,
    server: {
      host: "127.0.0.1",
      port: 4319,
      strictPort: true,
      fs: {
        // The security browser regression imports the root session runtime;
        // this allowance exists only for the test server.
        allow: [fileURLToPath(new URL("../../../..", import.meta.url))],
      },
    },
  });
  await server.listen();
  return async () => {
    await server.close();
  };
}
