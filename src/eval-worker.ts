import worker from "worker_threads"
import { parentPort } from "worker_threads"
import vm2 from "vm2"
import { UserInfo } from "./users.js"
import { Console } from "console"



var workerData: {
    code: string,
    dev: boolean,
    userId: string,
    userData?: { [key: string]: UserInfo },
} = worker.workerData


function validateStructure(og: any, value: any) {
    for (var k in value) {
        if (!validate(og[k], value[k])) return false
    }
    return true
}
function validate(og: any, value: any) {
    if (typeof og != "object") {
        return typeof og == typeof value
    } else {
        return validateStructure(og, value)
    }
}

type EvalModule = {devOnly?: boolean, exports: any, name?: string, description?: string, author?: string}

var modules: {[key: string]: EvalModule} = {
    "your_mom": {
        devOnly: false,
        exports: {
            yourmom() {
                return 69
            }
        }
    }
}



var context: any = {
    get userId() {
        return workerData.userId
    },
    get AVAILABLE_MODULES() {
        if (!workerData.dev) return Object.keys(modules).filter(el => !modules[el].devOnly)
        return Object.keys(modules)
    },
    console: new Console(process.stdout, process.stderr, false),
    require(mod: string) {
        if (modules[mod]) {
            if (modules[mod].devOnly && !workerData.dev) throw new Error(`The module '${mod}' is developer only`)
            return modules[mod].exports
        }
        throw new Error(`Module not found: '${mod}'`)
    }
}

// if (workerData.dev && workerData.userData) {
//     var data: any = {}
//     context.userData = data
//     for (var k in workerData.userData) {
//         let proxy = new Proxy(workerData.userData[k], {
//             set(target, p, value) {
//                 //@ts-ignore
//                 if (!validate(target[p], value)) return false
//                 target.modified = true
//                 return Reflect.set(target, p, value)
//             }
//         })
//         var users = workerData.userData
//         function proxify(base: any, obj: any) {
//             for (var p in obj) {
//                 //@ts-ignore
//                 if (typeof obj[p] == "object") {
//                     proxify(base, obj[p])
//                     obj[p] = new Proxy(obj[p], {
//                         set(target, p, value) {
//                             if (!validate(target[p], value)) return false
//                             base.modified = true
//                             return Reflect.set(target, p, value)
//                         }
//                     })
//                 }
//             }
//         }
//         proxify(users[k], users[k])
//         data[k] = proxy
//     }
// }

function cloneObj(obj: any) {
    var o: any = {}
    if (Array.isArray(obj)) o = []
    for (var k in obj) {
        if (typeof obj[k] == "object") {
            o[k] = cloneObj(obj[k])
        } else if (typeof obj[k] != "function") {
            o[k] = obj[k]
        }
    }
    return o
}

var vm = new vm2.VM({ sandbox: context })
try {
    var out = vm.run(workerData.code)
    // if (workerData.dev) {
    //     var modified: any = {}
    //     for (var k in workerData.userData) {
    //         var d: any = workerData.userData[k]
    //         if (d.modified) {
    //             var m: any = modified[k] = {}
    //             for (var key in d) {
    //                 m[key] = d[key]
    //             }
    //         }
    //     }
        
    //     parentPort?.postMessage({type: "patch-user", data: modified})
    // }
    parentPort?.postMessage({type: "return", data: `${out}`})
} catch (err) {
    parentPort?.postMessage({type: "return", data: `${err}`})
}
