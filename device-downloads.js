// Microsoft documents these stable endpoints: https://code.visualstudio.com/docs/supporting/faq#_previous-release-versions
export function vscodeDownload({ userAgent = '', platform = '', architecture = '', bitness = '', maxTouchPoints = 0 } = {}) {
  const device = `${platform} ${userAgent}`;
  if (/Android|iPhone|iPad|iPod|CrOS/i.test(device) || (/Mac/i.test(device) && maxTouchPoints > 1)) {
    return { href: 'https://vscode.dev/', label: 'Open Visual Studio Code in browser' };
  }
  let build;
  if (/Mac/i.test(device)) build = 'darwin-universal';
  else if (/Windows|Win32/i.test(device)) build = /arm/i.test(architecture + userAgent) ? 'win32-arm64-user' : 'win32-x64-user';
  else if (/Linux/i.test(device)) build = /armv7|armv6/i.test(userAgent) || (architecture === 'arm' && bitness === '32') ? 'linux-armhf' : /arm64|aarch64/i.test(architecture + userAgent) || architecture === 'arm' ? 'linux-arm64' : 'linux-x64';
  return { href: build ? `https://update.code.visualstudio.com/latest/${build}/stable` : 'https://code.visualstudio.com/download', label: 'Download Visual Studio Code' };
}

export async function setupDeviceDownloads() {
  const links = [...document.querySelectorAll('[data-device-download="vscode"]')];
  if (!links.length) return;
  let hints = navigator.userAgentData || {};
  try {
    if (hints.getHighEntropyValues) hints = await hints.getHighEntropyValues(['platform', 'architecture', 'bitness']);
  } catch { /* Use the user agent when architecture hints are unavailable. */ }
  const result = vscodeDownload({ userAgent: navigator.userAgent, platform: hints.platform || navigator.platform, architecture: hints.architecture, bitness: hints.bitness, maxTouchPoints: navigator.maxTouchPoints });
  links.forEach((link) => { link.href = result.href; link.textContent = result.label; });
}
