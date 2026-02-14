import WebSocket from 'ws';
import fs from 'fs';
import http from 'http';
import path from 'path';

const outputDir = path.join(process.env.HOME, 'repos/optics');

// Get the page's WebSocket URL
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
      const timeout = setTimeout(() => {
        delete this.callbacks[id];
        reject(new Error(`Timeout for ${method}`));
      }, 10000);
      this.callbacks[id] = (msg) => {
        clearTimeout(timeout);
        resolve(msg);
      };
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async screenshot(filename) {
    const result = await this.send('Page.captureScreenshot', {
      format: 'png',
      quality: 80,
    });
    if (result.result && result.result.data) {
      fs.writeFileSync(filename, Buffer.from(result.result.data, 'base64'));
      return true;
    }
    return false;
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    return result.result?.result?.value;
  }
  
  clearConsole() {
    this.consoleMessages = [];
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const wsUrl = await getPageWsUrl();
  console.log('Connecting to:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.on('open', resolve));
  
  const cdp = new CDPClient(ws);
  
  // Enable required domains
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  
  // Set viewport to 1024x768
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false
  });
  
  // Navigate to the optics page
  await cdp.send('Page.navigate', { url: 'https://sit-dia.github.io/optics/' });
  await sleep(3000);
  
  console.log('Page loaded. Starting tests...\n');

  const testPositions = [
    { f: 40, do_val: 43, desc: 'Near focal point, large magnification' },
    { f: 40, do_val: 38, desc: 'Virtual image, object inside focal length' },
    { f: 50, do_val: 100, desc: 'Normal projector mode' },
    { f: 80, do_val: 100, desc: 'Moderate magnification' },
    { f: 100, do_val: 90, desc: 'Virtual image, object inside focal length' },
    { f: 10, do_val: 100, desc: 'Small focal length, small image' },
    { f: 10, do_val: 8, desc: 'Very small, virtual image' },
    { f: 50, do_val: 51, desc: 'Just past focal, huge magnification' },
    { f: 50, do_val: 49, desc: 'Just inside focal, huge virtual image' },
    { f: 100, do_val: 200, desc: '1:1 magnification at 2f' },
  ];

  const results = [];

  for (let i = 0; i < testPositions.length; i++) {
    const { f, do_val, desc } = testPositions[i];
    const testNum = i + 1;
    console.log(`\n=== Test ${testNum}: f=${f}, do=${do_val} (${desc}) ===`);
    
    cdp.clearConsole();
    
    // Set slider values via JavaScript
    const setResult = await cdp.evaluate(`
      (function() {
        const fSlider = document.getElementById('thin-lens-f');
        const doSlider = document.getElementById('thin-lens-do');
        if (!fSlider || !doSlider) return 'SLIDERS_NOT_FOUND';
        
        fSlider.value = '${f}';
        fSlider.dispatchEvent(new Event('input', { bubbles: true }));
        
        doSlider.value = '${do_val}';
        doSlider.dispatchEvent(new Event('input', { bubbles: true }));
        
        return 'OK';
      })()
    `);
    
    if (setResult !== 'OK') {
      console.log('  ERROR: Could not set sliders: ' + setResult);
      results.push({ testNum, f, do_val, desc, status: 'ERROR', notes: 'Sliders not found' });
      continue;
    }
    
    await sleep(500);
    
    // Get readout values
    const readouts = await cdp.evaluate(`
      (function() {
        const readoutEls = document.querySelectorAll('.readout-value');
        const readoutLabels = document.querySelectorAll('.readout-label');
        const data = {};
        readoutEls.forEach((el, i) => {
          const label = readoutLabels[i]?.textContent?.trim() || 'unknown' + i;
          data[label] = el.textContent?.trim();
        });
        return JSON.stringify(data);
      })()
    `);
    const readoutData = JSON.parse(readouts || '{}');
    console.log('  Readouts:', JSON.stringify(readoutData));
    
    // Analyze canvas content for edge glow
    const canvasInfo = await cdp.evaluate(`
      (function() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return JSON.stringify({ error: 'No canvas found' });
        
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        
        function checkEdgeGlow(side) {
          let redPixels = 0;
          let totalPixels = 0;
          const sampleSize = 20;
          
          if (side === 'left') {
            for (let y = 0; y < h; y += 10) {
              for (let x = 0; x < sampleSize; x += 5) {
                const data = ctx.getImageData(x, y, 1, 1).data;
                totalPixels++;
                if (data[0] > 180 && data[1] < 120 && data[2] < 120 && data[3] > 30) {
                  redPixels++;
                }
              }
            }
          } else if (side === 'right') {
            for (let y = 0; y < h; y += 10) {
              for (let x = w - sampleSize; x < w; x += 5) {
                const data = ctx.getImageData(x, y, 1, 1).data;
                totalPixels++;
                if (data[0] > 180 && data[1] < 120 && data[2] < 120 && data[3] > 30) {
                  redPixels++;
                }
              }
            }
          }
          return { redPixels, totalPixels, ratio: totalPixels > 0 ? redPixels/totalPixels : 0, hasGlow: redPixels > totalPixels * 0.03 };
        }
        
        const leftGlow = checkEdgeGlow('left');
        const rightGlow = checkEdgeGlow('right');
        
        return JSON.stringify({ canvasWidth: w, canvasHeight: h, leftGlow, rightGlow });
      })()
    `);
    
    const canvasData = JSON.parse(canvasInfo || '{}');
    console.log('  Canvas: ' + canvasData.canvasWidth + 'x' + canvasData.canvasHeight);
    console.log('  Left glow: ' + (canvasData.leftGlow?.hasGlow ? 'YES' : 'no') + ' (' + canvasData.leftGlow?.redPixels + '/' + canvasData.leftGlow?.totalPixels + ', ratio=' + (canvasData.leftGlow?.ratio || 0).toFixed(3) + ')');
    console.log('  Right glow: ' + (canvasData.rightGlow?.hasGlow ? 'YES' : 'no') + ' (' + canvasData.rightGlow?.redPixels + '/' + canvasData.rightGlow?.totalPixels + ', ratio=' + (canvasData.rightGlow?.ratio || 0).toFixed(3) + ')');
    
    // Take screenshot
    const screenshotPath = path.join(outputDir, 'test-screenshot-' + testNum + '.png');
    await cdp.screenshot(screenshotPath);
    console.log('  Screenshot: ' + screenshotPath);
    
    // Check console errors
    const consoleErrors = cdp.consoleMessages.filter(m => m.type === 'error');
    console.log('  Console errors: ' + consoleErrors.length);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(e => console.log('    - ' + (e.text || JSON.stringify(e.args?.map(a => a.value || a.description)))));
    }
    
    // Compute expected behavior
    const diCalc = (f * do_val) / (do_val - f);
    const magCalc = -diCalc / do_val;
    const isVirtual = do_val < f;
    const nearInfThreshold = Math.max(3, f * 0.05);
    const isInfinity = Math.abs(do_val - f) < nearInfThreshold;
    const expectedRegime = isInfinity ? 'At focal point' : isVirtual ? 'HMD (virtual image)' : 'Projector (real image)';
    
    // Viewport bounds
    const eyeWorldX = isVirtual ? Math.max(80, f * 0.6) : 60;
    const anchorMinX = -do_val - 40;
    const anchorMaxX = Math.max(eyeWorldX + 40, f + 20);
    let effectiveMinX = Math.min(anchorMinX, -f - 10);
    let effectiveMaxX = Math.max(anchorMaxX, f + 10);
    
    // Add padding (same as code)
    const worldW = effectiveMaxX - effectiveMinX;
    effectiveMinX -= worldW * 0.08;
    effectiveMaxX += worldW * 0.08;
    
    const shouldHaveLeftGlow = isVirtual && !isInfinity && diCalc < effectiveMinX;
    const shouldHaveRightGlow = !isVirtual && !isInfinity && diCalc > effectiveMaxX;
    
    console.log('  Expected: di=' + (isInfinity ? 'inf' : diCalc.toFixed(1)) + ', mag=' + magCalc.toFixed(2) + ', regime=' + expectedRegime);
    console.log('  Viewport: [' + effectiveMinX.toFixed(0) + ', ' + effectiveMaxX.toFixed(0) + ']');
    console.log('  Expected glow: left=' + shouldHaveLeftGlow + ', right=' + shouldHaveRightGlow);
    
    let glowCorrect = true;
    let glowNotes = '';
    if (shouldHaveRightGlow && !canvasData.rightGlow?.hasGlow) {
      glowCorrect = false;
      glowNotes += 'Missing right edge glow for off-screen real image. ';
    }
    if (shouldHaveLeftGlow && !canvasData.leftGlow?.hasGlow) {
      glowCorrect = false;
      glowNotes += 'Missing left edge glow for off-screen virtual image. ';
    }
    
    const status = consoleErrors.length > 0 ? 'ERROR' : (glowCorrect ? 'PASS' : 'ISSUE');
    
    results.push({
      testNum, f, do_val, desc, status,
      readouts: readoutData,
      glowCorrect, glowNotes,
      expectedRegime, shouldHaveLeftGlow, shouldHaveRightGlow,
      diCalc: isInfinity ? Infinity : diCalc,
      consoleErrors: consoleErrors.length,
      screenshotPath
    });
    
    console.log('  STATUS: ' + status + (glowNotes ? ' - ' + glowNotes : ''));
  }
  
  // Summary
  console.log('\n\n========== SUMMARY ==========');
  const passed = results.filter(r => r.status === 'PASS');
  const issues = results.filter(r => r.status === 'ISSUE');
  const errs = results.filter(r => r.status === 'ERROR');
  
  console.log('\nPASS: ' + passed.length + '/10');
  passed.forEach(r => console.log('  Test ' + r.testNum + ': f=' + r.f + ', do=' + r.do_val + ' - ' + r.desc));
  
  if (issues.length > 0) {
    console.log('\nISSUES: ' + issues.length + '/10');
    issues.forEach(r => console.log('  Test ' + r.testNum + ': f=' + r.f + ', do=' + r.do_val + ' - ' + r.glowNotes));
  }
  
  if (errs.length > 0) {
    console.log('\nERRORS: ' + errs.length + '/10');
    errs.forEach(r => console.log('  Test ' + r.testNum + ': f=' + r.f + ', do=' + r.do_val + ' - ' + (r.notes || 'Console errors')));
  }
  
  console.log('\nOverall: ' + (issues.length === 0 && errs.length === 0 ? 'PASS' : 'NEEDS_FIXES'));
  
  ws.close();
}

main().catch(e => { console.error(e); process.exit(1); });
