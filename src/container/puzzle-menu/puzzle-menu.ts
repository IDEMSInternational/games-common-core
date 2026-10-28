import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';
import { MENU_PAGES, MenuPage } from './menu-pages';

/**
 * The ☰ button and the menu it opens: a panel sliding in from the left
 * listing the studio's pages (see menu-pages.ts), each opening in the
 * panel. Closes with ×, a tap outside the panel, or Escape. Used by the
 * puzzle shell, so every game has it.
 */
@Component({
  selector: 'puzzle-menu',
  templateUrl: './puzzle-menu.html',
  styleUrl: './puzzle-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleMenu {
  protected readonly pages = MENU_PAGES;
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

  protected read(page: MenuPage | null): void {
    this.page.set(page);
    this.panel()?.nativeElement.focus();
  }

  /** The address as people read it: "chiark.greenend.org.uk/~sgtatham/puzzles". */
  protected shortUrl(url: string): string {
    return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  }

  /** Keys stay inside the menu (so the game's shortcuts don't fire); Escape goes back or closes. */
  protected onKey(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key !== 'Escape') return;
    if (this.page()) this.read(null);
    else this.close();
  }
}
