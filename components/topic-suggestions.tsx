"use client";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { findParentId } from "@/components/topic-tree-editor";
import type { TopicTree, TopicSubtopic, Suggestion } from "@/lib/api/pipeline";

// id -> başlık haritası (konular + tüm alt başlıklar, herhangi derinlik).
function buildTitleMap(tree: TopicTree): Map<string, string> {
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
function isNoop(tree: TopicTree, s: Suggestion): boolean {
  const current = findParentId(tree, s.node_id);
  if (s.new_parent_id !== null && s.new_parent_id === current) return true;
  if (s.new_parent_id === null && current === null) return true;
  return false;
}

interface Props {
  tree: TopicTree;
  suggestions: Suggestion[];
  onApply: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
}

export function TopicSuggestions({ tree, suggestions, onApply, onDismiss }: Props) {
  const titleMap = useMemo(() => buildTitleMap(tree), [tree]);
  const visible = suggestions.filter((s) => !isNoop(tree, s));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
      <div className="text-sm font-semibold text-blue-800">
        Ağaç önerileri ({visible.length})
      </div>
      {visible.map((s, i) => {
        const currentParentId = findParentId(tree, s.node_id);
        const currentLabel = currentParentId
          ? (titleMap.get(currentParentId) ?? currentParentId)
          : "konu üst-düzeyi";
        const targetLabel =
          s.new_parent_id === null
            ? "⬆ konu üst-düzeyine (terfi)"
            : (titleMap.get(s.new_parent_id) ?? s.new_parent_title ?? s.new_parent_id);
        return (
          <div
            key={`${s.node_id}:${s.new_parent_id ?? "root"}:${i}`}
            className="rounded-md border bg-white p-2 space-y-1 text-sm"
          >
            <div className="font-medium">{titleMap.get(s.node_id) ?? s.node_title}</div>
            <div className="text-xs text-gray-600">
              şu an: {currentLabel} <span className="mx-1">→</span> {targetLabel}
            </div>
            <div className="text-xs italic text-gray-500">{s.reason}</div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => onApply(s)}>Uygula</Button>
              <Button size="sm" variant="outline" onClick={() => onDismiss(s)}>Yoksay</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
