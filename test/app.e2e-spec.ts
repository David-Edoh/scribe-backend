import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { overrideE2eProviders } from './helpers/e2e-test-utils';

/**
 * App-wide E2E tests
 * Verifies basic health check and global routing
 */
describe('App (E2E - Global Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const overrides = overrideE2eProviders(Test.createTestingModule({
      imports: [AppModule],
    }));
    const moduleFixture: TestingModule = await overrides.builder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health (Health Check)', () => {
    it('should return healthy status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.status).toBe(200);
    });
  });

  describe('Global API routing', () => {
    it('should return 404 for undefined routes', async () => {
      await request(app.getHttpServer())
        .get('/api/undefined-route-xyz')
        .expect(404);
    });

    it('should support requests from frontend origin', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
    });
  });

  describe('Request validation', () => {
    it('should validate malformed JSON', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/voice-profiles')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });

  describe('Root path', () => {
    it('should handle root path', async () => {
      const response = await request(app.getHttpServer()).get('/');

      expect([200, 301, 302, 404]).toContain(response.status);
    });
  });
});
