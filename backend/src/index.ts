import { app } from "./app.js";

const port = Number(process.env.BACKEND_PORT ?? 8000);
const host = process.env.BACKEND_HOST ?? "127.0.0.1";

app.listen(port, host, () => {
  console.log(`Bhoomi Suraksha backend listening on http://${host}:${port}`);
  console.log(`API docs at http://localhost:${port}/api/docs`);
});
