import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

/** How big a celebration: one quick burst, a few, or a longer show. */
export type CelebrationSize = 'small' | 'normal' | 'big';

/** When each burst goes off (ms), for each size. */
const BURSTS: Record<CelebrationSize, readonly number[]> = {
  small: [0],
  normal: [0, 280, 560],
  big: [0, 220, 440, 700, 950, 1250],
};
const SPARKS: Record<CelebrationSize, number> = { small: 36, normal: 50, big: 60 };
const ORANGES = ['#f37021', '#ff9a57', '#ffc14d'];
const GOLDS = ['#ffd36b', '#ffe7a3', '#ffc14d'];

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds lived, and how long it lives. */
  age: number;
  life: number;
  colour: string;
  radius: number;
}

/**
 * Orange fireworks over the board when a puzzle is solved: bursts of
 * sparks flying out, slowing, drifting down and fading. Plays once when
 * it appears, then says it's done. Drawn on a see-through canvas that
 * doesn't take touches. Nothing plays if the phone asks for reduced
 * motion.
 */
@Component({
  selector: 'puzzle-fireworks',
  template: '<canvas #canvas></canvas>',
  styleUrl: './puzzle-fireworks.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class PuzzleFireworks {
  readonly size = input<CelebrationSize>('normal');
  /** The show is over. */
  readonly done = output<void>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private frame = 0;

  constructor() {
    afterNextRender(() => this.play());
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  private play(): void {
    // Not where motion is unwanted, nor where it can't be shown (e.g. tests, which have no matchMedia).
    if (typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.done.emit();
      return;
    }
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (!context) {
      this.done.emit();
      return;
    }

    // Draw in the canvas's layout units, sharp on the screen (scaled stage, high-density displays).
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.round(box.width * devicePixelRatio);
    canvas.height = Math.round(box.height * devicePixelRatio);
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);

    const size = this.size();
    const bursts = [...BURSTS[size]];
    const unit = Math.min(width, height);
    const sparks: Spark[] = [];
    const start = performance.now();
    let last = start;

    const burst = (finale: boolean) => {
      const x = width * (0.2 + Math.random() * 0.6);
      const y = height * (0.12 + Math.random() * 0.23); // the upper part, above the message
      const colours = finale ? GOLDS : ORANGES;
      const count = SPARKS[size] * (finale ? 1.3 : 1);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        const speed = unit * (0.35 + Math.random() * 0.35) * (finale ? 1.2 : 1);
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          age: 0,
          life: 0.8 + Math.random() * 0.5,
          colour: colours[Math.floor(Math.random() * colours.length)],
          radius: unit * (0.006 + Math.random() * 0.006),
        });
      }
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      while (bursts.length && now - start >= bursts[0]) {
        bursts.shift();
        burst(size === 'big' && bursts.length === 0);
      }

      context.clearRect(0, 0, width, height);
      const drag = Math.exp(-2.6 * dt);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        if (s.age >= s.life) {
          sparks.splice(i, 1);
          continue;
        }
        const px = s.x;
        const py = s.y;
        s.vx *= drag;
        s.vy = s.vy * drag + unit * 0.5 * dt; // gravity
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const alpha = 1 - s.age / s.life;
        context.globalAlpha = alpha;
        context.strokeStyle = s.colour;
        context.fillStyle = s.colour;
        context.lineWidth = s.radius;
        context.beginPath(); // a short trail
        context.moveTo(px - (s.x - px) * 2, py - (s.y - py) * 2);
        context.lineTo(s.x, s.y);
        context.stroke();
        context.beginPath();
        context.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      if (bursts.length || sparks.length) this.frame = requestAnimationFrame(step);
      else this.done.emit();
    };
    this.frame = requestAnimationFrame(step);
  }
}
