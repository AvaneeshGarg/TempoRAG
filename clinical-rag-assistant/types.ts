
export type DecayMethod = 'etvd' | 'sigmoid' | 'bioscore';

export interface Source {
  year: string;
  title: string;
  score: number;
  pmid?: string;
}

export interface QueryResponse {
  answer: string;
  sources: Source[];
}

export interface PredictRequest {
  age: number;
  anaemia: number;
  creatinine_phosphokinase: number;
  diabetes: number;
  ejection_fraction: number;
  high_blood_pressure: number;
  platelets: number;
  serum_creatinine: number;
  serum_sodium: number;
  sex: number;
  smoking: number;
}

export interface PredictionResponse {
  risk_1d: number;
  risk_7d: number;
  risk_30d: number;
}

export interface ResearchItem {
  title: string;
  snippet: string;
  url?: string;
  publishedDate?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export interface HealthStatus {
  status: 'ok' | 'error' | 'checking';
}

export interface SearchResponse {
  synthesis: string;
  pubmed_results: string;
}
