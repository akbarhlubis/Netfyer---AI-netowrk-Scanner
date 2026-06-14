import { ScanResult, AIDiagnosis } from '../types';

export const diagnoseNetwork = async (params: {
  scanData: ScanResult;
  provider: 'gemini' | 'deepseek' | 'custom';
  apiKey?: string;
  model: string;
  apiUrl?: string;
}): Promise<AIDiagnosis> => {
  const response = await fetch('/api/diagnose', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Failed to complete AI network diagnosis.');
  }

  return response.json() as Promise<AIDiagnosis>;
};
