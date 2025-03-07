
import {createSVG} from './common.mjs';

let gradientIdCounter = 0;


export class Color {
    static fromRGB(r, g, b, a) {
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const d = maxC - minC;
        let h = 0;
        if (!d) {
            h = 0;
        } else if (maxC === r) {
            h = ((g - b) / d) % 6;
        } else if (maxC === g) {
            h = (b - r) / d + 2; } else {
            h = (r - g) / d + 4;
        }
        h = Math.round(h * 60);
        if (h < 0) {
            h += 360;
        }
        h /= 360;
        const l = (maxC + minC) / 2;
        const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
        return new this(h, s, l, a);
    }

    static fromHex(hex) {
        if (hex.length >= 7) {
            const r = parseInt(hex.substr(1, 2), 16) / 0xff;
            const g = parseInt(hex.substr(3, 2), 16) / 0xff;
            const b = parseInt(hex.substr(5, 2), 16) / 0xff;
            const a = (hex.length === 9) ? parseInt(hex.substr(7, 2), 16)  / 0xff : undefined;
            return this.fromRGB(r, g, b, a);
        } else if (hex.length >= 4) {
            const r = parseInt(''.padStart(2, hex.substr(1, 1)), 16) / 0xff;
            const g = parseInt(''.padStart(2, hex.substr(2, 1)), 16) / 0xff;
            const b = parseInt(''.padStart(2, hex.substr(3, 1)), 16) / 0xff;
            const a = (hex.length === 5) ? parseInt(''.padStart(2, hex.substr(4, 1)), 16) / 0xff : undefined;
            return this.fromRGB(r, g, b, a);
        } else {
            throw new Error('Invalid hex color');
        }
    }

    constructor(h, s, l, a) {
        this.h = h;
        this.s = s;
        this.l = l;
        this.a = a;
    }

    clone() {
        return new this.constructor(this.h, this.s, this.l, this.a);
    }

    hue(h) {
        const c = this.clone();
        c.h = h;
        return c;
    }

    saturation(s) {
        const c = this.clone();
        c.s = s;
        return c;
    }

    light(l) {
        const c = this.clone();
        c.l = l;
        return c;
    }

    alpha(a) {
        const c = this.clone();
        c.a = a;
        return c;
    }

    adjustHue(h) {
        const c = this.clone();
        c.h = h;
        return c;
    }

    adjustLight(ld) {
        const c = this.clone();
        c.l += ld;
        return c;
    }

    adjustSaturation(sd) {
        const c = this.clone();
        c.s += sd;
        return c;
    }

    adjustAlpha(ad) {
        const c = this.clone();
        c.a += ad;
        return c;
    }

    toString(options={}) {
        const h = Number((this.h * 360).toFixed(3));
        const s = Number((this.s * 100).toFixed(3));
        const l = Number((this.l * 100).toFixed(3));
        const a = this.a !== undefined ? ` / ${Number((this.a * 100).toFixed(3))}%` : '';
        return `hsl(${h} ${s} ${l}%${a})`;
    }
}


export class Gradient {

    static fromObject(obj) {
        if (obj.type === 'linear') {
            return new LinearGradient(obj);
        } else {
            throw new TypeError("unsupported type");
        }
    }

    constructor({type, colors}={}) {
        this.type = type;
        this.colors = [];
        this.id = `color-gradient-${type}-${gradientIdCounter++}`;
        if (colors) {
            for (const x of colors) {
                if (typeof x === 'string' || (x instanceof Color)) {
                    this.addColor(x);
                } else {
                    this.addColor(x.color, x.offset);
                }
            }
        }
    }

    addColor(color, offset) {
        this.colors.push({
            color: (color instanceof Color) ? color : parse(color),
            offset
        });
    }
}


export class LinearGradient extends Gradient {
    constructor(options) {
        super(options);
        this.rotate = options.rotate;
        this.el = createSVG({
            name: 'linearGradient',
            id: this.id,
            attrs: {
                x1: 0,
                y1: 1,
                x2: 0,
                y2: 0,
            }
        });
    }

    render() {
        this.el.setAttribute('class', 'sc-gradient');
        const rotate = (this.rotate || 0) % 360;
        if (rotate) {
            this.el.setAttribute('gradientTransform', `rotate(${rotate} 0.5 0.5)`);
        } else {
            this.el.removeAttribute('gradientTransform');
        }
        let left = 0;
        const stops = [];
        for (const [i, x] of this.colors.entries()) {
            let offset = x.offset;
            if (offset == null) {
                if (i === 0) {
                    offset = 0;
                } else if (i === this.colors.length - 1) {
                    offset = 1;
                } else {
                    const nextBorderJump = this.colors.slice(i).findIndex(x => x.offset != null);
                    let steps, right;
                    if (nextBorderJump !== -1) {
                        steps = nextBorderJump + 1;
                        right = this.colors[nextBorderJump + i].offset;
                    } else {
                        steps = this.colors.length - i;
                        right = 1;
                    }
                    offset = left + (right - left) / steps;
                }
            }
            left = offset;
            const stop = createSVG({
                name: 'stop',
                attrs: {
                    offset: `${offset * 100}%`,
                },
                style: {
                    'stop-color': x.color,
                }
            });
            stops.push(stop);
        }
        this.el.replaceChildren(...stops);
    }
}


let _colorCanvasCtx;
export function parse(value) {
    if (value == null) {
        throw new TypeError('invalid color or gradient');
    }
    if (value instanceof Color) {
        return value;
    } else if (value instanceof Gradient) {
        return value;
    } else if (typeof value === 'object') {
        return Gradient.fromObject(value);
    }
    if (!_colorCanvasCtx) {
        _colorCanvasCtx = (new OffscreenCanvas(1, 1)).getContext('2d', {willReadFrequently: true});
    }
    const ctx = _colorCanvasCtx;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1, {colorSpace: 'srgb'}).data;
    return Color.fromRGB(r / 255, g / 255, b / 255, a / 255);
}
