/* eslint-disable tailwindcss/no-custom-classname -- the widget's classes are defined in src/views/styles.ts, not in a CSS file. */
/**
 * @packageDocumentation
 *
 * What a View shows when it has no data to draw: a skeleton while it waits (the
 * host's design guidance prefers these to spinners or bare text) and a message
 * panel when the call failed, was cancelled, timed out, or simply carried only
 * text. Both are announced to screen readers.
 */

import type { ReactElement } from 'react';

import type { FailureReason } from '@/views/view-state';

/** The heading for each way a View can come up empty. */
const HEADINGS: Readonly<Record<FailureReason, string>> = {
  error: 'Something went wrong',
  notice: 'Nothing to show',
  cancelled: 'Cancelled',
  connection: 'Could not connect',
  timeout: 'Still waiting',
};

/** Whether a screen reader should interrupt (`alert`) or wait its turn (`status`). */
export function liveRole(reason: FailureReason): 'alert' | 'status' {
  return reason === 'error' || reason === 'connection' ? 'alert' : 'status';
}

/**
 * Placeholder shaped like the finished content, shown while the data is on its
 * way. `request` says what was asked for when the host has told the View.
 */
export function LoadingCard({
  noun,
  request,
}: Readonly<{ noun: string; request?: string }>): ReactElement {
  return (
    <div className="wrap">
      <div className="card" aria-busy="true">
        <div className="skeleton" aria-hidden="true">
          <div className="bar title-bar" />
          <div className="bar" />
          <div className="bar short" />
        </div>
        <div className="status-line" role="status">
          {request ? `Loading ${noun}: ${request}…` : `Loading ${noun}…`}
        </div>
      </div>
    </div>
  );
}

/** A panel that says why there is nothing to draw, in the server's own words when it had any. */
export function MessageCard({
  reason,
  message,
}: Readonly<{ reason: FailureReason; message: string }>): ReactElement {
  return (
    <div className="wrap">
      <div
        className={
          reason === 'error' || reason === 'connection' ? 'card error' : 'card'
        }
        role={liveRole(reason)}
      >
        <div className="eyebrow">
          <span className="dot" aria-hidden="true" />
          {HEADINGS[reason]}
        </div>
        <p className="notice">{message}</p>
      </div>
    </div>
  );
}

/**
 * A line only screen readers get, announced politely whenever its text changes.
 * It is rendered from the first frame (an empty live region is what assistive
 * technology watches), so the arrival of the data is announced even though the
 * loading placeholder that preceded it disappears.
 */
export function Announcer({
  message,
}: Readonly<{ message: string }>): ReactElement {
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {message}
    </div>
  );
}
