# Voracious

Voracious is a (prototype) tool for foreign language learners to get the most out of watching TV and movies. It lets you easily:
- simultaneously display foreign and native subtitles
- train your listen/comprehension with a "quiz mode" that automatically pauses after each subtitle
- replay the current subtitle to re-listen to tricky speech
- highlight words/phrases for later study
- export highlights for SRS in Anki
- automatically generate furigana for Japanese text
- _(coming soon)_ hover over words to see definitions
- _(coming soon)_ study comics/images as well, with OCR

## Running in development mode

To install dependencies, first run:
```
yarn
```

Then start the React development server with:
```
yarn react-start
```

Once the React server has started up, **in a separate terminal** run:
```
yarn electron
```

## Getting Started

- Click `+ Add Video`
- Paste a link to a video in the Video URL field and click `Set URL`
- Click `Import Subs` to add subtitle tracks. Ideally you should add at least two subtitle tracks:
 - One in the same langauge as the video (transcription)
 - And then one in your native language (translation)
- Use the video controls and buttons/key-shorcuts to play video, change quiz modes, etc.
- (Japanese only) hover/click on words
