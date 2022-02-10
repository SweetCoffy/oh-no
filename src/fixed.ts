export default class Fixed {
    fracbits: bigint
    get fracunit() {
        return 1n << this.fracbits
    }
    toFloat(number: bigint) {
        if (number/this.fracunit > Number.MAX_SAFE_INTEGER || number/this.fracunit < Number.MIN_SAFE_INTEGER) 
        throw new RangeError(`number: ${number / this.fracunit} (${number}) is outside of the range ${Number.MIN_SAFE_INTEGER} - ${Number.MAX_SAFE_INTEGER}`)
        var int = number / this.fracunit
        var dec = number % this.fracunit
        return Number(int) + Math.abs(Number(dec))/Number(this.fracunit)
    }
    fromFloat(number: number) {
        var int = Math.floor(number)
        var dec = number % 1
        return BigInt(int)*this.fracunit + BigInt(Math.round(dec * Number(this.fracunit)))
    }
    abs(number: bigint) {
        if (number < 0) return -number
        return number
    }
    mul(a: bigint, b: bigint) {
        return (a*b)/this.fracunit
    }
    div(a: bigint, b: bigint) {
        return (a*this.fracunit)/b
    }
    fromString(str: string): bigint {
        var h = str.split(".")
        var int = BigInt(h[0])
        var dec = Number("0." + (h[1] || "0"))
        return (int*this.fracunit) + BigInt(Math.round(dec*Number(this.fracunit)))
    }
    sign(number: bigint) {
        if (number > 0) return this.fracunit
        if (number < 0) return -this.fracunit
        return 0n
    }
    eval(str: string, constants: {[key: string]: bigint} = {}) {
        var f = this
        for (var k in constants) {
            if (typeof constants[k] != "bigint") throw `constants: '${k}' is of type ${typeof constants[k]}, bigint expected`
        }
        var ops = [
            { sign: "+", func: (a: bigint, b: bigint) => a + b },
            { sign: "-", func: (a: bigint, b: bigint) => a - b },
            { sign: "*", func: (a: bigint, b: bigint) => f.mul(a, b) },
            { sign: "/", func: (a: bigint, b: bigint) => f.div(a, b) },
        ]
        var funcs = {
            abs:  f.abs .bind(f),
            sign: f.sign.bind(f),
        }
        var counter = Date.now()
        function getId() {
            var str = ""
            var c = counter++
            var i = 0
            var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
            while (c > 0) {
                str += chars[Math.floor(c % chars.length)]
                c -= Math.ceil(c / 10) * (1 + (i / 4));
                i++;
            }
            return str
        }
        function split(str: string) {
            var inBracket = 0
            var acc = ""
            var ar = []
            for (var i = 0; i < str.length; i++) {
                var c = str[i]
            if (c == "(") inBracket++
                if (c == ")" && inBracket) inBracket--
            if (c == "," && !inBracket) {
                    ar.push(acc)
                    acc = ""
                } else acc += c
            }
            if (acc) ar.push(acc)
            return ar
        }
        function parseExp(str: string): bigint {
            str = str.replace(/[\s]/g, "")
            str = str.replace(/(?<![\d\)])-((?:\d+)|(?:\(.+\)))/g, function(substr, h: string) {
                var id = `__${getId()}`
                constants[id] = -parseExp(h)
                return `(0-${h})`
            })
            str = str.replace(/([a-zA-Z][a-zA-Z0-9]*)\((.+)\)/g, function (substr, h: string, argsStr: string) {
                var args = split(argsStr).map(el => parseExp(el))
                if (!(h in funcs)) return "0";
                //@ts-ignore
                var func = funcs[h]
                var id = `__${getId()}`;
                constants[id] = func(...args);
                return id;
            });
            str = str.replace(/\((.+?)\)/g, function(substr, h: string) {
                var id = `__${getId()}`
                constants[id] = parseExp(h)
                return id
            })
            if (str in constants) return constants[str]
            for (var o of ops) {
                var h = str.split(o.sign)
                if (h.length > 1) {
                    var a = parseExp(h[0])
                    var b = parseExp(h.slice(1).join(o.sign))
                    return o.func(a, b)
                }
            }
            return f.fromString(str);
        }
        return parseExp(str)
    }
    toString(number: bigint, precision: 1n | 2n | 3n = 1n) {
        if (precision < 1n || precision > 3n) throw new RangeError(`precision: ${precision} is outside of the range 1 - 3`)
        var int = this.abs(number / this.fracunit)
        var dec = this.abs((number % this.fracunit) / (this.fracunit / (10n ** precision)))
        var sign = number < 0 ? "-" : ""
        if (dec > 0) return `${sign}${int}.${dec}`
        return `${sign}${int}`
    }
    constructor(fracbits = 16n) {
        this.fracbits = fracbits
        //this.fracunit = 1n << this.fracbits
    }
}