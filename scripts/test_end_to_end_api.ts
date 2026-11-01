import fs from 'fs';
import path from 'path';

async function testApiEnhance() {
  const filePath = path.resolve('data/test_patches/actual_face_500.png');
  const fileBuf = fs.readFileSync(filePath);

  const form = new FormData();
  form.append('image', new Blob([fileBuf], { type: 'image/png' }), 'actual_face_500.png');
  form.append('scale', '4');
  form.append('engine', 'realesrgan-x4plus');
  form.append('faceRestore', 'true');
  form.append('deblur', 'true');
  form.append('denoise', 'false');

  console.log('Posting to http://localhost:3000/api/enhance/image...');
  const t0 = Date.now();
  const resp = await fetch('http://localhost:3000/api/enhance/image', {
    method: 'POST',
    body: form,
  });

  console.log('Status:', resp.status, resp.statusText);
  const result = await resp.json();
  console.log('Result:', JSON.stringify(result, null, 2));
  console.log(`Finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

testApiEnhance().catch(console.error);
