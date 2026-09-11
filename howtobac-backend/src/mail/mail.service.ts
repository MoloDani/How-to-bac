import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../config/env.js';
import {
  accountExistsEmail,
  passwordResetEmail,
  verificationEmail,
  type MailContent,
} from './templates.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly appBaseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    const apiKey = config.get('RESEND_API_KEY', { infer: true });
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = config.get('MAIL_FROM', { infer: true });
    this.appBaseUrl = config.get('APP_BASE_URL', { infer: true });
  }

  sendVerificationEmail(to: string, token: string) {
    const url = `${this.appBaseUrl}/verify?token=${encodeURIComponent(token)}`;
    return this.send(to, verificationEmail(url), url);
  }

  sendPasswordResetEmail(to: string, token: string) {
    const url = `${this.appBaseUrl}/reset?token=${encodeURIComponent(token)}`;
    return this.send(to, passwordResetEmail(url), url);
  }

  sendAccountExistsEmail(to: string) {
    return this.send(
      to,
      accountExistsEmail(
        `${this.appBaseUrl}/login`,
        `${this.appBaseUrl}/forgot-password`,
      ),
    );
  }

  /**
   * Never throws: a mail outage shouldn't fail the request that triggered it.
   * The user can ask for the email again.
   */
  private async send(
    to: string,
    { subject, html }: MailContent,
    link?: string,
  ) {
    if (!this.resend) {
      // Development without RESEND_API_KEY (production refuses to boot without it).
      this.logger.log(`[not sent] to=${to} "${subject}" ${link ?? ''}`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });
      if (error) this.logger.error(`send failed: "${subject}"`, error);
    } catch (err) {
      this.logger.error(`send failed: "${subject}"`, err);
    }
  }
}
