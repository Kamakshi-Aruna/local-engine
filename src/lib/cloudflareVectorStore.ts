// Cloudflare Vectorize integration

// Disable SSL verification for development (Node.js environment)
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

interface CloudflareConfig {
  workerUrl: string;
}

export interface DocumentChunk {
  id: string;
  text: string;
  source: string;
  chunk_index: number;
}

export interface SearchResult {
  file: string;
  chunk: number;
  score: number;
  preview: string;
}

export interface CloudflareSearchResponse {
  success: boolean;
  answer?: string;
  query: string;
  sources?: SearchResult[];
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_results?: Array<{
    tool_call_id: string;
    result: any;
  }>;
  error?: string;
}

export class CloudflareVectorStore {
  private config: CloudflareConfig;

  constructor(workerUrl: string) {
    this.config = {
      workerUrl: workerUrl.replace(/\/$/, ''), // Remove trailing slash
    };
  }

  async search(query: string, limit: number = 3): Promise<CloudflareSearchResponse> {
    try {
      const response = await fetch(`${this.config.workerUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Cloudflare search error:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadChunks(chunks: DocumentChunk[]): Promise<{ success: boolean; message: string; chunks_processed?: number }> {
    try {
      const response = await fetch(`${this.config.workerUrl}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chunks }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Cloudflare upload error:', error);
      throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteDocument(source: string): Promise<{ success: boolean; message: string }> {
    // Note: This would require implementing deletion in the Cloudflare Worker
    // For now, we'll return a placeholder response
    console.warn('Delete functionality not yet implemented in Cloudflare Worker');
    return {
      success: false,
      message: 'Delete functionality not yet implemented',
    };
  }
}

export async function getCloudflareVectorStore(): Promise<CloudflareVectorStore> {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;

  if (!workerUrl) {
    throw new Error('CLOUDFLARE_WORKER_URL environment variable is required');
  }

  return new CloudflareVectorStore(workerUrl);
}