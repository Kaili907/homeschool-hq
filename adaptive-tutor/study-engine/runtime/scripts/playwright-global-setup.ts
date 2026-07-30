import { fileURLToPath } from "node:url";
import { createServer } from "vite";

export default async function startReleaseSurface() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const server = await createServer({
    appType: "spa",
    configFile: false,
    root,
    server: {
      host: "127.0.0.1",
      port: 4319,
      strictPort: true,
    },
  });
  await server.listen();
  return async () => {
    await server.close();
  };
}
