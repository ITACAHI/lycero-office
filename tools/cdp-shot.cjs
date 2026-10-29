const CDP = require('chrome-remote-interface');
const fs = require('fs');
(async () => {
  try {
    const client = await CDP({ port: 9222 });
    const { Page } = client;
    await Page.enable();
    // Attach to existing page target via Page domain
    const { data } = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('D:/Lycero Office/release/screenshots/cdp-home3.png', Buffer.from(data, 'base64'));
    console.log('saved', fs.statSync('D:/Lycero Office/release/screenshots/cdp-home3.png').size);
    await client.close();
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(1);
  }
})();
