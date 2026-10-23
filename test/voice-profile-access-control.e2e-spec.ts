import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../src/modules/users/users.service';
import { overrideE2eProviders } from './helpers/e2e-test-utils';

jest.setTimeout(30000);

describe('VoiceProfile User Isolation & Access Control (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let usersService: UsersService;

  let userA: any;
  let userB: any;
  let profileA: any;
  let profileB: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'dev_jwt_secret';

    const overrides = overrideE2eProviders(Test.createTestingModule({
      imports: [AppModule],
    }));
    const module: TestingModule = await overrides.builder.compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    usersService = module.get<UsersService>(UsersService);

    // Create User A
    const createdUserA = await usersService.create(
      `user-a-${Date.now()}@example.com`,
      'PasswordA123!',
      'User A',
    );
    await prisma.user.create({
      data: {
        id: createdUserA.id,
        email: createdUserA.email,
        password: 'PasswordA123!',
        name: createdUserA.displayName,
      },
    });
    const tokenA = jwtService.sign({
      sub: createdUserA.id,
      email: createdUserA.email,
    });
    userA = { id: createdUserA.id, email: createdUserA.email, token: tokenA };

    // Create User B
    const createdUserB = await usersService.create(
      `user-b-${Date.now()}@example.com`,
      'PasswordB123!',
      'User B',
    );
    await prisma.user.create({
      data: {
        id: createdUserB.id,
        email: createdUserB.email,
        password: 'PasswordB123!',
        name: createdUserB.displayName,
      },
    });
    const tokenB = jwtService.sign({
      sub: createdUserB.id,
      email: createdUserB.email,
    });
    userB = { id: createdUserB.id, email: createdUserB.email, token: tokenB };

    // Create profile for User A
    profileA = await prisma.voiceProfile.create({
      data: {
        userId: userA.id,
        name: 'Prophetic Voice A',
        biography: 'User A profile',
      },
    });

    // Create profile for User B
    profileB = await prisma.voiceProfile.create({
      data: {
        userId: userB.id,
        name: 'Apostolic Voice B',
        biography: 'User B profile',
      },
    });
  });

  afterAll(async () => {
    // Cleanup profiles
    if (profileA) {
      await prisma.voiceProfileEmbedding.deleteMany({
        where: { voiceProfileId: profileA.id },
      });
      await prisma.voiceProfile.delete({ where: { id: profileA.id } });
    }
    if (profileB) {
      await prisma.voiceProfileEmbedding.deleteMany({
        where: { voiceProfileId: profileB.id },
      });
      await prisma.voiceProfile.delete({ where: { id: profileB.id } });
    }
    // Cleanup users
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });
    await app.close();
  });

  describe('Cross-User GET Access Control', () => {
    it('should allow User A to read their own profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/voice-profiles/${profileA.id}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(profileA.id);
      expect(res.body.name).toBe('Prophetic Voice A');
    });

    it('should allow User B to read their own profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/voice-profiles/${profileB.id}`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(profileB.id);
      expect(res.body.name).toBe('Apostolic Voice B');
    });

    it("should deny User B from reading User A's profile (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/voice-profiles/${profileA.id}`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(res.status).toBe(403);
    });

    it("should deny User A from reading User B's profile (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/voice-profiles/${profileB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Cross-User PUT Access Control', () => {
    it('should allow User A to update their own profile', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/voice-profiles/${profileA.id}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Updated Prophetic Voice' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Prophetic Voice');
    });

    it("should deny User B from updating User A's profile (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/voice-profiles/${profileA.id}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);

      // Verify profile was not actually updated
      const verified = await prisma.voiceProfile.findUnique({
        where: { id: profileA.id },
      });
      expect(verified.name).toBe('Updated Prophetic Voice'); // Should still have old value
    });

    it("should deny User A from updating User B's profile (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/voice-profiles/${profileB.id}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);

      // Verify profile was not updated
      const verified = await prisma.voiceProfile.findUnique({
        where: { id: profileB.id },
      });
      expect(verified.name).toBe('Apostolic Voice B'); // Should still have original value
    });
  });

  describe('Cross-User DELETE Access Control', () => {
    let tempProfileA: any;
    let tempProfileB: any;

    beforeAll(async () => {
      // Create additional profiles for deletion tests
      tempProfileA = await prisma.voiceProfile.create({
        data: {
          userId: userA.id,
          name: 'Temp Profile A',
          biography: 'To be deleted',
        },
      });
      tempProfileB = await prisma.voiceProfile.create({
        data: {
          userId: userB.id,
          name: 'Temp Profile B',
          biography: 'To be deleted',
        },
      });
    });

    afterAll(async () => {
      // Cleanup any remaining temp profiles
      const remainingA = await prisma.voiceProfile.findUnique({
        where: { id: tempProfileA.id },
      });
      const remainingB = await prisma.voiceProfile.findUnique({
        where: { id: tempProfileB.id },
      });

      if (remainingA) {
        await prisma.voiceProfileEmbedding.deleteMany({
          where: { voiceProfileId: tempProfileA.id },
        });
        await prisma.voiceProfile.delete({ where: { id: tempProfileA.id } });
      }
      if (remainingB) {
        await prisma.voiceProfileEmbedding.deleteMany({
          where: { voiceProfileId: tempProfileB.id },
        });
        await prisma.voiceProfile.delete({ where: { id: tempProfileB.id } });
      }
    });

    it('should allow User A to delete their own profile', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/voice-profiles/${tempProfileA.id}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);

      // Verify profile is deleted
      const deleted = await prisma.voiceProfile.findUnique({
        where: { id: tempProfileA.id },
      });
      expect(deleted).toBeNull();
    });

    it("should deny User B from deleting User A's profile (403 Forbidden)", async () => {
      // Create a new profile for User A
      const profileForDeletion = await prisma.voiceProfile.create({
        data: {
          userId: userA.id,
          name: 'Profile To Protect',
          biography: 'Should not be deleted',
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/voice-profiles/${profileForDeletion.id}`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(res.status).toBe(403);

      // Verify profile still exists
      const stillExists = await prisma.voiceProfile.findUnique({
        where: { id: profileForDeletion.id },
      });
      expect(stillExists).not.toBeNull();

      // Cleanup
      await prisma.voiceProfileEmbedding.deleteMany({
        where: { voiceProfileId: profileForDeletion.id },
      });
      await prisma.voiceProfile.delete({
        where: { id: profileForDeletion.id },
      });
    });

    it("should deny User A from deleting User B's profile (403 Forbidden)", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/voice-profiles/${tempProfileB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(403);

      // Verify profile still exists
      const stillExists = await prisma.voiceProfile.findUnique({
        where: { id: tempProfileB.id },
      });
      expect(stillExists).not.toBeNull();
    });
  });

  describe('User Isolation in List Operations', () => {
    it("should only return User A's profiles when User A calls GET /voice-profiles", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/voice-profiles')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // All returned profiles should belong to User A
      res.body.forEach((profile: any) => {
        expect(profile.userId).toBe(userA.id);
      });

      // Should not contain User B's profiles
      const userBProfileNames = res.body.map((p: any) => p.name);
      expect(userBProfileNames).not.toContain('Apostolic Voice B');
    });

    it("should only return User B's profiles when User B calls GET /voice-profiles", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/voice-profiles')
        .set('Authorization', `Bearer ${userB.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // All returned profiles should belong to User B
      res.body.forEach((profile: any) => {
        expect(profile.userId).toBe(userB.id);
      });

      // Should not contain User A's profiles
      const userAProfileNames = res.body.map((p: any) => p.name);
      expect(userAProfileNames).not.toContain('Updated Prophetic Voice');
    });
  });

  describe('Non-Existent Profile Access', () => {
    const fakeUuid = '12345678-1234-1234-1234-123456789012';

    it('should return 404 when User A tries to access non-existent profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/voice-profiles/${fakeUuid}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 when User A tries to update non-existent profile', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/voice-profiles/${fakeUuid}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 404 when User A tries to delete non-existent profile', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/voice-profiles/${fakeUuid}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(404);
    });
  });
});
