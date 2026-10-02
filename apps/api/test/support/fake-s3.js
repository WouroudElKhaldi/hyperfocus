import http from "node:http";

// A tiny stand-in for an S3-compatible service (R2, B2, MinIO…), for tests: path-style PUT/GET/DELETE of objects,
// and it refuses any request that isn't signed with AWS Signature V4 for the expected key. Never touches the internet.
export async function startFakeS3({ accessKeyId = "test-key" } = {}) {
  const objects = new Map();
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const auth = req.headers.authorization ?? "";
      requests.push({ method: req.method, path: req.url, signed: auth.startsWith(`AWS4-HMAC-SHA256 Credential=${accessKeyId}/`) });
      if (!auth.startsWith(`AWS4-HMAC-SHA256 Credential=${accessKeyId}/`)) {
        res.writeHead(403).end("SignatureDoesNotMatch");
        return;
      }
      const key = decodeURIComponent(req.url);
      if (req.method === "PUT") {
        objects.set(key, { body: Buffer.concat(chunks), type: req.headers["content-type"] });
        res.writeHead(200).end();
      } else if (req.method === "GET") {
        const o = objects.get(key);
        if (!o) res.writeHead(404).end("NoSuchKey");
        else res.writeHead(200, { "Content-Type": o.type ?? "application/octet-stream" }).end(o.body);
      } else if (req.method === "DELETE") {
        objects.delete(key);
        res.writeHead(204).end();
      } else res.writeHead(405).end();
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${server.address().port}`, objects, requests, close: () => new Promise((r) => server.close(r)) };
}
