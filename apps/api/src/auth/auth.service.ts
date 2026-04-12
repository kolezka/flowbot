import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly secret: string;
  private readonly jwtSecret: string;

  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('DASHBOARD_SECRET');
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('DASHBOARD_SECRET must be set in production');
    }
    this.secret = secret || 'change-me-in-production';
    this.jwtSecret =
      configService.get<string>('JWT_SECRET') || this.secret;
  }

  validateSecret(password: string): boolean {
    const a = Buffer.from(password);
    const b = Buffer.from(this.secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
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
      const sigBuf = Buffer.from(signature, 'base64url');
      const expBuf = Buffer.from(expectedSig, 'base64url');
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf))
        return false;

      const payload = JSON.parse(
        Buffer.from(data, 'base64url').toString(),
      );
      return payload.exp > Date.now();
    } catch {
      return false;
    }
  }
}
