import { fs } from '../lib/fs.js';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import pc from 'picocolors';

const CONFIG_DIR = join(homedir(), '.config', 'hush');
const CACHE_FILE = join(CONFIG_DIR, 'update-check.json');
const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 24;

interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

export function checkForUpdate(currentVersion: string): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    let cache: UpdateCache | null = null;
    if (fs.existsSync(CACHE_FILE)) {
      try {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8') as string);
      } catch {
      }
    }

    if (cache && cache.latestVersion && isNewer(cache.latestVersion, currentVersion)) {
      console.error(
        pc.bgYellow(pc.black(' UPDATE ')) +
        pc.yellow(` New version available: ${cache.latestVersion} (current: ${currentVersion})`)
      );
      console.error(pc.dim(`Run "npm install -D @chriscode/hush@latest" to update`));
      console.error('');
    }

    const now = Date.now();
    if (!cache || now - cache.lastCheck > CHECK_INTERVAL_MS) {
      spawnBackgroundCheck();
    }
  } catch {
  }
}

function spawnBackgroundCheck() {
  const script = `
    const https = require('https');
    const fs = require('fs');
    const path = require('path');
    
    const cacheFile = '${CACHE_FILE.replace(/\\/g, '\\\\')}';
    
    const req = https.get('https://registry.npmjs.org/@chriscode/hush/latest', {
      timeout: 3000,
      headers: { 'User-Agent': 'hush-cli' }
    }, (res) => {
      if (res.statusCode !== 200) process.exit(0);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const content = JSON.stringify({
            lastCheck: Date.now(),
            latestVersion: json.version
          });
          fs.writeFileSync(cacheFile, content);
        } catch (e) {}
      });
    });
    
    req.on('error', () => {});
    req.end();
  `;

  const child = spawn(process.execPath, ['-e', script], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, NO_UPDATE_NOTIFIER: '1' }
  });
  
  child.unref();
}

function isNewer(latest: string, current: string): boolean {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  
  if (l[0] > c[0]) return true;
  if (l[0] < c[0]) return false;
  
  if (l[1] > c[1]) return true;
  if (l[1] < c[1]) return false;
  
  if (l[2] > c[2]) return true;
  return false;
}
