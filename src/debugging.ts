import { FG_Yellow, P, R } from "./ansi.js";

var enabled = process.argv.includes("-debug")
export function log(str: any) {
    if (!enabled) return;
    if (str instanceof Date) str = str.toString()
    else if (typeof str == "boolean" || typeof str == "number" || typeof str == "bigint") str = `${P}0;${FG_Yellow}m` + str.toString() + R
    else if (typeof str == "function") str = str.toString()
    console.log(str)
}