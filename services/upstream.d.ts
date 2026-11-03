declare module "layered-pii-redaction" {
  export function redactText(
    text: string,
    options: {
      profile: "identifiers"
      peopleMap: { people: never[]; safe: string[] }
    },
  ): { text: string; blocked: boolean; hits: unknown[] }
}

declare module "fontkit" {
  interface Font {
    unitsPerEm: number
    layout(text: string): {
      glyphs: { path: { toSVG(): string } }[]
      positions: { xOffset: number; yOffset: number; xAdvance: number }[]
    }
  }
  export function create(buffer: Buffer): Font
}
