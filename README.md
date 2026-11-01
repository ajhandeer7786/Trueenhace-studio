# TrueEnhance AI Studio

A high-performance full-stack web application for real AI image upscaling, portrait face restoration, and video enhancement powered by Real-ESRGAN neural networks, MozJPEG/Sharp, and FFmpeg 4.4.

---

## 🇵🇰 Roman Urdu Guide (App Run Karne Ka Tareeqa)

### Requirements:
1. **Node.js** (v18 ya v20+)
2. **FFmpeg** (Video enhancement aur audio preservation ke liye)

### Setup Steps:
```bash
# 1. Dependencies install karein:
npm install

# 2. Local development server start karein:
npm run dev
```
Jab server start ho jaye to browser mein **`http://localhost:3000`** open karein.

### Production Build & Run:
```bash
# Production bundle create karein:
npm run build

# Production server start karein:
npm start
```

---

## 🇬🇧 English Guide

### Features:
- **Portrait & Face AI Restorer**: Natural skin-tone preservation, noise suppression, and selective feature refinement without harsh CLAHE/unsharp distortion.
- **Real-ESRGAN x4 Neural Super-Resolution**: High-fidelity detail reconstruction.
- **FFmpeg 4.4 Multi-pass Pipeline**: Video stabilization (`vid.stab`), spatial denoising (`hqdn3d`), sharpening, audio preservation, and H.264 encoding.
- **Download Quality Controls**: Direct compressed MozJPEG (92% quality, ~400-800KB) and lossless PNG exports.
- **Persistent Processing History**: Safe disk management, per-item deletion, and full storage wipe.
- **PWA Mobile-Ready**: Responsive UI optimized for Android Chrome and iOS Safari.

### Project Structure:
- `server.ts`: Express backend handling image processing, FFmpeg video pipeline, and API endpoints.
- `src/App.tsx`: Main React application with global processing notifications and tab routing.
- `src/components/`: Reusable UI components (Navbar, Footer, ComparisonSlider, PWAInstallButton, etc.).
- `src/pages/`: ImageEnhancerPage, VideoEnhancerPage, HistoryPage, SettingsPage.
- `src/server/realEsrganEngine.ts`: Real-ESRGAN neural model engine and portrait restoration logic.
- `src/utils/`: Logic for video filter chains, dimension calculations, and client API communication.

### Environment Configuration:
Check `.env.example` for optional Google Gemini API key or external GPU bridge settings.
