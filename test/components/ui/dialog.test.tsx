import { describe, expect, it } from '@jest/globals';

import {
  Dialog,
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
