// Confidence after the same-season check (pes/formats/pes2021/playerEvidence.js). SYNTHETIC: field descriptors only.
import { withSameSeasonEvidence } from '../../pes/formats/pes2021/playerEvidence.js';

const field = (name, confidence) => ({ name, kind: 'bits', offset: 0, shift: 0, bits: 7, addend: 0, confidence, evidence: 'ejogc' });
const full = { equal: 100, total: 100 };

describe('withSameSeasonEvidence', () => {
  it('raises structural fields that equal the export', () => {
    const [f] = withSameSeasonEvidence([field('weight', 'structural')], { weight: full });
    expect(f.confidence).toBe('verified');
  });

  it('keeps a field that differs from the export', () => {
    const [f] = withSameSeasonEvidence([field('weight', 'structural')], { weight: { equal: 90, total: 100 } });
    expect(f.confidence).toBe('structural');
  });

  it('needs a second source for unverified fields', () => {
    const [form, other] = withSameSeasonEvidence([field('form', 'unverified'), field('mystery', 'unverified')], { form: full, mystery: full });
    expect(form.confidence).toBe('verified');
    expect(other.confidence).toBe('unverified');
  });

  it('takes the EJOGC goalkeeper names', () => {
    const [f] = withSameSeasonEvidence([field('gkReach', 'unverified')], { gkReach: full });
    expect(f.confidence).toBe('verified');
    expect(f.evidence).toMatch(/height/);
  });
});
