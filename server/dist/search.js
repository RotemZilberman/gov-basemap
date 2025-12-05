"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRouter = void 0;
const express_1 = __importDefault(require("express"));
const projection_1 = require("./projection");
const sessionAuth_1 = require("./sessionAuth");
exports.searchRouter = express_1.default.Router();
exports.searchRouter.use(express_1.default.json());
function isAddress(types) {
    if (!types)
        return false;
    const set = new Set(types.map((t) => t.toLowerCase()));
    return (set.has("street_address") ||
        set.has("premise") ||
        set.has("route") ||
        set.has("locality") ||
        set.has("political"));
}
function labelFromTypes(types) {
    if (!types || types.length === 0)
        return "תוצאה";
    if (types.includes("street_address") || types.includes("premise"))
        return "כתובת";
    if (types.includes("route"))
        return "רחוב";
    if (types.includes("locality") || types.includes("political"))
        return "יישוב";
    if (types.includes("point_of_interest") || types.includes("establishment"))
        return "מקום";
    return "תוצאה";
}
async function fetchPlaceDetails(placeId, apiKey) {
    const params = new URLSearchParams({
        place_id: placeId,
        key: apiKey,
        fields: "geometry,name,formatted_address,types"
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
    if (!response.ok) {
        console.warn(`Google Place Details request failed with ${response.status}`);
        return null;
    }
    const data = (await response.json());
    if (data.status !== "OK" || !data.result) {
        console.warn(`Google Place Details returned status ${data.status ?? "UNKNOWN"}`, data.error_message);
        return null;
    }
    return data.result;
}
function toSuggestion(prediction, details, idx, fallbackTitle) {
    const loc = details.geometry?.location;
    if (!loc)
        return null;
    const itm = (0, projection_1.wgs84ToItm)(loc.lng, loc.lat);
    if (!itm)
        return null;
    const title = details.name ??
        details.formatted_address ??
        prediction.structured_formatting?.main_text ??
        prediction.description ??
        fallbackTitle;
    const subtitle = prediction.structured_formatting?.secondary_text ??
        details.formatted_address ??
        prediction.description;
    const types = details.types ?? prediction.types;
    const kind = isAddress(types) ? "address" : "feature";
    return {
        id: `gg-${prediction.place_id ?? idx}`,
        title,
        subtitle,
        kind,
        badge: labelFromTypes(types),
        action: { type: "zoom", x: itm.x, y: itm.y, level: 12, term: title }
    };
}
exports.searchRouter.get("/google-geocode", async (req, res) => {
    try {
        const { sid, session, newMagic } = await (0, sessionAuth_1.authenticateSession)(req);
        const searchText = typeof req.query.q === "string"
            ? req.query.q.trim()
            : typeof req.query.query === "string"
                ? req.query.query.trim()
                : "";
        if (!searchText) {
            await (0, sessionAuth_1.persistSession)(sid, session);
            return res.json({ suggestions: [], newMagic });
        }
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            await (0, sessionAuth_1.persistSession)(sid, session);
            return res
                .status(503)
                .json({ suggestions: [], error: "Google Maps API key is not configured on the server", newMagic });
        }
        const params = new URLSearchParams({
            input: searchText,
            key: apiKey,
            language: "he",
            components: "country:il"
        });
        const autocompleteResponse = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`);
        if (!autocompleteResponse.ok) {
            return res.status(502).json({
                suggestions: [],
                error: `Google Places autocomplete returned ${autocompleteResponse.status}`
            });
        }
        const data = (await autocompleteResponse.json());
        const isOk = data.status === "OK";
        const isZeroResults = data.status === "ZERO_RESULTS";
        const predictions = isOk && Array.isArray(data.predictions) ? data.predictions : [];
        const errorMessage = isOk || isZeroResults
            ? undefined
            : data.error_message ?? (data.status ? `Google Places status ${data.status}` : undefined);
        const detailedSuggestions = await Promise.all(predictions.slice(0, 6).map(async (prediction, idx) => {
            if (!prediction.place_id)
                return null;
            const details = await fetchPlaceDetails(prediction.place_id, apiKey);
            if (!details)
                return null;
            return toSuggestion(prediction, details, idx, searchText);
        }));
        const suggestions = detailedSuggestions.filter(Boolean);
        await (0, sessionAuth_1.persistSession)(sid, session);
        return res.json({
            suggestions,
            newMagic,
            error: errorMessage
        });
    }
    catch (err) {
        if (err instanceof sessionAuth_1.SessionAuthError) {
            return res.status(err.status).json({ suggestions: [], error: err.message });
        }
        console.error("[/search/google-geocode] Failed to fetch Google Places suggestions", err);
        return res.status(500).json({ suggestions: [], error: "Failed to fetch Google Places suggestions" });
    }
});
