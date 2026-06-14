import { GoogleGenAI, Type } from '@google/genai';
import { ScanResult, AIDiagnosis } from '../../src/types';

export class AIService {
  public static async diagnose(params: {
    scanData: ScanResult;
    provider: 'gemini' | 'deepseek' | 'custom';
    apiKey?: string;
    model: string;
    apiUrl?: string;
  }): Promise<AIDiagnosis> {
    const { scanData, provider, apiKey, model, apiUrl } = params;

    const basePrompt = `
      You are an expert Security Architect specializing in network infrastructure and threat modeling.
      Analyze the following network scan results.
      The environment context is ${scanData.network.includes('HOSPITAL') ? 'a Critical Healthcare Facility (Hospitals, Clinical Labs)' : 'a Standard Enterprise/Cloud Infrastructure'}.
      
      Diagnostic Objectives:
      1. Identify root causes for any anomalies.
      2. Assess operational impact (e.g., service downtime, data leak risk).
      3. Provide precise, actionable CLI remediation terminal commands (Cisco IOS, Junos, or Linux/Cloud style).
      
      Scan Data to Analyze:
      ${JSON.stringify(scanData, null, 2)}

      IMPORTANT: Return your response EXACTLY as a single well-formed JSON object containing the absolute following fields with no enclosing markdown or extra text:
      {
        "severity": "Critical" | "High" | "Medium" | "Low",
        "rootCause": "Detailed explanation of the underlying problem",
        "impact": "What happens if this is not fixed (e.g. data leak/downtime)",
        "remediationCommands": ["cli command 1", "cli command 2"],
        "summary": "High-level summary of the findings"
      }
    `;

    if (provider === 'gemini') {
      const activeKey = apiKey || process.env.GEMINI_API_KEY;
      if (!activeKey) {
        throw new Error('System Gemini API key is missing. Please configure it or enter a custom key in the Settings Panel.');
      }

      const ai = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      try {
        const response = await ai.models.generateContent({
          model: model || 'gemini-3.5-flash',
          contents: basePrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                severity: {
                  type: Type.STRING,
                  enum: ['Critical', 'High', 'Medium', 'Low'],
                  description: 'Overall threat level'
                },
                rootCause: {
                  type: Type.STRING,
                  description: 'Detailed explanation of the underlying problem'
                },
                impact: {
                  type: Type.STRING,
                  description: 'What happens if this is not fixed'
                },
                remediationCommands: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Exact terminal commands to resolve the issue'
                },
                summary: {
                  type: Type.STRING,
                  description: 'High-level summary of the findings'
                }
              },
              required: ['severity', 'rootCause', 'impact', 'remediationCommands', 'summary']
            }
          }
        });

        const rawText = response.text || '';
        return JSON.parse(rawText.trim()) as AIDiagnosis;
      } catch (error) {
        console.error('Gemini API Error in AIService:', error);
        throw new Error('Failed to generate network diagnosis utilizing Gemini API.');
      }
    } else {
      // DeepSeek or Custom OpenAI-compatible Provider
      const activeKey = apiKey || (provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.CUSTOM_API_KEY);
      if (!activeKey) {
        throw new Error(`API Key for ${provider.toUpperCase()} is missing. Please configure it or enter your custom key in Settings.`);
      }

      const defaultUrl = provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com/v1';
      const targetUrl = (apiUrl || defaultUrl).replace(/\/$/, ''); // strip trailing slash

      try {
        const fetchResponse = await fetch(`${targetUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeKey}`
          },
          body: JSON.stringify({
            model: model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'),
            messages: [
              {
                role: 'system',
                content: 'You are a Senior Security Architect. Return results only in strict JSON format without Markdown wrapping (`json ...`).'
              },
              {
                role: 'user',
                content: basePrompt
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2
          })
        });

        if (!fetchResponse.ok) {
          const errMsg = await fetchResponse.text();
          throw new Error(`Provider API returned non-success HTTP status ${fetchResponse.status}: ${errMsg}`);
        }

        const resData = await fetchResponse.json() as any;
        const messageContent = resData?.choices?.[0]?.message?.content || '{}';
        
        // Clean markdown backticks just in case the provider ignored instructions
        const cleanJSON = messageContent.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJSON) as AIDiagnosis;
      } catch (error: any) {
        console.error(`${provider.toUpperCase()} API Error in AIService:`, error);
        throw new Error(`Failed to complete diagnosis using ${provider.toUpperCase()}: ${error.message || error}`);
      }
    }
  }
}
