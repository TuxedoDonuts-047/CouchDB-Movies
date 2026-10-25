import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const directory = path.dirname(filename);
const couchUrl = new URL(process.env.COUCHDB_URL || 'http://admin:mtu12345@localhost:5984/movies');
const couchCredentials = Buffer.from(`${decodeURIComponent(couchUrl.username)}:${decodeURIComponent(couchUrl.password)}`).toString('base64');
const couchTarget = `${couchUrl.protocol}//${couchUrl.host}`;
const port = Number(process.env.PORT || 3000);
const app = express();

app.use('/couch', (request, response, next) => {
  let pathSegments;
  try {
    pathSegments = decodeURIComponent(request.url.split('?')[0]).split('/');
  } catch {
    return response.sendStatus(400);
  }
  const isRootProbe = pathSegments.length === 2 && pathSegments[1] === '' && ['GET', 'HEAD'].includes(request.method);
  const isMoviesRequest = pathSegments[1] === 'movies' && !pathSegments.includes('..') && !pathSegments.includes('.');
  if (isRootProbe || isMoviesRequest) return next();
  response.sendStatus(404);
});

app.use('/couch', createProxyMiddleware({
  target: couchTarget,
  changeOrigin: true,
  pathRewrite: { '^/couch': '' },
  on: {
    proxyReq(proxyRequest) {
      proxyRequest.setHeader('Authorization', `Basic ${couchCredentials}`);
    }
  }
}));

app.use(express.static(path.join(directory, 'public')));
app.listen(port, '127.0.0.1', () => {
  console.log(`Movies app is available at http://localhost:${port}`);
});