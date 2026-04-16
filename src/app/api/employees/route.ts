import { upsertEmployeeCardholder } from "@/lib/ibadge-db";
import { forwardToUpstream } from "@/lib/ibadge-upstream";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const proxied = await forwardToUpstream(request);
  if (proxied) {
    return proxied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      firstName?: string;
      lastName?: string;
      badgeNumber?: string;
      email?: string | null;
      companyNum?: string | null;
    };
    const created = await upsertEmployeeCardholder({
      firstName: String(body.firstName ?? "").trim(),
      lastName: String(body.lastName ?? "").trim(),
      badgeNumber: String(body.badgeNumber ?? "").trim(),
      email: body.email ?? null,
      companyNum: body.companyNum ?? null,
    });
    return Response.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save cardholder.";
    const status = /required/i.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
