import { describe, expect, it } from '@jest/globals';

import {
  FormField,
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

describe('TextInput and TextArea', () => {
  it('share one look', () => {
    expect(classOf(html(<TextInput />), 'input')).toContain('border-ink/25');
    expect(classOf(html(<TextArea />), 'textarea')).toContain('border-ink/25');
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
