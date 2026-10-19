import { describe, expect, it } from '@jest/globals';

import {
  FormField,
  describedByIds,
  FormMessage,
  Select,
  SelectField,
  TextArea,
  TextInput,
} from '../../../src/components/ui/field';
import { classOf, html } from '../render';

describe('FormField', () => {
  it('ties the label to the control by id, with help text under it', () => {
    const out = html(
      <FormField id="name" label="Recipe name" hint="What to call it.">
        <TextInput id="name" />
      </FormField>,
    );
    expect(out).toContain('for="name"');
    expect(out).toContain('id="name"');
    expect(out).toContain('id="name-hint"');
    expect(out.indexOf('Recipe name')).toBeLessThan(
      out.indexOf('What to call it.'),
    );
  });

  it('points the control at its help text so the help is read with the field', () => {
    const out = html(
      <FormField id="cook" label="Cooklang" hint="Paste it here.">
        <TextArea id="cook" />
      </FormField>,
    );
    expect(out).toContain('aria-describedby="cook-hint"');
    expect(out).toContain('id="cook-hint"');
  });

  it('adds no describedby when there is no help text', () => {
    const out = html(
      <FormField id="cook" label="Cooklang">
        <TextArea id="cook" />
      </FormField>,
    );
    expect(out).not.toContain('aria-describedby');
  });

  it('marks the control invalid and points it at the error, which is announced', () => {
    const out = html(
      <FormField id="name" label="Recipe name" error="A name is needed.">
        <TextInput id="name" />
      </FormField>,
    );
    expect(out).toMatch(/<input[^>]*aria-invalid="true"/);
    expect(out).toMatch(/<input[^>]*aria-describedby="name-error"/);
    expect(out).toMatch(
      /<p id="name-error" role="alert"[^>]*>A name is needed\.<\/p>/,
    );
  });

  it('points the control at both its help text and its error', () => {
    const out = html(
      <FormField id="cook" label="Cooklang" hint="Paste it." error="Empty.">
        <TextArea id="cook" />
      </FormField>,
    );
    expect(out).toContain('aria-describedby="cook-hint cook-error"');
  });

  it('does not mark a valid control invalid', () => {
    const out = html(
      <FormField id="cook" label="Cooklang" hint="Paste it.">
        <TextArea id="cook" />
      </FormField>,
    );
    expect(out).not.toContain('aria-invalid');
    expect(out).not.toContain('role="alert"');
  });

  it('leaves the help line out when there is none', () => {
    expect(
      html(
        <FormField id="a" label="A">
          <TextInput id="a" />
        </FormField>,
      ),
    ).not.toContain('-hint');
  });
});

describe('describedByIds', () => {
  it('joins the ids that are present', () => {
    expect(describedByIds(['a-hint', undefined, 'a-error'])).toBe(
      'a-hint a-error',
    );
  });

  it('is nothing when none are present, so no attribute is written', () => {
    expect(describedByIds([undefined, undefined])).toBeUndefined();
    expect(describedByIds([])).toBeUndefined();
  });
});

describe('TextInput and TextArea', () => {
  it('share one look', () => {
    expect(classOf(html(<TextInput />), 'input')).toContain('border-field');
    expect(classOf(html(<TextArea />), 'textarea')).toContain('border-field');
  });

  it('darken their edge on hover as well as focus, since the resting edge is now clear', () => {
    expect(classOf(html(<TextInput />), 'input')).toContain('hover:border-ink');
    expect(classOf(html(<TextInput />), 'input')).not.toContain(
      'hover:border-ink/50',
    );
  });

  it('show code-like text in a monospace face on request', () => {
    expect(classOf(html(<TextArea mono />), 'textarea')).toContain('font-mono');
    expect(classOf(html(<TextArea />), 'textarea')).not.toContain('font-mono');
  });
});

describe('FormMessage', () => {
  it('announces an error, and only an error', () => {
    expect(html(<FormMessage tone="error">bad</FormMessage>)).toContain(
      'role="alert"',
    );
    expect(html(<FormMessage tone="note">fyi</FormMessage>)).not.toContain(
      'role=',
    );
  });
});

describe('Select and SelectField', () => {
  it('draws its own chevron over a native select', () => {
    const out = html(
      <Select defaultValue="a">
        <option value="a">A</option>
      </Select>,
    );
    expect(out).toContain('<select');
    expect(out).toContain('<svg');
    expect(classOf(out, 'select')).toContain('appearance-none');
  });

  it('puts the label beside the select', () => {
    const out = html(
      <SelectField label="Sort">
        <option>x</option>
      </SelectField>,
    );
    expect(out).toContain('<label');
    expect(out.indexOf('Sort')).toBeLessThan(out.indexOf('<select'));
  });
});
