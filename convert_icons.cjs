const sharp = require('sharp');
const fs = require('fs');

async function convert() {
  await sharp('public/icons/icon-192.webp').toFile('public/icons/icon-192.png');
  await sharp('public/icons/icon-512.webp').toFile('public/icons/icon-512.png');
  // Create maskable icon
  await sharp('public/icons/icon-512.webp')
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 45, b: 107, alpha: 1 } })
    .toFile('public/icons/maskable-icon-512.png');
  console.log('Conversion done.');
}

convert();
