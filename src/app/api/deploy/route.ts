import { NextResponse } from "next/server";
import crypto from "crypto";
import { exec } from "child_process";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.DEPLOY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expected = `sha256=${hmac.digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function run(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, timeout: 240_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} failed: ${stderr || err.message}`));
      else resolve(stdout);
    });
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  if (payload.ref !== "refs/heads/main") {
    return NextResponse.json({ ok: true, skipped: "not main branch" });
  }

  const cwd = process.cwd();
  console.log("[deploy] Webhook received, deploying...");

  try {
    const pull = await run("git pull origin main", cwd);
    console.log("[deploy] git pull:", pull);

    const install = await run("npm install --production=false", cwd);
    console.log("[deploy] npm install done");

    const build = await run("npm run build", cwd);
    console.log("[deploy] build done");

    const restart = await run("pm2 restart profitsoftware", cwd);
    console.log("[deploy] pm2 restart done");

    return NextResponse.json({ ok: true, pull: pull.trim() });
  } catch (err) {
    console.error("[deploy] Failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Deploy failed" }, { status: 500 });
  }
}
