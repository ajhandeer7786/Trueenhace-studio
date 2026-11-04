# Genuine AI Face Restoration (MagicHour Quality) Implementation Plan

## Executive Summary
This plan outlines the architecture for integrating genuine pretrained deep-learning face restoration (**GFPGAN v1.4** and **CodeFormer**) into TrueEnhance AI Studio. It replaces the temporary `sharp` edge-sharpening workaround with genuine generative facial prior restoration, while preserving Real-ESRGAN for general image/video background upscaling, optimizing execution speed, maintaining strict repository size limits (< 250 MB), and safeguarding facial identity.

---

## 1. Current State vs. Target State

| Aspect | Current State | Target State (MagicHour Quality) |
| :--- | :--- | :--- |
| **Face Restoration** | Sharpness filter + Lanczos3 resize in `sharp` | Genuine **GFPGAN v1.4** / **CodeFormer** 512x512 neural inference |
| **Face Detection & Alignment** | Whole image or heuristic crop | Automated face detection + affine 512x512 alignment + inverse blend |
| **Identity Preservation** | Only sharpening thresholds | Dynamic fidelity control ($w \in [0.1, 0.9]$) to blend prior vs. original features |
| **Model Weight Storage** | Local `models/` folder (limited by 250MB build limit) | Dynamic runtime caching in `/tmp/models/` + optional Remote GPU worker |
| **Inference Time** | Fast but non-AI for faces | Optimized ONNX Runtime (tiled & face-cropped) + Remote CUDA GPU bridge |
| **Fallback Behavior** | Silently falls back to Sharp | Explicit status reporting; no fake progress or fake AI claims |

---

## 2. Technical Architecture & Component Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Upload / Input Image                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         Is Face Restore Enabled?
                                    ├──────────────────────────┐
                                   YES                         NO
                                    │                          │
                 ┌──────────────────┴──────────────────┐       │
                 │   Face Detection & Crop (YuNet)     │       │
                 │  - Detect bounding box & landmarks  │       │
                 │  - Affine warp to 512×512 aligned   │       │
                 └──────────────────┬──────────────────┘       │
                                    │                          │
                 ┌──────────────────┴──────────────────┐       │
                 │   Inference Engine Selection        │       │
                 │   - Local ONNX (CPU /tmp cache)     │       │
                 │   - OR Remote GPU Worker (CUDA)     │       │
                 └──────────────────┬──────────────────┘       │
                                    │                          │
                 ┌──────────────────┴──────────────────┐       │
                 │   GFPGAN v1.4 / CodeFormer Core     │       │
                 │  - Generative Facial Prior repair   │       │
                 │  - Fidelity control (w = 0.5-0.7)   │       │
                 └──────────────────┬──────────────────┘       │
                                    │                          │
                 ┌──────────────────┴──────────────────┐       │
                 │   Inverse Affine & Feather Blend    │       │
                 │  - Seamless Poisson / soft mask     │       │
                 │  - Preserves natural skin & pores   │       │
                 └──────────────────┬──────────────────┘       │
                                    │                          │
                                    ▼                          ▼
                 ┌─────────────────────────────────────────────────────┐
                 │       Real-ESRGAN x4plus / Compact Pipeline         │
                 │  - General scene & background super-resolution      │
                 └──────────────────────────┬──────────────────────────┘
                                            │
                                            ▼
                 ┌─────────────────────────────────────────────────────┐
                 │          MozJPEG (92%) / Lossless PNG Output        │
                 └─────────────────────────────────────────────────────┘
```

---

## 3. Required Pretrained Model Files & Size Management

To comply with the AI Studio **< 250 MB total build size limit** and avoid quota failures, heavy neural weights must **not** be checked directly into the git repository root.

1. **Face Restoration Model**:
   - Model: **GFPGANv1.4.onnx** (approx. 332 MB) or **CodeFormer.onnx** (approx. 360 MB).
   - Storage Strategy: Downloaded on-demand into `/tmp/models/` at runtime upon first user request with an in-app download progress indicator, OR executed via the external GPU worker.
2. **Face Detection Model**:
   - Model: **YuNet ONNX** (lightweight, ~340 KB) or OpenCV DNN Haar/SSD for instant face localization and 5-point landmark extraction.
3. **General Super-Resolution**:
   - Existing **realesrgan_x4.onnx** (compact 4.8MB) + **real_esrgan_x4plus.onnx** (RRDBNet) preserved in `models/`.

---

## 4. Hosting & Hardware Acceleration Requirements

1. **Option A: Local Container (ONNX Runtime Node on CPU)**
   - Runtime: `onnxruntime-node` with CPU execution provider, intra-op threads set to `os.cpus().length`.
   - Optimization: Only the cropped 512x512 face region is fed to the face restoration model (not the whole image), reducing computation time from minutes to ~2.5 - 4.5 seconds per face.
2. **Option B: Remote GPU Server (CUDA Acceleration)**
   - Script: `scripts/gpu_worker.py` (FastAPI).
   - Hardware: NVIDIA T4, RTX 3060/4090, or A10G (e.g., via RunPod, Modal, or local workstation).
   - Execution time: ~150 - 350 ms per face.

---

## 5. Exact Files Requiring Modification

1. `src/server/faceRestorationEngine.ts` **(NEW FILE)**:
   - Implements face detection, alignment, ONNX inference session management, inverse warping, and soft feather blending.
2. `server.ts`:
   - Update `/api/enhance/image` to route through `faceRestorationEngine` when `faceRestore === true`.
   - Add model verification and download status endpoints (`/api/models/face-status`).
   - Remove the `options.engine === 'portrait-restorer'` sharpening mock.
3. `src/types/index.ts`:
   - Add `faceFidelity` (0–100%) and face model selection fields to `ImageEnhanceOptions` and `ProcessingJob`.
4. `src/pages/ImageEnhancerPage.tsx`:
   - Add "Face Restoration Fidelity" slider (balancing restoration vs original facial likeness).
   - Add model choice dropdown (GFPGAN v1.4, CodeFormer, Auto).
   - Show real model badge in the result diagnostics panel.
5. `src/pages/SettingsPage.tsx`:
   - Add Face Model status card with download / cache status in `/tmp/models/`.
6. `scripts/gpu_worker.py`:
   - Add GFPGAN/CodeFormer endpoints to the standalone GPU worker.

---

## 6. Verification Steps (Post-Approval)
1. Verify model downloads cleanly to `/tmp/models/` without exceeding the repository quota.
2. Test alignment and inverse affine blending with portrait images (including `Girl1_255s.jpg`) to ensure zero distortion, eye clarity, and natural skin preservation.
3. Verify video enhancement and standard Real-ESRGAN workflows remain 100% operational.
4. Execute `lint_applet` and `compile_applet` to ensure type safety.
