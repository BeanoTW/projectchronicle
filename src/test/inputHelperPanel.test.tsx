import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InputHelperPanel from '@/chronicle/shared/InputHelperPanel';

const longText = 'First thing happened. Second thing happened. Third thing happened. '.repeat(5).trim();

describe('Phase 5 — Input Helper panel', () => {
  it('stays absent when there is no useful structure suggestion', () => {
    const { container } = render(
      <InputHelperPanel text="A short ordinary note." onAccept={vi.fn()} onShown={vi.fn()} onInteract={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not count merely displaying a suggestion as interaction or acceptance', () => {
    const onShown = vi.fn();
    const onInteract = vi.fn();
    const onAccept = vi.fn();
    render(<InputHelperPanel text={longText} onAccept={onAccept} onShown={onShown} onInteract={onInteract} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show structure suggestion' }));
    expect(onShown).toHaveBeenCalledTimes(1);
    expect(onInteract).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('only applies a structure suggestion after explicit acceptance', () => {
    const onShown = vi.fn();
    const onInteract = vi.fn();
    const onAccept = vi.fn();
    render(<InputHelperPanel text={longText} onAccept={onAccept} onShown={onShown} onInteract={onInteract} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show structure suggestion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use this structure' }));

    expect(onInteract).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledTimes(1);
    const accepted = onAccept.mock.calls[0][0] as string;
    expect(accepted.replace(/\s/g, '')).toBe(longText.replace(/\s/g, ''));
  });

  it('records rejection as interaction without applying the suggestion', () => {
    const onInteract = vi.fn();
    const onAccept = vi.fn();
    render(<InputHelperPanel text={longText} onAccept={onAccept} onShown={vi.fn()} onInteract={onInteract} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show structure suggestion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep my wording as-is' }));

    expect(onInteract).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });
});
