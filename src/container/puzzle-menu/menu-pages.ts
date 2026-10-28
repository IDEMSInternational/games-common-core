import { LICENCE } from './licence';

/**
 * A page in the ☰ menu. To fill one in, give it `paragraphs` (then any
 * `links` and headed `sections`, shown below them); a page without
 * paragraphs shows a "coming soon" message.
 */
export interface MenuPage {
  readonly id: string;
  readonly title: string;
  readonly paragraphs?: readonly string[];
  readonly links?: readonly MenuLink[];
  readonly sections?: readonly MenuSection[];
}

/** A website a page points to; opens in the phone's browser. */
export interface MenuLink {
  readonly label: string;
  readonly url: string;
}

/**
 * A part of a page with its own heading. `quote` is someone else's text,
 * set apart below ours.
 */
export interface MenuSection {
  readonly heading: string;
  readonly paragraphs?: readonly string[];
  readonly quote?: readonly QuoteItem[];
}

/**
 * A paragraph of a quote: plain text, a list of text and links (shown as
 * linked words in the sentence), or `indented` paragraphs set in further.
 */
export type QuoteItem = string | readonly (string | MenuLink)[] | { readonly indented: readonly string[] };

/** The game the menu belongs to: its id (also its repository's name) and display name. */
export interface MenuGame {
  readonly id: string;
  readonly name: string;
}

const GITHUB = 'https://github.com/IDEMSInternational';

/** The pages in every game's ☰ menu, in order. */
export function menuPages(game: MenuGame): readonly MenuPage[] {
  return [
    { id: 'announcements', title: 'Announcements' },
    {
      id: 'acknowledgements',
      title: 'Acknowledgements',
      paragraphs: [
        "This game is based on Simon Tatham's Portable Puzzle Collection, a free collection of logic puzzles by " +
          'Simon Tatham and contributors.',
        'We are grateful to them for sharing their work. You can play all of the original puzzles on their ' +
          'website.',
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
    {
      id: 'licence',
      title: 'Licence',
      paragraphs: [
        `${game.name} is © 2026 IDEMS International, and it is open source.`,
        'Open source means that the code that makes the game work is published for everyone. Anyone may read ' +
          'it, learn from it, change it and share it, free of charge, as long as they keep the licence below ' +
          'with it.',
        "The same licence covers the parts of the game ported from Simon Tatham's Portable Puzzle Collection, " +
          'and includes its notice.',
      ],
      links: [
        { label: `${game.name} source code`, url: `${GITHUB}/${game.id}` },
        { label: 'Code shared by all IDEMS Games', url: `${GITHUB}/games-common-core` },
      ],
      sections: [{ heading: 'The licence', quote: LICENCE }],
    },
    { id: 'terms', title: 'Terms and Conditions' },
  ];
}
