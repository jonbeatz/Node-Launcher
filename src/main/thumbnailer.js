const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

class MSC_Thumbnailer {
  constructor() {
    this.cacheDir = path.join(process.cwd(), 'cache', 'thumbnails');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    this.browser = null;
  }

  async init() {
    // In Electron, we can use the bundled Chromium path
    // For now, we'll try to find it or use a default path
    try {
      this.browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', // Fallback for Win11
        headless: 'new',
      });
      console.log('VPE: Thumbnailer Initialized');
    } catch (err) {
      console.error('VPE: Thumbnailer Failed to launch browser', err);
    }
  }

  async capture(projectId, url) {
    if (!this.browser) await this.init();
    if (!this.browser) return null;

    const page = await this.browser.newPage();
    try {
      await page.setViewport({ width: 800, height: 600 });
      
      // Wait for HTTP 200
      console.log(`[VPE] Waiting for health check on ${url}...`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const thumbnailPath = path.join(this.cacheDir, `${projectId}.webp`);
      await page.screenshot({
        path: thumbnailPath,
        type: 'webp',
        quality: 80,
      });

      console.log(`[VPE] Thumbnail captured: ${thumbnailPath}`);
      return thumbnailPath;
    } catch (err) {
      console.error(`[VPE] Thumbnail capture failed for ${projectId}:`, err);
      return null;
    } finally {
      await page.close();
    }
  }

  async shutdown() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = new MSC_Thumbnailer();
