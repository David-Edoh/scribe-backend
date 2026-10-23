import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../src/modules/users/users.service';
import { overrideE2eProviders } from './helpers/e2e-test-utils';

jest.setTimeout(30000);

describe('VoiceProfile CRUD Operations', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let usersService: any;
  let testUser: any;
  let testProfile: any;

  beforeAll(async () => {
    // Ensure JWT_SECRET is set before creating test module
    process.env.JWT_SECRET = 'dev_jwt_secret';

    const overrides = overrideE2eProviders(Test.createTestingModule({
      imports: [AppModule],
    }));
    const moduleFixture: TestingModule = await overrides.builder.compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    usersService = moduleFixture.get<UsersService>(UsersService);

    // Setup test user via Prisma AND UsersService for consistency
    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    const displayName = 'Test Prophet';

    // Create user in UsersService (in-memory) so JWT validation can find the user
    const createdUser = await usersService.create(email, password, displayName);
    if (!createdUser) {
      throw new Error('Failed to create test user via UsersService');
    }

    // Also create in Prisma so VoiceProfile foreign key constraint works
    // Note: Prisma schema expects password, but UsersService uses passwordHash
    const prismaUser = await prismaService.user.create({
      data: {
        id: createdUser.id,
        email: createdUser.email,
        password: password, // Store original password (Prisma field name)
        name: createdUser.displayName,
      },
    });

    // Use JwtService to sign token - ensures secret consistency
    const token = jwtService.sign({
      sub: createdUser.id,
      email: createdUser.email,
    });
    testUser = { userId: createdUser.id, email, token };
  });

  afterAll(async () => {
    // UsersService is in-memory, no cleanup needed
    // Just close the app
    await app.close();
  }, 15000);

  it('should create a voice profile', async () => {
    const payload = {
      name: 'Test Prophet',
      biography: 'A test biography',
      signaturePhrases: ['Test phrase'],
    };

    const res = await request(app.getHttpServer())
      .post('/api/voice-profiles')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(payload.name);
    testProfile = res.body;
  });

  it('should retrieve all profiles', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/voice-profiles')
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should retrieve a specific profile', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/voice-profiles/${testProfile.id}`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testProfile.id);
    expect(res.body.name).toBe('Test Prophet');
  });

  it('should update a profile', async () => {
    const updatePayload = {
      name: 'Updated Prophet',
      biography: 'Updated bio',
    };

    const res = await request(app.getHttpServer())
      .put(`/api/voice-profiles/${testProfile.id}`)
      .set('Authorization', `Bearer ${testUser.token}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(updatePayload.name);
  });

  it('should delete a profile', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/voice-profiles/${testProfile.id}`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(200);

    const getRes = await request(app.getHttpServer())
      .get(`/api/voice-profiles/${testProfile.id}`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(getRes.status).toBe(404);
  });

  describe('Non-Existent Resource Handling', () => {
    const fakeUuid = '12345678-1234-1234-1234-123456789012';

    it('should return 404 when getting non-existent profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/voice-profiles/${fakeUuid}`)
        .set('Authorization', `Bearer ${testUser.token}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 when updating non-existent profile', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/voice-profiles/${fakeUuid}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(404);
    });

    it('should return 404 when deleting non-existent profile', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/voice-profiles/${fakeUuid}`)
        .set('Authorization', `Bearer ${testUser.token}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 with invalid UUID format', async () => {
      const invalidUuid = 'not-a-uuid';
      const res = await request(app.getHttpServer())
        .get(`/api/voice-profiles/${invalidUuid}`)
        .set('Authorization', `Bearer ${testUser.token}`);

      expect(res.status).toBe(404); // Prisma returns 404 for invalid UUID format
    });
  });

  it('should reject requests without authentication', async () => {
    const res = await request(app.getHttpServer()).get('/api/voice-profiles');

    expect(res.status).toBe(401);
  });

  it('should reject requests with invalid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/voice-profiles')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });
});
