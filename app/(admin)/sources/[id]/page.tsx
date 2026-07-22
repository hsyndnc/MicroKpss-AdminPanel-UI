"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTopics, type TopicTree } from "@/lib/api/pipeline";
import { TopicWorkspace } from "@/components/topic-workspace";

export default function SourceDetailPage() {
  const params = useParams<{ id: string }>();
  const sourceId = params.id;
  const [tree, setTree] = useState<TopicTree | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getTopics(sourceId).then(setTree).catch(() => setNotFound(true));
  }, [sourceId]);

  if (notFound) {
    return <p className="text-center text-gray-400 py-20">Kaynak bulunamadı.</p>;
  }
  if (!tree) {
    return <p className="text-center text-gray-400 py-20">Yükleniyor...</p>;
  }
  return <TopicWorkspace sourceId={sourceId} tree={tree} onTreeChange={setTree} />;
}
