"use client";

import "./globals.css";

/**
 * The last safety net (Part E4): shown only if the whole page frame breaks, so
 * it cannot use translations or the usual layout. It says the same thing in
 * English, Sinhala and Tamil, with one button.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background px-4 text-center text-foreground">
        <main className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground">This is our mistake, not yours. Please try again.</p>
          <p className="text-muted-foreground">යම් දෙයක් වැරදී ඇත. කරුණාකර නැවත උත්සාහ කරන්න.</p>
          <p className="text-muted-foreground">ஏதோ தவறு நடந்துவிட்டது. மீண்டும் முயற்சிக்கவும்.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 h-12 rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
