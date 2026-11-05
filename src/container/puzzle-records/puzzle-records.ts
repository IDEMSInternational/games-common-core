import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { HomeControls, RecordRow } from '../puzzle-screens';
import { shareText } from '../share';

/**
 * The records page's list: the player's records by mode (best daily
 * streaks, Beat the clock records, timed play's and the ladder's best
 * times), each with Share and × to delete it, which asks first. The page
 * scrolls if the list is long. Shown by PuzzleHome, under its title row.
 */
@Component({
  selector: 'puzzle-records',
  templateUrl: './puzzle-records.html',
  styleUrl: './puzzle-records.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'deleting.set(null)',
  },
})
export class PuzzleRecords {
  readonly controls = input.required<HomeControls>();

  /** The record being deleted, while asking "are you sure?". */
  protected readonly deleting = signal<RecordRow | null>(null);
  /** A message after sharing (e.g. "Copied, ready to paste"), under its record. */
  protected readonly shared = signal<{ readonly id: string; readonly message: string } | null>(null);

  protected async share(row: RecordRow): Promise<void> {
    this.shared.set(null);
    const message = await shareText(this.controls().id, `${this.controls().title}: my records`, row.share);
    if (message) this.shared.set({ id: row.id, message });
  }

  protected delete(row: RecordRow): void {
    this.controls().deleteRecord(row.id);
    this.deleting.set(null);
  }
}
