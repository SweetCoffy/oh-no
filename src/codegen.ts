import { createWriteStream } from "fs";
import { abilities } from "./abilities.js";
import { items } from "./helditem.js";
import { shopItems } from "./items.js";
import { moves } from "./moves.js";
import { statusTypes } from "./battle.js";
import { locales } from "./locale.js";
import { load } from "./content-loader.js";

export function generate() {
    load("content/locale/en_us/pvp.yml")
    let stream = createWriteStream("src/gen.ts", "utf8")
    stream.write(`export type MoveID = ${moves.map((_, k) => `"${k}"`).join(" | ")}\n`)
    stream.write(`export type AbilityID = ${abilities.map((_, k) => `"${k}"`).join(" | ")}\n`)
    stream.write(`export type HeldItemID = ${items.map((_, k) => `"${k}"`).join(" | ")}\n`)
    stream.write(`export type ItemID = ${shopItems.map((_, k) => `"${k}"`).join(" | ")}\n`)
    stream.write(`export type StatusID = ${statusTypes.map((_, k) => `"${k}"`).join(" | ")}\n`)
    stream.write(`export type GenLocaleString = ${Object.keys(locales.en_US ?? {}).map(k => `"${k}"`).join(" | ")}\n`)
    stream.close()
}