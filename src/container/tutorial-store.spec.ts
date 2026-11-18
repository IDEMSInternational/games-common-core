import { Tutorial } from '../engine/tutorial';
import { SampleMove, SampleParams, SampleState, sampleGame } from './testing/sample-game';
import { TutorialStore } from './tutorial-store';

/** Two steps: fill in the first square, then the second. */
const twoSteps: Tutorial<SampleParams, SampleState, SampleMove, number> = {
  params: { w: 4, h: 4, difficulty: 0 },
  description: '1100000000000000',
  steps: [
    { text: 'Fill in the first square.', hint: 0, done: (s) => s.cells[0] === '1' },
    { text: 'Now the second.', hint: 1, done: (s) => s.cells[1] === '1' },
  ],
};

describe('Tutorial steps', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a done step on screen for a moment, then shows the next one all at once', () => {
    const finish = vi.fn();
    const tutorial = new TutorialStore(sampleGame(), twoSteps, finish);
    expect([tutorial.text(), tutorial.hint(), tutorial.stepIndex()]).toEqual([
      'Fill in the first square.',
      0,
      0,
    ]);

    tutorial.move({ kind: 'set', at: 0, on: true });
    // the move's result, under the same caption, without a hint, taking no moves
    expect(tutorial.state().cells[0]).toBe('1');
    expect([tutorial.text(), tutorial.hint(), tutorial.stepIndex()]).toEqual([
      'Fill in the first square.',
      null,
      0,
    ]);
    tutorial.move({ kind: 'set', at: 1, on: true });
    expect(tutorial.state().cells[1]).toBe('0');

    vi.advanceTimersByTime(500); // the next step: caption, dots and hint together
    expect([tutorial.text(), tutorial.hint(), tutorial.stepIndex()]).toEqual([
      'Now the second.',
      1,
      1,
    ]);

    tutorial.move({ kind: 'set', at: 1, on: true });
    expect(tutorial.finished()).toBe(true);
    vi.advanceTimersByTime(1800);
    expect(finish).toHaveBeenCalled();
  });
});
