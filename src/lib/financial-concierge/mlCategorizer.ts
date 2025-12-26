/**
 * ML/Embedding-based Categorization (Optional Feature)
 * This is a placeholder implementation for future ML-based categorization
 * 
 * To implement:
 * 1. Choose an embedding model (OpenAI, Cohere, or local)
 * 2. Generate embeddings for category names/descriptions
 * 3. Generate embedding for transaction description
 * 4. Use cosine similarity to find best match
 * 5. Set confidence threshold (e.g., 0.7)
 */

import { TransactionToCategorize, CategorizationResult } from './types';

export interface MLCategorizationOptions {
    userId: string;
    transaction: TransactionToCategorize;
    categories: Array<{ id: string; name: string; description?: string }>;
    confidenceThreshold?: number; // Default: 0.7
}

/**
 * Placeholder for ML-based categorization
 * 
 * Example implementation using OpenAI embeddings:
 * 
 * ```typescript
 * import OpenAI from 'openai';
 * 
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 * 
 * async function categorizeWithML(options: MLCategorizationOptions): Promise<CategorizationResult | null> {
 *     const transactionText = `${options.transaction.name} ${options.transaction.note || ''}`;
 *     
 *     // Get embedding for transaction
 *     const transactionEmbedding = await openai.embeddings.create({
 *         model: 'text-embedding-3-small',
 *         input: transactionText,
 *     });
 *     
 *     // Get embeddings for all categories (could be cached)
 *     const categoryEmbeddings = await Promise.all(
 *         options.categories.map(async (cat) => {
 *             const embedding = await openai.embeddings.create({
 *                 model: 'text-embedding-3-small',
 *                 input: `${cat.name} ${cat.description || ''}`,
 *             });
 *             return { category: cat, embedding: embedding.data[0].embedding };
 *         })
 *     );
 *     
 *     // Calculate cosine similarity
 *     let bestMatch: { category: typeof options.categories[0]; similarity: number } | null = null;
 *     
 *     for (const { category, embedding } of categoryEmbeddings) {
 *         const similarity = cosineSimilarity(
 *             transactionEmbedding.data[0].embedding,
 *             embedding
 *         );
 *         
 *         if (!bestMatch || similarity > bestMatch.similarity) {
 *             bestMatch = { category, similarity };
 *         }
 *     }
 *     
 *     const threshold = options.confidenceThreshold || 0.7;
 *     if (bestMatch && bestMatch.similarity >= threshold) {
 *         return {
 *             category_id: bestMatch.category.id,
 *             confidence: bestMatch.similarity,
 *             method: 'ml_model',
 *             explanation: `ML match: ${(bestMatch.similarity * 100).toFixed(0)}% similarity to "${bestMatch.category.name}"`,
 *         };
 *     }
 *     
 *     return null;
 * }
 * 
 * function cosineSimilarity(a: number[], b: number[]): number {
 *     let dotProduct = 0;
 *     let normA = 0;
 *     let normB = 0;
 *     
 *     for (let i = 0; i < a.length; i++) {
 *         dotProduct += a[i] * b[i];
 *         normA += a[i] * a[i];
 *         normB += b[i] * b[i];
 *     }
 *     
 *     return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
 * }
 * ```
 */
export async function categorizeWithML(
    options: MLCategorizationOptions
): Promise<CategorizationResult | null> {
    // Placeholder implementation
    // Return null to indicate no ML match found
    // This allows the categorization engine to fall back to other methods
    
    console.log('ML categorization is not yet implemented');
    return null;
}

/**
 * Pre-compute category embeddings (for caching)
 * This should be called when categories are created/updated
 */
export async function updateCategoryEmbeddings(
    userId: string,
    categoryIds: string[]
): Promise<void> {
    // Placeholder for embedding pre-computation
    // In production, this would:
    // 1. Fetch category names/descriptions
    // 2. Generate embeddings
    // 3. Store in a cache (Redis) or database table
    console.log('Category embedding update not yet implemented');
}

