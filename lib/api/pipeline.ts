import axios from "axios";

// Pipeline'a doğrudan değil, kendi route handler proxy'mize gidiyoruz —
// X-Api-Key sadece sunucu tarafında eklenir, tarayıcıya inmez.
const pipelineClient = axios.create({ baseURL: "/api/pipeline" });

export interface TopicSubtopic {
  id: string;
  title: string;
  chunk_ids: string[];
  subtopics?: TopicSubtopic[];   // gruplama (parent) düğümleri çocuk taşır; yaprak taşımaz
}
export interface Topic {
  id: string;
  title: string;
  subtopics: TopicSubtopic[];
}
export interface Suggestion {
  node_id: string;              // taşınacak düğümün id'si
  node_title: string;           // düğümün başlığı
  new_parent_id: string | null; // hedef parent id; null => konu üst-düzeyine terfi
  new_parent_title: string | null;
  topic_id: string;             // düğümün ait olduğu taksonomi konusunun id'si
  reason: string;               // LLM gerekçesi (kısa)
}
export interface TopicTree {
  source_id: string;
  file_name: string;
  topics: Topic[];
  previews?: Record<string, string>;
  suggestions?: Suggestion[];
}

export interface PipelineUploadResponse {
  job_id: string;
  status: string;
  file: string;
}

export interface PipelineJobResponse {
  status: "queued" | "processing" | "done" | "error";
  file: string;
  source_id?: string;
  topics?: TopicTree;
  error?: string;
}

export interface GenerateResult {
  status: string;
  count: number;
  export?: { imported?: number; error?: string };
}

export async function uploadPdfToPipeline(file: File): Promise<PipelineUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await pipelineClient.post<PipelineUploadResponse>("/upload", form);
  return data;
}

export async function getPipelineJob(jobId: string): Promise<PipelineJobResponse> {
  const { data } = await pipelineClient.get<PipelineJobResponse>(`/jobs/${jobId}`);
  return data;
}

export async function getTopics(sourceId: string): Promise<TopicTree> {
  const { data } = await pipelineClient.get<TopicTree>(`/sources/${sourceId}/topics`);
  return data;
}

export async function saveTopics(sourceId: string, tree: TopicTree): Promise<TopicTree> {
  const { data } = await pipelineClient.put<{ topics: TopicTree }>(
    `/sources/${sourceId}/topics`, tree
  );
  return data.topics;
}

export async function reviewTopics(sourceId: string): Promise<TopicTree> {
  const { data } = await pipelineClient.post<{ topics: TopicTree }>(
    `/sources/${sourceId}/review`
  );
  return data.topics;
}

export async function generateFromTopic(
  sourceId: string,
  nodeId: string,
  body: { count: number; category_id: string; tip?: string }
): Promise<GenerateResult> {
  const { data } = await pipelineClient.post<GenerateResult>(
    `/sources/${sourceId}/topics/${nodeId}/generate`, body
  );
  return data;
}

export interface SourceSummary {
  source_id: string;
  file_name: string;
  topic_count: number;
  question_count: number;
  created_at: string | null;
}

export async function listSources(): Promise<SourceSummary[]> {
  const { data } = await pipelineClient.get<SourceSummary[]>("/sources");
  return data;
}

export async function deleteSource(sourceId: string, deleteQuestions: boolean): Promise<void> {
  await pipelineClient.delete(`/sources/${sourceId}?delete_questions=${deleteQuestions}`);
}
