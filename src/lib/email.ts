import { Resend } from "resend";

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim() || "";
  if (!key) {
    console.warn("⚠️ RESEND_API_KEY is not set in environment variables. Please add RESEND_API_KEY to Render dashboard.");
    return null;
  }
  try {
    return new Resend(key);
  } catch (err) {
    console.error("Failed to initialize Resend client:", err);
    return null;
  }
}

export interface WelcomeEmailParams {
  toEmail: string;
  name: string;
  username: string;
  accountType?: 'handler' | 'vet' | 'business';
  petName?: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<boolean> {
  const { toEmail, name, username, accountType, petName } = params;
  try {
    const resend = getResendClient();
    if (!resend) {
      console.log(`[WELCOME EMAIL FALLBACK LOG] To: ${toEmail} | Name: ${name} | Username: ${username}`);
      return false;
    }

    const fromAddress = process.env.EMAIL_FROM || "Animandler <onboarding@resend.dev>";
    const roleLabel = accountType === 'vet' 
      ? 'Verified Veterinarian' 
      : accountType === 'business' 
        ? 'Pet Business & Care Partner' 
        : 'Pet Handler & Parent';
    const petMention = petName ? ` & ${petName}` : '';

    const sendPromise = resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      subject: `Welcome to Animandler, ${name}! 🐾 Your Pet Community Awaits`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Animandler</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #080c14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f0f6fc;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #080c14; padding: 40px 16px;">
            <tr>
              <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #0d131f; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 36px 32px 24px 32px; background: linear-gradient(135deg, rgba(2, 122, 105, 0.25), rgba(6, 182, 212, 0.15)); border-bottom: 1px solid rgba(255,255,255,0.06); text-align: center;">
                      <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: linear-gradient(135deg, #027A69, #06b6d4); font-size: 28px; box-shadow: 0 4px 16px rgba(6, 182, 212, 0.4); margin-bottom: 12px;">🐾</div>
                      <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Anim<span style="color: #06b6d4;">andler</span></h1>
                      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Official Membership Welcome</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 32px 32px 20px 32px;">
                      <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #f1f5f9;">Welcome to the family, ${name}${petMention}! 🐶🐱</h2>
                      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                        We are thrilled to welcome you to <strong>Animandler</strong> — the global social and care platform celebrating companion animals, pet parents, and veterinary professionals.
                      </p>
                      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                        Whether you are sharing your pet's funniest moments, searching for trusted care services, or connecting with fellow pet lovers, your journey begins right now.
                      </p>

                      <!-- Membership Card -->
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 12px; margin-bottom: 28px;">
                        <tr>
                          <td style="padding: 18px 20px;">
                            <div style="font-size: 11px; text-transform: uppercase; color: #06b6d4; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">Your Membership Details</div>
                            <div style="font-size: 15px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">Handle: <span style="color: #38bdf8;">${username}</span></div>
                            <div style="font-size: 14px; color: #94a3b8; margin-bottom: 4px;">Tier: <span style="color: #f1f5f9; font-weight: 600;">${roleLabel}</span></div>
                            <div style="font-size: 14px; color: #94a3b8;">Community Hub: <span style="color: #f1f5f9;">Animandler.com • Lagos, Nigeria &amp; Worldwide</span></div>
                          </td>
                        </tr>
                      </table>

                      <!-- Quick Start Highlights -->
                      <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 14px;">What you can do on Animandler:</div>
                      
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                        <tr>
                          <td width="32" valign="top" style="font-size: 18px; line-height: 24px;">🎥</td>
                          <td style="padding-left: 10px; font-size: 14px; line-height: 20px; color: #e2e8f0;">
                            <strong>Short Video Feed:</strong> Share short pet clips, viral pet dances, and training wins with custom trending sounds.
                          </td>
                        </tr>
                      </table>

                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                        <tr>
                          <td width="32" valign="top" style="font-size: 18px; line-height: 24px;">🐾</td>
                          <td style="padding-left: 10px; font-size: 14px; line-height: 20px; color: #e2e8f0;">
                            <strong>Dedicated Pet Profiles:</strong> Showcase your pet's photos, breed, age, and personality with verified badges.
                          </td>
                        </tr>
                      </table>

                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                        <tr>
                          <td width="32" valign="top" style="font-size: 18px; line-height: 24px;">🛍️</td>
                          <td style="padding-left: 10px; font-size: 14px; line-height: 20px; color: #e2e8f0;">
                            <strong>Care &amp; Marketplace:</strong> Discover grooming, dog walking, boarding, healthy treats, and accessories.
                          </td>
                        </tr>
                      </table>

                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                        <tr>
                          <td width="32" valign="top" style="font-size: 18px; line-height: 24px;">🩺</td>
                          <td style="padding-left: 10px; font-size: 14px; line-height: 20px; color: #e2e8f0;">
                            <strong>Vet Hub:</strong> Connect with licensed veterinarians for guidance, clinic check-ins, and emergency advice.
                          </td>
                        </tr>
                      </table>

                      <!-- Call to Action Button -->
                      <div style="text-align: center; margin: 32px 0 24px 0;">
                        <a href="https://animandler.com" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #027A69, #06b6d4); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 28px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 18px rgba(6, 182, 212, 0.4); letter-spacing: 0.3px;">
                          Start Exploring Animandler ➔
                        </a>
                      </div>

                      <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: center;">
                        Need assistance or have feedback? Reach us anytime at <a href="mailto:support@animandler.com" style="color: #06b6d4; text-decoration: none;">support@animandler.com</a>.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px; background-color: #0a0e17; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
                      <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                        Animandler.com • Lagos, Nigeria &amp; Global Pet Community
                      </p>
                      <p style="margin: 0; font-size: 11px; color: #475569;">
                        &copy; 2026 Animandler. All rights reserved.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: "Resend timeout" } }), 6000)
    );

    const { error } = await Promise.race([sendPromise, timeoutPromise]);

    if (error) {
      console.warn("Resend sendWelcomeEmail notice:", error?.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("sendWelcomeEmail exception:", err);
    return false;
  }
}

export async function sendOtpEmail(toEmail: string, otpCode: string): Promise<boolean> {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.log(`[OTP FALLBACK LOG] To: ${toEmail} | Verification Code: ${otpCode}`);
      return false;
    }

    const fromAddress = process.env.EMAIL_FROM || "Animandler <onboarding@resend.dev>";
    const sendPromise = resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      subject: `Animandler Password Reset Code: ${otpCode}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #0d1117; color: #f0f6fc; border-radius: 12px; border: 1px solid #30363d;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #027A69; margin: 0; font-size: 28px;">🐾 Animandler</h1>
            <p style="color: #8b949e; font-size: 14px; margin-top: 4px;">Password Reset Verification</p>
          </div>
          <p style="font-size: 15px; color: #c9d1d9;">Hello,</p>
          <p style="font-size: 15px; color: #c9d1d9;">You requested to reset your password on Animandler. Use the 6-digit verification code below to proceed:</p>
          <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ffffff; background: #161b22; padding: 14px 28px; border-radius: 8px; border: 1px solid #027A69;">${otpCode}</span>
          </div>
          <p style="font-size: 13px; color: #8b949e; text-align: center;">This code will expire in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    // 4-second timeout to prevent hanging when external email API is slow or rejects domain
    const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: "Resend timeout" } }), 4000)
    );

    const { error } = await Promise.race([sendPromise, timeoutPromise]);

    if (error) {
      console.warn("Resend sendOtpEmail notice:", error?.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("sendOtpEmail exception:", err);
    return false;
  }
}
