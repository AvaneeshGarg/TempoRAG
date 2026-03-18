import { HealthStatus, QueryResponse, DecayMethod, PredictionResponse, PredictRequest, SearchResponse } from '../types';

// Reads from Vite env (VITE_BACKEND_URL). Falls back to '' (which uses Vite proxy in dev).
const BASE_URL = ((import.meta.env.VITE_BACKEND_URL as string) || '').replace(/\/+$/, '');

const apiFetch = (path: string, init?: RequestInit) =>
  fetch(`${BASE_URL}${path}`, { credentials: 'include', ...init });

export const clinicalApi = {
  async checkHealth(): Promise<HealthStatus> {
    try {
      const response = await apiFetch('/health');
      if (!response.ok) throw new Error('Health check failed');
      const data = await response.json();
      return { status: data.status === 'ok' ? 'ok' : 'error' };
    } catch (error) {
      console.error('API Health Check Error:', error);
      return { status: 'error' };
    }
  },

  async query(question: string, method: DecayMethod): Promise<QueryResponse> {
    const response = await apiFetch('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, method }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to fetch response from clinical assistant');
    }
    return response.json();
  },

  async predict(data: PredictRequest): Promise<PredictionResponse> {
    const response = await apiFetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Prediction request failed.');
    }
    const result = await response.json();
    return {
      risk_1d: result['1_day_risk'],
      risk_7d: result['7_day_risk'],
      risk_30d: result['30_day_risk'],
    };
  },

  async searchPubMed(query: string): Promise<SearchResponse> {
    const response = await apiFetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Search request failed.');
    }
    return response.json();
  },
};
