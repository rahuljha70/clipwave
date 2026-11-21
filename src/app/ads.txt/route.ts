const ADS_TXT_AUTHORITY = "f08c47fec0942fa0";

export const dynamic = "force-dynamic";

export async function GET() {
  const publisherId = process.env.ADSENSE_PUBLISHER_ID?.trim() ?? "";
  if (!/^pub-\d{10,20}$/.test(publisherId)) {
    return new Response("AdSense publisher ID is not configured.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  return new Response(`google.com, ${publisherId}, DIRECT, ${ADS_TXT_AUTHORITY}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
