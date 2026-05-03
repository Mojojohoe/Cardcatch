Card art assets are loaded from THIS folder (public/assets/images).

IMPORTANT: `npm run dev` only serves files under `public/`. Assets that exist only under
`dist/assets/images` after a build are NOT available during development — copy or symlink
them here while you work. Production builds copy `public/` into `dist/`, so the same paths work.

Assembled mode tries several filename patterns per suit (SuitHearts, Hearts, suit_Hearts, subfolder suits/, …) and extensions: .png, .webp, .jpg, .svg

Card Creator pip grid is 11×17 (odd×odd) so the middle cell is a true centre.

  CardBasicLight.png   — card face background (256×374 recommended)
  SuitHearts.png       — suit symbols (corners + pip court); same pattern:
  SuitDiamonds.png, SuitClubs.png, SuitSpades.png

Picture cards (optional full art):

  Hearts-J.png, Hearts-K.png, …  (game id with hyphen, e.g. Spades-A.png)
