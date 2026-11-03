import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DAILY_LEVELS } from '../../engine/daily';
import type { GameOptions } from '../puzzle-screens';
import { PuzzleSwitch } from '../puzzle-switch/puzzle-switch';
import { ThemeStore } from '../theme-store';
import { MenuGame, MenuLink, MenuPage, QuoteItem, menuPages } from './menu-pages';

/** The Game options page, first in the menu. */
const OPTIONS: MenuPage = { id: 'options', title: 'Game options' };

/**
 * The ☰ button and the menu it opens: a panel sliding in from the left
 * listing Game options (the theme, and the game's `options`) and the
 * studio's pages (see menu-pages.ts), each opening in the panel. Closes
 * with ×, a tap outside the panel, or Escape. On the home page, so every
 * game has it.
 */
@Component({
  selector: 'puzzle-menu',
  imports: [NgTemplateOutlet, PuzzleSwitch],
  templateUrl: './puzzle-menu.html',
  styleUrl: './puzzle-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleMenu {
  readonly game = input.required<MenuGame>();
  /** The game's own options, if any. */
  readonly options = input<GameOptions | null>(null);
  protected readonly theme = inject(ThemeStore);
  protected readonly OPTIONS = OPTIONS;
  protected readonly levelNames = DAILY_LEVELS;

  protected readonly pages = computed(() => menuPages(this.game()));
  protected readonly open = signal(false);
  /** The page being read, or null for the list of pages. */
  protected readonly page = signal<MenuPage | null>(null);

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly opener = viewChild.required<ElementRef<HTMLButtonElement>>('opener');

  protected show(): void {
    this.page.set(null);
    this.open.set(true);
    setTimeout(() => this.panel()?.nativeElement.focus());
  }

  protected close(): void {
    this.open.set(false);
    this.opener().nativeElement.focus();
  }

  /** Asking "are you sure?" before resetting the records; then, done. */
  protected readonly confirmingReset = signal(false);
  protected readonly resetDone = signal(false);

  protected reset(options: GameOptions): void {
    options.resetRecords();
    this.confirmingReset.set(false);
    this.resetDone.set(true);
  }

  /** Ticks or unticks a daily level (the last one ticked stays). */
  protected setDailyLevel(options: GameOptions, level: number, event: Event): void {
    const box = event.target as HTMLInputElement;
    options.setDailyLevel(level, box.checked);
    box.checked = options.dailyLevels()[level];
  }

  /** How many daily levels are ticked. */
  protected ticked(levels: readonly boolean[]): number {
    return levels.filter(Boolean).length;
  }

  protected read(page: MenuPage | null): void {
    this.confirmingReset.set(false);
    this.resetDone.set(false);
    this.page.set(page);
    this.panel()?.nativeElement.focus();
  }

  /**
   * The address as people read it, "chiark.greenend.org.uk/~sgtatham/puzzles",
   * in pieces ending at each "/" so a long one wraps there, not mid-word.
   */
  protected urlParts(url: string): string[] {
    const short = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    return short.match(/[^/]*\/?/g)!.filter(Boolean);
  }

  /** The paragraphs of an indented quote inside a quote, or null for a paragraph. */
  protected indented(item: QuoteItem): readonly string[] | null {
    return typeof item === 'object' && 'indented' in item ? item.indented : null;
  }

  /** A quote paragraph as text and links. */
  protected pieces(item: QuoteItem): readonly (string | MenuLink)[] {
    return typeof item === 'string' ? [item] : 'indented' in item ? [] : item;
  }

  protected isLink(piece: string | MenuLink): piece is MenuLink {
    return typeof piece !== 'string';
  }

  /** Keys stay inside the menu (so the game's shortcuts don't fire); Escape goes back or closes. */
  protected onKey(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key !== 'Escape') return;
    if (this.page()) this.read(null);
    else this.close();
  }
}
