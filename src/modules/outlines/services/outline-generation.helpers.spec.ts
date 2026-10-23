import { parseOutlineResponse } from './outline-generation.helpers';

describe('outline generation helpers', () => {
  it('parses the expected markdown chapter format', () => {
    const outline = parseOutlineResponse(
      `## Overall Theme & Purpose
Purpose begins with divine intention.

**Chapter 1: Created With Intention**
Objectives:
- Establish that life is not accidental
- Connect identity to divine design

Key Points:
- Creation reveals intention
- Purpose starts with God

Est. Word Count: 1500

**Chapter 2: Living the Assignment**
Objectives:
- Explain assignment

Key Points:
- Obedience matters

Est. Word Count: 1200

## Themes
Primary themes:
- Purpose
- Identity`,
      'Purpose of Life',
      'Why we exist',
    );

    expect(outline.chapters).toHaveLength(2);
    expect(outline.chapters[0]).toMatchObject({
      number: 1,
      title: 'Created With Intention',
      estimatedWordCount: 1500,
    });
    expect(outline.chapters[0].objectives).toContain(
      'Establish that life is not accidental',
    );
    expect(outline.themes).toContain('Purpose');
  });

  it('parses numbered outline chapters when markdown headings vary', () => {
    const outline = parseOutlineResponse(
      `1. Created With Intention
- Life is not accidental
- Purpose starts with identity
- God designs before He deploys

2. Serving With What You Carry
- Gifts are stewardship
- Purpose blesses others
- Obedience gives shape to calling`,
      'Purpose of Life',
      'Why we exist',
    );

    expect(outline.chapters).toHaveLength(2);
    expect(outline.chapters[1].title).toBe('Serving With What You Carry');
    expect(outline.chapters[1].keyPoints.length).toBeGreaterThan(0);
  });

  it('falls back to a non-empty outline when parsing fails', () => {
    const outline = parseOutlineResponse(
      'This manuscript should explore why we exist and how to live aligned.',
      'Purpose of Life',
      'Why we exist',
    );

    expect(outline.chapters.length).toBeGreaterThan(0);
    expect(outline.estimatedWordCount).toBeGreaterThan(0);
  });
});
