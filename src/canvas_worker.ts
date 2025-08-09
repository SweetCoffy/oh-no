import { parentPort, workerData } from "worker_threads"
import type { PartialBattle, PartialInfo, PartialPlayer, WorkerMsg } from "./canvas_types"
import { CanvasRenderingContext2D, createCanvas, Image, loadImage, registerFont } from "canvas"
import { basename, join, resolve } from "path"
import { readdirSync } from "fs"
if (!parentPort) process.exit(1)
const info = workerData.info as PartialInfo
const statusTypes = new Map(info.statusType)
const statusIcons: { [x in string]: string } = {
    bleed: "bleed",
    poison: "poison",
    mind_overwork: "boost",
    rush: "boost",
    regen: "regen",
    broken: "broken"
}
console.log("alive")
const assetsRoot = resolve("./assets")
const fontPath = join(assetsRoot, "font")
const fontName = "Oxanium"
const variants = [
    ["Regular", 400],
    ["Medium", 500],
    ["SemiBold", 600],
    ["Bold", 700],
    ["ExtraBold", 800],
] as const

for (let [n, w] of variants) {
    let path = join(fontPath, fontName + "-" + n + ".ttf")
    console.log(path)
    registerFont(path, {
        family: fontName,
        weight: w + "",
        style: "normal"
    })
}
// registerFont(fontPath, {
//     family: "Atkinson Hyperlegible Next",
//     weight: "normal",
//     style: "normal"
// })
const iconRoot = join(assetsRoot, "icon")
const iconFiles = readdirSync(iconRoot)
const icons: Map<string, Image> = new Map()
Promise.all(iconFiles.map(file => loadImage(join(iconRoot, file)).then(image =>
    [file, image] as const
)))
    .then(images => {
        for (let [k, v] of images) {
            let name = basename(k, ".png")
            icons.set(name, v)
            console.log(`loaded icon ${name}`)
        }
    })
const fontFamily = "Oxanium"
const normalCanvas = createCanvas(512 + 64, 512 + 96)
const wideCanvas = createCanvas(768 + 128, 512 + 96)
const minCanvasHeight = 480
const playerWidth = 320
const playerHeight = 80
const pad = 8
console.log("still alive")
const numFormat = new Intl.NumberFormat("en-US", { style: "decimal", maximumFractionDigits: 2, signDisplay: "auto" })
const teamColors = [
    "#0051ff",
    "#ff0015",
    "#fff700",
    "#00ff26",
    "#d400ff"
]
function icon(name: string): Image | null {
    return icons.get(name) ?? null
}
function drawPlayer(ctx: CanvasRenderingContext2D, p: PartialPlayer, w: number) {
    ctx.font = `bold 20px ${fontFamily}`
    ctx.lineWidth = 4
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.fillStyle = "#fff"
    if (p.dead) {
        ctx.fillStyle = "#777"
    }
    let playerPad = 8
    ctx.strokeStyle = "#00000094"
    ctx.strokeText(p.name, playerPad + 2, 0)
    ctx.fillText(p.name, playerPad + 2, 0)
    let measured = ctx.measureText(p.name)
    ctx.translate(playerPad, 20 + 8)
    let barWidth = (w - 16) - playerPad
    let barHeight = 24
    //let barRadius = 2
    let prevAbsorb = p.prevAbsorb
    let teamColor = teamColors[p.team]
    ctx.fillStyle = teamColor
    ctx.fillRect(barWidth + 4, -4, 4, barHeight + 8)
    if (p.dead) {
        ctx.fillStyle = "#111"
        ctx.fillRect(0, 0, barWidth, barHeight)
        ctx.fillStyle = "#aaa"
        ctx.textBaseline = "middle"
        ctx.font = `800 20px ${fontFamily}`
        let barMiddle = barHeight / 2
        let deadText = "DEAD"
        if (p.vaporized) deadText = "VAPORIZED"
        ctx.fillText(deadText, 4, barMiddle)
        return
    }
    if (p.absorb > 0 || prevAbsorb > 0) {
        let absorbOfs = 4
        let absorbSizeE = Math.abs(absorbOfs) * 2
        //let absorbRad = barRadius + absorbOfs
        ctx.fillStyle = "#333"
        ctx.fillRect(-absorbOfs, -absorbOfs,
            barWidth + absorbSizeE, barHeight + absorbSizeE)
        ctx.fillStyle = "#888"
        ctx.fillRect(-absorbOfs, -absorbOfs,
            Math.min(prevAbsorb / p.cstats.hp, 1) * (barWidth + absorbSizeE),
            barHeight + absorbSizeE)
        ctx.fillStyle = "#fff"
        ctx.fillRect(-absorbOfs, -absorbOfs,
            Math.min(p.absorb / p.cstats.hp, 1) * (barWidth + absorbSizeE),
            barHeight + absorbSizeE)
    }
    let barColor = "#ff0015"
    let dmgColor = "#6b0009"
    let healColor = "#73f5eaff"
    let blockColor = "#c9c9c9ff"
    let bgColor = "#111"
    let hpPercent = p.hp / p.cstats.hp
    let iconSize = barHeight - 4
    let iconY = barHeight / 2 - iconSize / 2
    let iconPad = pad / 2
    let prevPercent = p.prevHp
    let hpOver = false
    if (hpPercent > 0.2) {
        barColor = "#ffe44a"
    }
    if (hpPercent > 0.5) {
        barColor = "#4aff62"
    }
    if (hpPercent > 1) {
        hpOver = true
        prevPercent -= Math.floor(hpPercent)
        prevPercent = Math.max(prevPercent, 0)
        hpPercent = hpPercent % 1
        dmgColor = "#ff8791ff"
        bgColor = "#25702fff"
        barColor = "#4aff62"
    }
    prevPercent = Math.max(Math.min(prevPercent, 1), 0)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, barWidth, barHeight)
    let hpWidth = Math.max(Math.min(hpPercent, 1), -1) * barWidth
    ctx.fillStyle = barColor
    if (hpWidth < 0) {
        hpWidth = -hpWidth
        ctx.fillRect(barWidth - hpWidth, 0, hpWidth, barHeight)
    } else {
        let delta = hpPercent - prevPercent
        ctx.fillRect(0, 0, hpWidth, barHeight)
        if (delta < 0) {
            ctx.fillStyle = dmgColor
            ctx.fillRect(hpWidth, 0, -delta * barWidth, barHeight)
        }
        if (delta > 0) {
            ctx.fillStyle = healColor
            let healW = delta * barWidth
            ctx.fillRect(hpWidth - healW, 0, healW, barHeight)
        }
        if (p.dmgBlocked > 0) {
            ctx.fillStyle = blockColor
            let blockW = Math.min(p.dmgBlocked / p.cstats.hp, 1) * barWidth
            ctx.fillRect(hpWidth - blockW, 0, blockW, barHeight)
        }
    }
    let barMiddle = barHeight / 2
    ctx.fillStyle = "#fff"
    ctx.textBaseline = "middle"
    ctx.font = `800 20px ${fontFamily}`
    let hpText = numFormat.format(p.hp)
    if (p.dead) {
        hpText = "DEAD"
    }
    measured = ctx.measureText(hpText)
    let heartIcon = icon("health_cross")
    let shieldIcon = icon("shield")
    let maxHpText = numFormat.format(p.cstats.hp)
    let tx = 4
    ctx.strokeStyle = "#00000094"
    ctx.lineWidth = 4
    if (heartIcon) {
        ctx.shadowColor = "#0000007a"
        ctx.shadowOffsetY = 4
        ctx.drawImage(heartIcon, tx, iconY, iconSize, iconSize)
        ctx.globalCompositeOperation = "normal"
        ctx.shadowColor = "#00000000"
        tx += iconSize + iconPad
    }
    ctx.strokeText(hpText, tx, barMiddle)
    ctx.fillText(hpText, tx, barMiddle)
    tx += Math.max(measured.width, 64) + pad
    if (p.absorb > 0) {
        let absorbText = numFormat.format(p.absorb)
        let ptx = tx
        measured = ctx.measureText(absorbText)
        if (tx + measured.width + iconPad + iconSize < barWidth) {
            if (shieldIcon) {
                ctx.shadowColor = "#0000007a"
                ctx.shadowOffsetY = 4
                ctx.drawImage(shieldIcon, tx, iconY, iconSize, iconSize)
                ctx.globalCompositeOperation = "normal"
                ctx.shadowColor = "#00000000"
                tx += iconSize + pad
            }
            ctx.strokeText(absorbText, tx, barMiddle)
            ctx.fillText(absorbText, tx, barMiddle)
            measured = ctx.measureText(absorbText)
            tx += measured.width
        } else {
            tx = ptx
        }
    }
    let xSpace = barWidth - tx
    ctx.textAlign = "right"
    ctx.font = `600 16px ${fontFamily}`
    measured = ctx.measureText(maxHpText)
    if (measured.width + 4 < xSpace) {
        ctx.strokeText(maxHpText, barWidth - 4, barMiddle)
        ctx.fillText(maxHpText, barWidth - 4, barMiddle)
    }
    ctx.translate(0, barHeight + pad)
    ctx.textAlign = "left"
    let statusH = 24
    let x = 0
    let statusPad = pad / 2
    let maxStatusTextW = barWidth / 6
    ctx.textBaseline = "middle"
    ctx.font = `bold 16px ${fontFamily}`
    ctx.strokeStyle = "#0000007a"
    if (p.charge > 0) {
        let chargeText = `${p.charge}`
        let percent = Math.min(p.charge / p.cstats.chglimit, 1)
        let measured = ctx.measureText(chargeText)
        let w = Math.max(measured.width, 24)
        ctx.fillStyle = "#111"
        ctx.fillRect(x, 0, w + statusPad * 2, statusH)
        ctx.fillStyle = "#ff1c3e"
        ctx.fillRect(x, 0, percent * (w + statusPad * 2), statusH)
        ctx.fillStyle = "#fff"
        ctx.strokeText(chargeText, x + statusPad, statusH / 2)
        ctx.fillText(chargeText, x + statusPad, statusH / 2)
        x += w + statusPad * 2 + pad
    }
    if (p.magic > 0) {
        let magicText = `${p.magic}`
        let percent = Math.min(p.magic / p.cstats.maglimit, 1)
        let measured = ctx.measureText(magicText)
        let w = Math.max(measured.width, 24)
        ctx.fillStyle = "#111"
        ctx.fillRect(x, 0, w + statusPad * 2, statusH)
        ctx.fillStyle = "#1c7eff"
        ctx.fillRect(x, 0, percent * (w + statusPad * 2), statusH)
        ctx.fillStyle = "#fff"
        ctx.strokeText(magicText, x + statusPad, statusH / 2)
        ctx.fillText(magicText, x + statusPad, statusH / 2)
        x += w + statusPad * 2 + pad
    }
    let statusMaxW = barWidth
    let overflowCount = 0
    // p.status = [
    //     {
    //         type: "poison",
    //         turnsLeft: 2,
    //     },
    //     {
    //         type: "rush",
    //         turnsLeft: 2,
    //     },
    //     {
    //         type: "mind_overwork",
    //         turnsLeft: 2,
    //     },
    //     {
    //         type: "delayed_pain",
    //         turnsLeft: 2,
    //     },
    //     {
    //         type: "regen",
    //         turnsLeft: 2,
    //     },
    //     {
    //         type: "broken",
    //         turnsLeft: 2,
    //     },
    //     {
    //         type: "bleed",
    //         turnsLeft: 2,
    //     }
    // ]
    let sorted = p.status.sort((a, b) => b.turnsLeft - a.turnsLeft)
    iconSize = statusH - 4
    iconY = statusH / 2 - iconSize / 2
    //iconPad = pad /2
    for (let s of sorted) {
        let type = statusTypes.get(s.type)
        if (!type) continue
        let statusText = type.name
        ctx.font = `bold 16px ${fontFamily}`
        measured = ctx.measureText(statusText)
        if (measured.width > maxStatusTextW) {
            ctx.font = `bold 12px ${fontFamily}`
            measured = ctx.measureText(statusText)
        }
        let width = measured.width + iconSize + iconPad
        if (overflowCount > 0 || x + width + statusPad * 2 > statusMaxW) {
            let h = Math.max(statusH - overflowCount * 2, statusH * 0.5)
            let w = Math.max(6 - overflowCount, 2)
            ctx.fillStyle = type.fillStyle
            ctx.fillRect(x, statusH / 2 - h / 2, w, h)
            x += w
            overflowCount++
            continue
        }
        ctx.fillStyle = type.fillStyle
        ctx.fillRect(x, 0, width + statusPad * 2, statusH)
        //ctx.globalCompositeOperation = "destination-out"
        let segmentCount = s.duration
        let segmentFillCount = s.turnsLeft
        let segmentStart = statusPad / 2
        let segmentSpacing = 2
        let segmentH = 4
        let segmentY = statusH - (segmentH + statusPad / 2)
        let segmentW = 0
        let sx = x + segmentStart
        function recalculateAvailSpace() {
            return (width + statusPad*2 - segmentStart - statusPad/2)
                - (Math.max((segmentCount - 1) * segmentSpacing, 0)
                    + segmentW * segmentCount)
        }
        let availSpace = recalculateAvailSpace()
        while (availSpace > 0) {
            let expand = availSpace / segmentCount
            segmentW += expand
            availSpace = recalculateAvailSpace()
        }
        ctx.globalCompositeOperation = "hard-light"
        const lengthGradient = ctx.createLinearGradient(0, statusH - (segmentH + 4), 0, statusH)
        lengthGradient.addColorStop(0, "rgb(127, 127, 127)")
        lengthGradient.addColorStop(1, "#464646ff")
        ctx.fillStyle = lengthGradient
        ctx.fillRect(x, statusH - (segmentH + 4), width + statusPad*2, segmentH + 4)
        for (let i = 0; i < segmentCount; i++) {
            if (i < segmentFillCount) {
                //do something here
                ctx.fillStyle = "#eee"
                ctx.globalCompositeOperation = "hard-light"
            } else {
                ctx.fillStyle = "#999"
                ctx.globalCompositeOperation = "hard-light"
            }
            ctx.fillRect(sx, segmentY, segmentW, segmentH)
            sx += segmentW + segmentSpacing
        }
        ctx.globalCompositeOperation = "normal"
        ctx.fillStyle = "#fff"
        let iconImg = icon(statusIcons[s.type])
        if (iconImg) {
            ctx.shadowColor = "#0000007a"
            ctx.shadowOffsetY = 2
            ctx.drawImage(iconImg, x + statusPad, iconY, iconSize, iconSize)
            ctx.shadowColor = "#00000000"
        }
        ctx.strokeText(statusText, x + statusPad + iconSize + iconPad, statusH / 2)
        ctx.fillText(statusText, x + statusPad + iconSize + iconPad, statusH / 2)
        x += width + statusPad * 2 + pad
    }
}
function generate(b: PartialBattle) {
    let canvas = normalCanvas
    let teams: PartialPlayer[][] = []
    for (let p of b.players) {
        if (!teams[p.team]) teams[p.team] = []
        teams[p.team].push(p)
    }
    if (teams.length > 2) {
        canvas = wideCanvas
    }
    let ctx = canvas.getContext("2d")
    ctx.resetTransform()
    ctx.font = "16px monospace"
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "#1c1d1f"
    //ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "#fff"
    ctx.textAlign = "left"
    ctx.textBaseline = "top"

    let totalW = 0
    let maxW = canvas.width - pad
    let x = 0
    let y = 0
    let curPlayerW = playerWidth
    if (teams.length > 1) {
        let tallest = 0
        let yOfs = 0
        curPlayerW = playerWidth * 0.6
        let colWidth = curPlayerW + pad
        let cols = Math.min(Math.max(Math.floor(canvas.width / colWidth), 1), teams.length)
        colWidth = (canvas.width) / cols
        curPlayerW = colWidth - pad * 2
        let mostPlayers = Math.max(...teams.map(v => v.length))
        let playerH = playerHeight + pad
        let hMult = Math.ceil(teams.length / cols)
        let wantedHeight = hMult * mostPlayers * playerH + 32
        canvas.height = Math.max(minCanvasHeight, wantedHeight)
        let cx = 0
        let height = 0
        for (let i = 0; i < teams.length; i++) {
            if (cx >= cols) {
                cx = 0
                yOfs += tallest + pad
                height = 0
                tallest = 0
            }
            let players = teams[i]
            y = 0
            height = 0
            ctx.resetTransform()
            ctx.fillStyle = teamColors[i % teamColors.length]
            ctx.fillRect(cx * colWidth + pad, yOfs, colWidth - pad * 2, 4)
            y += 4 + pad
            height += 4 + pad
            for (let p of players) {
                ctx.resetTransform()
                ctx.translate(cx * colWidth, y + yOfs)
                drawPlayer(ctx, p, curPlayerW)
                y += playerHeight + pad
                height += playerHeight + pad
            }
            tallest = Math.max(tallest, height)
            cx++
        }
    } else {
        canvas.height = Math.max(minCanvasHeight, b.players.length * (playerHeight + pad))
        curPlayerW = canvas.width - 32
        for (let p of b.players) {
            if (x + curPlayerW + pad > maxW) {
                x = 0
                y += playerHeight + pad
            }
            ctx.resetTransform()
            ctx.translate(x, y)
            drawPlayer(ctx, p, curPlayerW)
            totalW += curPlayerW + pad
            x += curPlayerW + pad
        }
    }

    return canvas.toBuffer("image/png")
}
parentPort.on("message", (data: WorkerMsg) => {
    if (data.type == "generate") {

        let buf = generate(data.battle).buffer as ArrayBuffer
        let msg: WorkerMsg = {
            type: "result",
            id: data.id,
            buf,
        }
        //@ts-ignore
        parentPort.postMessage(msg, [buf])
    }
})