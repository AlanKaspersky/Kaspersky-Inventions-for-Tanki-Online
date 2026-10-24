const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname, '../..');
let playwright;
if (process.env.PLAYWRIGHT_MODULE_PATH) playwright = require(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH));
else {
    try { playwright = require('playwright'); }
    catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND') throw error;
        const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
        if (!fs.existsSync(bundled)) throw Error('Install Playwright or set PLAYWRIGHT_MODULE_PATH to its module directory.');
        playwright = require(bundled);
    }
}
const edge = process.platform === 'win32' ? path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe') : '';
const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH || (edge && fs.existsSync(edge) ? edge : undefined);
module.exports = { chromium: playwright.chromium, browserOptions: { headless: true, ...(executablePath ? { executablePath } : {}) }, root };
