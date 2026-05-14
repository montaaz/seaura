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
            res = await query("SELECT image_url, images FROM products WHERE id = $1", [id]);
        } else if (type === 'category') {
            res = await query("SELECT image_url FROM categories WHERE id = $1", [id]);
        } else if (type === 'subcategory') {
            res = await query("SELECT image_url FROM sub_categories WHERE id = $1", [id]);
        } else {
            res = await query("SELECT value FROM home_content WHERE id = $1", [id]);
        }

        const data = res.rows[0];
        if (!data) return new Response("Not Found", { status: 404 });

        const imagesArr = typeof data.images === 'string' ? JSON.parse(data.images) : (data.images || []);
        let rawValue = data.image_url;

        // Priority Logic for Products:
        if (type === 'product') {
            if (idx !== null) {
                rawValue = imagesArr[parseInt(idx)] || rawValue;
            } else {
                // Aggressively prefer the first image in the array if it exists
                if (imagesArr.length > 0 && imagesArr[0] && imagesArr[0].length > 10) {
                    rawValue = imagesArr[0];
                }
            }
        } else {
            // Categories/Subcategories/Home
            rawValue = type === 'category' ? data.image_url : (type === 'subcategory' ? data.image_url : data.value);
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
                    "Cache-Control": "public, max-age=31536000, immutable",
                },
            });
        }

        // If it's already a URL, redirect to it
        try {
            return NextResponse.redirect(new URL(rawValue, request.url));
        } catch (e) {
            return NextResponse.redirect(new URL("/logo1.png", request.url));
        }

    } catch (err) {
        console.error("Image Proxy Error:", err);
        return new Response("Internal Server Error", { status: 500 });
    }
}
