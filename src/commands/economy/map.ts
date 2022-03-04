import { Command } from "../../command-loader.js";
import canvas from "canvas"
const { createCanvas } = canvas
import { drawString, drawTiles, images } from "../../imggen.js";
import { Building, buildingTypes, map } from "../../game-map.js";
import { ApplicationCommandOptionType, ApplicationCommandType, MessageAttachment } from "discord.js";
import { getUser } from "../../users.js"
import { format } from "../../util.js";
import { getItem } from "../../items.js";

export var command: Command = {
    name: "map",
    description: "asd",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "show",
            description: "a",
            options: [
                {
                    type: ApplicationCommandOptionType.Number,
                    name: "scale",
                    required: false,
                    description: "nbasd"
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "select",
            description: "a",
            options: [
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "start_x",
                    required: true,
                    description: "a",
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "start_y",
                    required: true,
                    description: "a",
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "end_x",
                    required: true,
                    description: "a",
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "end_y",
                    required: true,
                    description: "a",
                },
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: "stack",
                    required: false,
                    description: "a",
                },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "deselect",
            description: "a",
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "grid",
            description: "a",
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "build_mode",
            description: "a",
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "claim",
            description: "a",
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "unclaim",
            description: "a",
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "find_unclaimed",
            description: "a",
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "destroy",
            description: "a",
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "scroll_view",
            description: "asd",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "direction",
                    required: true,
                    description: "y",
                    choices: [
                        {
                            name: "Up",
                            value: "0,-1"
                        },
                        {
                            name: "Down",
                            value: "0,1"
                        },
                        {
                            name: "Left",
                            value: "-1,0"
                        },
                        {
                            name: "Right",
                            value: "1,0"
                        },
                    ]
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "amount",
                    required: false,
                    description: "a"
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "set_scroll",
            description: "a",
            options: [
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "x",
                    description: "a",
                    required: true,
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "y",
                    description: "a",
                    required: true,
                },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "build",
            description: "a",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "building",
                    description: "a",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "x",
                    description: "a",
                    required: false,
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "y",
                    description: "a",
                    required: false,
                },
                {
                    type: ApplicationCommandOptionType.String,
                    name: "facing",
                    required: false,
                    description: "y",
                    choices: [
                        {
                            name: "Up",
                            value: "0,-1"
                        },
                        {
                            name: "Down",
                            value: "0,1"
                        },
                        {
                            name: "Left",
                            value: "-1,0"
                        },
                        {
                            name: "Right",
                            value: "1,0"
                        },
                    ]
                },
            ]
        }
    ],
    async run(i) {
        var u = getUser(i.user)
        var size = 16

        var s = Math.max(Math.min(i.options.getNumber("scale") || 1, 2), 0.25)

        var w = Math.floor(12 * s)
        var h = Math.floor(12 * s)

        var canvas = createCanvas(w * size, h * size)
        var ctx = canvas.getContext('2d')
        ctx.fillStyle = "rgba(0, 153, 255, 127)"
        ctx.antialias = "none"
        ctx.imageSmoothingEnabled = false
        ctx.fillStyle = "#000000"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        var content = ``

        switch (i.options.getSubcommand(true)) {
            case "show": {
                break;
            }
            case "select": {
                let startx = i.options.getInteger("start_x", true)
                let starty = i.options.getInteger("start_y", true)

                let endx = i.options.getInteger("end_x", true)
                let endy = i.options.getInteger("end_y", true)
                let w = Math.max(endx - startx, 0) + 1
                let h = Math.max(endy - starty, 0) + 1
                content = `Selected ${w * h} tiles (${w}x${h})`
                if (i.options.getBoolean("stack")) {
                    u.selection.setAll((x, y, v) => v || (x >= startx && x <= endx && y >= starty && y <= endy))
                } else u.selection.setAll((x, y) => x >= startx && x <= endx && y >= starty && y <= endy)
                
                break;
            }
            case "deselect": {
                content = `Cancelled selection`
                u.selection.setAll((x, y) => false)
                break;
            }
            case "grid": {
                u.showGrid = !u.showGrid
                if (u.showGrid) content = `Grid enabled`
                else content = `Grid disabled`
                break;
            }
            case "build_mode": {
                u.buildMode = !u.buildMode
                if (u.buildMode) content = `Build Mode enabled`
                else content = `Build Mode disabled`
                break;
            }
            case "claim": {
                var claimTiles = []
                for (var t of map.iterateRect(0, 0, map.width, map.height)) {
                    if (t.tile?.owner) continue
                    if (u.selection.get2D(t.x, t.y)) claimTiles.push(t)
                }
                var cost = 15n * BigInt(claimTiles.length)
                if (u.money.points < cost) {
                    content = `Can't afford to buy ${claimTiles.length} tiles (costs $ ${format(cost)})`
                    break;
                }
                for (var t of claimTiles) {
                    if (!t.tile) continue
                    t.tile.owner = i.user.id
                }
                u.money.points -= cost
                content = `Claimed ${claimTiles.length} tiles for $ ${format(cost)}`
                break;
            }
            case "unclaim": {
                var unclaimTiles = []
                for (var t of map.iterateRect(0, 0, map.width, map.height)) {
                    if (u.selection.get2D(t.x, t.y) && t.tile?.owner == i.user.id) unclaimTiles.push(t)
                }
                var cost = (15n * BigInt(unclaimTiles.length))/4n*3n
                content = `Unclaimed ${unclaimTiles.length} tiles and earned $ ${format(cost)}`
                u.money.points += cost
                for (var t of unclaimTiles) {
                    if (!t.tile) continue
                    t.tile.owner = undefined
                }
                break;
            }
            case "find_unclaimed": {
                for (var t of map.iterateRect(0, 0, map.width, map.height)) {
                    if (!t.tile) continue
                    if (!t.tile.owner) {
                        content = `Found an unclaimed tile at position ${t.x}, ${t.y}`
                        u.viewx = Math.floor(t.x - (w / 2))
                        u.viewy = Math.floor(t.y - (h / 2))
                        break;
                    }
                }
                break;
            }
            case "scroll_view": {
                var o = i.options.getString("direction", true).split(",").map(el => Number(el))
                var amt = i.options.getInteger("amount", false) || w
                u.viewx += o[0] * amt
                u.viewy += o[1] * amt
                break;
            }
            case "set_scroll": {
                u.viewx = i.options.getInteger("x", true)
                u.viewy = i.options.getInteger("y", true)
                break;
            }
            case "build": {
                let x = i.options.getInteger("x", false) ?? NaN
                let y = i.options.getInteger("y", false) ?? NaN
                var building = i.options.getString("building", true)
                var buildInfo = buildingTypes.get(building)
                if (!buildInfo) {
                    content = `Invalid building`
                    break
                }
                var tiles = []
                if (!isNaN(x) && !isNaN(y)) {
                    tiles = [{x, y, tile: map.get(x, y)}]
                } else {
                    tiles = [...map.iterateRect(0, 0, map.width, map.height)].filter(el => u.selection.get2D(el.x, el.y))
                }
                tiles = tiles.filter(el => {
                    var canbuild = buildInfo?.canBuild(el.x, el.y)
                    return el.tile?.owner == i.user.id && canbuild
                })
                if (tiles.length <= 0) {
                    content = `No valid tiles found to build on`
                    break;
                }
                var items = buildInfo.buildCost.map(el => ({item: el.item, amount: el.amount * BigInt(tiles.length)}))
                var stacks = items.map(el => getItem(i.user, el.item) || { item: el.item, amount: 0n })
                if (stacks.some((el, idx) => el.amount < items[idx].amount)) {
                    content = `Not enough items to build`
                    break;
                }
                var facing = i.options.getString("facing", false) || "1,0"
                let h = facing.split(",").map(el => Number(el))
                for (var j = 0; j < items.length; j++) {
                    stacks[j].amount -= items[j].amount
                }
                for (var t of tiles) {
                    if (!t.tile) continue
                    if (t.tile.building) {
                        t.tile.destroyBuilding(i.user)
                    }
                    t.tile.building = new Building(building, t.tile)
                    t.tile.building.facingx = h[0]
                    t.tile.building.facingy = h[1]
                }
                content = `Built ${tiles.length} buildings`
                break;
            }
            case "destroy": {
                let tiles = [...map.iterateBitArray(u.selection)].filter(el => el.tile?.owner == i.user.id).filter(el => el.tile?.building)
                tiles.map(el => el.tile?.destroyBuilding(i.user))
                content = `Destroyed ${tiles.length} buildings`                
                break;
            }
        }
        u.viewx = Math.min(Math.max(u.viewx, 0), map.width - w)
        u.viewy = Math.min(Math.max(u.viewy, 0), map.height - h)
        var startx = u.viewx
        var starty = u.viewy
        var endx = startx + w
        var endy = starty + h
        content += `\nView Position: ${startx}, ${starty}\nView size: ${w}x${h}`
        var builds = [...map.iterateBitArray(u.selection)].map(el => el.tile?.building).filter(el => el != undefined) as Building[]
        if (builds.length > 0) {
            content += `\n${builds.length} Buildings selected`
        }
        drawTiles(ctx, map, startx, starty, w, h, size, size)
        
        for (var y = starty; y < endy; y++) {
            for (var x = startx; x < endx; x++) {
                var localx = x - startx
                var localy = y - starty
                if (u.selection.get2D(x, y)) {
                    ctx.drawImage(images.selection, size + localx * size, size + localy * size)
                }

            }
        }
        if (u.buildMode) {
            for (var y = starty; y < endy; y++) {
                for (var x = startx; x < endx; x++) {
                    var localx = x - startx
                    var localy = y - starty
                    if (map.getOwner(x, y) != i.user.id) {
                        ctx.drawImage(images.cantbuild, size + localx * size, size + localy * size)
                    }
                }
            }
        } else {
            for (var y = starty; y < endy; y++) {
                for (var x = startx; x < endx; x++) {
                    var localx = x - startx
                    var localy = y - starty
                    if (map.getOwner(x, y) && map.getOwner(x, y) != i.user.id) {
                        ctx.drawImage(images.cantbuild, size + localx * size, size + localy * size)
                    }
    
                }

            }
        }
        if (u.showGrid) {
            for (var y = starty; y < endy; y++) {
                for (var x = startx; x < endx; x++) {
                    var localx = x - startx
                    var localy = y - starty
                    ctx.drawImage(images.grid, size + localx * size, size + localy * size)
    
                }
            }
        }
        var temp = createCanvas(canvas.width, canvas.height)
        var ctx2 = temp.getContext("2d")
        ctx2.drawImage(canvas, 0, 0)
        ctx2.imageSmoothingEnabled = false
        canvas = createCanvas(temp.width * 1.25, temp.height * 1.25)
        ctx = canvas.getContext('2d')
        ctx.antialias = "none"
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(temp, 0, 0, canvas.width, canvas.height)
        size *= 1.25
        for (var x = 0; x < w; x++) {
            var str = `${x + startx}`
            var l = str.length
            drawString(ctx, size + (x * size) + (8 * 1.25) - l * 4, (8 * 1.25 - 2), str)
        }
        for (var y = 0; y < h; y++) {
            var str = `${y + starty}`
            var l = str.length
            drawString(ctx, (8 * 1.25) - l * 4, size + (y * size) + (8 * 1.25 - 2), str)
        }
        var scaled = createCanvas(canvas.width * 2, canvas.height * 2)
        var ctx2 = scaled.getContext('2d')
        ctx2.imageSmoothingEnabled = false
        ctx2.drawImage(canvas, 0, 0, scaled.width, scaled.height)
        var buf = scaled.toBuffer("image/png")
        await i.reply({
            content: content,
            files: [ new MessageAttachment(buf, "bruv.png") ]
        })
    }
}