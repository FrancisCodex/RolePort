"use client";

import { useState } from "react";
import { Select } from "@/components/ui/fields";

/** Country and location filters for the job search form. The location control follows the chosen country. */
export function LocationFields({
  countries,
  phLocations,
  country: initialCountry,
  locationId,
  city,
}: {
  countries: { code: string; name: string }[];
  phLocations: { id: string; label: string }[];
  country: string;
  locationId?: string;
  city?: string;
}) {
  const [country, setCountry] = useState(initialCountry);
  const [remote, setRemote] = useState(locationId === "remote");
  const name = countries.find((c) => c.code === country)?.name ?? country;

  return (
    <>
      <Select name="country" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </Select>
      {country === "PH" ? (
        <Select name="loc" defaultValue={locationId ?? ""} aria-label="Location">
          <option value="">Anywhere in PH</option>
          <option value="remote">Remote</option>
          {phLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
      ) : (
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <input
            name="city"
            defaultValue={city}
            disabled={remote}
            placeholder={remote ? "Remote" : `City in ${name}`}
            aria-label="City"
            className="h-12 w-full min-w-0 rounded-2xl border-2 border-border bg-surface-2 px-4 text-[15px] outline-none transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface disabled:opacity-60"
          />
          <label className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted">
            <input
              type="checkbox"
              name="loc"
              value="remote"
              checked={remote}
              onChange={(e) => setRemote(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            Remote
          </label>
        </div>
      )}
    </>
  );
}
