import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function fixture(t, markup = '') {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.setContent(`<style>#outer { position:relative; width:900px; height:700px } #inner { width:600px; height:400px } dynamo-blob { width:100px;height:100px }</style><div id="outer"><div id="inner">${markup}</div></div>`);
  await page.evaluate(() => {
    window.reads = [];
    for (const key of ['offsetWidth', 'offsetHeight']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key);
      Object.defineProperty(HTMLElement.prototype, key, { ...descriptor, get() {
        reads.push({ id: this.id || this.localName, key });
        return descriptor.get.call(this);
      } });
    }
    window.now = 100;
    performance.now = () => now;
    window.queue = new Map(); let sequence = 0;
    requestAnimationFrame = callback => { queue.set(++sequence, callback); return sequence; };
    cancelAnimationFrame = id => queue.delete(id);
    window.frame = (ms = 16.667) => { now += ms; const pending = [...queue.values()];queue.clear();for (const cb of pending) cb(now); };
    window.addBlob = (parent = document.querySelector('#inner')) => {
      const blob = document.createElement('dynamo-blob');
      blob.setAttribute('data-blob-wobble-autoplay', 'false');
      blob.setAttribute('data-blob-drift-start-position', 'center');
      parent.append(blob);blob.playDrift();return blob;
    };
  });
  await page.addScriptTag({ path: fileURLToPath(new URL('../dist/dynamoblobs.js', import.meta.url)) });
  return page;
}

// Give the browser its resize/mutation delivery opportunity, then flush the
// library's animation callbacks independently of display refresh rate.
async function settle(page) {
  await page.waitForTimeout(60);
  await page.evaluate(() => frame());
}

test('stable drift has zero dimension reads; a shared resized container is measured once', async t => {
  const page = await fixture(t);
  await page.evaluate(() => { document.querySelector('#inner').style.position = 'relative'; window.blobs = Array.from({ length: 8 }, () => addBlob());blobs[0].playMorph();blobs[1].playWobble(); });
  await settle(page);
  await page.evaluate(() => { reads.length = 0; });
  for (let batch = 0; batch < 4; batch++) {
    await page.evaluate(() => { for (let i = 0; i < 30; i++) frame(); });
    await page.waitForTimeout(20);
  }
  assert.deepEqual(await page.evaluate(() => reads), []);
  await page.evaluate(() => { reads.length = 0; document.querySelector('#inner').style.width = '500px'; });
  await settle(page);
  const result = await page.evaluate(() => ({ bounds: blobs.map(blob => blob.driftBounds().pw), containerReads: reads.filter(read => read.id === 'inner') }));
  assert.deepEqual(result.bounds, Array(8).fill(500));
  assert.equal(result.containerReads.filter(read => read.key === 'offsetWidth').length, 1);
  assert.equal(result.containerReads.filter(read => read.key === 'offsetHeight').length, 1);
});

test('containing-block changes invalidate cached bounds, including silent CSSOM edits', async t => {
  const page = await fixture(t);
  await page.evaluate(() => { window.blob = addBlob(); });
  await settle(page);
  assert.equal(await page.evaluate(() => blob.driftBounds().pw), 900);
  await page.evaluate(() => { document.querySelector('#inner').className = 'positioned'; const style = document.createElement('style'); style.textContent = '.positioned { position:relative }';document.head.append(style); });
  await settle(page);
  assert.equal(await page.evaluate(() => blob.driftBounds().pw), 600);
  await page.evaluate(() => { document.styleSheets[0].insertRule('#inner { position:static !important }'); });
  await settle(page);
  await page.evaluate(() => frame(300));
  assert.equal(await page.evaluate(() => blob.driftBounds().pw), 900);
});

test('resize, visibility, resume and shadow-root reparenting refresh geometry', async t => {
  const page = await fixture(t);
  await page.evaluate(() => { document.querySelector('#inner').style.cssText = 'position:relative;display:none';window.blob = addBlob(); });
  await settle(page);
  await page.evaluate(() => { document.querySelector('#inner').style.display = 'block'; });
  await settle(page);
  assert.deepEqual(await page.evaluate(() => { const {w,pw} = blob.driftBounds();return [w,pw,blob.driftInitialized]; }), [100,600,true]);
  await page.evaluate(() => { blob.pauseDrift();blob.style.width = '150px';document.querySelector('#inner').style.width = '450px';blob.playDrift(); });
  await settle(page);
  assert.deepEqual(await page.evaluate(() => { const {w,pw} = blob.driftBounds();return [w,pw]; }), [150,450]);
  await page.evaluate(() => { const host = document.createElement('div');document.body.append(host);const root = host.attachShadow({mode:'open'});root.innerHTML = '<section style="position:relative;width:300px;height:200px"></section>';root.querySelector('section').append(blob); });
  await settle(page);
  assert.equal(await page.evaluate(() => blob.driftBounds().pw), 300);
  await page.evaluate(() => { blob.remove();reads.length=0;for(let i=0;i<60;i++)frame(); });
  assert.deepEqual(await page.evaluate(() => [queue.size, reads.length]), [0,0]);
});
