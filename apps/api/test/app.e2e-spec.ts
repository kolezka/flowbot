import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET) should require authentication', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(401);
  });

  it('/api/auth/login (POST) should return token with valid secret', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ password: 'change-me-in-production' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('token');
      });
  });

  it('/api/auth/login (POST) should reject invalid password', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ password: 'wrong' })
      .expect(401);
  });

  it('/ (GET) should succeed with valid token', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ password: 'change-me-in-production' })
      .expect(200);

    return request(app.getHttpServer())
      .get('/')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .expect(200)
      .expect('Hello World!');
  });
});
