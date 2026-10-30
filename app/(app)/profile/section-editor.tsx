"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/fields";
import { Input } from "@/components/ui/input";
import { MAX_ITEM_DETAILS, MAX_SECTIONS, MAX_SECTION_ITEMS, type ProfileSection, type SectionItem } from "@/lib/profile/schema";
import { emptySectionItem, SECTION_SUGGESTIONS, sectionHints } from "@/lib/profile/sections";

const hasContent = (section: ProfileSection) => section.items.some((i) => i.title || i.subtitle || i.date || i.link || i.details.length > 0);

/** The profile's extra sections, each its own card, and the way to add another. */
export function SectionEditor({ sections, onChange }: { sections: ProfileSection[]; onChange: (next: ProfileSection[]) => void }) {
  const [confirm, dialog] = useConfirm();
  const [custom, setCustom] = useState("");
  // The section just added, so its first box can take the cursor.
  const [added, setAdded] = useState<number | null>(null);

  const taken = (title: string) => sections.some((s) => s.title.trim().toLowerCase() === title.trim().toLowerCase());
  const full = sections.length >= MAX_SECTIONS;
  const canAddCustom = custom.trim().length > 0 && !taken(custom) && !full;

  const set = (i: number, patch: Partial<ProfileSection>) => onChange(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  function add(title: string) {
    setAdded(sections.length);
    onChange([...sections, { title: title.trim(), items: [emptySectionItem()] }]);
  }

  function move(i: number, by: -1 | 1) {
    const next = [...sections];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setAdded(null);
    onChange(next);
  }

  async function remove(i: number) {
    const section = sections[i];
    if (hasContent(section)) {
      const count = section.items.length;
      const ok = await confirm({
        title: `Remove ${section.title.trim() || "this section"}?`,
        body: `This removes ${count} ${count === 1 ? "entry" : "entries"} from your profile when you save. CVs you already saved for an application keep theirs.`,
        confirmLabel: "Remove",
        tone: "danger",
      });
      if (!ok) return;
    }
    setAdded(null);
    onChange(sections.filter((_, j) => j !== i));
  }

  return (
    <>
      {sections.map((section, i) => (
        <SectionCard
          key={i}
          section={section}
          index={i}
          last={i === sections.length - 1}
          focus={i === added}
          onChange={(patch) => set(i, patch)}
          onMove={(by) => move(i, by)}
          onRemove={() => void remove(i)}
        />
      ))}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Add a section</CardTitle>
          <CardDescription>Anything your CV needs beyond the sections above. Each one prints on your CV in this order, under its own heading.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {SECTION_SUGGESTIONS.filter((s) => !taken(s.title)).map((s) => (
              <Button key={s.title} variant="soft" size="sm" disabled={full} onClick={() => add(s.title)}>
                <Plus /> {s.title}
              </Button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canAddCustom) return;
              add(custom);
              setCustom("");
            }}
          >
            <Input
              aria-label="Name of your own section"
              placeholder="Or name your own, e.g. Open source, Talks, Patents"
              value={custom}
              maxLength={60}
              onChange={(e) => setCustom(e.target.value)}
            />
            <Button type="submit" variant="secondary" disabled={!canAddCustom}>
              Add
            </Button>
          </form>
          {full && <p className="text-xs text-subtle">That&apos;s the most a profile holds: {MAX_SECTIONS} extra sections.</p>}
          {custom.trim() && taken(custom) && <p className="text-xs text-subtle">You already have a section with that name.</p>}
        </CardContent>
      </Card>
      {dialog}
    </>
  );
}

function SectionCard({
  section,
  index,
  last,
  focus,
  onChange,
  onMove,
  onRemove,
}: {
  section: ProfileSection;
  index: number;
  last: boolean;
  focus: boolean;
  onChange: (patch: Partial<ProfileSection>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const hints = sectionHints(section.title);
  const setItem = (i: number, patch: Partial<SectionItem>) => onChange({ items: section.items.map((item, j) => (j === i ? { ...item, ...patch } : item)) });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <Input
          aria-label="Section name"
          placeholder="Section name"
          value={section.title}
          maxLength={60}
          className="max-w-xs font-semibold"
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" aria-label={`Move ${section.title} up`} disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Move ${section.title} down`} disabled={last} onClick={() => onMove(1)}>
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Remove ${section.title}`} onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {section.items.map((item, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label={hints.item}
                placeholder={hints.item}
                autoFocus={focus && i === 0}
                value={item.title}
                maxLength={300}
                onChange={(e) => setItem(i, { title: e.target.value })}
              />
              <Input aria-label={hints.subtitle} placeholder={hints.subtitle} value={item.subtitle} maxLength={160} onChange={(e) => setItem(i, { subtitle: e.target.value })} />
              <Input aria-label={hints.date} placeholder={hints.date} value={item.date} maxLength={40} onChange={(e) => setItem(i, { date: e.target.value })} />
              <Input aria-label="Link" placeholder="Link (optional)" value={item.link} maxLength={200} onChange={(e) => setItem(i, { link: e.target.value })} />
            </div>
            <Textarea
              aria-label={hints.details}
              placeholder={hints.details}
              value={item.details.join("\n")}
              onChange={(e) => setItem(i, { details: e.target.value.split("\n").filter((l, k, all) => l.trim() || k === all.length - 1).slice(0, MAX_ITEM_DETAILS) })}
              onBlur={(e) => setItem(i, { details: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) })}
            />
            <button
              type="button"
              onClick={() => onChange({ items: section.items.filter((_, j) => j !== i) })}
              className="self-end text-xs font-medium text-subtle hover:text-danger"
            >
              Remove
            </button>
          </div>
        ))}
        {section.items.length < MAX_SECTION_ITEMS && (
          <Button variant="soft" size="sm" className="self-start" onClick={() => onChange({ items: [...section.items, emptySectionItem()] })}>
            <Plus /> Add entry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
