# Elementary music content and mission seams

`content.ts` is the drop-in boundary for the future curriculum bank. Every
`MusicPiece` requires a stable `id`, `title`, `composer`, `era`, and
`listenFor` prompt. A piece may optionally provide either an external `link` or
an `audio` URL through `media`. The repository intentionally contains neither
recordings nor sheet music.

Replace `MUSIC_PIECES` with reviewed content and licensed/public media when the
real curriculum arrives. Keep the call to `parseMusicPieces(...)` so malformed
or duplicate content fails at the bank boundary instead of inside the player.

## Mission hook (documented, intentionally unwired)

`musicMissionHook(profile, today)` in `engine.ts` returns:

```ts
{ id: 'music-practice', label: 'Music: read notes or listen', done: boolean }
```

It becomes done after a note-reading answer or after a piece is marked
listened on `today`. A future mission-composition cycle can consume that value.
This cycle does not import it into `src/missions.ts`.
