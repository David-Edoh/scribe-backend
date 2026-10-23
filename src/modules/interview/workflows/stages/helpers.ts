export function extractAnchorScriptures(scriptureText: string): string[] {
  const scriptureRegex = /\b[\d\s]?[A-Za-z]+\s+[\d:,-]+\b/g;
  const matches = scriptureText.match(scriptureRegex) || [];
  return matches.slice(0, 5);
}

export function isProfileValid(profile: any, logger: any): boolean {
  const hasSignaturePhrases =
    Array.isArray(profile.signaturePhrases) && profile.signaturePhrases.length > 0;
  const hasAnchorScriptures =
    Array.isArray(profile.anchorScriptures) && profile.anchorScriptures.length > 0;
  const hasMinistryDNA = profile.ministryDNA && profile.ministryDNA.length > 20;

  const valid = hasSignaturePhrases && hasAnchorScriptures && hasMinistryDNA;

  if (!valid) {
    logger.warn(
      `Profile validation failed. Phrases: ${hasSignaturePhrases}, Scriptures: ${hasAnchorScriptures}, MinistryDNA: ${hasMinistryDNA}`,
    );
  }

  return valid;
}
