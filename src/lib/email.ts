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

export async function sendOtpEmail(toEmail: string, otpCode: string): Promise<boolean> {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.log(`[OTP FALLBACK LOG] To: ${toEmail} | Verification Code: ${otpCode}`);
      return false;
    }

    const sendPromise = resend.emails.send({
      from: "Animandler <onboarding@resend.dev>",
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
