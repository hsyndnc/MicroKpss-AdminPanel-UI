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

export function TopicTreeEditor({ tree, onChange }: Props) {
  // Tüm alt başlıklar (chunk taşıma hedefleri için)
  const allSubs = useMemo(
    () => tree.topics.flatMap((t) => t.subtopics.map((s) => ({ id: s.id, label: `${t.title} › ${s.title}` }))),
    [tree]
  );

  function update(mut: (draft: TopicTree) => void) {
    const draft: TopicTree = structuredClone(tree);
    mut(draft);
    onChange(draft);
  }

  function renameTopic(tid: string, title: string) {
    update((d) => { const t = d.topics.find((x) => x.id === tid); if (t) t.title = title; });
  }
  function renameSub(sid: string, title: string) {
    update((d) => d.topics.forEach((t) => t.subtopics.forEach((s) => { if (s.id === sid) s.title = title; })));
  }
  function deleteSub(sid: string) {
    update((d) => d.topics.forEach((t) => { t.subtopics = t.subtopics.filter((s) => s.id !== sid); }));
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
      d.topics.forEach((t) => {
        const i = t.subtopics.findIndex((s) => s.id === sid);
        if (i >= 0) { moved = t.subtopics.splice(i, 1)[0]; }
      });
      const dest = d.topics.find((t) => t.id === destTopicId);
      if (moved && dest) dest.subtopics.push(moved);
    });
  }
  function moveChunk(chunkId: string, destSubId: string) {
    update((d) => {
      d.topics.forEach((t) => t.subtopics.forEach((s) => {
        s.chunk_ids = s.chunk_ids.filter((c) => c !== chunkId);
      }));
      d.topics.forEach((t) => t.subtopics.forEach((s) => {
        if (s.id === destSubId) s.chunk_ids.push(chunkId);
      }));
    });
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
          {topic.subtopics.map((sub) => (
            <div key={sub.id} className="ml-3 rounded-md border bg-gray-50 p-2 space-y-1">
              <div className="flex items-center gap-2">
                <Input value={sub.title} onChange={(e) => renameSub(sub.id, e.target.value)} />
                <span className="text-xs text-gray-500 whitespace-nowrap">{sub.chunk_ids.length} chunk</span>
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
              {tree.previews && sub.chunk_ids.length > 0 && (
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
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => addSub(topic.id)}>+ Alt başlık ekle</Button>
        </div>
      ))}
    </div>
  );
}
