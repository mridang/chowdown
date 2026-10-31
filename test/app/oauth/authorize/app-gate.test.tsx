import { describe, expect, it } from '@jest/globals';

import { approvalGate } from '@/app/oauth/authorize/app-gate';
import type { User } from '@/domain/auth/store';
import { htmlAt } from '../../../components/render';

const HERE = '/oauth/authorize?client_id=dcr_abc&state=xyz';

const user = (extra: Partial<User> = {}) =>
  ({
    id: 7,
    email: 'cook@example.com',
    refresh_token_enc: 'sealed',
    recipes_folder_id: 'folder-1',
    ...extra,
  }) as User;

/** The gate's markup for a person, or null when it lets them through. */
function gate(person: User): string | null {
  const element = approvalGate(person, HERE);
  return element ? htmlAt(element) : null;
}

describe('approvalGate', () => {
  it('lets a person with Drive connected go on to approve', () => {
    expect(gate(user())).toBeNull();
  });

  it('asks a person without Drive to connect it first', () => {
    expect(gate(user({ refresh_token_enc: null }))).toContain('/auth/drive');
  });

  it('comes straight back to the approval once Drive is connected', () => {
    expect(gate(user({ refresh_token_enc: null }))).toContain(
      encodeURIComponent(HERE),
    );
  });

  it('heads the screen it shows, as the page has no other heading', () => {
    expect(gate(user({ refresh_token_enc: null }))?.match(/<h1/g)).toHaveLength(
      1,
    );
  });

  it('asks a person whose Drive connection was lost to reconnect it', () => {
    expect(
      gate(user({ refresh_token_enc: null, recipes_folder_id: 'folder-1' })),
    ).toContain('Reconnect your Google Drive');
  });

  it('asks a person who never connected Drive to connect it', () => {
    expect(
      gate(user({ refresh_token_enc: null, recipes_folder_id: null })),
    ).toContain('Connect your Google Drive');
  });
});
