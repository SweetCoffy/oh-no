import { MoveID } from "./gen";
import { BASE_STAT_TOTAL } from "./params";
import { baseStats, limitStats, Stats } from "./stats";
import { addSingleUpdater, UPDATE_TIME_INC, UserSpecialData } from "./users";
type HuntSpecial = {
    stats: Stats,
    hpPercent: number,
    moveset: MoveID[],
}
export const huntData = 
    new UserSpecialData<HuntSpecial>("hunt", {
        stats: limitStats(baseStats, BASE_STAT_TOTAL),
        hpPercent: 1,
        moveset: ["bonk", "nerf_gun", "protect"]
    }).register()

const FULL_RECOVERY_TIME = 1000 * 500
const FULL_RECOVERY_INCS = Math.floor(FULL_RECOVERY_TIME / UPDATE_TIME_INC)
export const HP_PER_INC = 1 / FULL_RECOVERY_INCS
addSingleUpdater("Hunt HP Recovery", (u, d, i) => {
    let hunt = huntData.get(d)
    if (hunt.hpPercent >= 1) return
    let amt = HP_PER_INC * i
    hunt.hpPercent += amt
    if (hunt.hpPercent > 1)
        hunt.hpPercent = 1
})