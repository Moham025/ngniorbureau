/**
 * Rendu HTML -> PDF via puppeteer-core.
 * En local : Chrome installé. Sur Vercel/Lambda : @sparticuz/chromium.
 */

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

export async function htmlToPdf(html: string): Promise<Uint8Array> {
  const puppeteer = await import('puppeteer-core')

  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME
  let executablePath = CHROME_PATH
  let launchArgs: string[] = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ]
  if (isServerless) {
    const chromium = (await import('@sparticuz/chromium')).default
    executablePath = await chromium.executablePath()
    launchArgs = chromium.args
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: launchArgs,
  })
  try {
    const page = await browser.newPage()
    // 'load' suffit : toutes les images sont inline en base64
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    })
    return pdf
  } finally {
    await browser.close()
  }
}

/** Nombre -> lettres (français), pour les montants sur les reçus */
export function numToWordsFr(n: number): string {
  if (n === 0) return 'zéro'
  const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
  const tensArr = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']
  function lt1000(x: number): string {
    if (x === 0) return ''
    if (x < 20) return ones[x]
    if (x < 100) {
      const t = Math.floor(x / 10), u = x % 10
      if (t === 7) return 'soixante-' + ones[10 + u]
      if (t === 8) return 'quatre-vingt' + (u === 0 ? '' : '-' + ones[u])
      if (t === 9) return 'quatre-vingt-' + ones[10 + u]
      return tensArr[t] + (u === 0 ? '' : (u === 1 ? '-et-un' : '-' + ones[u]))
    }
    const h = Math.floor(x / 100), r = x % 100
    return (h === 1 ? '' : ones[h] + '-') + 'cent' + (r === 0 && h > 1 ? 's' : '') + (r === 0 ? '' : '-' + lt1000(r))
  }
  let r = '', x = Math.round(n)
  if (x >= 1000000) { const m = Math.floor(x / 1000000); r += lt1000(m) + ' million' + (m > 1 ? 's' : '') + ' '; x %= 1000000 }
  if (x >= 1000) { const k = Math.floor(x / 1000); r += (k === 1 ? '' : lt1000(k) + '-') + 'mille '; x %= 1000 }
  r += lt1000(x)
  return r.trim()
}
