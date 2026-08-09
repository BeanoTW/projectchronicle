// Session-scoped Notebook UI state (search, view, month, filters).
//
// Lives outside the screen component so returning from a record restores the
// same view, and so it can be reset when the active account changes.
import { cloneFilters, emptyFilters, type NotebookFilters } from '../filters';
import { registerTransientReset } from './sessionCleanup';

export interface NotebookUiState {
  q: string;
  view: 'list' | 'month';
  month: string;
  selectedDate: string | null;
  filters: NotebookFilters;
}

const initial = (): NotebookUiState => ({
  q: '',
  view: 'list',
  month: new Date().toISOString().slice(0, 7),
  selectedDate: null,
  filters: cloneFilters(emptyFilters),
});

export const notebookUiState: NotebookUiState = initial();

export const resetNotebookUiState = (): void => {
  Object.assign(notebookUiState, initial());
};

registerTransientReset(resetNotebookUiState);
