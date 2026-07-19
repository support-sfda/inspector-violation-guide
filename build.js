const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, 'public');
const output = path.join(__dirname, 'dist');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(source, output, { recursive: true });
fs.mkdirSync(path.join(output, 'server'), { recursive: true });
fs.mkdirSync(path.join(output, '.openai'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '.openai', 'hosting.json'), path.join(output, '.openai', 'hosting.json'));

const assets = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/arabic.css': ['arabic.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
  '/data/violations.json': ['data/violations.json', 'application/json; charset=utf-8']
};
const bundled = Object.fromEntries(Object.entries(assets).map(([route, [file, type]]) => [route, {
  body: fs.readFileSync(path.join(source, file), 'utf8'), type
}]));
const worker = `const files=${JSON.stringify(bundled)};
export default {async fetch(request){const url=new URL(request.url);const file=files[url.pathname]||files['/'];return new Response(file.body,{headers:{'content-type':file.type,'cache-control':url.pathname==='/data/violations.json'?'public, max-age=3600':'no-cache','x-content-type-options':'nosniff'}})}};`;
fs.writeFileSync(path.join(output, 'server', 'index.js'), worker);
console.log('Built static and Sites-compatible output in dist/');
