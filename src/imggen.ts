import canvas from "canvas"
const { loadImage } = canvas
import { readdirSync } from "fs"
import { GameMap } from "./game-map.js"
export var images: { [key: string]: canvas.Image } = {}
for (var file of readdirSync("assets/")) {
    var n = file.split(".")[0]
    images[n] = await loadImage(`./assets/${file}`)
}

export function drawTiles(ctx: canvas.CanvasRenderingContext2D, map: GameMap, fromx: number, fromy: number, w: number, h: number, offsetx: number = 0, offsety: number = 0) {
    var size = 16
    for (var tile of map.iterateRect(fromx, fromy, fromx + w, fromy + h)) {
        if (!tile.tile) continue
        ctx.drawImage(images[tile.tile.type], offsetx + (tile.x - fromx) * size, offsety + (tile.y - fromy) * size)
        if (tile.tile.building) {
            ctx.drawImage(images[tile.tile.building.info?.getSprite(tile.tile.building) || ""] || images.unknown, offsetx + (tile.x - fromx) * size, offsety + (tile.y - fromy) * size)
        }
    }
}
export function drawString(ctx: canvas.CanvasRenderingContext2D, x: number, y: number, string: string) {
    for (var i = 0; i < string.length; i++) {
        var c = string[i]
        var image = images[string.charCodeAt(i)]
        if (image) {
            ctx.drawImage(image, x, y)
            x += image.width
        }
    }
}