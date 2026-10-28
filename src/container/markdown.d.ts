/** Markdown files imported as text, with `with { loader: 'text' }`. */
declare module '*.md' {
  const text: string;
  export default text;
}
