/**
 * Color matching for the shop filter.
 *
 * Product colors are entered free-text in the admin ("Nom de la couleur"), so the
 * stored names are inconsistent: English ("pink", "red"), French ("bleu"), and
 * typos ("reed"). The shop filter offers a fixed French palette, so comparing
 * names for equality misses almost everything.
 *
 * A product color matches a filter swatch when EITHER
 *   - its name normalises to the same canonical color, or
 *   - its hex is visually close to the swatch's hex.
 * The hex test is what saves products whose name is a typo or an unlisted word.
 */

export interface ProductColor {
    name?: string | null;
    hex?: string | null;
}

/** Canonical key -> every spelling we accept for it (normalised, no accents). */
const COLOR_SYNONYMS: Record<string, string[]> = {
    rose: ["rose", "pink", "fuchsia", "magenta", "rosa"],
    rouge: ["rouge", "red", "reed", "rood", "rosso"],
    bleu: ["bleu", "blue", "blu", "azul", "navy", "marine", "bleumarine", "cyan", "turquoise"],
    vert: ["vert", "green", "verde", "olive", "kaki", "khaki"],
    jaune: ["jaune", "yellow", "amarillo", "giallo"],
    orange: ["orange", "naranja", "arancione", "corail", "coral"],
    violet: ["violet", "purple", "mauve", "lilas", "lilac", "viola", "morado"],
    noir: ["noir", "black", "negro", "nero"],
    blanc: ["blanc", "white", "blanco", "bianco"],
    gris: ["gris", "grey", "gray", "grigio"],
    marron: ["marron", "brown", "chocolat", "chocolate", "marrone", "cafe"],
    beige: ["beige", "creme", "cream", "ivoire", "ivory", "sable", "sand"],
    ecru: ["ecru", "offwhite", "naturel", "natural", "nature", "lin", "linen"],
    camel: ["camel", "tan", "fauve"],
    bordeaux: ["bordeaux", "burgundy", "wine", "vin", "maroon"],
    dore: ["dore", "gold", "golden", "or", "oro"],
    argent: ["argent", "silver", "argente", "plata"],
    multicolore: ["multicolore", "multicolor", "multi", "rainbow", "arcenciel"],
};

/** Lowercase, strip accents, punctuation and spaces: "Bleu Marine" -> "bleumarine". */
function normalizeName(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

/** Map a free-text color name to a canonical key, or null when unrecognised. */
export function canonicalColorName(name?: string | null): string | null {
    if (!name) return null;
    const normalized = normalizeName(name);
    if (!normalized) return null;

    for (const [key, synonyms] of Object.entries(COLOR_SYNONYMS)) {
        if (synonyms.includes(normalized)) return key;
    }
    // Fall back to a containment test so "bleu ciel" or "rose pale" still resolve.
    for (const [key, synonyms] of Object.entries(COLOR_SYNONYMS)) {
        if (synonyms.some(s => s.length >= 3 && normalized.includes(s))) return key;
    }
    return null;
}

/** Parse #rgb / #rrggbb into [r, g, b]; null for gradients or malformed values. */
function parseHex(hex?: string | null): [number, number, number] | null {
    if (!hex) return null;
    const cleaned = hex.trim().replace(/^#/, "");
    if (cleaned.length === 3 && /^[0-9a-f]{3}$/i.test(cleaned)) {
        const [r, g, b] = cleaned.split("");
        return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)];
    }
    if (cleaned.length === 6 && /^[0-9a-f]{6}$/i.test(cleaned)) {
        return [
            parseInt(cleaned.slice(0, 2), 16),
            parseInt(cleaned.slice(2, 4), 16),
            parseInt(cleaned.slice(4, 6), 16),
        ];
    }
    return null;
}

/** RGB -> HSL, with hue in degrees and s/l as 0..1. */
function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const delta = max - min;
    if (delta === 0) return [0, 0, l];

    const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let h: number;
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
    return [h, s, l];
}

/**
 * Classify a hex into the same canonical families used for names.
 * Hue is what separates pink from blue; raw RGB distance is not reliable enough
 * (a vivid pink sits closer to violet than to the pale pink palette swatch).
 */
function canonicalColorFromHex(hex?: string | null): string | null {
    const rgb = parseHex(hex);
    if (!rgb) return null;
    const [h, s, l] = rgbToHsl(rgb);

    // Achromatic first: saturation too low for hue to carry meaning.
    if (s < 0.12 || l < 0.08 || l > 0.95) {
        if (l < 0.18) return "noir";
        if (l > 0.9) return "blanc";
        if (l > 0.75) return "beige";
        return "gris";
    }

    if (h < 15 || h >= 345) return l < 0.3 ? "bordeaux" : "rouge";
    if (h < 40) return l < 0.35 ? "marron" : (s < 0.5 ? "camel" : "orange");
    if (h < 50) return l < 0.4 ? "marron" : (l > 0.8 ? "beige" : "dore");
    if (h < 70) return "jaune";
    if (h < 160) return "vert";
    if (h < 255) return "bleu";
    if (h < 290) return "violet";
    return "rose";
}

/** Does one product color match the selected filter swatch? */
export function colorMatchesFilter(
    productColor: ProductColor,
    filter: { name: string; hex: string }
): boolean {
    const productKey = canonicalColorName(productColor?.name);
    const filterKey = canonicalColorName(filter.name) ?? canonicalColorFromHex(filter.hex);
    if (!filterKey) return false;

    // "Multicolore" products should surface under any color filter.
    if (productKey === "multicolore") return true;

    // A recognised product name decides it outright — the admin said what it is.
    if (productKey) return productKey === filterKey;

    // Unnamed or unrecognised name ("reed"): fall back to the picked swatch,
    // classified by hue into the same families.
    return canonicalColorFromHex(productColor?.hex) === filterKey;
}

/** Does any of a product's colors match the selected filter swatch? */
export function productMatchesColor(
    colors: ProductColor[] | null | undefined,
    filter: { name: string; hex: string } | null
): boolean {
    if (!filter) return true;
    if (!Array.isArray(colors) || colors.length === 0) return false;
    return colors.some(c => colorMatchesFilter(c, filter));
}
