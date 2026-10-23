import { Injectable } from '@nestjs/common';
import { VoiceProfileService } from '../../voice-profile/services/voice-profile.service';
import { VoiceProfileData } from './prompt-builder.types';

@Injectable()
export class VoiceProfileFormatter {
  constructor(private readonly voiceProfileService: VoiceProfileService) {}

  /**
   * Fetch and format voice profile data for prompt injection.
   * Returns the full structured extraction data so generation prompts
   * receive maximum author DNA with every field in its original form.
   */
  async formatVoiceProfile(
    userId: string,
    voiceProfileId: string,
  ): Promise<VoiceProfileData> {
    const profile = await this.voiceProfileService.findById(voiceProfileId);

    if (!profile) {
      throw new Error(`Voice profile ${voiceProfileId} not found`);
    }

    // Verify ownership
    if (profile.userId !== userId) {
      throw new Error('Unauthorized: Voice profile does not belong to user');
    }

    return {
      name:            profile.name,
      biography:       profile.biography || '',
      signaturePhrases: profile.signaturePhrases || [],
      anchorScriptures: profile.anchorScriptures || [],
      voiceThemes:     (profile as any).voiceThemes || [],
      toneMarkers:     (profile as any).toneMarkers || [],
      keyMessages:     (profile as any).keyMessages || [],
      recurringMotifs: (profile as any).recurringMotifs || [],
      writingStyle:    (profile as any).writingStyle || null,
      ministryDNA:     (profile as any).ministryDNA || '',
      // Legacy fields – used as fallback for profiles created before the migration
      theologicalFramework: profile.theologicalFramework || '',
      sampleTexts:          profile.sampleTexts || '',
    };
  }

  /**
   * Fetch multiple voice profiles and merge data
   */
  async mergeVoiceProfiles(
    userId: string,
    voiceProfileIds: string[],
  ): Promise<VoiceProfileData> {
    const profiles = await Promise.all(
      voiceProfileIds.map((id) => this.formatVoiceProfile(userId, id)),
    );

    if (profiles.length === 0) {
      throw new Error('No voice profiles found');
    }

    if (profiles.length === 1) {
      return profiles[0];
    }

    // Merge multiple profiles
    return {
      name:            profiles[0].name,
      biography:       profiles[0].biography,
      signaturePhrases: [...new Set(profiles.flatMap((p) => p.signaturePhrases))],
      anchorScriptures: [...new Set(profiles.flatMap((p) => p.anchorScriptures || []))],
      voiceThemes:     [...new Set(profiles.flatMap((p) => p.voiceThemes || []))],
      toneMarkers:     [...new Set(profiles.flatMap((p) => p.toneMarkers || []))],
      keyMessages:     [...new Set(profiles.flatMap((p) => p.keyMessages || []))],
      recurringMotifs: [...new Set(profiles.flatMap((p) => p.recurringMotifs || []))],
      writingStyle:    profiles[0].writingStyle,
      ministryDNA:     profiles[0].ministryDNA || '',
      theologicalFramework: profiles
        .filter((p) => p.theologicalFramework)
        .map((p) => p.theologicalFramework)
        .join('\n\n'),
      sampleTexts: profiles
        .filter((p) => p.sampleTexts)
        .map((p) => p.sampleTexts)
        .join('\n\n---\n\n'),
    };
  }
}
