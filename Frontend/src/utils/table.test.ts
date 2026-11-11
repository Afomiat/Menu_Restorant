import { describe, expect, it } from 'vitest';
import { groupLabel, tableLabel } from './table';

describe('tableLabel', () => {
  it('puts "Table" in front of a plain table name', () => {
    expect(tableLabel('5')).toBe('Table 5');
    expect(tableLabel('Patio-2')).toBe('Table Patio-2');
  });

  it('does not repeat "Table" when the name already has it', () => {
    expect(tableLabel('Table 1')).toBe('Table 1');
    expect(tableLabel('table 7')).toBe('table 7');
    expect(tableLabel('TABLE-3')).toBe('TABLE-3');
  });

  it('keeps names that only start with the same letters', () => {
    expect(tableLabel('Tablet bar')).toBe('Table Tablet bar');
  });

  it('copes with numbers and empty values', () => {
    expect(tableLabel(12)).toBe('Table 12');
    expect(tableLabel('  ')).toBe('Table');
    expect(tableLabel(undefined)).toBe('Table');
  });

  it('shows the old kitchen group keys without doubling "Table"', () => {
    expect(groupLabel('Table 5')).toBe('Table 5');
    expect(groupLabel('Table Table 1')).toBe('Table 1');
    expect(groupLabel('Direct Orders')).toBe('Direct Orders');
  });
});
