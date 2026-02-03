import { pipeline, FeatureExtractionPipeline, env } from '@huggingface/transformers';

let embeddingPipeline: FeatureExtractionPipeline | null = null;

export async function initEmbeddings(): Promise<void> {
  if (!embeddingPipeline) {
    console.log('Loading embedding model (first run may take time)...');

    // Set cache directory
    env.cacheDir = './.cache';

    // Load EmbeddingGemma with Q4 quantization
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'onnx-community/embeddinggemma-300m-ONNX',
      { dtype: 'q4' } as any
    );

    console.log('Embedding model loaded');
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!embeddingPipeline) {
    await initEmbeddings();
  }

  // CRITICAL: Task prefix is MANDATORY for EmbeddingGemma
  // For documents/text, use "title: none | text: ..."
  const prefixedText = `title: none | text: ${text}`;

  // Truncate to avoid token limits (EmbeddingGemma supports up to 2K tokens)
  const truncated = prefixedText.substring(0, 8000);

  // Generate embeddings with mean pooling and normalization
  const output = await embeddingPipeline!(truncated, {
    pooling: 'mean',
    normalize: true
  });

  return Array.from(output.data);
}

export async function generateExchangeEmbedding(
  userMessage: string,
  assistantMessage: string,
  toolNames?: string[]
): Promise<number[]> {
  // Combine user question, assistant answer, and tools used for better searchability
  let combined = `User: ${userMessage}\n\nAssistant: ${assistantMessage}`;

  // Include tool names in embedding for tool-based searches
  if (toolNames && toolNames.length > 0) {
    combined += `\n\nTools: ${toolNames.join(', ')}`;
  }

  return generateEmbedding(combined);
}
