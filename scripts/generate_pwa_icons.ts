import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });

// SVG Icon definition
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="60%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#d946ef"/>
    </linearGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" rx="128" fill="url(#bg)"/>
  
  <!-- Outer glowing ring border -->
  <rect x="16" y="16" width="480" height="480" rx="112" fill="none" stroke="url(#glow)" stroke-width="6" opacity="0.4"/>

  <!-- Glowing focal orb -->
  <circle cx="256" cy="256" r="140" fill="url(#glow)" opacity="0.15" filter="url(#blur)"/>

  <!-- Main Enhancement Star / Sparkle Icon -->
  <g transform="translate(256, 256)" filter="url(#blur)">
    <!-- Primary 4-pointed sparkle -->
    <path d="M 0,-150 Q 0,-30 150,0 Q 0,30 0,150 Q 0,30 -150,0 Q 0,-30 0,-150 Z" fill="url(#glow)"/>
    <!-- Central core bright highlight -->
    <circle cx="0" cy="0" r="28" fill="#ffffff"/>
    
    <!-- Secondary small sparkle top-right -->
    <g transform="translate(130, -110) scale(0.35)">
      <path d="M 0,-120 Q 0,-20 120,0 Q 0,20 0,120 Q 0,20 -120,0 Q 0,-20 0,-120 Z" fill="#38bdf8"/>
      <circle cx="0" cy="0" r="20" fill="#ffffff"/>
    </g>

    <!-- Secondary small sparkle bottom-left -->
    <g transform="translate(-120, 110) scale(0.28)">
      <path d="M 0,-120 Q 0,-20 120,0 Q 0,20 0,120 Q 0,20 -120,0 Q 0,-20 0,-120 Z" fill="#e879f9"/>
      <circle cx="0" cy="0" r="20" fill="#ffffff"/>
    </g>
  </g>
</svg>
`;

const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="60%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#d946ef"/>
    </linearGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Full-bleed background for maskable cropping -->
  <rect width="512" height="512" fill="url(#bg)"/>

  <!-- Centered safe-zone iconography (80% circle) -->
  <g transform="translate(256, 256) scale(0.72)">
    <circle cx="0" cy="0" r="160" fill="url(#glow)" opacity="0.15" filter="url(#blur)"/>
    <path d="M 0,-150 Q 0,-30 150,0 Q 0,30 0,150 Q 0,30 -150,0 Q 0,-30 0,-150 Z" fill="url(#glow)"/>
    <circle cx="0" cy="0" r="28" fill="#ffffff"/>

    <g transform="translate(130, -110) scale(0.35)">
      <path d="M 0,-120 Q 0,-20 120,0 Q 0,20 0,120 Q 0,20 -120,0 Q 0,-20 0,-120 Z" fill="#38bdf8"/>
      <circle cx="0" cy="0" r="20" fill="#ffffff"/>
    </g>
  </g>
</svg>
`;

async function main() {
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon.trim());

  const svgBuf = Buffer.from(svgIcon);
  const maskableBuf = Buffer.from(maskableSvg);

  // 192x192 PNG
  await sharp(svgBuf).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Created pwa-192x192.png');

  // 512x512 PNG
  await sharp(svgBuf).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Created pwa-512x512.png');

  // 512x512 Maskable PNG
  await sharp(maskableBuf).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Created pwa-maskable-512x512.png');

  // 180x180 Apple Touch Icon
  await sharp(svgBuf).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // 32x32 Favicon PNG
  await sharp(svgBuf).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.png'));
  console.log('Created favicon.png');
}

main().catch(console.error);
