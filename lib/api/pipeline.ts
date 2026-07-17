import axios from "axios";

// Pipeline'a doğrudan değil, kendi route handler proxy'mize gidiyoruz —
// X-Api-Key sadece sunucu tarafında eklenir, tarayıcıya inmez.
const pipelineClient = axios.create({
  baseURL: "/api/pipeline",
});

export interface PipelineUploadResponse {
  job_id: string;
  status: string;
  file: string;
}

export interface PipelineJobResponse {
  status: "queued" | "processing" | "done" | "error";
  file: string;
  count?: number;
  export?: { imported?: number; error?: string };
  error?: string;
}

export async function uploadPdfToPipeline(
  file: File,
  categoryId: string,
  nQuestions: number
): Promise<PipelineUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("category_id", categoryId);
  form.append("n_questions", String(nQuestions));
  const { data } = await pipelineClient.post<PipelineUploadResponse>("/upload", form);
  return data;
}

export async function getPipelineJob(jobId: string): Promise<PipelineJobResponse> {
  const { data } = await pipelineClient.get<PipelineJobResponse>(`/jobs/${jobId}`);
  return data;
}
