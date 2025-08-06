import { parentPort, workerData } from "worker_threads"
import type { PartialBattle, PartialInfo, PartialPlayer, WorkerMsg } from "./canvas_types"
import { CanvasRenderingContext2D, createCanvas } from "canvas"
if (!parentPort) process.exit(1)
const info = workerData.info as PartialInfo
const statusTypes = new Map(info.statusType)
console.log("alive")
const canvas = createCanvas(512+64, 512)
const playerWidth = 320
const playerHeight = 80
const pad = 8
console.log("still alive")
const numFormat = new Intl.NumberFormat("en-US", { style: "decimal", maximumFractionDigits: 2 })
const teamColors = [
    "#0051ff",
    "#ff0015",
    "#fff700",
    "#00ff26",
    "#d400ff"
]
function drawPlayer(ctx: CanvasRenderingContext2D, p: PartialPlayer, w: number) {
    ctx.font = "bold 20px sans-serif"
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.fillStyle = "#fff"
    if (p.dead) {
        ctx.fillStyle = "#777"
    }
    let playerPad = 8
    ctx.fillText(p.name, playerPad + 2, 0)
    let measured = ctx.measureText(p.name)
    ctx.translate(playerPad, 20 + 12)
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
        ctx.font = "800 20px sans-serif"
        let barMiddle = barHeight / 2
        let deadText = "DEAD"
        if (p.vaporized) deadText = "VAPORIZED"
        ctx.fillText(deadText, 4, barMiddle)
        return
    }
    if (p.absorb > 0 || prevAbsorb > 0) {
        let absorbOfs = 4
        let absorbSizeE = Math.abs(absorbOfs)*2
        //let absorbRad = barRadius + absorbOfs
        ctx.fillStyle = "#333"
        ctx.fillRect(-absorbOfs, -absorbOfs, 
            barWidth + absorbSizeE, barHeight + absorbSizeE)
        ctx.fillStyle = "#aaa"
        ctx.fillRect(-absorbOfs, -absorbOfs,
            Math.min(prevAbsorb / p.cstats.hp, 1) * (barWidth + absorbSizeE), 
            barHeight + absorbSizeE)
        ctx.fillStyle = "#fff"
        ctx.fillRect(-absorbOfs, -absorbOfs, 
            Math.min(p.absorb / p.cstats.hp, 1) * (barWidth + absorbSizeE), 
            barHeight + absorbSizeE)
    }
    ctx.fillStyle = "#111"
    ctx.fillRect(0, 0, barWidth, barHeight)
    let barColor = "#ff0015"
    let dmgColor = "#6b0009"
    let healColor = "#73f5eaff"
    let blockColor = "#0011ff5d"
    let hpPercent = p.hp / p.cstats.hp
    let prevPercent = Math.min(p.prevHp / p.cstats.hp, 1)
    if (hpPercent > 0.2) {
        barColor = "#ffe44a"
    }
    if (hpPercent > 0.5) {
        barColor = "#4aff62"
    }
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
            let healW = delta*barWidth
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
    ctx.font = "800 20px sans-serif"
    let hpText = numFormat.format(p.hp)
    if (p.dead) {
        hpText = "DEAD"
    }
    let maxHpText = numFormat.format(p.cstats.hp)
    measured = ctx.measureText(hpText)
    ctx.strokeStyle = "#00000094"
    ctx.lineWidth = 4
    ctx.strokeText(hpText, 4, barMiddle)
    ctx.fillText(hpText, 4, barMiddle)
    ctx.textAlign = "right"
    ctx.font = "600 16px sans-serif"
    ctx.strokeText(maxHpText, barWidth - 4, barMiddle)
    ctx.fillText(maxHpText, barWidth - 4, barMiddle)
    ctx.translate(0, barHeight + pad)
    ctx.textAlign = "left"
    let statusH = 20
    let x = 0
    let statusPad = pad / 2
    let maxStatusTextW = barWidth/6
    ctx.textBaseline = "middle"
    ctx.font = "bold 16px sans-serif"
    ctx.strokeStyle = "#0000007a"
    if (p.charge > 0) {
        let chargeText = `${p.charge}`
        let percent = Math.min(p.charge / p.cstats.chglimit, 1)
        let measured = ctx.measureText(chargeText)
        let w = Math.max(measured.width, 24)
        ctx.fillStyle = "#111"
        ctx.fillRect(x, 0, w + statusPad * 2, statusH)
        ctx.fillStyle = "#ff1c3e"
        ctx.fillRect(x, 0, percent * (w + statusPad*2), statusH)
        ctx.fillStyle = "#fff"
        ctx.strokeText(chargeText, x + statusPad, statusH / 2)
        ctx.fillText(chargeText, x + statusPad, statusH / 2)
        x += w + statusPad*2 + pad
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
        x += w + statusPad*2 + pad
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
    for (let s of sorted) {
        let type = statusTypes.get(s.type)
        if (!type) continue
        let statusText = type.name
        measured = ctx.measureText(statusText)
        if (measured.width > maxStatusTextW) {
            ctx.font = "bold 12px sans-serif"
            measured = ctx.measureText(statusText)
        }
        if (x + measured.width + statusPad*2 > statusMaxW) {
            let h = Math.max(statusH - overflowCount*2, statusH*0.5)
            let w = Math.max(6 - overflowCount, 2)
            ctx.fillStyle = type.fillStyle
            ctx.fillRect(x, statusH / 2 - h / 2, w, h)
            x += w
            overflowCount++
            continue
        }
        ctx.fillStyle = type.fillStyle
        ctx.fillRect(x, 0, measured.width + statusPad*2, statusH)
        ctx.fillStyle = "#fff"
        ctx.strokeText(statusText, x + statusPad, statusH / 2)
        ctx.fillText(statusText, x + statusPad, statusH / 2)
        x += measured.width + statusPad*2 + pad
    }
}
function generate(b: PartialBattle) {
    let ctx = canvas.getContext("2d")
    ctx.resetTransform()
    ctx.font = "16px monospace"
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "#1c1d1f"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "#fff"
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    
    let totalW = 0
    let maxW = canvas.width - pad
    let x = 0
    let y = 0
    let teams: PartialPlayer[][] = []
    let curPlayerW = playerWidth
    for (let p of b.players) {
        if (!teams[p.team]) teams[p.team] = []
        teams[p.team].push(p)
    }
    if (teams.length > 1) {
        let tallest = 0
        let yOfs = 0
        curPlayerW = playerWidth*0.6
        let colWidth = curPlayerW + pad
        let cols = Math.max(Math.floor(canvas.width / colWidth), 1)
        colWidth = (canvas.width) / cols
        curPlayerW = colWidth-pad*2
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
            ctx.fillRect(cx * colWidth + pad, yOfs, colWidth - pad*2, 4)
            y += 4 + pad
            height += 4 + pad
            for (let p of players) {
                ctx.resetTransform()
                ctx.translate(cx*colWidth, y + yOfs)
                drawPlayer(ctx, p, curPlayerW)
                y += playerHeight + pad
                height += playerHeight + pad
            }
            tallest = Math.max(tallest, height)
            cx++
        }
    } else {
        for (let p of b.players) {
            if (x + playerWidth + pad > maxW) {
                x = 0
                y += playerHeight + pad
            }
            ctx.resetTransform()
            ctx.translate(x, y)
            drawPlayer(ctx, p, playerWidth)
            totalW += playerWidth + pad
            x += playerWidth + pad
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