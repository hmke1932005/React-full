import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Renders the otpauth:// URI returned by TwoFactorService::generateSetup()
 * as a scannable QR code, entirely client-side.
 *
 * Mirrors the PHP views' approach (each portal's two-factor-setup.php, which
 * use davidshimjs/qrcodejs from cdnjs): the secret is already sent to the
 * browser in plain text as `otpauth_uri`/`manual_key` regardless, so turning
 * it into a QR code locally adds no exposure — nothing is sent to a third
 * party. Here it's done with the `qrcode` npm package instead of a CDN
 * script tag, since this is a bundled React app.
 *
 * If generation fails for any reason, the code just doesn't render and the
 * manual key (always shown alongside this) remains the fallback — every
 * authenticator app supports typing it in by hand.
 */
export default function TotpQrCode({ uri, size = 200 }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!uri || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, uri, { width: size, margin: 1 }, (err) => {
      if (err && !cancelled) setFailed(true);
    });
    return () => { cancelled = true; };
  }, [uri, size]);

  if (!uri || failed) return null;

  return (
    <div style={{ display: 'inline-block', padding: 'var(--space-3)', background: '#fff', borderRadius: 'var(--radius-md)' }}>
      <canvas ref={canvasRef} width={size} height={size} />
    </div>
  );
}
