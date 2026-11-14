import { describe, expect, it, jest } from '@jest/globals';

import { callTool } from '@/domain/mcp/tool-calls';
import { SetMeasurementSystemTool } from '@/domain/mcp/tools/set-measurement-system';

import { USER, fakeServices, folder, said } from '../../../lib/mcp/tool-fakes';

describe('set_measurement_system', () => {
  it('remembers the system without opening Drive', async () => {
    const services = fakeServices();
    const open = jest.fn(async () => folder().ctx);
    const result = await callTool(
      USER,
      { name: 'set_measurement_system', arguments: { system: 'metric' } },
      {
        ...services,
        openDrive: open,
      },
    );
    expect(said(result)).toContain('metric');
    expect(services.setUnits).toHaveBeenCalledWith(7, 'metric');
    expect(open).not.toHaveBeenCalled();
  });
});

describe('SetMeasurementSystemTool.handle', () => {
  it('refuses a system it does not know, even though the schema already bounds it', async () => {
    const services = fakeServices();
    const result = await new SetMeasurementSystemTool().handle(
      { system: 'cubits' },
      { user: USER, services },
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toBe('Please choose metric, us, or imperial.');
    expect(services.setUnits).not.toHaveBeenCalled();
  });
});
