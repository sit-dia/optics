import WebSocket from 'ws';
import fs from 'fs';
import http from 'http';
import path from 'path';

const outputDir = path.join(process.env.HOME, 'repos/optics');

async function getPageWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const pages = JSON.parse(data);
        const optics = pages.find(p => p.url.includes('optics') || p.title.includes('Optics'));
        if (optics) resolve(optics.webSocketDebuggerUrl);
        else reject(new Error('Optics page not found'));
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = {};
    this.consoleMessages = [];
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.callbacks[msg.id]) {
        this.callbacks[msg.id](msg);
        delete this.callbacks[msg.id];
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        this.consoleMessages.push(msg.params);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        this.consoleMessages.push({ type: 'error', text: JSON.stringify(msg.params) });
      }
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      const timeout = setTimeout(() => { delete this.callbacks[id]; reject(new Error('Timeout')); }, 10000);
      this.callbacks[id] = (msg) => { clearTimeout(timeout); resolve(msg); };
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return result.result?.result?.value;
  }
  clearConsole() { this.consoleMessages = []; }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const wsUrl = await getPageWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.on('open', resolve));
  const cdp = new CDPClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Quick sweep: move focal length slider from 10 to 200 in steps of 10 at do=100
  // Check for any console errors/exceptions
  console.log('=== Sweep Test: f from 10 to 200, do=100 ===');
  let totalErrors = 0;
  
  for (let f = 10; f <= 200; f += 10) {
    cdp.clearConsole();
    await cdp.evaluate(`
      (function() {
        const fSlider = document.getElementById('thin-lens-f');
        const doSlider = document.getElementById('thin-lens-do');
        fSlider.value = '${f}'; fSlider.dispatchEvent(new Event('input', { bubbles: true }));
        doSlider.value = '100'; doSlider.dispatchEvent(new Event('input', { bubbles: true }));
        return 'OK';
      })()
    `);
    await sleep(200);
    const errors = cdp.consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      console.log('  f=' + f + ': ' + errors.length + ' console errors!');
      totalErrors += errors.length;
    }
  }
  console.log('Sweep complete. Total errors: ' + totalErrors);
  
  // Sweep do from 5 to 500 at f=50
  console.log('\n=== Sweep Test: do from 5 to 500, f=50 ===');
  for (let d = 5; d <= 500; d += 5) {
    cdp.clearConsole();
    await cdp.evaluate(`
      (function() {
        const fSlider = document.getElementById('thin-lens-f');
        const doSlider = document.getElementById('thin-lens-do');
        fSlider.value = '50'; fSlider.dispatchEvent(new Event('input', { bubbles: true }));
        doSlider.value = '${d}'; doSlider.dispatchEvent(new Event('input', { bubbles: true }));
        return 'OK';
      })()
    `);
    await sleep(100);
    const errors = cdp.consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      console.log('  do=' + d + ': ' + errors.length + ' console errors!');
      totalErrors += errors.length;
    }
  }
  console.log('Sweep complete. Total errors: ' + totalErrors);
  
  // Test viewport stability: rapidly alternate between extreme values
  console.log('\n=== Rapid Toggle Stability Test ===');
  const extremes = [
    { f: 10, d: 500 },
    { f: 200, d: 5 },
    { f: 10, d: 11 },
    { f: 200, d: 199 },
    { f: 100, d: 100 },
    { f: 50, d: 50 },
  ];
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const { f, d } of extremes) {
      cdp.clearConsole();
      await cdp.evaluate(`
        (function() {
          const fSlider = document.getElementById('thin-lens-f');
          const doSlider = document.getElementById('thin-lens-do');
          fSlider.value = '${f}'; fSlider.dispatchEvent(new Event('input', { bubbles: true }));
          doSlider.value = '${d}'; doSlider.dispatchEvent(new Event('input', { bubbles: true }));
          return 'OK';
        })()
      `);
      await sleep(50);
      const errors = cdp.consoleMessages.filter(m => m.type === 'error');
      if (errors.length > 0) {
        console.log('  f=' + f + ',do=' + d + ' cycle ' + cycle + ': errors!');
        totalErrors += errors.length;
      }
    }
  }
  console.log('Toggle test complete. Total errors: ' + totalErrors);
  
  console.log('\n=== FINAL: Total console errors across all sweeps: ' + totalErrors + ' ===');
  
  ws.close();
}

main().catch(e => { console.error(e); process.exit(1); });
