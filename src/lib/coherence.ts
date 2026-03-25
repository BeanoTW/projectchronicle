/**
 * Coherence detection for narrative input.
 * A record is "coherent" if ANY 2 of 4 signals are present.
 */

const TIME_PATTERNS = /\b(today|yesterday|morning|afternoon|evening|night|around|approximately|ago|last\s+\w+|on\s+\w+day|\d{1,2}[\/\-\.]\d{1,2}|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

const PERSON_PATTERNS = /\b(manager|supervisor|colleague|coworker|co-worker|boss|team\s*lead|director|hr|human\s*resources|employee|staff|worker|mr\.?|mrs\.?|ms\.?|dr\.?|lecturer|tutor|professor|teacher|student|dean|advisor|warden|flatmate|flat\s*mate|housemate|house\s*mate|roommate|room\s*mate|landlord|landlady|tenant|neighbour|neighbor|bouncer|bartender|coach|trainer|instructor|doorman|security|receptionist|officer|driver)\b/i;
const PERSON_NAME = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\b/;

const ACTION_VERBS = /\b(said|told|asked|came|sent|called|emailed|shouted|yelled|wrote|messaged|walked|approached|confronted|reported|complained|refused|denied|threatened|warned|dismissed|ignored|demanded|instructed|informed|noticed|witnessed|heard|saw|observed|felt|received|given|taken|moved|changed|removed|cancelled|scheduled)\b/i;

export function detectCoherence(text: string): boolean {
  if (!text.trim()) return false;

  let signals = 0;

  if (TIME_PATTERNS.test(text)) signals++;
  if (PERSON_PATTERNS.test(text) || PERSON_NAME.test(text)) signals++;
  if (text.length >= 150) signals++;
  if (ACTION_VERBS.test(text)) signals++;

  return signals >= 2;
}
