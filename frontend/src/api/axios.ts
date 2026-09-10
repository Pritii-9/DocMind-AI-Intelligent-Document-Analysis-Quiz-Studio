import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export interface AIQueryRequest {
  question: string;
  doc_key?: string;
}

export interface AIQueryResponse {
  answer: string;
  matches?: Array<{
    chunk_index: number;
    score: number;
    text_preview: string;
  }>;
}

export interface AICommandRequest {
  query: string;
}

export interface AICommandResponse {
  response: string;
}

export async function aiQuery(data: AIQueryRequest): Promise<AIQueryResponse> {
  const response = await api.post<AIQueryResponse>("/ai/query", data);
  return response.data;
}

export async function aiCommand(data: AICommandRequest): Promise<AICommandResponse> {
  const response = await api.post<AICommandResponse>("/ai/command", data);
  return response.data;
}

export async function aiIngest(docKey: string): Promise<{msg: string; chunk_count?: number}> {
  const response = await api.post<{msg: string; chunk_count?: number}>("/ai/ingest/" + encodeURIComponent(docKey));
  return response.data;
}

export default api;
