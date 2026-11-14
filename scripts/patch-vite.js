import fs from 'fs';
import path from 'path';

function patchFile(relPath) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf-8');
  let changed = false;

  // 1. Replace reject of 'WebSocket closed without opened.' with safe resolve
  if (content.includes('WebSocket closed without opened.')) {
    content = content.replace(/reject\(\/\* @__PURE__ \*\/ new Error\("WebSocket closed without opened\."\)\);/g, 'resolve();');
    changed = true;
  }

  // 2. Suppress vite failed to connect to websocket error log
  if (content.includes('[vite] failed to connect to websocket')) {
    content = content.replace(/console\.error\(`\[vite\] failed to connect to websocket[\s\S]*?`\);/g, '');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`Successfully patched ${relPath}`);
  }
}

try {
  patchFile('node_modules/vite/dist/client/client.mjs');
  patchFile('node_modules/vite/dist/client/bundledDevClient.mjs');
} catch (e) {
  console.warn('Note: Vite patch script could not run:', e?.message || e);
}
