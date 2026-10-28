/**
 * The pages in every game's ☰ menu, in order. To fill one in, give it
 * `paragraphs` (and any `links`, shown below them); a page without
 * paragraphs shows a "coming soon" message.
 */
export interface MenuPage {
  readonly id: string;
  readonly title: string;
  readonly paragraphs?: readonly string[];
  readonly links?: readonly MenuLink[];
}

/** A website a page points to; opens in the phone's browser. */
export interface MenuLink {
  readonly label: string;
  readonly url: string;
}

export const MENU_PAGES: readonly MenuPage[] = [
  { id: 'announcements', title: 'Announcements' },
  {
    id: 'acknowledgements',
    title: 'Acknowledgements',
    paragraphs: [
      "This game is based on Simon Tatham's Portable Puzzle Collection, a free collection of logic puzzles by " +
        'Simon Tatham and contributors.',
      'We are grateful to them for sharing their work under the MIT licence. You can play all of the original ' +
        'puzzles on their website.',
    ],
    links: [
      {
        label: "Simon Tatham's Portable Puzzle Collection",
        url: 'https://www.chiark.greenend.org.uk/~sgtatham/puzzles/',
      },
    ],
  },
  { id: 'about', title: 'About IDEMS Games' },
  { id: 'other-games', title: 'Other IDEMS Games' },
  { id: 'terms', title: 'Terms and Conditions' },
];
