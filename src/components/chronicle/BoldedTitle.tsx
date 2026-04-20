/**
 * BoldedTitle — display helper for scanability.
 *
 * Renders the first N words in semibold and the remainder in regular weight,
 * helping the eye scan a long list of records. Display-only; never mutates
 * stored data.
 */
interface BoldedTitleProps {
  text: string;
  /** Number of leading words to bold. Default 4. */
  leadingWords?: number;
  className?: string;
}

const BoldedTitle = ({ text, leadingWords = 4, className = '' }: BoldedTitleProps) => {
  if (!text) return null;
  // Split on whitespace but preserve the spaces in the output.
  const parts = text.split(/(\s+)/);
  // Word-bearing tokens (i.e. not pure whitespace) determine the bold cutoff.
  let wordCount = 0;
  let cutIndex = parts.length;
  for (let i = 0; i < parts.length; i++) {
    if (!/^\s+$/.test(parts[i])) {
      wordCount += 1;
      if (wordCount === leadingWords) {
        cutIndex = i + 1;
        break;
      }
    }
  }
  const head = parts.slice(0, cutIndex).join('');
  const tail = parts.slice(cutIndex).join('');
  return (
    <span className={className}>
      <span className="font-semibold">{head}</span>
      {tail && <span className="font-normal text-foreground/85">{tail}</span>}
    </span>
  );
};

export default BoldedTitle;
