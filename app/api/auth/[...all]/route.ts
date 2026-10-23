import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { isLite } from "@/lib/mode";

// The lite edition has no accounts and no server database.
const notFound = () => new Response(null, { status: 404 });

export const GET = (request: Request) => (isLite ? notFound() : toNextJsHandler(getAuth()).GET(request));
export const POST = (request: Request) => (isLite ? notFound() : toNextJsHandler(getAuth()).POST(request));
