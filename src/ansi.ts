export const Reset = "\u001b[0m"
export const Start = "\u001b["
export const End = "m"


export const FG_Gray   = 30
export const FG_Red    = 31
export const FG_Green  = 32
export const FG_Yellow = 33
export const FG_Blue   = 34
export const FG_Pink   = 35
export const FG_Cyan   = 36
export const FG_White  = 37


export const BG_DarkBlue    = 40  
export const BG_Orange      = 41 
export const BG_Gray        = 42 
export const BG_LightGray   = 43 
export const BG_LighterGray = 44 
export const BG_Indigo      = 45 
//export const BG_LighterGray = 46 
export const BG_White       = 47 


export const Normal = 0
export const Bold = 1
export const Underline = 4

export type LogColor = "red" | "green" | "white" | "gray" | "blue" | "yellow" | "pink" | "cyan"
export type LogColorWAccent = LogColor | "accent" | "success" | "failure" | "danger" | "unimportant"
export const color2ANSITable: { [x in LogColorWAccent]: number } = {
    accent: FG_Cyan,
    success: FG_Green,
    failure: FG_Red,
    danger: FG_Yellow,
    unimportant: FG_Gray,

    red: FG_Red,
    green: FG_Green,
    white: 0,
    gray: FG_Gray,
    blue: FG_Blue,
    yellow: FG_Yellow,
    pink: FG_Pink,
    cyan: FG_Cyan,
}
export const color2ANSIAlias: { [x: string]: LogColorWAccent } = {
    a: "accent",
    s: "success",
    f: "failure",
    d: "danger",
    u: "unimportant"
}