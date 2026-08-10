// Proxies Giphy's trending endpoint server-side so the API key never ships
// to the browser.
import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const apiKey = Netlify.env.get("GIPHY_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Giphy key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const res = await fetch(`https://api.giphy.com/v1/gifs/trending?limit=4&rating=pg-13&api_key=${apiKey}`);
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
  });
};

export const config: Config = {
  path: "/api/giphy"
};
