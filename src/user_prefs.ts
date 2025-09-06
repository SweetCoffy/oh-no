import type { PrefSpecial } from "./save_special";

function genValues<K extends string, V extends number|string>(obj: { [k in K]: V }): UserPref<K, V>["values"] {
    let kv = {}
    let vk = {}
    for (let k in obj) {
        //@ts-ignore
        kv[k] = obj[k]
        //@ts-ignore
        vk[obj[k]] = k
    }
    return {
        //@ts-ignore
        kv,
        //@ts-ignore
        vk,
    }
}
interface UserPref<K extends string, V extends number|string> {
    name: string
    description: string
    key: keyof PrefSpecial
    default: V
    values: {
        kv: {
            [key in K]: V
        }
        vk: {
            [key in V]: K
        }
    }
}

export const prefList: { [k in keyof PrefSpecial]: UserPref<string, number> } = {
    preferMarkdown: {
        name: "Prefer Markdown (experimental)",
        description: "Disables fancy colored text and replaces it with markdown whenever possible. Recommended for mobile, where colors aren't rendered.",
        key: "preferMarkdown",
        default: 0,
        values: genValues({
            "Off": 0,
            "On": 1,
        })
    }
}