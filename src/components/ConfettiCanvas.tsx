import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
};

const COLORS = [
  "#e53935", // red
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // gold / amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#ffffff", // white
];

export function ConfettiCanvas({ onComplete }: { onComplete?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvasRef.current) return;
      width = canvasRef.current.width = window.innerWidth;
      height = canvasRef.current.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    // Generate burst particles from both bottom corners
    const particles: Particle[] = [];
    const count = Math.min(100, Math.floor(width / 12));

    // Left cannon
    for (let i = 0; i < count / 2; i++) {
      const angle = (Math.PI / 4) + (Math.random() * Math.PI / 4); // 45° to 90°
      const speed = 12 + Math.random() * 16;
      particles.push({
        x: width * 0.1,
        y: height * 0.95,
        vx: Math.cos(angle) * speed * (0.8 + Math.random() * 0.4),
        vy: -Math.sin(angle) * speed * (0.8 + Math.random() * 0.4),
        size: 6 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
      });
    }

    // Right cannon
    for (let i = 0; i < count / 2; i++) {
      const angle = (Math.PI / 2) + (Math.random() * Math.PI / 4); // 90° to 135°
      const speed = 12 + Math.random() * 16;
      particles.push({
        x: width * 0.9,
        y: height * 0.95,
        vx: Math.cos(angle) * speed * (0.8 + Math.random() * 0.4),
        vy: -Math.sin(angle) * speed * (0.8 + Math.random() * 0.4),
        size: 6 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
      });
    }

    let animId: number;
    const startTime = performance.now();
    const duration = 3500; // 3.5 seconds

    const render = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed > duration) {
        ctx.clearRect(0, 0, width, height);
        onComplete?.();
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const fadeStart = duration * 0.65;
      const globalFade = elapsed > fadeStart ? 1 - (elapsed - fadeStart) / (duration - fadeStart) : 1;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.vx *= 0.985; // air drag
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity * globalFade);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="confetti-canvas"
      aria-hidden="true"
    />
  );
}
