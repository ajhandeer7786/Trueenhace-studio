"""
TrueEnhance AI Studio - Standalone Remote GPU Worker
-----------------------------------------------------
Run this script on a machine with a CUDA-enabled GPU (NVIDIA RTX, A100, T4, etc.)
to provide dedicated hardware-accelerated Real-ESRGAN super-resolution to TrueEnhance.

Requirements:
    pip install fastapi uvicorn torch torchvision torchaudio realesrgan pillow

Run command:
    python scripts/gpu_worker.py --port 8000
"""

import io
import argparse
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, Header, HTTPException
from fastapi.responses import Response
from PIL import Image
import torch

try:
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet
    REAL_ESRGAN_AVAILABLE = True
except ImportError:
    REAL_ESRGAN_AVAILABLE = False

app = FastAPI(title="TrueEnhance GPU Inference Service", version="1.0.0")

device = "cuda" if torch.cuda.is_available() else "cpu"
upsampler = None


@app.on_event("startup")
def load_model():
    global upsampler
    print(f"Loading Real-ESRGAN on device: {device}...")
    if REAL_ESRGAN_AVAILABLE and device == "cuda":
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
        upsampler = RealESRGANer(
            scale=4,
            model_path="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
            model=model,
            tile=256,
            tile_pad=10,
            pre_pad=0,
            half=True,
            gpu_id=0,
        )
        print("Real-ESRGAN GPU upsampler initialized.")
    else:
        print("CUDA GPU not detected or Real-ESRGAN library not installed. Running in CPU fallback mode.")


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "device": device,
        "cuda_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "None",
    }


@app.post("/v1/enhance")
async def enhance_image(
    file: UploadFile = File(...),
    scale: int = Form(4),
    face_restore: bool = Form(False),
    face_fidelity: int = Form(70),
    x_api_key: Optional[str] = Header(None),
):
    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")

        if upsampler is not None:
            import numpy as np
            np_img = np.array(image)
            output, _ = upsampler.enhance(np_img, outscale=scale)
            out_img = Image.fromarray(output)
        else:
            # Fallback high-order resampler if model not yet loaded
            out_img = image.resize((image.width * scale, image.height * scale), Image.Resampling.LANCZOS)

        out_buffer = io.BytesIO()
        out_img.save(out_buffer, format="PNG")
        return Response(content=out_buffer.getvalue(), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", type=str, default="0.0.0.0")
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)
