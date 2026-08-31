"use client";
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TopicTree, Topic, TopicSubtopic, Suggestion } from "@/lib/api/pipeline";

interface Props {
  tree: TopicTree;
  onChange: (t: TopicTree) => void;
  suggestions?: Suggestion[];
  selectedNodeId?: string | null;
  onSelectSuggestion?: (nodeId: string) => void;
}

// Bir alt-ağaçtaki tüm YAPRAK alt başlıklar (chunk taşıma hedefleri). Parent'lara chunk konmaz.
function collectLeaves(subs: TopicSubtopic[], topicTitle: string, path: string[]): { id: string; label: string }[] {
  return subs.flatMap((s) => {
    const kids = s.subtopics ?? [];
    if (kids.length > 0) return collectLeaves(kids, topicTitle, [...path, s.title]);
    return [{ id: s.id, label: `${topicTitle} › ${[...path, s.title].join(" › ")}` }];
  });
}

// Düğümü (çocuklarıyla) ağaçtan çıkar; bulursa döndürür (mutasyon: splice).
function removeNode(subs: TopicSubtopic[], nodeId: string): TopicSubtopic | undefined {
  const i = subs.findIndex((s) => s.id === nodeId);
  if (i >= 0) return subs.splice(i, 1)[0];
  for (const s of subs) {
    if (s.subtopics) {
      const r = removeNode(s.subtopics, nodeId);
      if (r) return r;
    }
  }
  return undefined;
}

// id'si parentId olan alt-başlığın subtopics'ine node ekle (recursive). Bulursa true.
function insertUnderSubs(subs: TopicSubtopic[], parentId: string, node: TopicSubtopic): boolean {
  for (const s of subs) {
    if (s.id === parentId) {
      if (!s.subtopics) s.subtopics = [];
      s.subtopics.push(node);
      return true;
    }
    if (s.subtopics && insertUnderSubs(s.subtopics, parentId, node)) return true;
  }
  return false;
}

// Draft üzerinde taşımayı uygular (mutasyon). newParentId null => topicId konusunun üst-düzeyine.
function moveNodeInDraft(
  draft: TopicTree, nodeId: string, newParentId: string | null, topicId: string
): void {
  let moved: TopicSubtopic | undefined;
  for (const t of draft.topics) {
    if (!moved) moved = removeNode(t.subtopics, nodeId);
  }
  if (!moved) return; // bayat öneri — düğüm yok, güvenli no-op
  if (newParentId === null) {
    const topic = draft.topics.find((t) => t.id === topicId) ?? draft.topics[0];
    topic?.subtopics.push(moved);
    return;
  }
  let inserted = false;
  for (const t of draft.topics) {
    if (insertUnderSubs(t.subtopics, newParentId, moved)) { inserted = true; break; }
  }
  if (!inserted) {
    // hedef parent bulunamadı → topicId üst-düzeyine güvenli fallback (düğüm kaybolmaz)
    const topic = draft.topics.find((t) => t.id === topicId) ?? draft.topics[0];
    topic?.subtopics.push(moved);
  }
}

// SAF genel taşıma: yeni ağaç döner (workspace bunu çağırır).
export function moveNode(
  tree: TopicTree, nodeId: string, newParentId: string | null, topicId: string
): TopicTree {
  const draft: TopicTree = structuredClone(tree);
  moveNodeInDraft(draft, nodeId, newParentId, topicId);
  return draft;
}

// Düğümün mevcut parent alt-başlık id'si; doğrudan bir konunun altındaysa null.
function locateParent(
  subs: TopicSubtopic[], nodeId: string, parentId: string | null
): { found: boolean; parentId: string | null } {
  for (const s of subs) {
    if (s.id === nodeId) return { found: true, parentId };
    const r = locateParent(s.subtopics ?? [], nodeId, s.id);
    if (r.found) return r;
  }
  return { found: false, parentId: null };
}

export function findParentId(tree: TopicTree, nodeId: string): string | null {
  for (const t of tree.topics) {
    const r = locateParent(t.subtopics, nodeId, null);
    if (r.found) return r.parentId;
  }
  return null;
}

// id -> başlık haritası (konular + tüm alt başlıklar, herhangi derinlik).
export function buildTitleMap(tree: TopicTree): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (subs: TopicSubtopic[]) => {
    for (const s of subs) {
      map.set(s.id, s.title);
      walk(s.subtopics ?? []);
    }
  };
  for (const t of tree.topics) {
    map.set(t.id, t.title);
    walk(t.subtopics);
  }
  return map;
}

// §5: "olduğu yere taşı" (etkisiz) veya "zaten üst-düzeyde" önerileri gizle.
export function isNoop(tree: TopicTree, s: Suggestion): boolean {
  const current = findParentId(tree, s.node_id);
  if (s.new_parent_id !== null && s.new_parent_id === current) return true;
  if (s.new_parent_id === null && current === null) return true;
  return false;
}

// Görünür (no-op olmayan) öneriler — panel + editör aynı listeyi kullanır.
export function visibleSuggestions(tree: TopicTree, suggestions: Suggestion[]): Suggestion[] {
  return suggestions.filter((s) => !isNoop(tree, s));
}

// id'li alt-başlığı bul (herhangi derinlik).
export function findNode(tree: TopicTree, id: string): TopicSubtopic | undefined {
  const walk = (subs: TopicSubtopic[]): TopicSubtopic | undefined => {
    for (const s of subs) {
      if (s.id === id) return s;
      const r = walk(s.subtopics ?? []);
      if (r) return r;
    }
    return undefined;
  };
  for (const t of tree.topics) {
    const r = walk(t.subtopics);
    if (r) return r;
  }
  return undefined;
}

export function TopicTreeEditor({
  tree, onChange, suggestions = [], selectedNodeId = null, onSelectSuggestion,
}: Props) {
  const allSubs = useMemo(
    () => tree.topics.flatMap((t) => collectLeaves(t.subtopics, t.title, [])),
    [tree]
  );

  // node_id -> görünür (no-op olmayan) öneri; rozet bu düğümlerde çıkar.
  const suggestionByNode = useMemo(() => {
    const map = new Map<string, Suggestion>();
    for (const s of suggestions) {
      if (!isNoop(tree, s) && !map.has(s.node_id)) map.set(s.node_id, s);
    }
    return map;
  }, [tree, suggestions]);
  const selectedSug = selectedNodeId ? suggestionByNode.get(selectedNodeId) : undefined;
  const targetId = selectedSug ? selectedSug.new_parent_id : null; // vurgulanacak hedef dal

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
    update((d) => d.topics.forEach((t) => removeNode(t.subtopics, sid)));
  }
  function addSub(tid: string) {
    update((d) => {
      const t = d.topics.find((x) => x.id === tid);
      if (t) t.subtopics.push({ id: crypto.randomUUID(), title: "Yeni alt başlık", chunk_ids: [] });
    });
  }
  function moveSubToTopic(sid: string, destTopicId: string) {
    update((d) => moveNodeInDraft(d, sid, null, destTopicId));
  }
  function moveChunk(chunkId: string, destSubId: string) {
    update((d) => {
      d.topics.forEach((t) => stripChunk(t.subtopics, chunkId));
      d.topics.forEach((t) => addChunkTo(t.subtopics, destSubId, chunkId));
    });
  }

  // Tek düğüm satırı + (yaprak ise) parçalar + (dal ise) çizgili çocuk konteyneri.
  function renderNode(sub: TopicSubtopic) {
    const kids = sub.subtopics ?? [];
    const isParent = kids.length > 0;
    const sug = suggestionByNode.get(sub.id);
    const isSource = sub.id === selectedNodeId && !!sug;
    const isTarget = !!targetId && sub.id === targetId;
    return (
      <>
        <div className={cn(
          "group flex items-center gap-2 rounded-md px-1 py-0.5",
          isSource && "bg-blue-50 ring-2 ring-blue-400",
          isTarget && "bg-green-50 ring-2 ring-green-400",
        )}>
          <span className="shrink-0 text-sm" title={isParent ? "dal" : "yaprak"}>
            {isParent ? "📁" : "📄"}
          </span>
          <Input value={sub.title} onChange={(e) => renameSub(sub.id, e.target.value)}
                 className={cn("h-7", isParent && "font-medium")} />
          <span className="whitespace-nowrap text-xs text-gray-400">
            {isParent ? `${kids.length} alt başlık` : `${sub.chunk_ids.length} parça`}
          </span>
          {isTarget && (
            <span className="shrink-0 whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              buraya
            </span>
          )}
          {sug && (
            <button
              type="button"
              onClick={() => onSelectSuggestion?.(sub.id)}
              title="Taşıma önerisi — önizle"
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs",
                isSource
                  ? "border-blue-400 bg-blue-100 text-blue-800"
                  : "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200",
              )}
            >
              💡 öneri
            </button>
          )}
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <Select
              items={tree.topics.map((t) => ({ value: t.id, label: t.title }))}
              onValueChange={(v) => moveSubToTopic(sub.id, v as string)}
            >
              <SelectTrigger className="h-7 w-24"><SelectValue placeholder="Taşı →" /></SelectTrigger>
              <SelectContent>
                {tree.topics.map((t) => (<SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500"
                    onClick={() => deleteSub(sub.id)}>×</Button>
          </div>
        </div>

        {!isParent && tree.previews && sub.chunk_ids.length > 0 && (
          <details className="ml-6 text-xs">
            <summary className="cursor-pointer text-gray-400">Parçalar</summary>
            <div className="mt-1 space-y-1">
              {sub.chunk_ids.map((cid) => (
                <div key={cid} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-gray-600">
                    {tree.previews?.[cid] ?? cid}
                  </span>
                  <Select items={allSubs.map((s) => ({ value: s.id, label: s.label }))}
                          onValueChange={(v) => moveChunk(cid, v as string)}>
                    <SelectTrigger className="h-7 w-40"><SelectValue placeholder="Taşı →" /></SelectTrigger>
                    <SelectContent>
                      {allSubs.map((s) => (<SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </details>
        )}

        {isParent && renderChildren(kids)}
      </>
    );
  }

  // Çocukları bağlantı çizgileriyle sar: dikey omurga (son çocukta yarım) + yatay tik.
  function renderChildren(kids: TopicSubtopic[]) {
    return (
      <div>
        {kids.map((k, idx) => {
          const last = idx === kids.length - 1;
          return (
            <div key={k.id} className="relative pl-5">
              <span className={cn("absolute left-1.5 top-0 w-px bg-gray-300", last ? "h-[18px]" : "h-full")} />
              <span className="absolute left-1.5 top-[18px] h-px w-3 bg-gray-300" />
              {renderNode(k)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tree.topics.map((topic: Topic) => (
        <div key={topic.id} className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm" title="konu">📚</span>
            <Input
              value={topic.title}
              onChange={(e) => renameTopic(topic.id, e.target.value)}
              className="h-8 font-semibold"
            />
          </div>
          {renderChildren(topic.subtopics)}
          <Button variant="ghost" size="sm" className="ml-5" onClick={() => addSub(topic.id)}>
            + Alt başlık ekle
          </Button>
        </div>
      ))}
    </div>
  );
}
