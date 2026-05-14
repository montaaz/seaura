import { NextResponse } from "next/server";
import * as bcrypt from "bcrypt";
import { query } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const { email, password, name } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ message: "Missing fields" }, { status: 400 });
        }

        // Check if user exists
        const existing = await query("SELECT * FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) {
            return NextResponse.json({ message: "User already exists" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await query(
            "INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)",
            [email, hashedPassword, name || null, "CLIENT"] // Default to CLIENT
        );

        return NextResponse.json({ message: "Success" }, { status: 201 });
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
