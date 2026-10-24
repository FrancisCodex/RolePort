"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";

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
      <Select
        name="country"
        value={country}
        onValueChange={setCountry}
        aria-label="Country"
        options={countries.map((c) => ({ value: c.code, label: c.name }))}
      />
      {country === "PH" ? (
        <Select
          name="loc"
          defaultValue={locationId ?? ""}
          aria-label="Location"
          options={[
            { value: "", label: "Anywhere in PH" },
            { value: "remote", label: "Remote" },
            ...phLocations.map((l) => ({ value: l.id, label: l.label })),
          ]}
        />
      ) : (
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <input
            name="city"
            defaultValue={city}
            disabled={remote}
            placeholder={remote ? "Remote" : `City in ${name}`}
            aria-label="City"
            className="h-9 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm shadow-[var(--shadow-soft)] outline-none transition-[border-color,box-shadow] placeholder:text-subtle hover:border-border-strong focus:border-brand focus:ring-3 focus:ring-brand/15 disabled:opacity-60"
          />
          <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted">
            <input
              type="checkbox"
              name="loc"
              value="remote"
              checked={remote}
              onChange={(e) => setRemote(e.target.checked)}
              className="size-3.5 accent-[var(--brand)]"
            />
            Remote
          </label>
        </div>
      )}
    </>
  );
}
