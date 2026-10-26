// Shopee iPhone Duo stock check — opens the page in real Chromium (Playwright),
// reads what a visitor sees, saves a screenshot, and reports status to the workflow.
import { chromium } from 'playwright';
import { appendFileSync } from 'node:fs';

const URL   = 'https://shopee.co.th/product/989284521/45567695488';
const COLOR = 'Star White';
const CAP   = '512GB';

function out(k, v) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
  console.log(`${k}=${v}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  locale: 'th-TH',
  timezoneId: 'Asia/Bangkok',
  viewport: { width: 1366, height: 900 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
});

let status = 'unknown';
let note = '';
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);                       // let Shopee's JS load price/stock

  const text = await page.locator('body').innerText();
  const hasProduct = text.includes('iPhone Duo');
  const soldOut    = text.includes('สินค้าหมด');
  const canBuy     = /ซื้อสินค้า|ซื้อเลย|เพิ่มไปยังรถเข็น/.test(text);

  // Try selecting Star White, then see whether 512GB is still selectable.
  let variant = 'not checked';
  try {
    const c = page.locator(`button[aria-label="${COLOR}"]`).first();
    if (await c.count()) {
      if (!(await c.isDisabled())) await c.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      const s = page.locator(`button[aria-label="${CAP}"]`).first();
      if (await s.count()) variant = (await s.isDisabled()) ? 'disabled (sold out)' : 'selectable';
    }
  } catch (e) { variant = 'error: ' + e.message.split('\n')[0]; }

  note = `title:${hasProduct} soldOutLabel:${soldOut} buyButton:${canBuy} ${CAP}-after-${COLOR}:${variant}`;

  if (!hasProduct)                          status = 'blocked';   // login/captcha/blank page
  else if (variant === 'selectable')        status = 'in_stock';
  else if (variant.startsWith('disabled'))  status = 'out';
  else if (soldOut)                         status = 'out';
  else if (canBuy)                          status = 'in_stock';
} catch (e) {
  note = 'error: ' + e.message.split('\n')[0];
}

await page.screenshot({ path: 'shot.png', fullPage: false }).catch(() => {});
await browser.close();

if (process.env.FORCE_TEST === 'true') { status = 'in_stock'; note = 'TEST RUN — ' + note; }
out('status', status);
out('note', note.replace(/\n/g, ' '));
