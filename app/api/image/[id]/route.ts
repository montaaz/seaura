import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const id = (await params).id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'product'; // 'product' or 'home'
    const idx = searchParams.get('idx');

    try {
        let res;
        if (type === 'product') {
            // When a specific index is requested, pull only that one element
            // out of the JSONB array server-side instead of shipping the whole
            // (potentially multi-MB base64) `images` blob over the wire.
            if (idx !== null) {
                res = await query(
                    "SELECT image_url, (images->>($2::int)) AS selected_image FROM products WHERE id = $1",
                    [id, parseInt(idx)]
                );
            } else {
                res = await query(
                    "SELECT image_url, (images->>0) AS selected_image FROM products WHERE id = $1",
                    [id]
                );
            }
        } else if (type === 'category') {
            res = await query("SELECT image_url FROM categories WHERE id = $1", [id]);
        } else if (type === 'subcategory') {
            res = await query("SELECT image_url FROM sub_categories WHERE id = $1", [id]);
        } else {
            res = await query("SELECT value FROM home_content WHERE id = $1", [id]);
        }

        const data = res.rows[0];
        if (!data) return new Response("Not Found", { status: 404 });

        let rawValue = data.image_url;

        // Priority Logic for Products:
        if (type === 'product') {
            const selected = data.selected_image;
            if (idx !== null) {
                rawValue = selected || rawValue;
            } else if (selected && selected.length > 10) {
                // Prefer the first image in the array if it exists
                rawValue = selected;
            }
        } else {
            // Categories/Subcategories/Home
            rawValue = type === 'category' ? data.image_url : (type === 'subcategory' ? data.image_url : data.value);
        }

        // Guard against a corrupted self-referential value (e.g. a
        // "/api/image/8" proxy placeholder that got saved back into image_url).
        // Serving it would loop the proxy back onto itself forever.
        if (typeof rawValue === 'string' && rawValue.startsWith('/api/image/')) {
            const fallback = type === 'product' ? data.selected_image : null;
            rawValue = (fallback && !fallback.startsWith('/api/image/')) ? fallback : null;
        }

        if (!rawValue || rawValue.length < 5) {
            return NextResponse.redirect(new URL("/logo1.png", request.url));
        }

        // Check if it's a base64 data URL
        const match = rawValue.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
            const contentType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            
            return new Response(buffer, {
                headers: {
                    "Content-Type": contentType,
                    // NOT immutable: this URL (e.g. /api/image/4?type=home) is a
                    // stable address whose underlying image can be replaced in the
                    // admin. "immutable" told the browser to cache the old bytes for
                    // a year and never re-fetch — which is exactly why edited hero
                    // images never appeared to change. Revalidate instead.
                    "Cache-Control": "public, max-age=60, must-revalidate",
                },
            });
        }

        // If it's already a URL, redirect to it. Cache the redirect only
        // briefly: long enough to avoid re-hitting the proxy on every render,
        // short enough that changing an image in the DB shows up quickly
        // instead of being pinned to the old target for a day.
        try {
            const redirect = NextResponse.redirect(new URL(rawValue, request.url));
            redirect.headers.set("Cache-Control", "public, max-age=60, must-revalidate");
            return redirect;
        } catch (e) {
            return NextResponse.redirect(new URL("/logo1.png", request.url));
        }

    } catch (err) {
        console.error("Image Proxy Error:", err);
        return new Response("Internal Server Error", { status: 500 });
    }
}
