"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Bell, CornerDownLeft, MapPin, Search } from "lucide-react";
import { findGooglePlaces, HAS_GOOGLE_MAPS } from "@/lib/googleMaps";
import { getRegion, INDIA, nearestRegion, normaliseSearch, type Region } from "@/lib/regions";
import { type GeoJsonFeature } from "@/lib/terrapulseClient";
import { isAlert, type FocusItem } from "@/lib/briefing";

export type SearchChoice =
  | { id: string; title: string; detail: string; region: Region; item?: undefined }
  | { id: string; title: string; detail: string; item: FocusItem; region?: undefined };

export default function PlaceSearch({ regions, features, offline, onChoose }: {
  regions: Region[];
  features: GeoJsonFeature[];
  offline: boolean;
  onChoose: (choice: SearchChoice) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [external, setExternal] = useState<SearchChoice[]>([]);
  const [message, setMessage] = useState("");
  const [looking, setLooking] = useState(false);
  const latestQuery = useRef(query);
  latestQuery.current = query;
  const normalised = normaliseSearch(query);

  const matches = useMemo(() => {
    if (!normalised) return [];
    const choices: Array<SearchChoice & { aliases: string; rank: number }> = [];
    for (const region of regions) {
      choices.push({ id: region.id, title: region.name, detail: region.basin, region, aliases: region.hazard, rank: 1 });
      for (const place of region.places) {
        const area = region.id === INDIA.id ? nearestRegion(place.center) : region;
        choices.push({
          id: `place-${place.name}`, title: place.name, detail: place.state,
          aliases: place.aliases.join(" "), rank: 0,
          item: { kind: "place", name: place.name, center: place.center, regionId: area.id },
        });
      }
    }
    features.forEach((feature, index) => {
      const { title, place_name, region_id, layer, road_status } = feature.properties;
      const region = getRegion(region_id);
      const keywords = isAlert(feature) ? "alert warning flood rain" : "";
      choices.push({
        id: `feature-${feature.id ?? index}`, title, detail: place_name ?? region.short_name,
        aliases: `${keywords} ${layer} ${road_status ?? ""}`, rank: 2,
        item: { kind: "feature", feature },
      });
    });
    const score = ({ title, rank }: typeof choices[number]) => {
      const label = normaliseSearch(title);
      return (label === normalised ? 0 : label.startsWith(normalised) ? 3 : label.includes(normalised) ? 6 : 9) + rank;
    };
    return choices.filter((choice) => normaliseSearch(`${choice.title} ${choice.detail} ${choice.aliases}`).includes(normalised))
      .sort((a, b) => score(a) - score(b)).slice(0, 7);
  }, [features, normalised, regions]);

  // Render only results that belong to this query if the geocoder finishes late.
  const choices = matches.length ? matches : external;
  const externalEnabled = HAS_GOOGLE_MAPS && !offline;

  const choose = (choice: SearchChoice) => {
    onChoose(choice);
    setOpen(false);
    setQuery("");
    setExternal([]);
    setMessage("");
  };

  const searchMore = async () => {
    if (!normalised || looking) return;
    setLooking(true);
    setMessage("");
    try {
      const found = await findGooglePlaces(query);
      if (latestQuery.current !== query) return;
      setExternal(found.map(({ name, center }) => ({
        id: name, title: name, detail: "India",
        item: { kind: "place", name, center, regionId: nearestRegion(center).id },
      })));
      if (!found.length) setMessage("No matching places were found in India.");
    } catch {
      if (latestQuery.current === query) setMessage("More places are unavailable. Try a nearby city or basin.");
    } finally {
      setLooking(false);
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setOpen(false);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => Math.max(0, Math.min(choices.length - 1, index + step)));
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (choices[active]) choose(choices[active]);
      else if (externalEnabled) void searchMore();
    }
  };

  return (
    <div className="tp-search" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <Search size={17} aria-hidden />
      <input id="global-search-input" aria-label="Search any city, state, river basin or alert"
        title="Search any city, state, river basin or alert. Try Bhopal, Darbhanga, Assam, Wayanad or flood."
        placeholder="Search a city, basin or alert…" maxLength={100} value={query} role="combobox"
        aria-expanded={open && !!normalised} aria-autocomplete="list" aria-controls="place-search-results"
        aria-activedescendant={open && choices[active] ? `search-option-${active}` : undefined}
        onFocus={() => setOpen(true)} onKeyDown={keyDown}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); setExternal([]); setMessage(""); }} />
      <kbd aria-hidden>⌘ K</kbd>
      {open && normalised && (
        <div className="tp-search-popover">
          <div role="listbox" id="place-search-results" aria-label="Search results">
            {choices.map((choice, index) => {
              const Icon = choice.item?.kind === "feature" ? Bell : MapPin;
              return <button type="button" role="option" aria-selected={index === active}
                id={`search-option-${index}`} key={choice.id} onClick={() => choose(choice)}>
                <Icon size={16} aria-hidden /><span><strong>{choice.title}</strong><small>{choice.detail}</small></span>
                {index === active && <CornerDownLeft size={13} aria-hidden />}
              </button>;
            })}
          </div>
          {!choices.length && (
            <div className="tp-search-empty">
              <p>{message || (externalEnabled ? "No saved matches. Search more places in India." : "No saved matches. Try a nearby city, state or basin.")}</p>
              {externalEnabled && <button type="button" className="tp-button" onClick={() => void searchMore()} disabled={looking}>
                {looking ? "Searching…" : "Search more places"}
              </button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
