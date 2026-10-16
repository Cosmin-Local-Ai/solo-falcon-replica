/**
 * Step 11 / Part D (B-134) — the demo marker is shell chrome, and it is there after a reload.
 *
 * Acceptance 5 is the one this file pins: a demo that is restored on load but not ANNOUNCED on load is
 * worse than one that is not restored, because the person returns to a year of numbers they never entered
 * and nothing says so. So the assertions are made against the rendered shell, not against store internals:
 * the badge has to be in the DOM on the first paint, it has to name whose data is on screen, and it has to
 * carry the control that switches back.
 *
 * The badge lives in `.topbar`, which is a fixed row above `.main-content` — the element that scrolls. A
 * banner inside `.main-content` (the sandbox banner) scrolls out of view on a long register, which is why
 * the sandbox banner alone was not enough for B-134.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider } from './data/store';
import { DEMO_MODE_STORAGE_KEY } from './data/demoMode';
import { seedStorage } from './test/storage';
import { personaById } from './data/personas';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  seedStorage();
});

describe('the demo badge in the shell (B-134, acceptance 5)', () => {
  it('is present on the first render after a reload, and names whose data is on screen', () => {
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, JSON.stringify({ personaId: 'short-term-host' }));
    const { container } = render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );

    const badge = container.querySelector('[data-demo-badge]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-demo-persona')).toBe('short-term-host');
    expect(badge?.textContent).toContain(personaById('short-term-host')!.label);

    // The badge is in the topbar, not in the scrolling content area.
    expect(container.querySelector('.topbar [data-demo-badge]')).not.toBeNull();
    expect(container.querySelector('.main-content [data-demo-badge]')).toBeNull();
  });

  it('is absent when the screen shows the person\'s own data', () => {
    const { container } = render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    expect(container.querySelector('[data-demo-badge]')).toBeNull();
  });

  it('switches back to the person\'s own numbers from the badge itself', () => {
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, JSON.stringify({ personaId: 'short-term-host' }));
    const { container } = render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );

    // The demo really is what the shell is showing: the seeded name is not on screen.
    expect(container.querySelector('.topbar-user')?.textContent ?? '').not.toContain('Dobre Radu');

    const exit = container.querySelector<HTMLButtonElement>('[data-demo-badge-exit]');
    expect(exit).not.toBeNull();
    act(() => {
      exit!.click();
    });

    expect(container.querySelector('[data-demo-badge]')).toBeNull();
    expect(container.querySelector('.topbar-user')?.textContent ?? '').toContain('Dobre Radu');
    expect(localStorage.getItem(DEMO_MODE_STORAGE_KEY)).toBeNull();
  });
});
