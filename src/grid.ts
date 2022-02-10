export class Grid<T> {
    #tiles: T[][] = []
    readonly width: number
    readonly height: number
    constructor(width: number, height: number, func: (x: number, y: number, grid: Grid<T>) => T) {
        for (var x = 0; x < width; x++) {
            this.#tiles[x] = []
            for (var y = 0; y < height; y++) {
                this.#tiles[x].push(func(x, y, this))
            }
        }
        this.width = width
        this.height = height
    }
    get(x: number, y: number): T | undefined {
        return this.#tiles[x]?.[y]
    }
    set(x: number, y: number, tile: T) {
        this.#tiles[x][y] = tile
    }
    getIndex(i: number): T | undefined {
        return this.get(i % this.width, Math.floor(i / this.height))
    }
}