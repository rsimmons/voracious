import memoize from 'memoize-immutable';
import MixedTupleMap from 'mixedtuplemap';

import { getKind } from './util/annotext';
import { getChunksInRange, chunkSetIterableChunks } from './util/chunk';

const getSourceHighlightSetContexts = (source, highlightSetId) => {
  const contexts = [];

  source.texts.forEach((text, textNum) => {
    for (const chunk of chunkSetIterableChunks(text.chunkSet)) {
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

        const latestHighlightTimestamp = Math.max(...getKind(chunk.annoText, 'highlight').map(a => a.data.timeCreated));

        contexts.push({
          sourceId: source.id,
          primary: {
            annoText: chunk.annoText, // this one has highlights
            language: text.language,
            textNum,
            chunkId: chunk.uid,
          },
          secondaryAnnoTexts: secondaryAnnoTexts, // list of {language, annoTexts: [annoText...]}
          latestHighlightTimestamp,
        });
      }
    }
  });

  return contexts;
};

const getSourceHighlightSetContextsMemoized = memoize(getSourceHighlightSetContexts, {cache: new MixedTupleMap()})

const getHighlightSetContexts = (sources, highlightSetId) => {
  const contexts = [].concat(...sources.toArray().map(source =>
    getSourceHighlightSetContextsMemoized(source, highlightSetId)
  ));

  contexts.sort((a, b) => a.latestHighlightTimestamp - b.latestHighlightTimestamp);

  return contexts;
};

// NOTE: This returns an OrderedMap
export const getExpandedHighlightSets = (state) => {
  return state.highlightSets.map(set => ({
    id: set.id,
    name: set.name,
    contexts: getHighlightSetContexts(state.sources, set.id),
  }));
};
