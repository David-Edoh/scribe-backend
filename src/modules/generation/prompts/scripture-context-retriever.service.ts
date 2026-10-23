import { Injectable } from '@nestjs/common';
import { RetrieverService } from '../../rag/retrievers/retriever.service';
import { ScriptureContext } from './prompt-builder.types';

/**
 * Scripture context retriever for prompt injection
 * Fetches relevant anchor scriptures from RAG and formats them for the prompt
 */
@Injectable()
export class ScriptureContextRetriever {
  constructor(private readonly retrieverService: RetrieverService) {}

  /**
   * Retrieve and format scriptures relevant to a chapter topic/query
   */
  async retrieveScriptures(
    userId: string,
    query: string,
    limit: number = 5,
  ): Promise<ScriptureContext[]> {
    // Use RAG retriever to find relevant scriptures by semantic similarity
    const retrieved = await this.retrieverService.retrieveRelevant(
      userId,
      query,
      limit,
    );

    return retrieved
      .filter((item) => item.source === 'scripture')
      .map((item) => this.formatScriptureResult(item.item))
      .filter((s) => s !== null);
  }

  /**
   * Format raw scripture retrieval result into structured ScriptureContext
   */
  private formatScriptureResult(scriptureItem: any): ScriptureContext | null {
    if (!scriptureItem) {
      return null;
    }

    // Support different possible field names depending on storage structure
    const ref =
      scriptureItem.ref ||
      scriptureItem.scriptureRef ||
      scriptureItem.reference ||
      '';
    const text = scriptureItem.text || scriptureItem.scriptureText || '';

    if (!ref || !text) {
      return null;
    }

    return {
      ref,
      text,
      context: scriptureItem.context || scriptureItem.interpretation || '',
      themeAlignment:
        scriptureItem.themeAlignment || scriptureItem.relevance || '',
    };
  }

  /**
   * Fetch specific scriptures by reference (e.g., "John 3:16")
   */
  async getScriptureByReference(
    reference: string,
  ): Promise<ScriptureContext | null> {
    // This would query the scripture database directly
    // For now, we'll implement the structure; backend would connect to scripture DB
    try {
      // Placeholder for scripture DB query
      // const scripture = await this.scriptureRepository.findByReference(reference);
      // return this.formatScriptureResult(scripture);
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch multiple scriptures by references
   */
  async getScripturesByReferences(
    references: string[],
  ): Promise<ScriptureContext[]> {
    const results = await Promise.all(
      references.map((ref) => this.getScriptureByReference(ref)),
    );
    return results.filter((s) => s !== null);
  }
}
