import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;
  private senderEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY') || '';
    this.senderEmail = this.configService.get<string>('SENDER_EMAIL') || '';
    this.resend = new Resend(apiKey);
  }

  async sendVerificationEmail(
    email: string,
    verificationLink: string,
    displayName?: string | null,
  ): Promise<void> {
    const name = displayName ? displayName.split(' ')[0] : 'Friend';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding-bottom: 30px; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background-color: #000000; color: white !important; padding: 12px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            .logo { font-size: 28px; font-weight: bold; color: #000000; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">The Scribe</div>
              <p style="color: #666; margin: 0;">AI-Powered Christian Writing Assistant</p>
            </div>
            
            <div class="content">
              <h2>Verify Your Email</h2>
              <p>Hi ${name},</p>
              <p>Welcome to Scribe! To get started with your spiritual writing journey, please verify your email address by clicking the button below:</p>
              
              <center>
                <a href="${verificationLink}" class="button">Verify Email Address</a>
              </center>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Or copy and paste this link in your browser:</p>
              <p style="background-color: white; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; color: #666;">
                ${verificationLink}
              </p>
              
              <p style="color: #999; font-size: 12px; margin-top: 20px;">This link will expire in 24 hours.</p>
            </div>
            
            <div class="footer">
              <p>The Scribe is your creative AI companion for apostolic, prophetic, and Spirit-filled ministry writing.</p>
              <p>&copy; 2026 Scribe. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await this.resend.emails.send({
        from: this.senderEmail,
        to: email,
        subject: 'Verify Your Scribe Email',
        html: htmlContent,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw error;
    }
  }
}
