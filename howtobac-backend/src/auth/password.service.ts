import { Injectable, OnModuleInit } from '@nestjs/common';
import argon2 from 'argon2';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  async onModuleInit() {
    this.dummyHash = await argon2.hash('placeholder-for-timing-equalisation');
  }

  hash(password: string) {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  verify(hash: string, password: string) {
    return argon2.verify(hash, password);
  }

  /**
   * Burns the same time as a real verify. Call it when the email is unknown so
   * response time doesn't reveal whether an account exists. Always false.
   */
  async verifyDummy(password: string): Promise<false> {
    await argon2.verify(this.dummyHash, password);
    return false;
  }
}
