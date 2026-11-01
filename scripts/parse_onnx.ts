import fs from 'fs';
import path from 'path';

const buf = fs.readFileSync(path.resolve(process.cwd(), 'models/realesrgan_x4.onnx'));
console.log('ONNX file size:', buf.length);

// Extract printable strings of length >= 4
const asciiStrings: string[] = [];
let current = '';
for (let i = 0; i < buf.length; i++) {
  const byte = buf[i];
  if (byte >= 32 && byte <= 126) {
    current += String.fromCharCode(byte);
  } else {
    if (current.length >= 4) {
      asciiStrings.push(current);
    }
    current = '';
  }
}

console.log('Total strings extracted:', asciiStrings.length);
console.log('Sample strings:', asciiStrings.slice(0, 50));

// Find keywords like Conv, Relu, LeakyRelu, Resize, PRelu, Shuffle, Upsample, etc.
const opTypes = ['Conv', 'Relu', 'LeakyRelu', 'PRelu', 'Resize', 'Add', 'Sub', 'Mul', 'Div', 'Concat', 'Transpose', 'BatchNormalization', 'InstanceNormalization', 'Clip', 'Sigmoid', 'PixelShuffle', 'DepthToSpace'];
const matchedOps = asciiStrings.filter(s => opTypes.includes(s));
console.log('Matched OpTypes:', matchedOps);

// Check producer, doc_string, model version
console.log('Last 20 strings:', asciiStrings.slice(-20));
