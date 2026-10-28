/// <reference path="./markdown.d.ts" />
import privacyText from '../../PRIVACY.md' with { loader: 'text' };
import termsText from '../../TERMS.md' with { loader: 'text' };

/**
 * The Terms and Conditions and Privacy Policy, read from TERMS.md and
 * PRIVACY.md at the root of games-common-core (the public copies that the
 * app stores link to), so the app always shows exactly the same text.
 */
export interface LegalDocument {
  readonly title: string;
  /** Paragraphs before the first heading (including "Last updated"). */
  readonly intro: readonly string[];
  readonly sections: readonly { readonly heading: string; readonly paragraphs: readonly string[] }[];
}

/** Bump when either document changes enough that players should see the notice again. */
export const LEGAL_VERSION = '2026-10-28';

export const TERMS = parseLegal(termsText);
export const PRIVACY = parseLegal(privacyText);

/** Reads the simple Markdown the documents use: a "# " title, "## " headings and paragraphs. */
export function parseLegal(markdown: string): LegalDocument {
  let title = '';
  const intro: string[] = [];
  const sections: { heading: string; paragraphs: string[] }[] = [];
  for (const block of markdown.replace(/\r/g, '').split(/\n\s*\n/)) {
    const text = block.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (text.startsWith('## ')) sections.push({ heading: text.slice(3), paragraphs: [] });
    else if (text.startsWith('# ')) title = text.slice(2);
    else (sections.at(-1)?.paragraphs ?? intro).push(text);
  }
  return { title, intro, sections };
}
