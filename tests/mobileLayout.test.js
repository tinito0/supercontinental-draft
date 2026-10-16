import { describe, it, expect } from 'vitest';
import { getGridMetrics, chunkRows } from '../utils/marketGrid.js';
import { fitWithin, resizeImageFile, MAX_LOGO_SIZE } from '../utils/resizeImage.js';

describe('marketplace grid geometry (utils/marketGrid.js)', () => {
  it('fills a 360 px phone with two equal columns and a 390 px phone too', () => {
    expect(getGridMetrics(328)).toEqual({ columns: 2, gap: 12 });
    expect(getGridMetrics(358)).toEqual({ columns: 2, gap: 12 });
  });

  it('never drops below two columns on the narrowest phones', () => {
    expect(getGridMetrics(288).columns).toBe(2);
    expect(getGridMetrics(0).columns).toBe(2);
  });

  it('adds columns from the list width, not the window width', () => {
    expect(getGridMetrics(720).columns).toBe(3); // tablet portrait
    expect(getGridMetrics(1070).columns).toBe(5); // 1366 laptop with sidebar
    expect(getGridMetrics(1144).columns).toBe(6); // 1440 with sidebar (~177 px cards)
    expect(getGridMetrics(1624).columns).toBe(8); // 1920 with sidebar
  });

  it('compact density fits more, smaller cards', () => {
    expect(getGridMetrics(328, 'compact').columns).toBe(3);
    expect(getGridMetrics(1144, 'compact').columns).toBe(7);
  });

  it('chunks players into rows of the column count', () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkRows([], 3)).toEqual([]);
  });
});

describe('logo resize', () => {
  it('fits within 512 px keeping the aspect ratio and never upscales', () => {
    expect(fitWithin(12756, 12756)).toEqual({ width: MAX_LOGO_SIZE, height: MAX_LOGO_SIZE });
    expect(fitWithin(1200, 968)).toEqual({ width: 512, height: 413 });
    expect(fitWithin(200, 100)).toEqual({ width: 200, height: 100 });
  });

  it('returns the original file when the browser APIs are not available', async () => {
    const file = { name: 'x.png', size: 10, type: 'image/png' };
    expect(await resizeImageFile(file)).toBe(file);
  });
});
