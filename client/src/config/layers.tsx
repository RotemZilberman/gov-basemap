import React from "react";

export type LayerFieldType = "string" | "number" | "enum" | "date";

export interface LayerFieldMeta {
  name: string;
  label?: string;
  type: LayerFieldType;
  options?: string[];
  min?: number;
  max?: number;
}

export interface LayerOption {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  groupId: string;
  fields?: LayerFieldMeta[];
  zoomCenter?: { x: number; y: number; level?: number };
}

export const BASE_LAYER_OPTIONS: LayerOption[] = [
{
  id: "GASSTATIONS",
  label: "תחנות דלק",
  description: "מיקומי תחנות דלק פעילות ברחבי הארץ.",
  icon: <img src="/logos/fuel.svg" alt="" className="panel-icon-img" />,
  groupId: "infra",
  fields: [
    { name: "name", label: "שם תחנה", type: "string" },
    { name: "company", label: "חברה", type: "enum", options: ["אחר","דור אלון","דלק","טן","סד\"ש","סונול","פז"] },
    { name: "phonenumber", label: "מספר טלפון", type: "string" },
    { name: "address", label: "כתובת", type: "string" }
  ],
  zoomCenter: { x: 187331, y: 575949, level: 9 }
},
{
  id: "PARCEL_ALL",
  label: "חלקות",
  description: "גבולות חלקות קדסטריאליות.",
  icon: <img src="/logos/layer.svg" alt="" className="panel-icon-img" />,
  groupId: "parcels",
  fields: [
    { name: "gush_num", label: "מספר גוש", type: "number" },
    { name: "gush_suffix", label: "סיומת גוש", type: "number" },
    { name: "parcel", label: "חלקה", type: "number" },
    { name: "legal_area", label: "שטח חוקי", type: "number" },
    { name: "status_text", label: "סטטוס", type: "enum", options: ["הסדר מבוטל","ירדני בהסדר","לא מוסדר","לא רשום","מוסדר","סופית","רישום בשטח לא מוסדר","רישום ראשון"] },
    { name: "note", label: "הערה", type: "string" }
  ],
  zoomCenter: { x: 187331, y: 575949, level: 10 }
},
{
  id: "bus_stops",
  label: "תחנות אוטובוס",
  description: "תחנות אוטובוס ציבוריות.",
  icon: <img src="/logos/bus_stop.svg" alt="" className="panel-icon-img" />,
  groupId: "transport",
  fields: [
    { name: "stop_name", label: "שם תחנה", type: "string" },
    { name: "stop_desc", label: "תיאור תחנה", type: "string" },
    { name: "stop_id", label: "מזהה תחנה", type: "number" },
    { name: "stop_code", label: "קוד תחנה", type: "number" }
  ],
  zoomCenter: { x: 187331, y: 575949, level: 11 }
}
];

export const BASE_LAYER_IDS = BASE_LAYER_OPTIONS.map((l) => l.id);
