import { GoogleIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';

/**
 * The Google sign-in button used throughout the landing page. It is a plain
 * link to the sign-in route, so it works without any client script.
 */
export function SignInButton({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  return (
    <ButtonLink href="/api/auth/login" size={size}>
      <GoogleIcon size="md" />
      Continue with Google
    </ButtonLink>
  );
}
