import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const dir = path.join(process.cwd(), 'public', 'images');

async function optimizeImages() {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.jpg')) {
      const filePath = path.join(dir, file);
      const parsed = path.parse(filePath);
      const outPath = path.join(dir, `${parsed.name}.webp`);
      
      console.log(`Optimizing ${file}...`);
      await sharp(filePath)
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outPath);
    }
  }
  console.log('Done!');
}

optimizeImages().catch(console.error);
