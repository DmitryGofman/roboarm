import { useEffect, useRef } from "react";

// Fullscreen live camera feed fixed behind everything (z-index 0). Exposes the
// <video> element via onReady so the hand tracker can read frames; calls
// onError if the camera is denied/unavailable so the app can fall back.
export default function CameraBackground({
  facingMode = "environment",
  mirror = false,
  onReady,
  onError,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    let stream = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        onReady?.(v);
      } catch (e) {
        onError?.(e);
      }
    })();
    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: mirror ? "scaleX(-1)" : "none",
        zIndex: 0,
        background: "#000",
      }}
    />
  );
}
