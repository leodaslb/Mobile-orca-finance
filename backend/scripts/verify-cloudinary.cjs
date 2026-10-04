// Integração externa opcional. Não usa Neon nem cria usuário/transação.
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const keys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missing = keys.filter(key => !process.env[key]?.trim());
if (missing.length) {
  console.log(`SKIP: configure ${missing.join(', ')} para executar o teste Cloudinary opcional.`);
} else {
  const { CloudinaryStorageService } = require('../dist/modules/transactions/cloudinary-storage.service');
  const { validateReceiptUpload } = require('../dist/modules/transactions/receipt-upload');
  const storage = new CloudinaryStorageService();
  (async () => {
    for (const [name, mimeType] of [['receipt.jpg', 'image/jpeg'], ['receipt.png', 'image/png']]) {
      const file = { buffer: fs.readFileSync(path.join(__dirname, '../test/fixtures', name)), mimeType };
      validateReceiptUpload(file);
      let receipt;
      try {
        receipt = await storage.uploadReceipt(file);
        if (!receipt.publicId.startsWith('orca-finance/receipts/') || new URL(receipt.secureUrl).protocol !== 'https:') throw new Error('Invalid result');
        const download = await fetch(receipt.secureUrl, { signal: AbortSignal.timeout(30000) });
        if (!download.ok || !download.headers.get('content-type')?.startsWith(mimeType)) throw new Error('Invalid download');
        validateReceiptUpload({ buffer: Buffer.from(await download.arrayBuffer()), mimeType });
        console.log(`PASS: upload físico e leitura HTTPS ${mimeType}.`);
      } finally {
        if (receipt) { await storage.removeReceipt(receipt.publicId); console.log('PASS: arquivo de teste removido do Cloudinary.'); }
      }
    }
  })().catch(() => { console.error('FAIL: integração Cloudinary opcional. Confira a configuração e eventuais arquivos de teste; detalhes internos foram omitidos.'); process.exitCode = 1; });
}
