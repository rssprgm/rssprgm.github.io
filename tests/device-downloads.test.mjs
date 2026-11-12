import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../device-downloads.js', import.meta.url), 'utf8');
const { vscodeDownload } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('VS Code download resolves desktop platforms and architectures without guessing the Mac CPU', () => {
  for (const [device, build] of [
    [{ platform: 'MacIntel' }, 'darwin-universal'],
    [{ platform: 'macOS', architecture: 'arm' }, 'darwin-universal'],
    [{ platform: 'Windows', architecture: 'arm' }, 'win32-arm64-user'],
    [{ userAgent: 'Windows NT 10.0; Win64; x64' }, 'win32-x64-user'],
    [{ platform: 'Linux', architecture: 'arm' }, 'linux-arm64'],
    [{ userAgent: 'Linux armv7l' }, 'linux-armhf'],
    [{ platform: 'Linux', architecture: 'arm', bitness: '32' }, 'linux-armhf'],
    [{ userAgent: 'Linux x86_64' }, 'linux-x64'],
  ]) assert.equal(vscodeDownload(device).href, `https://update.code.visualstudio.com/latest/${build}/stable`);
});
test('phones, iPads reporting Mac, and ChromeOS get the browser editor; unknown devices get download choices', () => {
  for (const device of [{ userAgent: 'iPhone' }, { userAgent: 'Android' }, { platform: 'MacIntel', maxTouchPoints: 5 }, { userAgent: 'CrOS x86_64' }]) {
    assert.equal(vscodeDownload(device).href, 'https://vscode.dev/');
  }
  assert.equal(vscodeDownload().href, 'https://code.visualstudio.com/download');
});
