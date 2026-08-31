"use client";
import { Button } from "@/components/ui/button";
import {
  findParentId, buildTitleMap, visibleSuggestions, findNode,
} from "@/components/topic-tree-editor";
import type { TopicTree, Suggestion } from "@/lib/api/pipeline";

interface Props {
  tree: TopicTree;
  suggestions: Suggestion[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  onApply: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
}

// Seçili taşıma önerisinin görsel önizlemesi: kaynak düğüm ─▼ hedef düğüm + Uygula/Yoksay.
export function SuggestionPreview({
  tree, suggestions, selectedNodeId, onSelect, onApply, onDismiss,
}: Props) {
  const visible = visibleSuggestions(tree, suggestions);
  if (visible.length === 0) return null;

  const titleMap = buildTitleMap(tree);
  let idx = visible.findIndex((s) => s.node_id === selectedNodeId);
  if (idx < 0) idx = 0;
  const s = visible[idx];

  const sourceNode = findNode(tree, s.node_id);
  const sourceIsParent = (sourceNode?.subtopics?.length ?? 0) > 0;
  const sourceTitle = titleMap.get(s.node_id) ?? s.node_title;
  const currentParentId = findParentId(tree, s.node_id);
  const currentParentLabel = currentParentId
    ? (titleMap.get(currentParentId) ?? currentParentId)
    : "konu üst-düzeyi";

  const toTop = s.new_parent_id === null;
  const targetTitle = toTop
    ? ""
    : (titleMap.get(s.new_parent_id!) ?? s.new_parent_title ?? s.new_parent_id!);

  function step(delta: number) {
    const n = visible[(idx + delta + visible.length) % visible.length];
    if (n) onSelect(n.node_id);
  }
  // Uygula/Yoksay sonrası seçili öneri listeden düşecek → sonrakine kaydır.
  function advance() {
    const n = visible[idx + 1] ?? visible[0];
    if (n && n.node_id !== s.node_id) onSelect(n.node_id);
  }

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-blue-800">Taşıma önerisi</div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <button type="button" className="rounded px-1 hover:bg-gray-100 disabled:opacity-40"
                  disabled={visible.length < 2} onClick={() => step(-1)}>‹</button>
          <span>{idx + 1} / {visible.length}</span>
          <button type="button" className="rounded px-1 hover:bg-gray-100 disabled:opacity-40"
                  disabled={visible.length < 2} onClick={() => step(1)}>›</button>
        </div>
      </div>

      {/* kaynak düğüm */}
      <div className="rounded-md border bg-blue-50/60 p-2">
        <div className="flex items-center gap-2">
          <span>{sourceIsParent ? "📁" : "📄"}</span>
          <span className="text-sm font-medium">{sourceTitle}</span>
          <span className="text-xs text-gray-500">({sourceIsParent ? "dal" : "yaprak"})</span>
        </div>
        <div className="mt-0.5 text-xs text-gray-500">şu an: {currentParentLabel} içinde</div>
      </div>

      <div className="text-center text-gray-400">▼</div>

      {/* hedef */}
      <div className="rounded-md border bg-green-50/60 p-2">
        {toTop ? (
          <div className="flex items-center gap-2 text-sm font-medium text-green-800">
            <span>⬆</span> konu üst-düzeyine (terfi)
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>📁</span>
            <span className="text-sm font-medium">{targetTitle}</span>
            <span className="text-xs text-gray-500">(dal)</span>
          </div>
        )}
      </div>

      <div className="text-xs italic text-gray-500">{s.reason}</div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => { advance(); onApply(s); }}>Uygula</Button>
        <Button size="sm" variant="outline" onClick={() => { advance(); onDismiss(s); }}>Yoksay</Button>
      </div>
    </div>
  );
}
