import { createSelector, createSelectorCreator, defaultMemoize } from 'reselect';

import { getChunksInRange, chunkSetIterableChunks } from './util/chunk';
import { getKind } from './util/annotext';

function findSourceHighlightsWithContext(texts, highlightSetId) {
  const contexts = [];
  for (const text of texts) {
    for (const chunk of chunkSetIterableChunks(text.chunkSet)) {
      const hls = getKind(chunk.annoText, 'highlight');
      if (hls.some(a => (a.data.setId === highlightSetId))) {
        // There are some highlights matching the given set id

        // Pull related chunks+texts from other text tracks (translations, generally)
        const secondaryAnnoTexts = []; // list of {language, annoTexts: [annoText...]}
        for (const otherText of texts) {
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

        const latestHighlightTimestamp = Math.max(...getKind(chunk.annoText, 'highlight').map(a => a.data.timeCreated));

        contexts.push({
          primaryAnnoText: chunk.annoText, // this one has highlights
          primaryLanguage: text.language,
          secondaryAnnoTexts: secondaryAnnoTexts, // list of {language, annoTexts: [annoText...]}
          chunkUID: chunk.uid, // added this for export to Anki
          latestHighlightTimestamp,
        });
      }
    }
  }

  contexts.sort((a, b) => a.latestHighlightTimestamp - b.latestHighlightTimestamp);

  return contexts;
}

function findAllHighlightsWithContext(sourceTexts, highlightSetId) {
  let result = [];

  for (const texts of sourceTexts) {
    result = result.concat(findSourceHighlightsWithContext(texts, highlightSetId));
  }

  return result;
}

function arraysShallowEqual(a, b) {
  return (a.length === b.length) && a.every((v,i) => v === b[i]);
}

const createShallowArraySelector = createSelectorCreator(
  defaultMemoize,
  arraysShallowEqual
);

export function createExpandedHighlightSetsMapSelector() {
  return createSelector(
    state => state.highlightSets,
    createShallowArraySelector(
      state => state.sources.toArray().map(s => s.texts),
      sourceTexts => sourceTexts,
    ),
    (sets, sourceTexts) => sets.map(s => ({
      id: s.id,
      name: s.name,
      contexts: findAllHighlightsWithContext(sourceTexts, s.id),
    }))
  );
};
