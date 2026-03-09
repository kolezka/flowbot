import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

@Injectable()
export class AuthService {
  private readonly secret: string;
  private readonly jwtSecret: string;

  constructor(private configService: ConfigService) {
    this.secret =
      configService.get<string>('DASHBOARD_SECRET') ||
      'change-me-in-production';
    this.jwtSecret =
      configService.get<string>('JWT_SECRET') || this.secret;
  }

  validateSecret(password: string): boolean {
    return password === this.secret;
  }

  generateToken(): string {
    const payload = {
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      iss: 'dashboard',
    };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.jwtSecret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  verifyToken(token: string): boolean {
    try {
      const [data, signature] = token.split('.');
      if (!data || !signature) return false;

      const expectedSig = createHmac('sha256', this.jwtSecret)
        .update(data)
        .digest('base64url');
      if (signature !== expectedSig) return false;

      const payload = JSON.parse(
        Buffer.from(data, 'base64url').toString(),
      );
      return payload.exp > Date.now();
    } catch {
      return false;
    }
  }
}
