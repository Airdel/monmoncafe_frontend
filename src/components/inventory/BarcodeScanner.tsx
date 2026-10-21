import { useEffect, useRef, useState } from 'react';
import { Keyboard, Loader2, ScanLine } from 'lucide-react';
import { BarcodeFormat, BarcodeScanner as NativeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Modal } from '../ui/Modal';
import { inputClass, labelClass, primaryButtonClass } from '../finance/styles';
import { isNativeApp } from '../../lib/server';
import { BARCODE_PATTERN, normalizeBarcode } from '../../lib/barcodes';

/** Codes printed on products in México, plus Code 128 that some stores label with. */
const NATIVE_FORMATS = [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE, BarcodeFormat.Code128];
const WEB_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** The browser's own detector (Chrome on Android) or, where missing, a copy that reads with zxing. */
async function createDetector(): Promise<Detector> {
  const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (Native) return new Native({ formats: WEB_FORMATS });
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: WEB_FORMATS as never });
}

/**
 * Google's scanner screen on the phone app. Null when it was cancelled or
 * can't run (its module is missing and can't be downloaded now); the
 * caller falls back to the camera in the page.
 */
async function scanNative(): Promise<{ code: string | null; failed: boolean }> {
  try {
    const { available } = await NativeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      // Downloaded once by Google Play services; needs internet that one time
      void NativeScanner.installGoogleBarcodeScannerModule().catch(() => undefined);
      return { code: null, failed: true };
    }
    const { barcodes } = await NativeScanner.scan({ formats: NATIVE_FORMATS, autoZoom: true });
    return { code: barcodes[0]?.rawValue ?? null, failed: false };
  } catch (err) {
    // Closing Google's screen rejects too: that is not a failure
    const cancelled = err instanceof Error && /cancel/i.test(err.message);
    return { code: null, failed: !cancelled };
  }
}

/**
 * Reads a product's barcode: Google's scanner in the phone app, the camera
 * in the browser, or typing the number when the camera won't read it.
 */
export function BarcodeScannerModal({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const [mode, setMode] = useState<'native' | 'camera' | 'manual'>(isNativeApp ? 'native' : 'camera');
  const [manual, setManual] = useState('');
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const done = useRef(false);

  const finish = (raw: string) => {
    if (done.current) return;
    done.current = true;
    onCode(normalizeBarcode(raw));
  };

  // Phone app: Google's screen opens right away; cancelling it leaves the typing option
  useEffect(() => {
    if (mode !== 'native') return;
    let active = true;
    scanNative().then(({ code, failed }) => {
      if (!active) return;
      if (code) finish(code);
      else if (failed) setMode('camera');
      else setMode('manual');
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Browser: back camera into the page, looking for a code a few times a second
  useEffect(() => {
    if (mode !== 'camera') return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no deja usar la cámara.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = await createDetector();
        let busy = false;
        timer = setInterval(async () => {
          if (busy || stopped || video.readyState < 2) return;
          busy = true;
          try {
            const [found] = await detector.detect(video);
            if (found?.rawValue) finish(found.rawValue);
          } catch {
            // A frame it couldn't read; the next one may work
          } finally {
            busy = false;
          }
        }, 250);
      } catch (err) {
        if (stopped) return;
        setCameraError(err instanceof Error && err.name === 'NotAllowedError'
          ? 'No hay permiso para usar la cámara. Escribe el número del código.'
          : 'No se pudo abrir la cámara. Escribe el número del código.');
        setMode('manual');
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const manualCode = normalizeBarcode(manual);
  const manualValid = BARCODE_PATTERN.test(manualCode);

  return (
    <Modal title="Escanear código" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {mode === 'native' && (
          <div className="flex flex-col items-center gap-3 py-8 text-ink/60 text-sm">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            Abriendo el lector…
          </div>
        )}
        {mode === 'camera' && (
          <>
            <div className="relative rounded-xl overflow-hidden bg-shade aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-x-8 top-1/2 h-0.5 bg-primary/80 shadow-[0_0_12px] shadow-primary" />
            </div>
            <p className="text-ink/60 text-sm text-center">Apunta al código de barras del producto.</p>
          </>
        )}
        {mode === 'manual' ? (
          <form onSubmit={e => { e.preventDefault(); if (manualValid) finish(manualCode); }} className="flex flex-col gap-4">
            {cameraError && <p className="text-warning text-sm">{cameraError}</p>}
            <div>
              <label className={labelClass} htmlFor="barcode-manual">Número del código</label>
              <input id="barcode-manual" value={manual} onChange={e => setManual(e.target.value)} inputMode="numeric" placeholder="7501234567890" className={inputClass} autoFocus />
            </div>
            <button type="submit" disabled={!manualValid} className={primaryButtonClass}>
              <ScanLine className="w-5 h-5" /> Buscar
            </button>
            {isNativeApp && (
              <button type="button" onClick={() => setMode('native')} className="text-primary text-sm font-medium">Volver a escanear</button>
            )}
          </form>
        ) : (
          <button type="button" onClick={() => setMode('manual')} className="flex items-center justify-center gap-2 text-ink/60 hover:text-primary text-sm font-medium">
            <Keyboard className="w-4 h-4" /> Escribir el número
          </button>
        )}
      </div>
    </Modal>
  );
}
