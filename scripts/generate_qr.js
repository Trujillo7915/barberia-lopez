// generate_qr.js
// Generates a QR code image with two titles for Barbería López.
// Uses lightweight libraries: qrcode (for QR generation) and pureimage (for image composition).

const QRCode = require('qrcode');
const PImage = require('pureimage');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = 'https://barberia-lopez.onrender.com/';
  // Generate QR code buffer (PNG) with a decent size.
  const qrBuffer = await QRCode.toBuffer(url, { width: 400, margin: 1 });
  const { Readable } = require('stream');
  const qrStream = Readable.from(qrBuffer);
  const qrImg = await PImage.decodePNGFromStream(qrStream);

  // Load a system font for drawing text. Adjust path if needed on other OS.
  const fontPath = 'C:/Windows/Fonts/arial.ttf';
  const font = PImage.registerFont(fontPath, 'Arial');
  await font.load();

  const title1 = 'AGENDA TU CITA CON NOSOTROS';
  const title2 = 'Escanea y agenda';

  // Determine canvas dimensions.
  const canvasWidth = Math.max(qrImg.width, 600);
  const titleSectionHeight = 80; // 2 titles * 40px each + spacing
  const padding = 20;
  const canvasHeight = titleSectionHeight * 2 + padding + qrImg.height + padding;

  const img = PImage.make(canvasWidth, canvasHeight);
  const ctx = img.getContext('2d');

  // Background using page palette (haze)
  ctx.fillStyle = '#f5f5f5'; // --color-haze
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);


  // Text style
  ctx.fillStyle = '#1b1b1b'; // --color-ink
  ctx.font = '30px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title1, canvasWidth / 2, titleSectionHeight);
  ctx.fillText(title2, canvasWidth / 2, titleSectionHeight * 2);

  // Draw QR centered below titles.
  const qrX = (canvasWidth - qrImg.width) / 2;
  const qrY = titleSectionHeight * 2 + padding;
  ctx.drawImage(qrImg, qrX, qrY, qrImg.width, qrImg.height);

  // Ensure output directory exists.
  const outputDir = path.resolve(__dirname, '..', 'public');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outPath = path.join(outputDir, 'qr_agenda.png');

  await PImage.encodePNGToStream(img, fs.createWriteStream(outPath));
  console.log('QR image generated at', outPath);
})();
