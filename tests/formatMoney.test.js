import { formatMoney, formatPriceShort } from '../utils/helpers.js';

describe('formatMoney', () => {
  test('shows whole units as millions with a decimal comma', () => {
    expect(formatMoney(200000000)).toBe('$200,00M');
    expect(formatMoney(12500000)).toBe('$12,50M');
    expect(formatMoney(0)).toBe('$0,00M');
  });

  test('puts the minus sign before the currency symbol when overdrawn', () => {
    expect(formatMoney(-3200000)).toBe('-$3,20M');
    expect(formatPriceShort(-0.75)).toBe('-$0,75M');
  });

  test('does not print a negative zero', () => {
    expect(formatMoney(-1)).toBe('$0,00M');
    expect(formatMoney(-0)).toBe('$0,00M');
  });

  test('falls back to zero for values that are not numbers', () => {
    expect(formatMoney(undefined)).toBe('$0,00M');
    expect(formatMoney(NaN)).toBe('$0,00M');
    expect(formatMoney('abc')).toBe('$0,00M');
  });
});
