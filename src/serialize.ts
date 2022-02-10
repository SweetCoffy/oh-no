import { Dictionary } from "./util"

export const TYPE_OBJECT = 0
export const TYPE_ARRAY = 1
export const TYPE_NUMBER = 2
export const TYPE_STRING = 3
export const TYPE_BIGINT = 4

export function serialize(obj: any) {
    var buf = Buffer.alloc(1024)
    var i = 2
    for (var k in obj) {
        var value = obj[k]
        if (typeof value == "function") continue
        if (value == undefined) continue
        buf[i] = buf.write(k, i + 1, "ascii")
        i += buf[i] + 1;
        if (typeof value == "object") {
            buf[i++] = Array.isArray(value) ? TYPE_ARRAY : TYPE_OBJECT
            var dat = serialize(value)
            dat.copy(buf, i)
            i += dat.length
        } else if (typeof value == "number") {
            buf[i++] = TYPE_NUMBER
            buf.writeDoubleLE(value, i)
            i += 8
        } else if (typeof value == "string") {
            buf[i++] = TYPE_STRING
            buf[i] = buf.write(value, i + 1, "utf8")
            i += buf[i] + 1;
        } else if (typeof value == "bigint") {
            buf[i++] = TYPE_BIGINT
            var str = value.toString(16)
            buf[i] = buf.write(str, i + 1, "ascii")
            i += buf[i] + 1;
        }
        if (i >= buf.length/2) {
            var newbuf = Buffer.alloc(buf.length*2)
            buf.copy(newbuf)
            buf = newbuf;
        }
    }
    buf.writeUInt16LE(i, 0)
    return buf.slice(0, i)
}
function hexToBigInt(str: string) {
    str = str.toLowerCase()
    var sign = 1n
    if (str.startsWith("-")) {
      sign = -1n
      str = str.slice(1)
    }
    var v = 1n
    var value = 0n
    var table: Dictionary<bigint> = {
      0: 0n,
      1: 1n,
      2: 2n,
      3: 3n,
      4: 4n,
      5: 5n,
      6: 6n,
      7: 7n,
      8: 8n,
      9: 9n,
      a: 10n,
      b: 11n,
      c: 12n,
      d: 13n,
      e: 14n,
      f: 15n,
    }
    for (var i = 0; i < str.length; i++) {
        if (!(str[i] in table)) continue
      value += v * table[str[i]]
      v *= 16n
    }
    return value * sign
  }
export function deserialize(buf: Buffer) {
    var obj: any = {}
    var i = 2
    
    while (i < buf.length) {
        var len = buf[i++]
        var key = buf.toString("ascii", i, i + len)
        i += len;
        var type = buf[i++]
        if (type == TYPE_STRING) {
            var strlen = buf[i++]
            var str = buf.toString("utf8", i, i + strlen)
            
            i += strlen
            obj[key] = str;
        } else if (type == TYPE_OBJECT || type == TYPE_ARRAY) {
            var objlen = buf.readUInt16LE(i)
            var data = deserialize(buf.slice(i, i + objlen))
            if (type == TYPE_ARRAY) {
                obj[key] = []
                for (var k in data) {
                    obj[key][k] = data[k]
                }
            } else { 
                obj[key] = data
            }
            i += objlen
        } else if (type == TYPE_NUMBER) {
            obj[key] = buf.readDoubleLE(i)
            i += 8
        } else if (type == TYPE_BIGINT) {
            var strlen = buf[i++]
            var str = buf.toString("ascii", i, i + strlen + 1)
            i += strlen
            obj[key] = hexToBigInt(str.trim());
        }
    }
    return obj
}