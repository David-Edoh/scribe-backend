import { Injectable, Logger } from '@nestjs/common';
import { VoiceProfileRepository } from '../voice-profile.repository';
import { VoiceProfileModel } from '../models/voice-profile.model';

@Injectable()
export class VoiceProfileService {
  private readonly logger = new Logger(VoiceProfileService.name);

  constructor(private readonly repo: VoiceProfileRepository) {}

  async create(dto: any): Promise<VoiceProfileModel> {
    this.logger.debug(
      `[SERVICE-CREATE] Creating voice profile - name: ${dto.name}`,
    );
    const result = await this.repo.create(dto);
    this.logger.debug(
      `[SERVICE-CREATE] Voice profile created - id: ${result.id}`,
    );
    return result;
  }

  async findAllByUser(userId: string): Promise<VoiceProfileModel[]> {
    return this.repo.findAllByUser(userId);
  }

  async findById(id: string): Promise<VoiceProfileModel | null> {
    return this.repo.findById(id);
  }

  async update(id: string, changes: any): Promise<VoiceProfileModel> {
    return this.repo.update(id, changes);
  }

  async remove(id: string): Promise<VoiceProfileModel> {
    return this.repo.remove(id);
  }
}
