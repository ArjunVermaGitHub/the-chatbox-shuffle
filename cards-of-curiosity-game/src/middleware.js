import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

// If you're using Next 13/14+ App Router
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/'], // apply to all routes except static files
};

