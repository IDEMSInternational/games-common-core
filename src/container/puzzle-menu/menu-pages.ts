/**
 * The pages in every game's ☰ menu, in order. To fill one in, give it
 * `paragraphs`; a page without them shows a "coming soon" message.
 */
export interface MenuPage {
  readonly id: string;
  readonly title: string;
  readonly paragraphs?: readonly string[];
}

export const MENU_PAGES: readonly MenuPage[] = [
  { id: 'announcements', title: 'Announcements' },
  { id: 'acknowledgements', title: 'Acknowledgements' },
  { id: 'about', title: 'About IDEMS Games' },
  { id: 'other-games', title: 'Other IDEMS Games' },
  { id: 'terms', title: 'Terms and Conditions' },
];
