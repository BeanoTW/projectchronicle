/**
 * Category Icon Map — Single source of truth for top-level category visuals.
 *
 * Rules (from UI Polish spec):
 * - One icon per primary category group
 * - Used alongside category label (never replacing text)
 * - Simple line icons only, consistent stroke
 * - Muted colour by default; inherits currentColor when used inside a tinted chip
 */

import {
  MessageSquare,
  ArrowLeftRight,
  ClipboardList,
  PoundSterling,
  HardHat,
  Eye,
  FileText,
  CircleDashed,
  type LucideIcon,
} from 'lucide-react';
import { resolveCategory, type PrimaryCategory } from './categories';

export const CATEGORY_ICONS: Record<PrimaryCategory, LucideIcon> = {
  'Communication': MessageSquare,
  'Action / Change': ArrowLeftRight,
  'Process Event': ClipboardList,
  'Pay / Benefits': PoundSterling,
  'Working Conditions': HardHat,
  'Observed Behaviour': Eye,
  'Record Issued': FileText,
  'Other': CircleDashed,
};

/** Resolve any category string (legacy or current) to its line icon. */
export function getCategoryIcon(raw: string | null | undefined): LucideIcon {
  return CATEGORY_ICONS[resolveCategory(raw)];
}
