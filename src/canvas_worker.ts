import { MessageChannel, parentPort } from "worker_threads"
import { PartialBattle, PartialPlayer, WorkerMsg } from "./canvas_types"
import { CanvasRenderingContext2D, createCanvas } from "canvas"
if (!parentPort) process.exit(1)
console.log("alive")
const canvas = createCanvas(480, 480)
const playerWidth = 320
const playerHeight = 64
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
    ctx.font = "20px monospace"
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.fillStyle = "#fff"
    ctx.fillText(p.name, 8, 0)
    let measured = ctx.measureText(p.name)
    ctx.translate(0, 20 + 8)
    let barWidth = playerWidth
    let barHeight = 24
    //let barRadius = 2
    if (p.absorb > 0) {
        let absorbOfs = 4
        let absorbSizeE = Math.abs(absorbOfs)
        //let absorbRad = barRadius + absorbOfs
        ctx.fillStyle = "#ccc"
        ctx.fillRect(-absorbOfs, -absorbOfs, 
            barWidth + absorbSizeE, barHeight + absorbSizeE)
        ctx.fillStyle = "#fff"
        ctx.fillRect(-absorbOfs, -absorbOfs, 
            Math.min(p.absorb / p.cstats.hp, 1) * (barWidth + absorbSizeE), 
            barHeight + absorbSizeE)
    }
    ctx.fillStyle = "#333"
    ctx.fillRect(0, 0, barWidth, barHeight)
    let barColor = "#ff0015"
    let dmgColor = "#6b0009"
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
    }
    ctx.fillStyle = "#000"
    let barMiddle = barHeight / 2
    ctx.textBaseline = "middle"
    ctx.font = "bold 20px monospace"
    let hpText = numFormat.format(p.hp)
    let maxHpText = numFormat.format(p.cstats.hp)
    measured = ctx.measureText(hpText)
    ctx.fillText(hpText, 4, barMiddle)
    ctx.textAlign = "right"
    ctx.font = "bold 16px monospace"
    ctx.fillText(maxHpText, barWidth - 4, barMiddle)
}
function generate(b: PartialBattle) {
    let ctx = canvas.getContext("2d")
    ctx.font = "16px monospace"
    ctx.fillStyle = "#000"
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
        let tx = 0
        let tallest = 0
        let yOfs = 0
        curPlayerW = playerWidth*0.6
        for (let i = 0; i < teams.length; i++) {
            if (tx > 1) {
                tx = 0
                yOfs += tallest + pad
                tallest = 0
            }
            let players = teams[i]
            let resetX = tx*canvas.width/2
            let h = 0
            x = resetX
            y = 0
            totalW = 0
            maxW = canvas.width / 2 - pad*2
            for (let p of players) {
                if (x + curPlayerW + pad > maxW) {
                    x = resetX
                    y += playerHeight + pad
                    totalW = 0
                }
                ctx.resetTransform()
                ctx.translate(x, y)
                drawPlayer(ctx, p, curPlayerW)
                h += playerHeight + pad
                totalW += curPlayerW + pad
                x += curPlayerW + pad
            }
            tallest = Math.max(tallest, h)
            tx++
        }
        for (let p of b.players) {
            if (x + playerWidth + pad > maxW) {
                x = 0
                y += playerHeight + pad
                totalW = 0
            }
            ctx.resetTransform()
            ctx.translate(x, y)
            drawPlayer(ctx, p, playerWidth)
            totalW += playerWidth + pad
            x += playerWidth + pad
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