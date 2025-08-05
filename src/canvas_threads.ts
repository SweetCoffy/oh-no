import { Worker } from "worker_threads"
import type { Battle } from "./battle"
import { WorkerMsg } from "./canvas_types"
const threads: Worker[] = []
const busy: number[] = []
const THREAD_COUNT = 1
for (let i = 0; i < THREAD_COUNT; i++) {
    let worker = new Worker("./src/canvas_worker.ts")
    worker.on("error", (err) => {
        console.error(err)
    })
    busy.push(0)
    threads.push(worker)
}
function findThread() {
    let lowest = Math.min(...busy)
    let idx = busy.indexOf(lowest)
    return threads[idx]
}
export function generateImage(b: Battle): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        let thread = findThread()
        let msg: WorkerMsg = {
            type: "generate",
            id: Bun.randomUUIDv7(),
            battle: {
                type: b.type,
                isPve: b.isPve,
                turn: b.turn,
                logs: b.logs,
                players: b.players.map(p => ({
                    name: p.name,
                    level: p.level,
                    stats: p.stats,
                    hp: p.hp,
                    prevHp: p.prevHp,
                    absorb: p.getTotalAbsorption(),
                    team: p.team,
                    cstats: p.cstats,
                    charge: p.charge,
                    magic: p.magic,
                    status: p.status.map(s => ({
                        type: s.type,
                        turnsLeft: s.turnsLeft
                    }))
                }))
            }
        }
        function listener(m: WorkerMsg) {
            if (m.type != "result") return
            if (m.id != msg.id) return
            console.log(m)
            thread.removeListener("message", listener)
            let buf = Buffer.from(m.buf)
            resolve(buf)
        }
        thread.on("message", listener)
        thread.postMessage(msg)
    })
}