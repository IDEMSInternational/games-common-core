/**
 * Disjoint set forest ("union-find"): tracks which items are connected
 * into groups. The original collection's dsf.c; used by many puzzles to
 * follow connected regions, lines or equivalences.
 */
export class Dsf {
  private readonly parent: Int32Array;
  private readonly size: Int32Array;

  constructor(count: number) {
    this.parent = new Int32Array(count);
    this.size = new Int32Array(count);
    this.reset();
  }

  /** Puts every item back in a group of its own. */
  reset(): void {
    for (let i = 0; i < this.parent.length; i++) this.parent[i] = i;
    this.size.fill(1);
  }

  /** The representative item of the group containing `n`. */
  canonify(n: number): number {
    let root = n;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[n] !== root) {
      const next = this.parent[n];
      this.parent[n] = root;
      n = next;
    }
    return root;
  }

  /**
   * Joins the groups of `a` and `b`. As in dsf.c, the larger group's
   * representative survives, and on a tie `b`'s does; some solvers keep
   * data at the representative, so this choice affects their results.
   */
  merge(a: number, b: number): void {
    const ra = this.canonify(a);
    const rb = this.canonify(b);
    if (ra === rb) return;
    const [root, child] = this.size[ra] > this.size[rb] ? [ra, rb] : [rb, ra];
    this.parent[child] = root;
    this.size[root] += this.size[child];
  }

  equivalent(a: number, b: number): boolean {
    return this.canonify(a) === this.canonify(b);
  }
}
