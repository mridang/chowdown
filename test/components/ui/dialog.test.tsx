import { describe, expect, it, jest } from '@jest/globals';

import {
  backdropClickHandler,
  cancelHandler,
  Dialog,
  hasDescription,
  lockScroll,
  syncModal,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../../src/components/ui/dialog';
import { html } from '../render';

/** A dialog with a title and a description, open or closed as told. */
const sample = (open: boolean, props: { showClose?: boolean } = {}) =>
  html(
    <Dialog open={open}>
      <DialogTrigger className="opener">Open</DialogTrigger>
      <DialogContent closeLabel="Close filters" {...props}>
        <DialogTitle>Filters</DialogTitle>
        <DialogDescription>Narrow the list.</DialogDescription>
      </DialogContent>
    </Dialog>,
  );

describe('Dialog', () => {
  it('has a button that opens it, and no content while it is closed', () => {
    const out = sample(false);
    expect(out).toMatch(/<button type="button" class="opener">Open<\/button>/);
    expect(out).toMatch(/<dialog[^>]*><\/dialog>/);
    expect(out).not.toContain('Filters');
  });

  it('shows its content when open', () => {
    const out = sample(true);
    expect(out).toContain('Filters');
    expect(out).toContain('Narrow the list.');
  });

  it('is named and described by its title and description', () => {
    const out = sample(true);
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(out)?.[1];
    const describedBy = /aria-describedby="([^"]+)"/.exec(out)?.[1];
    expect(labelledBy).toBeDefined();
    expect(out).toContain(`<h2 id="${labelledBy}">`);
    expect(out).toContain(`<p id="${describedBy}">`);
  });

  it('points at a description only when it has one', () => {
    const bare = html(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Filters</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(bare).not.toContain('aria-describedby');
    expect(bare).toContain('aria-labelledby=');
  });

  it('does not point at a description while closed, when none is on the page', () => {
    expect(sample(false)).not.toContain('aria-describedby');
  });

  it('has a corner close button with the name it was given', () => {
    expect(sample(true)).toContain('aria-label="Close filters"');
  });

  it('can leave the corner close button out', () => {
    expect(sample(true, { showClose: false })).not.toContain(
      'aria-label="Close filters"',
    );
  });

  it('lends its behaviour to a button of the caller’s own', () => {
    const out = html(
      <Dialog>
        <DialogTrigger asChild>
          <a href="#x">Mine</a>
        </DialogTrigger>
      </Dialog>,
    );
    expect(out).toBe('<a href="#x">Mine</a>');
  });

  it('refuses to be used piecemeal', () => {
    expect(() => html(<DialogTitle>Orphan</DialogTitle>)).toThrow(
      'Dialog parts must be used inside <Dialog>.',
    );
  });
});

describe('hasDescription', () => {
  it('finds a description among the children', () => {
    expect(
      hasDescription(
        <>
          <DialogTitle>T</DialogTitle>
          <DialogDescription>D</DialogDescription>
        </>,
      ),
    ).toBe(true);
  });

  it('finds one nested inside other elements', () => {
    expect(
      hasDescription(
        <div>
          <section>
            <DialogDescription>D</DialogDescription>
          </section>
        </div>,
      ),
    ).toBe(true);
  });

  it('says no for text, nothing, and other elements', () => {
    expect(hasDescription('text')).toBe(false);
    expect(hasDescription(null)).toBe(false);
    expect(hasDescription(<p>plain</p>)).toBe(false);
  });
});

/** A stand-in for the dialog element: records what it was asked to do. */
function fakeDialog(open: boolean) {
  return { open, showModal: jest.fn(), close: jest.fn() };
}

describe('syncModal', () => {
  it('shows a closed dialog modally when it should be open', () => {
    const dialog = fakeDialog(false);
    syncModal(dialog, true);
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it('closes an open dialog when it should be closed', () => {
    const dialog = fakeDialog(true);
    syncModal(dialog, false);
    expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(dialog.showModal).not.toHaveBeenCalled();
  });

  it('does nothing when it already is what it should be (showModal would throw)', () => {
    const shown = fakeDialog(true);
    syncModal(shown, true);
    const hidden = fakeDialog(false);
    syncModal(hidden, false);
    expect(shown.showModal).not.toHaveBeenCalled();
    expect(hidden.close).not.toHaveBeenCalled();
  });
});

describe('backdropClickHandler', () => {
  const dialog = new EventTarget();

  it('closes the dialog for a click on the dialog itself, which is its backdrop', () => {
    const close = jest.fn();
    backdropClickHandler(dialog, close)({ target: dialog });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('ignores a click on something inside the dialog', () => {
    const close = jest.fn();
    backdropClickHandler(dialog, close)({ target: new EventTarget() });
    expect(close).not.toHaveBeenCalled();
  });
});

describe('cancelHandler', () => {
  it('takes Escape over from the browser and closes through the dialog’s own state', () => {
    const close = jest.fn();
    const preventDefault = jest.fn();
    cancelHandler(true, close)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('refuses to close a dialog that is busy, but still stops the browser doing it', () => {
    const close = jest.fn();
    const preventDefault = jest.fn();
    cancelHandler(false, close)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });
});

describe('lockScroll', () => {
  /** A style declaration that remembers what was set. */
  function fakeStyle(initial: string) {
    const values = new Map([['overflow', initial]]);
    return {
      values,
      getPropertyValue: (name: string) => values.get(name) ?? '',
      setProperty: (name: string, value: string) => {
        values.set(name, value);
      },
    };
  }

  it('stops the page scrolling, and puts back exactly what was there', () => {
    const style = fakeStyle('scroll');
    const unlock = lockScroll(style);
    expect(style.values.get('overflow')).toBe('hidden');
    unlock();
    expect(style.values.get('overflow')).toBe('scroll');
  });

  it('puts back nothing when nothing was set before', () => {
    const style = fakeStyle('');
    lockScroll(style)();
    expect(style.values.get('overflow')).toBe('');
  });
});
