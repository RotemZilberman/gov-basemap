# GovMap React Toolkit + MCP Server
A React + TypeScript toolkit that wraps the Israeli **GovMap API**, adds a custom drawing/search toolbar, and ships a **Model Context Protocol (MCP) server** so ChatGPT can control the map with natural-language commands.

---

## What’s Inside
- React + TypeScript UI around the GovMap iframe (you own the UI shell).
- Toolbar for draw/edit/search/filter/layer controls built on top of GovMap API.
- GovMap wrapper (`govmap.wrapper.ts`, `useGovmap.ts`) with real GovMap endpoints (createMap, draw, editDrawing, geocode, zoomToXY, filterLayers, setLayerVisibility).
- MCP server stub so ChatGPT can issue map actions (draw, zoom, filter, geocode).
- Floating ChatGPT button + slide-in chat sidebar to talk to the MCP server.

---

## Quickstart
1) Install  
`npm install`

2) Configure GovMap token  
Create `.env` with:  
`VITE_GOVMAP_TOKEN=your_token_here`

3) Run the frontend  
`npm run dev`

4) Run the MCP server (separate terminal)  
`npm run mcp`

---

## Project Layout
- `src/components`
  - `GovmapContainer.tsx` — loads GovMap iframe and injects the API script.
  - `Toolbar.tsx` — draw, edit, clear, search, filter, toggle layers.
- `src/hooks`
  - `useGovmap.ts` — wrapper around `window.govmap`.
- `src/lib`
  - `govmap.types.ts` — GovMap TypeScript types.
  - `govmap.wrapper.ts` — promise-based GovMap helper functions.
- `src/pages`
  - `App.tsx`, `Home.tsx`

- `src/main.tsx` — React app entry point.
- `src/styles.css` — global styles.
- `public/index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`

---

## UI Architecture
- Everything outside the iframe is yours (toolbar, chat button, chat sidebar).
- GovMap renders inside an iframe; all interactions go through `window.govmap.*`.
- ChatGPT button (bottom-right) opens a slide-in sidebar on the right.
- Sidebar holds the conversation and sends actions to the MCP server.

```
React UI shell
 [Toolbar]   [Floating ChatGPT Button]
   \__ Chat Sidebar (slide-in from right)
        \__ GovMap iframe (locked UI inside)
              \__ window.govmap.* APIs
```

---

## Example GovMap Call
```ts
govmap.createMap("map", { token, center: { x: 187331, y: 575949 }, level: 7 });
govmap.draw(govmap.drawType.Polygon).progress((res) => console.log(res.wkt));
const geo = await govmap.geocode({ keyword: "הרוקמים 26" });
await govmap.zoomToXY(geo.x, geo.y, 9);
```

---

## Example ChatGPT → MCP Flow
- User: “Draw a polygon around Azrieli complex”
- MCP payload:
```json
{
  "command": "draw_polygon",
  "args": { "coordinates": [/* ... */] }
}
```
- Browser executes: `govmap.draw(govmap.drawType.Polygon);`

---

## MCP Server (stub)
- Runs at `http://localhost:4000/mcp` (`npm run mcp`).
- Uses simple Express JSON endpoint; handlers live in `src/mcp/handlers.ts`.
- Current handlers echo payloads (`chat`, `draw_point`, `zoom_to`, `ping`); wire these to browser actions/WebSockets as needed.

---

## Notes / TODO
- GovMap script is loaded from `https://www.govmap.gov.il/govmap/api/govmap.api.js`. All calls use `window.govmap.*` per the official functions (createMap, draw, editDrawing, geocode, zoomToXY, filterLayers, setLayerVisibility, displayGeometries, etc.).
- Update layer names/filters in `Toolbar.tsx` to match the layers you actually have (default example: `GASSTATIONS` with `TYPE = '95'`).
- Add real browser ↔ MCP wiring (e.g., WebSocket) to trigger map actions from server commands.
- Extend handlers to mirror GovMap actions (draw, filter, selectFeaturesOnMap, displayGeometries, GPS, export).

---

## Extending Commands
Add a handler in `src/mcp/handlers.ts`:
```ts
register("zoom_to", async ({ x, y }) => {
  await browserApi.zoomTo(x, y);
  return { status: "ok" };
});
```

---

## License
MIT. PRs welcome. Need the components generated? Say: “generate the full components”.
