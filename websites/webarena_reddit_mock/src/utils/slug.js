// Postmill\App\Utils\Slugger::slugify — SluggerInterface::DEFAULT_MAX_LENGTH = 60
//
// Verbatim port from assets/data_model.md §6. Verified 56/56 against the
// slug-carrying anchor routes. `\w` in PHP's preg_split('/[^\w]+/u') with the
// `u` modifier is [\p{L}\p{N}_], so underscores survive and everything else —
// apostrophes, punctuation, emoji — acts as a separator.
export function slugify(title, maxLength = 60) {
  const words = title.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  let slug = '', len = 0;
  for (const word of words) {
    const add = len > 0 ? `-${word}` : word;
    len += [...add].length;          // grapheme-ish length, INCLUDING the dash
    if (len > maxLength) break;      // truncate at a word boundary
    slug += add;
  }
  return slug || '-';
}

export default slugify;
