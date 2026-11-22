import { createSerwistRoute } from "@serwist/turbopack";
import { cacheLife } from "next/cache";
import { LOCALES } from "@/i18n/config";
import { offlinePagePath } from "@/lib/pwa/cache-rules";

/**
 * Builds the service worker (src/app/sw.ts) and serves it at /serwist/sw.js
 * (Part F4.4, Serwist with Turbopack).
 *
 * What the worker saves when it installs: the website's own JavaScript and CSS
 * (so the calculators open without internet after the first visit), the icons,
 * and the offline page in each language.
 *
 * It must be built while `next build` runs, because only then the list of the
 * build's files exists (a hosting service's server does not have them). With
 * Cache Components a route is prerendered only if it does no file or network
 * work itself, so Serwist's work is wrapped in a cached helper
 * (`buildServiceWorkerFile`) whose result becomes the static answer. The other
 * values Serwist returns (`dynamic = "force-static"` and friends) are not
 * allowed with Cache Components and are not needed.
 */

/** Changes with every build, so a new offline page replaces the old one. */
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

const serwist = createSerwistRoute({
  additionalPrecacheEntries: LOCALES.map((locale) => ({ url: offlinePagePath(locale), revision })),
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
  globPatterns: [".next/static/**/*.{js,css}", "public/icons/**/*"],
});

export const generateStaticParams = serwist.generateStaticParams;

/** The files this route serves: the worker and its source map. Anything else is a plain 404. */
const SERVED_FILES = new Set(["sw.js", "sw.js.map"]);

/** One file of the build (the worker or its source map), made once per deployment. */
async function buildServiceWorkerFile(path: string): Promise<{ body: string; contentType: string }> {
  "use cache";
  // Never rebuilt while the deployment lives: a rebuild on the server could not see the build's files.
  cacheLife({ stale: 3600, revalidate: 365 * 24 * 3600, expire: 2 * 365 * 24 * 3600 });

  const response = await serwist.GET(new Request(`http://localhost/serwist/${path}`), {
    params: Promise.resolve({ path }),
  });
  return { body: await response.text(), contentType: response.headers.get("Content-Type") ?? "text/plain" };
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  if (!SERVED_FILES.has(path)) return new Response("Not found", { status: 404 });
  const file = await buildServiceWorkerFile(path);

  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      // The worker lives under /serwist/ but must control the whole website.
      "Service-Worker-Allowed": "/",
    },
  });
}
