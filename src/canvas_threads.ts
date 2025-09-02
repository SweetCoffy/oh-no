import { Worker } from "worker_threads"
import { statusTypes, teamNames, Battle } from "./battle"
import { PartialBattle, PartialInfo, WorkerMsg } from "./canvas_types"
const threads: Worker[] = []
const busy: number[] = []
const THREAD_COUNT = 2
// I don't trust my own code in battle.ts to play nicely in worker threads,
// so instead of importing it directly, I'll just do whatever the hell happens here
const info: PartialInfo = {
    statusType: [...statusTypes.mapValues(s => ({
        name: s.name,
        short: s.short,
        fillStyle: s.fillStyle
    })).entries()],
    teamNames: teamNames
}
for (let i = 0; i < THREAD_COUNT; i++) {
    setTimeout(() => {
        let worker = new Worker("./src/canvas_worker.ts", { workerData: { info } })
        worker.on("error", (err) => {
            console.error(err)
        })
        busy.push(0)
        threads.push(worker)
    }, i * 1000)
}
function findThread(): [Worker, number] {
    let lowest = Math.min(...busy)
    let idx = busy.indexOf(lowest)
    return [threads[idx], idx]
}
export function generateImage(b: Battle | PartialBattle): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        let [thread, idx] = findThread()
        let msg: WorkerMsg = {
            type: "generate",
            id: Bun.randomUUIDv7(),
            battle: (b instanceof Battle) ? {
                type: b.type,
                isPve: b.isPve,
                turn: b.turn,
                logs: b.logs,
                players: b.players.map(p => ({
                    name: p.name,
                    level: p.level,
                    stats: p.stats,
                    dead: p.dead,
                    hp: p.hp,
                    prevHp: p.prevHp,
                    absorb: p.getTotalAbsorption(),
                    dmgBlocked: p.damageBlockedInTurn,
                    prevAbsorb: p.prevAbsorption,
                    team: p.team,
                    cstats: p.cstats,
                    charge: p.charge,
                    magic: p.magic,
                    summoner: p.summoner?.id,
                    summons: p.summons.map(s => s.id),
                    id: p.id,
                    vaporized: p.vaporized,
                    healingInTurn: p.healingInTurn,
                    actionOrder: 0,
                    bruh: p.bruh,
                    status: p.status.map(s => ({
                        type: s.type,
                        turnsLeft: s.turnsLeft,
                        duration: s.duration
                    }))
                }))
            } : b
        }
        function listener(m: WorkerMsg) {
            if (m.type != "result") return
            if (m.id != msg.id) return
            busy[idx]--
            thread.removeListener("message", listener)
            let buf = Buffer.from(m.buf)
            resolve(buf)
        }
        thread.on("message", listener)
        thread.postMessage(msg)
        busy[idx]++
    })
}