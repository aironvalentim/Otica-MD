const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { ah, HttpError } = require('../util');
const { exigir } = require('../auth');

const TIPOS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(TIPOS[file.mimetype] ? null : new HttpError(400, 'Envie imagens JPG, PNG ou WEBP'), !!TIPOS[file.mimetype]),
});

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}
const BUCKET = process.env.SUPABASE_BUCKET || 'produtos';
const PASTA_LOCAL = path.join(__dirname, '..', '..', 'uploads');

router.post(
  '/',
  exigir('produtos.editar'),
  upload.array('arquivos', 10),
  ah(async (req, res) => {
    if (!req.files?.length) throw new HttpError(400, 'Nenhum arquivo enviado');
    const urls = [];
    for (const file of req.files) {
      const nome = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${TIPOS[file.mimetype]}`;
      if (supabase) {
        const { error } = await supabase.storage.from(BUCKET).upload(nome, file.buffer, { contentType: file.mimetype, upsert: false });
        if (error) throw new HttpError(502, `Falha ao enviar para o Storage: ${error.message}`);
        urls.push(supabase.storage.from(BUCKET).getPublicUrl(nome).data.publicUrl);
      } else {
        fs.mkdirSync(PASTA_LOCAL, { recursive: true });
        fs.writeFileSync(path.join(PASTA_LOCAL, nome), file.buffer);
        urls.push(`${req.protocol}://${req.get('host')}/uploads/${nome}`);
      }
    }
    res.status(201).json({ urls });
  })
);

module.exports = router;
