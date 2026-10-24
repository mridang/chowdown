import { describe, expect, it } from '@jest/globals';

import { AccountMenu, Avatar } from '@/components/site/account-menu';
import { driveLink } from '@/components/site/drive-link';
import { htmlAt } from '../render';

describe('Avatar', () => {
  it('shows the person’s photo, without sending our address to Google', () => {
    const out = htmlAt(
      <Avatar name="Ada Lovelace" picture="https://photos.test/ada.png" />,
    );
    expect(out).toMatch(/<img[^>]*src="https:\/\/photos\.test\/ada\.png"/);
    expect(out).toContain('referrerPolicy="no-referrer"');
    expect(out).toContain('alt=""');
  });

  it('shows their initial when there is no photo', () => {
    const out = htmlAt(<Avatar name="ada" />);
    expect(out).not.toContain('<img');
    expect(out).toContain('>A<');
  });
});

describe('AccountMenu', () => {
  const out = htmlAt(
    <AccountMenu
      firstName="Ada"
      name="Ada Lovelace"
      email="ada@example.com"
      drive={driveLink({ driveConnected: true })}
    />,
  );

  it('greets the person by first name', () => {
    expect(out).toContain('Hi Ada');
  });

  it('has a button named for small screens, where the greeting is hidden', () => {
    expect(out).toContain('Account menu, signed in as Ada');
  });

  it('starts closed', () => {
    expect(out).toContain('aria-expanded="false"');
    expect(out).not.toContain('Sign out');
  });
});

describe('AccountMenu’s destructive item', () => {
  it('stays out of the page, with its confirmation, until the menu is opened', () => {
    const out = htmlAt(
      <AccountMenu
        firstName="Ada"
        name="Ada Lovelace"
        email="ada@example.com"
        drive={driveLink({ driveConnected: false })}
      />,
    );
    expect(out).not.toContain('Delete account');
    expect(out).not.toContain('Delete your account?');
  });
});
