import { GenLocaleString } from "./gen"
import { fnum } from "./number-format.js"

export type LocaleString = GenLocaleString
type LocaleStrings = {
    [key in LocaleString]?: string
}
export type LocaleID = "en_US" | "es_SP"
export let locale: LocaleID = "en_US"
export type Locales = {
    [key in LocaleID]?: LocaleStrings
}
export let locales: Locales = {
    en_US: {},
}
let replacer = (str: string) => str
export function getString(key: string, obj: { [key: string]: any } | string[] = {}) {
    // @ts-ignore
    let str: string = locales[locale]?.[key]
    // @ts-ignore
    if (!str) str = locales.en_US?.[key]
    if (!str) return key
    str = replacer(str)
    if (!Array.isArray(obj)) {
        for (let k in obj) {
            let v = obj[k]
            delete obj[k]
            obj[k.toLowerCase()] = v
        }
    }
    return str.replace(/\$\.(\w+)/g, function (sub, k) {
        //@ts-ignore
        let v = obj[k.toLowerCase()]
        if (typeof v == "number")
            return fnum(v)
        return v + ""
    })
}