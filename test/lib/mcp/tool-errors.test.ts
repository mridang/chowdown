import { describe, expect, it } from '@jest/globals';

import { BackendFailure, InvalidToolArguments, UnknownTool } from '@/lib/mcp';

describe('UnknownTool', () => {
  it('names the tool the caller asked for', () => {
    const error = new UnknownTool('make_coffee');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('UnknownTool');
    expect(error.tool).toBe('make_coffee');
    expect(error.message).toBe('Unknown tool: make_coffee');
  });
});

describe('InvalidToolArguments', () => {
  it('carries each problem and reads them as one message', () => {
    const error = new InvalidToolArguments([
      '`a` is required.',
      '`b` is wrong.',
    ]);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidToolArguments');
    expect(error.problems).toEqual(['`a` is required.', '`b` is wrong.']);
    expect(error.message).toBe(
      'Invalid arguments: `a` is required. `b` is wrong.',
    );
  });
});

describe('BackendFailure', () => {
  it('names the service and keeps the cause out of the message', () => {
    const cause = new Error('secret details');
    const error = new BackendFailure('Google Drive', cause);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BackendFailure');
    expect(error.service).toBe('Google Drive');
    expect(error.cause).toBe(cause);
    expect(error.message).toBe('Google Drive failed');
  });
});
