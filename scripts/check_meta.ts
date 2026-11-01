import path from 'path';
import * as ort from 'onnxruntime-node';

async function checkMetadata() {
  const modelPath = path.resolve(process.cwd(), 'models/realesrgan_x4.onnx');
  const session = await ort.InferenceSession.create(modelPath);
  
  // In onnxruntime-node, let's inspect session properties
  console.log('Session keys:', Object.keys(session));
  console.log('Input names:', session.inputNames);
  console.log('Output names:', session.outputNames);
  
  // Let's check session metadata
  // session may have custom metadata props
  const meta = (session as any).metadata;
  console.log('Metadata:', meta);
  if (meta) {
    console.log('Custom metadata map:', meta.customMetadataMap);
    console.log('Description:', meta.description);
  }
}

checkMetadata().catch(console.error);
