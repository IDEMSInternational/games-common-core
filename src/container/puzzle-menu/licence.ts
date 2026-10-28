import type { QuoteItem } from './menu-pages';

/**
 * The games' licence, word for word as in each repository's LICENSE, except
 * that line breaks inside paragraphs are removed (so it wraps on a phone) and
 * the collection's web address, in our own words at the top, is a link on its
 * name instead. The original collection's notice is indented, as there, and
 * unchanged. The MIT licence requires the notice in every copy of the games,
 * so it is shown in the app, not only kept in the repositories.
 */
export const LICENCE: readonly QuoteItem[] = [
  'MIT License',
  'Copyright (c) 2026 IDEMS International.',
  [
    'Parts of this software are ports of ',
    {
      label: "Simon Tatham's Portable Puzzle Collection",
      url: 'https://www.chiark.greenend.org.uk/~sgtatham/puzzles/',
    },
    ', which carries this notice:',
  ],
  {
    indented: [
      'This software is copyright (c) 2004-2024 Simon Tatham.',
      'Portions copyright Richard Boulton, James Harvey, Mike Pinna, Jonas Kölker, Dariusz Olszewski, Michael ' +
        'Schierl, Lambros Lambrou, Bernd Schmidt, Steffen Bauer, Lennard Sprong, Rogier Goossens, Michael ' +
        'Quevillon, Asher Gordon, Didi Kohen, Ben Harris and Anders Höglund.',
    ],
  },
  'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated ' +
    'documentation files (the "Software"), to deal in the Software without restriction, including without ' +
    'limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of ' +
    'the Software, and to permit persons to whom the Software is furnished to do so, subject to the following ' +
    'conditions:',
  'The above copyright notice and this permission notice shall be included in all copies or substantial ' +
    'portions of the Software.',
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT ' +
    'LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO ' +
    'EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER ' +
    'IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR ' +
    'THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
];
