/**
 * Supabase Edge Functions Manager
 * Uses ONLY Node.js built-in modules — zero npm dependencies needed.
 * Handles multipart/form-data manually.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 8085;
const FUNCTIONS_DIR = process.env.EDGE_FUNCTIONS_DIR || '/app/functions';

/**
 * Parse a multipart/form-data body into fields and files.
 * Returns: { fields: {name: value}, files: [{fieldname, originalname, buffer}] }
 */
function parseMultipart(boundary, body) {
  const result = { fields: {}, files: [] };
  const boundaryBuf = Buffer.from('--' + boundary);
  const parts = [];
  let start = 0;

  // Split body by boundary
  while (true) {
    const idx = body.indexOf(boundaryBuf, start);
    if (idx === -1) break;
    if (start > 0) {
      // Extract part between previous and current boundary (skip leading CRLF)
      parts.push(body.slice(start, idx - 2)); // remove trailing \r\n
    }
    start = idx + boundaryBuf.length + 2; // skip boundary + \r\n
  }

  for (const part of parts) {
    // Find the header/body separator (\r\n\r\n)
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerStr = part.slice(0, headerEnd).toString();
    const bodyPart = part.slice(headerEnd + 4);

    // Parse Content-Disposition
    const cdMatch = headerStr.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/i);
    if (!cdMatch) continue;
    const name = cdMatch[1];

    const filenameMatch = headerStr.match(/filename="([^"]+)"/i);
    if (filenameMatch) {
      result.files.push({
        fieldname: name,
        originalname: filenameMatch[1],
        buffer: bodyPart
      });
    } else {
      result.fields[name] = bodyPart.toString();
    }
  }

  return result;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // POST /api/v1/projects/:ref/functions/deploy?slug=name
  const deployMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/functions(\/deploy)?$/);
  if (req.method === 'POST' && deployMatch) {
    const ref = deployMatch[1];
    const slug = url.searchParams.get('slug') || url.searchParams.get('name');

    if (!slug) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing slug query parameter' }));
      return;
    }

    // Read full body
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';

      let files = [];
      let metadata = {};

      const boundaryMatch = contentType.match(/boundary=(.+)/i);
      if (boundaryMatch) {
        const parsed = parseMultipart(boundaryMatch[1].trim(), body);
        files = parsed.files;
        if (parsed.fields.metadata) {
          try { metadata = JSON.parse(parsed.fields.metadata); } catch (e) {}
        }
      }

      if (files.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No files uploaded' }));
        return;
      }

      try {
        const functionDir = path.join(FUNCTIONS_DIR, slug);
        fs.mkdirSync(functionDir, { recursive: true });

        for (const file of files) {
          const filePath = path.join(functionDir, file.originalname);
          fs.writeFileSync(filePath, file.buffer);
          console.log(`Saved: ${filePath}`);
        }

        const responseData = {
          id: crypto.randomUUID(),
          slug,
          name: slug,
          version: 1,
          status: 'ACTIVE',
          created_at: Date.now(),
          updated_at: Date.now(),
          entrypoint_path: metadata.entrypoint_path || 'file:///src/index.ts',
          import_map_path: metadata.import_map_path || null,
          verify_jwt: metadata.verify_jwt !== false
        };

        console.log(`Deployed function: ${slug} (ref: ${ref})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
      } catch (err) {
        console.error('Deployment error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Edge Functions Manager listening on port ${PORT}`);
  console.log(`Functions directory: ${FUNCTIONS_DIR}`);
});
