import { NextResponse } from "next/server";

const subdomains = [
  {
    "subdomain": "schedule"
  }
]

export const config = {
  matcher: [
    "/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)",
  ],
};

export default async function middleware(req) {
  const url = new URL(req.url);
  const hostname = req.headers.get("host") || "";

  const allowedDomains = ["localhost:3000", "boilerclasses.com"];

  const isAllowedDomain = hostname === "localhost"
    || hostname.startsWith("localhost:")
    || allowedDomains.some(domain => hostname.includes(domain));

  const subdomain = hostname.split(".")[0];

  if (isAllowedDomain && !subdomains.some(d => d.subdomain === subdomain)) {
    return NextResponse.next();
  }

  const subdomainData = subdomains.find(d => d.subdomain === subdomain);

  if (subdomainData) {
    return NextResponse.rewrite(new URL(`/${subdomain}${url.pathname}`, req.url));
  }

  return new Response(null, { status: 404 });
}
