import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getDb, saveDb } from "../db";

export const paymentsRouter = Router();

const PAYSTACK_SECRET =
  process.env.PAYSTACK_SECRET ||
  process.env.PAYSTACK_SECRET_KEY ||
  "sk_test_30c5651e1fa89e38d79ab5768016cda82caecdea";

/**
 * Initialize a Paystack payment session
 * POST /api/payments/initialize
 */
paymentsRouter.post("/initialize", async (req: Request, res: Response) => {
  try {
    const { email, amount, currency, metadata, callback_url } = req.body;

    if (!email || !amount) {
      return res.status(400).json({
        status: false,
        error: "Email and amount are required",
      });
    }

    // Paystack takes amount in lowest currency subunit (kobo for NGN, cents for USD)
    const subunitAmount = Math.round(Number(amount) * 100);

    const payload: Record<string, any> = {
      email,
      amount: subunitAmount,
      metadata: metadata || {},
    };

    if (currency) {
      payload.currency = currency;
    }

    if (callback_url) {
      payload.callback_url = callback_url;
    }

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await paystackRes.json();

    if (!paystackRes.ok || !data.status) {
      console.warn("Paystack initialize error, trying fallback:", data);
      // If error was currency related (e.g. USD on standard NGN account), try without explicit currency
      if (payload.currency) {
        delete payload.currency;
        const retryRes = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const retryData = await retryRes.json();
        if (retryData.status) {
          return res.json(retryData);
        }
      }
      return res.status(400).json(data);
    }

    res.json(data);
  } catch (err: any) {
    console.error("Paystack initialize exception:", err);
    res.status(500).json({ status: false, error: err.message || "Failed to initialize payment" });
  }
});

/**
 * Verify a Paystack transaction
 * GET /api/payments/verify/:reference
 */
paymentsRouter.get("/verify/:reference", async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ status: false, error: "Reference is required" });
    }

    const refStr = Array.isArray(reference) ? reference[0] : String(reference);
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(refStr)}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
    });

    const data = await paystackRes.json();

    if (!paystackRes.ok || !data.status) {
      return res.status(400).json(data);
    }

    // If payment was successful, persist notification and audit
    if (data.data?.status === "success") {
      try {
        const db = await getDb();
        const customerEmail = data.data.customer?.email;
        const metadata = data.data.metadata || {};

        // Find or create notification
        const notifId = `notif_${Date.now()}`;
        const newNotif = {
          id: notifId,
          userId: metadata.customerId || "u_1",
          type: "system" as const,
          title: "Payment Confirmed 🎉",
          message: `Your payment of ${data.data.currency} ${(data.data.amount / 100).toFixed(2)} for "${metadata.itemName || "Marketplace Item"}" was successful! Ref: ${reference}`,
          timestamp: new Date().toISOString(),
          read: false,
        };

        if (!db.notifications[newNotif.userId]) {
          db.notifications[newNotif.userId] = [];
        }
        db.notifications[newNotif.userId].unshift(newNotif);

        // Record audit log
        db.auditLogs.unshift({
          id: `audit_${Date.now()}`,
          adminName: "Paystack Gateway",
          action: "PAYMENT_SUCCESS",
          details: `Ref ${reference} | ${customerEmail} | ${data.data.currency} ${data.data.amount / 100}`,
          timestamp: new Date().toISOString(),
        });

        saveDb(db).catch((e) => console.warn("SaveDb payment record error:", e));
      } catch (dbErr) {
        console.warn("Could not save payment to DB:", dbErr);
      }
    }

    res.json(data);
  } catch (err: any) {
    console.error("Paystack verify exception:", err);
    res.status(500).json({ status: false, error: err.message || "Failed to verify transaction" });
  }
});

/**
 * Paystack Webhook Handler
 * POST /api/payments/webhook
 */
paymentsRouter.post("/webhook", async (req: Request, res: Response) => {
  try {
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash === req.headers["x-paystack-signature"]) {
      const event = req.body;
      if (event.event === "charge.success") {
        console.log(`💰 Paystack Webhook: Payment success for ref ${event.data.reference}`);
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(400);
    }
  } catch (err) {
    res.sendStatus(500);
  }
});
