import * as worker_threads from "worker_threads"
import { VM } from "vm2"
var workerData: { args: string[] } = worker_threads.workerData;
var idcounter = 0;
function getid() {
    return idcounter++;
}
function readFile(path: string): Promise<Buffer | undefined> {
    return new Promise((resolve) => {
        var id = getid()
        var func = (msg: any) => {
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
        var id = getid()
        var func = (msg: any) => {
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
        var id = getid()
        worker_threads.parentPort?.postMessage({ type: "read", path: path, id: id })
        var func = (msg: any) => {
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
var cwd = "main"
var path = new Set(["", cwd, "main", "main/eggos", "main/js", ...((await readFile("main/cfg/path.cfg") + "") || "").split(";")])
var filename = workerData.args[0]
if (!filename.includes(".")) filename = filename + ".js"
var file = undefined
for (var p of path) {
    file = await readFile(joinpath(p, filename))
    if (file) break;
}
if (!file) {
    console.log(`File not found: ${filename}`)
    process.exit(1)
}
var vm = new VM({
    eval: true,
    wasm: false,
    sandbox: {
        async load(lib: string): Promise<any> {
            var str = (await readFile(joinpath("main", "libs", "lib" + lib + ".js")))?.toString()
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