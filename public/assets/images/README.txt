Card art assets (served at /assets/images/ in dev and production).

Required for assembled suit cards (see Card Creator in the app):

  CardBasicLight.png    — card face background (256×374 recommended)
  SuitHearts.png        — pip / corner suit glyph source
  SuitDiamonds.png
  SuitClubs.png
  SuitSpades.png

Optional picture-card art (one image per card, same aspect ratio):

  Hearts-J.png, Hearts-Q.png, …  (pattern: {Suit}-{Rank}.png matching game ids like Hearts-K)

Copy your files from dist/assets/images into this public folder while developing so Vite serves them.
