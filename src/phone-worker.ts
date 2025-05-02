import * as worker_threads from "worker_threads"
import { VM } from "vm2"
let workerData: { args: string[] } = worker_threads.workerData;
let idcounter = 0;
function getid() {
    return idcounter++;
}
function readFile(path: string): Promise<Buffer | undefined> {
    return new Promise((resolve) => {
        let id = getid()
        let func = (msg: any) => {
            if (msg.id == id) {
                worker_threads.parentPort?.removeListener("message", func)
                resolve(msg.content && Buffer.from(msg.content))
            }
        }
        worker_threads.parentPort?.on("message", func)
        worker_threads.parentPort?.postMessage({ type: "read", path: path, id: id })
    })
}
function readDir(path: string): Promise<string[] | undefined> {
    return new Promise((resolve) => {
        let id = getid()
        let func = (msg: any) => {
            if (msg.id == id) {
                worker_threads.parentPort?.removeListener("message", func)
                resolve(msg.content)
            }
        }
        worker_threads.parentPort?.on("message", func)
        worker_threads.parentPort?.postMessage({ type: "readdir", path: path, id: id })
    })
}
function writeFile(path: string, cont: Buffer): Promise<void> {
    return new Promise((resolve) => {
        let id = getid()
        worker_threads.parentPort?.postMessage({ type: "read", path: path, id: id })
        let func = (msg: any) => {
            if (msg.resid == id) {
                worker_threads.parentPort?.removeListener("message", func)
                resolve()
            }
        }
        worker_threads.parentPort?.on("message", func)
    })
}
function joinpath(...segs: string[]) {
    return segs.join("/").split("/").filter(el => el).join("/") || "/"
}
let cwd = "main"
let path = new Set(["", cwd, "main", "main/eggos", "main/js", ...((await readFile("main/cfg/path.cfg") + "") || "").split(";")])
let filename = workerData.args[0]
if (!filename.includes(".")) filename = filename + ".js"
let file: string | Buffer<ArrayBufferLike> | undefined = undefined
for (let p of path) {
    file = await readFile(joinpath(p, filename))
    if (file) break;
}
if (!file) {
    console.log(`File not found: ${filename}`)
    process.exit(1)
}
process.exit(1)
let vm = new VM({
    eval: true,
    wasm: false,
    sandbox: {
        async load(lib: string): Promise<any> {
            let str = (await readFile(joinpath("main", "libs", "lib" + lib + ".js")))?.toString()
            if (!str) return undefined;
            return vm.run(str)
        },
        readFile,
        writeFile,
        readDir,
        console,
        argv: workerData.args.slice(1),
        joinpath
    },
})

vm.run(file + "")