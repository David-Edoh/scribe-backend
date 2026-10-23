export async function retrieveContextForGeneration(
  embeddings: any,
  repo: any,
  userId: string,
  query: string,
  limit = 5,
) {
  const queryVector = await embeddings.embedText(query);

  const voiceChunks = await repo.queryNearestByUser(userId, queryVector, limit);
  const scriptures = await repo.queryNearestScriptures(queryVector, limit);

  const voiceContext = voiceChunks.map((chunk: any) => ({
    id: chunk.id,
    source: 'voice_profile',
    text: chunk.sourceText,
    distance: chunk.distance,
    metadata: chunk.metadata,
  }));

  const scriptureContext = scriptures.map((scripture: any) => ({
    id: scripture.id,
    source: 'scripture',
    reference: scripture.scriptureRef,
    text: scripture.scriptureText,
    distance: scripture.distance,
    metadata: scripture.metadata,
  }));

  const allContext = [...voiceContext, ...scriptureContext];
  allContext.sort((a, b) => a.distance - b.distance);

  return { query, voiceContext, scriptureContext, allContext: allContext.slice(0, limit * 2) };
}

export async function getContextReport(
  embeddings: any,
  repo: any,
  userId: string,
  query: string,
) {
  const context = await retrieveContextForGeneration(embeddings, repo, userId, query, 10);

  return {
    query,
    timestamp: new Date().toISOString(),
    voiceContextCount: context.voiceContext.length,
    scriptureContextCount: context.scriptureContext.length,
    voiceContext: context.voiceContext.map((chunk: any) => ({ id: chunk.id, similarity: (1 - chunk.distance).toFixed(4), text: chunk.text })),
    scriptureContext: context.scriptureContext.map((scripture: any) => ({ id: scripture.id, reference: scripture.reference, similarity: (1 - scripture.distance).toFixed(4), text: scripture.text })),
  };
}
