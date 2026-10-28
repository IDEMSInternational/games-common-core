import type { QuoteItem } from './menu-pages';

/** The MIT License after its copyright notice, word for word: the same for every MIT-licensed work. */
export const MIT_TERMS: readonly string[] = [
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
  ...MIT_TERMS,
];

/**
 * Other people's open-source software built into the apps, by licence. Keep
 * this up to date when dependencies change: the web packages are listed in
 * the build's 3rdpartylicenses.txt, the Android ones by
 * `gradlew :app:dependencies --configuration releaseRuntimeClasspath`.
 * Apache-licensed libraries need only the licence text and any NOTICE
 * (none of them ships one; Cordova's project notice is included anyway).
 */
export const OTHER_MIT_NOTICES: readonly string[] = [
  'Angular: Copyright (c) 2010-2026 Google LLC.',
  'Capacitor: Copyright (c) 2017-present Drifty Co.',
];

export const OTHER_APACHE_WORKS: readonly string[] = [
  'RxJS: Copyright (c) 2015-2018 Google, Inc., Netflix, Inc., Microsoft Corp. and contributors.',
  'AndroidX libraries: The Android Open Source Project.',
  'Kotlin standard library, kotlinx.coroutines and JetBrains Java Annotations: JetBrains s.r.o. and contributors.',
  'Guava ListenableFuture: The Guava Authors.',
  'JSpecify: The JSpecify Authors.',
  'Apache Cordova: The Apache Software Foundation. This product includes software developed at The Apache ' +
    'Software Foundation (http://www.apache.org/).',
];
