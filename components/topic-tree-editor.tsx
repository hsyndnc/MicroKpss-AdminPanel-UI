"use client";
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { TopicTree, Topic, TopicSubtopic } from "@/lib/api/pipeline";

interface Props {
  tree: TopicTree;
  onChange: (t: TopicTree) => void;
}

// Bir alt-ağaçtaki tüm YAPRAK alt başlıklar (chunk taşıma hedefleri). Parent'lara chunk konmaz.
function collectLeaves(subs: TopicSubtopic[], topicTitle: string, path: string[]): { id: string; label: string }[] {
  return subs.flatMap((s) => {
    const kids = s.subtopics ?? [];
    if (kids.length > 0) return collectLeaves(kids, topicTitle, [...path, s.title]);
    return [{ id: s.id, label: `${topicTitle} › ${[...path, s.title].join(" › ")}` }];
  });
}

export function TopicTreeEditor({ tree, onChange }: Props) {
  const allSubs = useMemo(
    () => tree.topics.flatMap((t) => collectLeaves(t.subtopics, t.title, [])),
    [tree]
  );

  function update(mut: (draft: TopicTree) => void) {
    const draft: TopicTree = structuredClone(tree);
    mut(draft);
    onChange(draft);
  }

  // recursive yardımcılar (herhangi bir derinlikte çalışır)
  function renameIn(subs: TopicSubtopic[], sid: string, title: string): boolean {
    for (const s of subs) {
      if (s.id === sid) { s.title = title; return true; }
      if (s.subtopics && renameIn(s.subtopics, sid, title)) return true;
    }
    return false;
  }
  function removeIn(subs: TopicSubtopic[], sid: string): TopicSubtopic | undefined {
    const i = subs.findIndex((s) => s.id === sid);
    if (i >= 0) return subs.splice(i, 1)[0];
    for (const s of subs) {
      if (s.subtopics) { const r = removeIn(s.subtopics, sid); if (r) return r; }
    }
    return undefined;
  }
  function stripChunk(subs: TopicSubtopic[], cid: string) {
    for (const s of subs) {
      s.chunk_ids = s.chunk_ids.filter((c) => c !== cid);
      if (s.subtopics) stripChunk(s.subtopics, cid);
    }
  }
  function addChunkTo(subs: TopicSubtopic[], sid: string, cid: string): boolean {
    for (const s of subs) {
      if (s.id === sid) { s.chunk_ids.push(cid); return true; }
      if (s.subtopics && addChunkTo(s.subtopics, sid, cid)) return true;
    }
    return false;
  }

  function renameTopic(tid: string, title: string) {
    update((d) => { const t = d.topics.find((x) => x.id === tid); if (t) t.title = title; });
  }
  function renameSub(sid: string, title: string) {
    update((d) => d.topics.forEach((t) => renameIn(t.subtopics, sid, title)));
  }
  function deleteSub(sid: string) {
    update((d) => d.topics.forEach((t) => removeIn(t.subtopics, sid)));
  }
  function addSub(tid: string) {
    update((d) => {
      const t = d.topics.find((x) => x.id === tid);
      if (t) t.subtopics.push({ id: crypto.randomUUID(), title: "Yeni alt başlık", chunk_ids: [] });
    });
  }
  function moveSubToTopic(sid: string, destTopicId: string) {
    update((d) => {
      let moved: TopicSubtopic | undefined;
      d.topics.forEach((t) => { if (!moved) moved = removeIn(t.subtopics, sid); });
      const dest = d.topics.find((t) => t.id === destTopicId);
      if (moved && dest) dest.subtopics.push(moved);
    });
  }
  function moveChunk(chunkId: string, destSubId: string) {
    update((d) => {
      d.topics.forEach((t) => stripChunk(t.subtopics, chunkId));
      d.topics.forEach((t) => addChunkTo(t.subtopics, destSubId, chunkId));
    });
  }

  function renderSub(sub: TopicSubtopic, depth: number) {
    const kids = sub.subtopics ?? [];
    const isParent = kids.length > 0;
    return (
      <div key={sub.id} className="rounded-md border bg-gray-50 p-2 space-y-1"
           style={{ marginLeft: depth * 14 }}>
        <div className="flex items-center gap-2">
          <Input value={sub.title} onChange={(e) => renameSub(sub.id, e.target.value)}
                 className={isParent ? "font-medium" : ""} />
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {isParent ? `${kids.length} alt başlık` : `${sub.chunk_ids.length} chunk`}
          </span>
          <Select
            items={tree.topics.map((t) => ({ value: t.id, label: t.title }))}
            onValueChange={(v) => moveSubToTopic(sub.id, v as string)}
          >
            <SelectTrigger className="w-32"><SelectValue placeholder="Taşı →" /></SelectTrigger>
            <SelectContent>
              {tree.topics.map((t) => (<SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => deleteSub(sub.id)}>Sil</Button>
        </div>
        {!isParent && tree.previews && sub.chunk_ids.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500">Parçalar</summary>
            <div className="mt-1 space-y-1">
              {sub.chunk_ids.map((cid) => (
                <div key={cid} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-gray-600">
                    {tree.previews?.[cid] ?? cid}
                  </span>
                  <Select items={allSubs.map((s) => ({ value: s.id, label: s.label }))}
                          onValueChange={(v) => moveChunk(cid, v as string)}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Taşı →" /></SelectTrigger>
                    <SelectContent>
                      {allSubs.map((s) => (<SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </details>
        )}
        {isParent && kids.map((c) => renderSub(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tree.topics.map((topic: Topic) => (
        <div key={topic.id} className="rounded-lg border p-3 space-y-2">
          <Input
            value={topic.title}
            onChange={(e) => renameTopic(topic.id, e.target.value)}
            className="font-semibold"
          />
          {topic.subtopics.map((sub) => renderSub(sub, 0))}
          <Button variant="ghost" size="sm" onClick={() => addSub(topic.id)}>+ Alt başlık ekle</Button>
        </div>
      ))}
    </div>
  );
}
