import { createSelector } from 'reselect';

import { getChunksInRange, iteratableChunks } from './util/chunk';
import { getKind } from './util/annotext';

function findSourceHighlightsWithContext(source, highlightSetId) {
  const contexts = [];
  for (const text of source.texts) {
    for (const chunk of iteratableChunks(text.chunkSet)) {
      const hls = getKind(chunk.annoText, 'highlight');
      if (hls.some(a => (a.data.setId === highlightSetId))) {
        // There are some highlights matching the given set id

        // Pull related chunks+texts from other text tracks (translations, generally)
        const secondaryAnnoTexts = []; // list of {language, annoTexts: [annoText...]}
        for (const otherText of source.texts) {
          if (otherText === text) {
            continue;
          }
          const otherChunks = getChunksInRange(otherText.chunkSet, chunk.position.begin, chunk.position.end);
          // TODO: sort otherChunks by time, if not already
          const otherChunkTexts = [];
          for (const otherChunk of otherChunks) {
            otherChunkTexts.push(otherChunk.annoText);
          }
          if (otherChunkTexts.length > 0) {
            secondaryAnnoTexts.push({language: otherText.language, annoTexts: otherChunkTexts});
          }
        }

        contexts.push({
          primaryAnnoText: chunk.annoText, // this one has highlights
          primaryLanguage: text.language,
          secondaryAnnoTexts: secondaryAnnoTexts, // list of {language, annoTexts: [annoText...]}
          chunkUID: chunk.uid, // added this for export to Anki
        });
      }
    }
  }

  return contexts;
}

function findAllHighlightsWithContext(sources, highlightSetId) {
  let result = [];

  for (const source of sources) {
    result = result.concat(findSourceHighlightsWithContext(source, highlightSetId));
  }

  return result;
}

export function createExpandedHighlightSetsMapSelector() {
  return createSelector(
    state => state.highlightSets,
    state => state.sources,
    (sets, sources) => sets.map(s => ({
      id: s.id,
      name: s.name,
      contexts: findAllHighlightsWithContext(sources.valueSeq(), s.id),
    }))
  );
};
