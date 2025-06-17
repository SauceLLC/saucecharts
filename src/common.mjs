/**
 * @module common
 */
import * as colorMod from './color.mjs';


/**
 * Native CSS Color value (browser support dependent)
 *
 * @typedef CSS_Color
 * @type {string}
 * @external
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value}
 */

/**
 * @typedef EventTarget
 * @type {EventTarget}
 * @external
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/EventTarget}
 */

/**
 * @typedef Element
 * @type {Element}
 * @external
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Element}
 */

/**
 * Coordinate box [top, right, bottom, left]
 *
 * @typedef BoxArray
 * @type {Array<number>}
 * @property {number} 0 - top
 * @property {number} 1 - right
 * @property {number} 2 - bottom
 * @property {number} 3 - left
 */

/**
 * Chart Tooltip options
 *
 * @typedef TooltipOptions
 * @type {object}
 * @property {boolean} [disabled]
 * @property {BoxArray} [padding] - Padding offsets for tooltip box
 * @property {number} [linger=800] - Milliseconds to linger before hiding
 * @property {TooltipPosition} [position="leftright"] - Relative positioning of tooltip with
 *                                                      respect to the pointer
 * @property {function} [format] - Custom callback function for tooltip value
 * @property {function} [formatKey] - Custom callback function for tooltip key
 */

/**
 * Chart Tooltip positions
 *
 * A string containing horizontal and/or veritical placement hints.
 *
 * @example
 * "left below"
 *
 * @typedef TooltipPosition
 * @type {string}
 * @property {"left"|"center"|"right"|"leftright"} 0 - Horizontal placement hints
 * @property {"above"|"top"|"middle"|"bottom"|"below"} 1 - Vertical placement hints
 */

/**
 * Chart Axis options
 *
 * @typedef AxisOptions
 * @type {object}
 * @property {boolean} [disabled]
 * @property {("left"|"right")} [align="left"] - Placement of vertical axis elements
 * @property {number} [ticks] - Number of ticks/labels to draw
 * @property {boolean} [showFirst] - Render the first (low) value of the axis
 * @property {number} [tickLength=6] - Size of the tick marks
 * @property {function} [format] - Custom callback function for label values
 */

/**
 * Chart type specific data object
 *
 * @typedef DataObject
 * @type object
 */

/**
 * Chart data array - Chart specific meaning
 *
 * @typedef ChartData
 * @type {Array<DataObject|DataValue|DataTuple>}
 */

/**
 * Y value of data.  X is infered by array index
 *
 * @typedef DataValue
 * @type number
 */

/**
 * X, Y data values
 *
 * @typedef DataTuple
 * @type Array<number>
 * @property {number} 0 - X value
 * @property {number} 1 - Y value
 */

/**
 * Tooltip position event
 *
 * @event tooltip
 * @type {object}
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [index]
 * @property {boolean} internal - Was the event triggered internally by pointer events
 * @property {Chart} chart
 */

/**
 * Zoom event
 *
 * @event zoom
 * @type {object}
 * @property {("data"|"visual")} type
 * @property {XRange} [xRange]
 * @property {YRange} [yRange]
 * @property {Coords} [translate]
 * @property {number} [scale]
 * @property {boolean} internal - Was the event triggered internally by pointer events
 * @property {Chart} chart
 */

let globalIdCounter = 0;


export const createSVG = _createNodes.bind(
    null, document.createElementNS.bind(document, 'http://www.w3.org/2000/svg'));

export const createHTML = _createNodes.bind(
    null, document.createElement.bind(document));


function _createNodes(createFunction, options) {
    const el = createFunction(options.name);
    if (options) {
        if (options.id) {
            el.id = options.id;
        }
        if (options.class) {
            const classes = Array.isArray(options.class) ? options.class : [options.class];
            el.classList.add(...classes);
        }
        if (options.data) {
            Object.assign(el.dataset, options.data);
        }
        if (options.attrs) {
            for (const [k, v] of Object.entries(options.attrs)) {
                el.setAttribute(k, v);
            }
        }
        if (options.style) {
            for (const [k, v] of Object.entries(options.style)) {
                el.style.setProperty(k, v);
            }
        }
        if (options.children) {
            el.append(...options.children.map(x => _createNodes(createFunction, x)));
        }
    }
    return el;
}


export function getStyleValue(el, key, type) {
    const raw = getComputedStyle(el).getPropertyValue(key);
    if (!type) {
        return raw;
    } else if (type === 'number') {
        return parseFloat(raw);
    } else if (type === 'time') {
        return parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000);
    }
}


export function requestIdle(cb, timeout=400) {
    if (window.requestIdleCallback) {
        return requestIdleCallback(cb, {timeout});
    } else {
        return setTimeout(cb, timeout / 2);
    }
}


export function cancelIdle(id) {
    if (window.requestIdleCallback) {
        return cancelIdleCallback(id);
    } else {
        return clearTimeout(id);
    }
}


export function lerp(n1, n2, t) {
    return ((1 - t) * n1) + (t * n2);
}


// Ported from https://github.com/joshcarr/largest-triangle-three-buckets.js
// See: https://github.com/sveinn-steinarsson/flot-downsample
function largestTriangleThreeBuckets(inData, outLen) {
    if (!outLen || outLen >= inData.length) {
        return inData;
    }
    const outData = [inData[0]];
    const every = (inData.length - 2) / (outLen - 2);
    let a = 0;
    let nextA;
    let maxAreaPoint;
    for (let i = 0; i < outLen - 2; i++) {
        const bStart = ((i + 1) * every | 0) + 1;
        const bEnd = Math.min(inData.length, ((i + 2) * every | 0) + 1);
        const bFactor = 1 / (bEnd - bStart);
        let avgX = 0, avgY = 0;
        for (let ii = bStart; ii < bEnd; ii++) {
            avgX += inData[ii].x * bFactor;
            avgY += inData[ii].y * bFactor;
        }
        const rangeFrom = ((i + 0) * every | 0) + 1;
        const rangeTo = ((i + 1) * every | 0) + 1;
        const aX = inData[a].x;
        const aY = inData[a].y;
        const aXAvgDist = aX - avgX;
        const ayAvgDist = avgY - aY;
        let maxArea = -1;
        for (let ii = rangeFrom; ii < rangeTo; ii++) {
            const area = Math.abs((aXAvgDist * (inData[ii].y - aY)) - (ayAvgDist * (aX - inData[ii].x)));
            if (area > maxArea) {
                maxArea = area;
                maxAreaPoint = inData[ii];
                nextA = i;
            }
        }
        outData.push(maxAreaPoint);
        a = nextA;
    }
    outData.push(inData[inData.length - 1]);
    return outData;
}


const resample = largestTriangleThreeBuckets;


/**
 * @typedef ChartOptions
 * @type {object}
 * @property {external:Element} [el] - DOM Element to insert chart into
 * @property {boolean} [merge] - Merge with existing Chart using this same element
 * @property {ChartData} [data] - Initial data to use for chart rendering
 * @property {number} [xMin] - Minimum X data value
 * @property {number} [xMax] - Maximum X data value
 * @property {number} [yMin] - Minimum Y data value
 * @property {number} [yMax] - Maximum Y data value
 * @property {string} [title] - Visually displayed title of chart
 * @property {external:CSS_Color} [color] - The CSS color basis for this chart's data
 * @property {BoxArray} [padding] - Plot padding in DPI adjusted coordinates.
 * @property {number} [width] - Fixed width of plot
 * @property {number} [height] - Fixed height of plot
 * @property {TooltipOptions} [tooltip] - Tooltip options
 * @property {AxisOptions} [xAxis] - X axis options
 * @property {AxisOptions} [yAxis] - Y axis options
 * @property {boolean} [disableAnimation] - Disable all animation/transitions
 * @property {boolean} [darkMode] - Force use of darkmode
 */


/**
 * Base class for charts subclasses.
 *
 * @abstract
 * @extends external:EventTarget
 * @param {ChartOptions} [options] - Common chart options
 * @emits zoom
 * @emits tooltip
 */
export class Chart extends EventTarget {

    constructor(options={}) {
        super();
        this.init(options);
        this.id = globalIdCounter++;
        this.xMin = options.xMin;
        this.xMax = options.xMax;
        this.yMin = options.yMin;
        this.yMax = options.yMax;
        this.title = options.title;
        this.color = options.color;
        this.padding = options.padding ?? [0, 0, 0, 0];
        this.width = options.width;
        this.height = options.height;
        this.tooltip = options.tooltip ?? {};
        this.tooltip.padding ??= [this.padding[0], this.padding[2]];
        this.tooltip.position ??= 'leftright';
        this.tooltip.linger ??= 800;
        this.xAxis = options.xAxis ?? {};
        this.yAxis = options.yAxis ?? {};
        this.disableAnimation = options.disableAnimation;
        this.darkMode = options.darkMode;
        this.childCharts = [];
        this._zoomState = {rev: 0};
        this._tooltipState = {suspendRefCnt: 0};
        this._gradients = new Set();
        this._onPointerEnterBound = this.onPointerEnter.bind(this);
        this._resizeObserver = new ResizeObserver(this.onResize.bind(this));
        this._merge = options.merge;
        if (options.el) {
            this.setElement(options.el);
        }
        if (options.data) {
            this.setData(options.data);
        }
        addEventListener('scroll', ev => {
            if (!this._tooltipState.visible) {
                return;
            }
            this._updateTooltip({disableAnimation: true});
        }, {passive: true});
    }

    /**
     * @protected
     * @param {ChartOptions} options
     */
    init(options) {
    }

    /**
     * Add a color gradient which can be used in SVG contexts
     *
     * @param {(module:color.Gradient|module:color.GradientOptions)} gradient
     * @returns {module:color.Gradient}
     */
    addGradient(gradient) {
        if (!(gradient instanceof colorMod.Gradient)) {
            gradient = colorMod.Gradient.fromObject(gradient);
        }
        gradient.render();
        this._gradients.add(gradient);
        this._defsEl.append(gradient.el);
        return gradient;
    }


    /**
     * @param {module:color.Gradient} gradient
     */
    removeGradient(gradient) {
        this._gradients.delete(gradient);
        gradient.el.remove();
        gradient.el = null;
    }

    onResize(entries) {
        for (let i = 0; i < entries.length; i++) {
            const x = entries[i];
            if (x.target === this._tooltipBoxEl) {
                requestAnimationFrame(() => this._onResizeTooltip(x));
            } else if (x.target === this.el) {
                requestAnimationFrame(() => this._onResizeContainer(x));
            }
        }
    }

    _onResizeTooltip(entry) {
        const minChange = 10;
        const courseWidth = Math.ceil(entry.borderBoxSize[0].inlineSize / minChange) * minChange;
        this._tooltipPositionerEl.style.setProperty('--course-width', `${courseWidth}px`);
    }

    _onResizeContainer(resize) {
        const hasAnim = !this.el.classList.contains('sc-disable-animation');
        if (hasAnim) {
            this.el.classList.add('sc-disable-animation');
        }
        try {
            this.adjustSize(resize.contentRect.width, resize.contentRect.height);
            this.render({disableAnimation: true});
        } finally {
            if (hasAnim) {
                this.el.offsetWidth;
                this.el.classList.remove('sc-disable-animation');
            }
        }
    }

    /**
     * @protected
     */
    adjustSize(boxWidth, boxHeight) {
        this.devicePixelRatio = devicePixelRatio || 1;
        if (boxWidth === undefined) {
            ({width: boxWidth, height: boxHeight} = this._rootSvgEl.getBoundingClientRect());
        }
        const allCharts = this.getAllCharts();
        if (allCharts.every(x => x.width != null)) {
            boxWidth = Math.max(...allCharts.map(x => x.padding[3] + x.width + x.padding[1]));
        }
        if (allCharts.every(x => x.height != null)) {
            boxHeight = Math.max(...allCharts.map(x => x.padding[0] + x.height + x.padding[2]));
        }
        if (!boxWidth || !boxHeight) {
            this._boxWidth = 0;
            this._boxHeight = 0;
            this._plotWidth = 0;
            this._plotHeight = 0;
            this._plotBox = [0, 0, 0, 0];
            return;
        }
        this._boxWidth = Math.round(boxWidth * this.devicePixelRatio);
        this._boxHeight = Math.round(boxHeight * this.devicePixelRatio);
        const inset = this.padding.map(x => x * this.devicePixelRatio);
        this._plotWidth = Math.max(0, this.width ?
            Math.round(this.width * this.devicePixelRatio) :
            this._boxWidth - inset[3] - inset[1]);
        this._plotHeight = Math.max(0, this.height ?
            Math.round(this.height * this.devicePixelRatio) :
            this._boxHeight - inset[0] - inset[2]);
        this._plotBox = [
            inset[0],
            this._plotWidth + inset[3],
            this._plotHeight + inset[0],
            inset[3]
        ];
        const plotStyle = this._plotRegionEl.style;
        plotStyle.setProperty('--plot-box-top', `${this._plotBox[0]}px`);
        plotStyle.setProperty('--plot-box-right', `${this._plotBox[1]}px`);
        plotStyle.setProperty('--plot-box-bottom', `${this._plotBox[2]}px`);
        plotStyle.setProperty('--plot-box-left', `${this._plotBox[3]}px`);
        plotStyle.setProperty('--plot-width', `${this._plotWidth}px`);
        plotStyle.setProperty('--plot-height', `${this._plotHeight}px`);
        if (this.isParentChart()) {
            this._rootSvgEl.setAttribute('viewBox', `0 0 ${this._boxWidth} ${this._boxHeight}`);
            this.el.style.setProperty('--dpr', this.devicePixelRatio);
        }
        if (this._tooltipState.visible) {
            this._establishTooltipState();
        }
    }

    _drawXAxis() {
        this._drawAxis('horizontal', this._xAxisEl, this.xAxis);
    }

    _drawYAxis() {
        this._drawAxis('vertical', this._yAxisEl, this.yAxis);
    }

    _drawAxis(orientation, el, options) {
        const vert = orientation === 'vertical';
        const baseline = el.querySelector('line.sc-baseline');
        const [top, right, bottom, left] = this._plotBox;
        if (vert) {
            el.classList.toggle('sc-right', !!options.right);
            baseline.setAttribute('x1', options.align === 'right' ? right : left);
            baseline.setAttribute('x2', options.align === 'right' ? right : left);
            baseline.setAttribute('y1', top);
            baseline.setAttribute('y2', bottom);
        } else {
            baseline.setAttribute('x1', left);
            baseline.setAttribute('x2', right);
            baseline.setAttribute('y1', bottom);
            baseline.setAttribute('y2', bottom);
        }
        let ticks = options.ticks;
        const trackLength = vert ? this._plotHeight : this._plotWidth;
        if (ticks == null) {
            ticks = 2 + Math.floor((trackLength / devicePixelRatio) / (vert ? 100 : 200));
        }
        const gap = trackLength / (ticks - 1);
        const tickLen = options.tickLength ?? 6;
        const existingTicks = el.querySelectorAll('line.sc-tick');
        const existingLabels = el.querySelectorAll('text.sc-label');
        let visualCount = 0;
        for (let i = options.showFirst ? 0 : 1; i < ticks; i++) {
            let x1, x2, y1, y2;
            if (vert) {
                x1 = options.align === 'right' ? right : left;
                x2 = x1 + tickLen * (options.align === 'right' ? -1 : 1);
                y1 = y2 = bottom - i * gap;
            } else {
                x1 = x2 = left + i * gap;
                y1 = bottom;
                y2 = bottom - tickLen;
            }
            let tick = existingTicks[visualCount];
            if (!tick) {
                tick = createSVG({name: 'line', class: 'sc-tick'});
                el.append(tick);
            }
            tick.setAttribute('x1', x1);
            tick.setAttribute('x2', x2);
            tick.setAttribute('y1', y1);
            tick.setAttribute('y2', y2);
            let label = existingLabels[visualCount];
            if (!label) {
                label = createSVG({name: 'text', class: 'sc-label'});
                el.append(label);
            }
            label.setAttribute('x', x1);
            label.setAttribute('y', y1);
            label.setAttribute('data-pct', i / (ticks - 1));
            label.textContent = this.onAxisLabel({
                orientation,
                tick: i,
                tickCount: ticks,
                format: options.format,
            });
            visualCount++;
        }
        for (let i = visualCount; i < existingTicks.length; i++) {
            existingTicks[i].remove();
        }
        for (let i = visualCount; i < existingLabels.length; i++) {
            existingLabels[i].remove();
        }
    }

    /**
     * Set the DOM element to be used by this chart
     *
     * @param {external:Element} el
     */
    setElement(el) {
        this.beforeSetElement(el);
        const old = this.el;
        this.el = el;
        if (old) {
            this._resizeObserver.disconnect();
            old.removeEventListener('pointerenter', this._onPointerEnterBound);
            this.doReset();
            if (this._plotRegionEl) {
                this._plotRegionEl.remove();
                this._plotRegionEl = null;
            }
            if (this._xAxisEl) {
                this._xAxisEl.remove();
                this._xAxisEl = null;
            }
            if (this._yAxisEl) {
                this._yAxisEl.remove();
                this._yAxisEl = null;
            }
        }
        if (!this._merge) {
            el.classList.add('saucechart', 'sc-wrap');
            el.classList.toggle('sc-disable-animation', !!this.disableAnimation);
            let darkMode = this.darkMode;
            if (darkMode === undefined) {
                const c = colorMod.parse(getStyleValue(el, 'color'));
                darkMode = c.l >= 0.5;
            }
            this.el.classList.toggle('sc-darkmode', darkMode);
            const svg = createSVG({
                name: 'svg',
                class: 'sc-root',
                attrs: {
                    version: '1.1',
                    preserveAspectRatio: 'none',
                },
                children: [{
                    name: 'defs'
                }, {
                    name: 'g',
                    class: 'sc-plot-regions',
                }, {
                    name: 'g',
                    class: 'sc-tooltip',
                }]
            });
            const tooltip = createHTML({
                name: 'div',
                class: 'sc-tooltip-positioner',
                children: [{
                    name: 'div',
                    class: 'sc-tooltip-box-wrap',
                    children: [{
                        name: 'div',
                        class: 'sc-tooltip-box',
                    }]
                }]
            });
            el.replaceChildren(svg, tooltip);
            el.parentSauceChart = this;
            this.childCharts.length = 0;
        } else {
            el.parentSauceChart.addChart(this);
        }
        this._rootSvgEl = el.querySelector('svg.sc-root');
        this._defsEl = this._rootSvgEl.querySelector(':scope > defs');
        this._tooltipGroupEl = this._rootSvgEl.querySelector(':scope > .sc-tooltip');
        this._tooltipPositionerEl = el.querySelector(':scope > .sc-tooltip-positioner'),
        this._tooltipBoxEl = this._tooltipPositionerEl.querySelector('.sc-tooltip-box');
        this._plotRegionEl = createSVG({name: 'g', class: 'sc-plot-region', data: {id: this.id}});
        if (this.color) {
            this._plotRegionEl.style.setProperty('--color', this.color);
            this._computedColor = null;
        }
        if (this.title) {
            const titleEl = createSVG({
                name: 'text',
                class: 'sc-title',
                x: 0,
                y: 10,
            });
            titleEl.textContent = this.title;
            this._plotRegionEl.append(titleEl);
        }
        this._rootSvgEl.querySelector('.sc-plot-regions').append(this._plotRegionEl);
        if (!this.xAxis.disabled) {
            this._xAxisEl = createSVG({
                name: 'g',
                class: ['sc-axis', 'sc-x-axis'],
                children: [{name: 'line', class: 'sc-baseline'}]
            });
            this._rootSvgEl.append(this._xAxisEl);
        }
        if (!this.yAxis.disabled) {
            this._yAxisEl = createSVG({
                name: 'g',
                class: ['sc-axis', 'sc-y-axis'],
                children: [{name: 'line', class: 'sc-baseline'}]
            });
            this._rootSvgEl.append(this._yAxisEl);
        }
        this._resizeObserver.observe(this._tooltipBoxEl);
        this._resizeObserver.observe(el);
        if (this.isParentChart() && !this.tooltip.disabled) {
            el.addEventListener('pointerenter', this._onPointerEnterBound);
        }
        this.afterSetElement(el);
        this.adjustSize();
        this.render();
    }

    /**
     * @protected
     */
    beforeSetElement() {}

    /**
     * @protected
     */
    afterSetElement() {}

    /**
     * Retrieve the computed CSS color for this chart
     *
     * @returns {external:CSS_Color}
     */
    getColor() {
        if (!this._computedColor) {
            this._computedColor = getStyleValue(this._plotRegionEl, '--color');
        }
        return this._computedColor;
    }

    /**
     * @returns {boolean}
     */
    isParentChart() {
        return this.el?.parentSauceChart === this;
    }

    /**
     * @protected
     * @params {Chart} chart
     */
    addChart(chart) {
        if (!this.isParentChart()) {
            throw new TypeError("only valid on parent");
        }
        this.childCharts.push(chart);
        chart.parentChart = this;
        for (const x of this.childCharts) {
            x._computedColor = null;
        }
        this._computedColor = null;
    }

    /**
     * @returns {Array<module:common.Chart>} All the charts sharing this chart's `el` property
     */
    getAllCharts() {
        const root = this.isParentChart() ? this : this.parentChart;
        return [root, ...root.childCharts];
    }

    localeNumber(value) {
        let localeConfig;
        if (value % 1 && value < 1e4) {
            localeConfig = {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
                useGrouping: 'min2',
            };
        } else if (value < 100) {
            localeConfig = {maximumFractionDigits: 1};
        } else {
            localeConfig = {
                useGrouping: 'min2',
                maximumFractionDigits: 0
            };
        }
        return value.toLocaleString(undefined, localeConfig);
    }

    /**
     * The default tooltip formatter
     *
     * @protected
     * @params {TooltipFormatOptions} options
     * @returns {(string|external:Element)} Tooltip contents
     */
    onTooltip({entry}) {
        if (!this._ttEntry) {
            this._ttEntry = document.createElement('div');
            this._ttEntry.className = 'sc-tooltip-entry';
            this._ttEntry.dataset.chartId = this.id;
            this._ttKey = document.createElement('key');
            this._ttValue = document.createElement('value');
            this._ttEntry.append(this._ttKey, this._ttValue);
        }
        this._ttEntry.style.setProperty('--color', entry.color ?? this.getColor());
        let key, value;
        if (this.tooltip.formatKey) {
            key = this.tooltip.formatKey({
                value: entry.x,
                index: entry.index,
                entry,
                chart: this
            });
        } else if (!isNaN(entry.x) && entry.x !== null) {
            if (this.xAxis.format) {
                key = this.xAxis.format({value: entry.x, chart: this});
            } else {
                key = this.localeNumber(entry.x);
            }
        }
        if (this.tooltip.format) {
            value = this.tooltip.format({
                value: entry.y,
                index: entry.index,
                entry,
                chart: this
            });
        } else if (!isNaN(entry.y) && entry.y !== null) {
            if (this.yAxis.format) {
                value = this.yAxis.format({value: entry.y, chart: this});
            } else {
                value = this.localeNumber(entry.y);
            }
        }
        this._ttKey.textContent = key ?? '';
        this._ttValue.textContent = value ?? '';
        return this._ttEntry;
    }

    /**
     * The default Axis Label formatter
     *
     * @protected
     * @params {AxisLabelOptions} options
     * @returns {string} Label contents
     */
    onAxisLabel({orientation, tick, tickCount, format}) {
        let range;
        let start;
        if (orientation === 'vertical') {
            start = this._yMin;
            range = this._yMax - this._yMin;
        } else {
            start = this._xMin;
            range = this._xMax - this._xMin;
        }
        const value = start + (range * (tick / (tickCount - 1)));
        if (isNaN(value) || value === null) {
            return '';
        }
        if (format) {
            return format({value, chart: this});
        } else {
            let localeConfig;
            if (range <= 1) {
                localeConfig = {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2
                };
            } else if (range < 100) {
                localeConfig = {maximumFractionDigits: 1};
            } else {
                localeConfig = {
                    useGrouping: 'min2',
                    maximumFractionDigits: 0
                };
            }
            return value.toLocaleString(undefined, localeConfig);
        }
    }

    onPointerEnter(ev) {
        if (!this.isTooltipAvailable() || this.isTooltipPointing() ||
            !this._renderData || !this._renderData.length) {
            return;
        }
        const state = this._establishTooltipState();
        const pointerAborter = state.pointerAborter = new AbortController();
        const signal = pointerAborter.signal;
        signal.addEventListener('abort', () => {
            setTimeout(() => {
                if (this._tooltipState.pointerAborter === pointerAborter) {
                    this.hideTooltip();
                }
            }, this.tooltip.linger);
        });
        // Cancel-esc pointer events are sloppy and unreliable (proven).  Kitchen sink...
        addEventListener('pointercancel', () => pointerAborter.abort(), {signal});
        addEventListener('pointerout', ev => !this.el.contains(ev.target) && pointerAborter.abort(),
                         {signal});
        this.el.addEventListener('pointerleave', () => pointerAborter.abort(), {signal});
        let af;
        this.el.addEventListener('pointermove', ev => {
            cancelAnimationFrame(af);
            const x = (ev.pageX - state.chartOffsets[0]) * this.devicePixelRatio;
            af = requestAnimationFrame(() => this._setTooltipPosition({x, internal: true}));
        }, {signal});
        const x = (ev.pageX - state.chartOffsets[0]) * this.devicePixelRatio;
        this._setTooltipPosition({x, disableAnimation: true, internal: true});
        this.showTooltip();
    }

    /**
     * Hide tooltip (if visible)
     */
    hideTooltip() {
        const state = this._tooltipState;
        if (state.pointerAborter && !state.pointerAborter.signal.aborted) {
            state.pointerAborter.abort();
        }
        if (!state.visible) {
            return;
        }
        this.el.classList.remove('sc-tooltip-active');
        state.visible = false;
    }

    /**
     * Show tooltip (if available)
     */
    showTooltip() {
        if (!this.isTooltipAvailable() || this._tooltipState.visible) {
            return;
        }
        const state = this._establishTooltipState();
        const posEl = this._tooltipPositionerEl;
        const hasAnim = !posEl.classList.contains('sc-disable-animation') &&
            !this.el.classList.contains('sc-disable-animation');
        if (hasAnim) {
            posEl.classList.add('sc-disable-animation');
        }
        this.el.classList.add('sc-tooltip-active');
        state.visible = true;
        if (hasAnim) {
            posEl.offsetWidth;
            posEl.classList.remove('sc-disable-animation');
        }
    }

    /**
     * Increment the tooltip's suspend reference count by 1.
     * While the tooltip suspend reference count is > 0 the tooltip will not be
     * available and thus won't be visible.
     */
    suspendTooltip() {
        this._tooltipState.suspendRefCnt++;
        if (this._tooltipState.visible) {
            this.hideTooltip();
        }
    }

    /**
     * Decrement the tooltip's suspend reference count by 1
     */
    resumeTooltip() {
        if (this._tooltipState.suspendRefCnt === 0) {
            throw new Error("not suspended");
        }
        this._tooltipState.suspendRefCnt--;
    }

    /**
     * @returns {boolean} Is the tooltip suspended or disabled
     */
    isTooltipAvailable() {
        return !this.tooltip.disabled && this._tooltipState.suspendRefCnt === 0;
    }

    /**
     * @returns {boolean} Is the tooltip actively handling pointer events
     */
    isTooltipPointing() {
        // i.e. Are we actively using pointer events to place the tooltip..
        return !!(
            this._tooltipState.visible &&
            this._tooltipState.pointerAborter &&
            !this._tooltipState.pointerAborter.signal.aborted
        );
    }

    _establishTooltipState() {
        const charts = this.getAllCharts();
        const chartRect = this.el.getBoundingClientRect();
        let positionCallback, hAlign, vAlign;
        if (typeof this.tooltip.position === 'function') {
            positionCallback = this.tooltip.position;
        } else {
            let tp = this.tooltip.position;
            if (typeof tp === 'string') {
                tp = tp.split(/\s+/);
            }
            hAlign = tp.find(x => ['left', 'center', 'right', 'leftright'].includes(x));
            vAlign = tp.find(x => ['above', 'top', 'middle', 'bottom', 'below'].includes(x)) || 'top';
            if (vAlign && !hAlign) {
                hAlign = {
                    below: 'center',
                    above: 'center',
                }[vAlign] || 'leftright';
            }
        }
        Object.assign(this._tooltipState, {
            charts,
            chartOffsets: [chartRect.x + scrollX, chartRect.y + scrollY],
            positionCallback,
            hAlign,
            vAlign,
            lastDrawSig: undefined,
            hasDrawn: false,
        });
        return this._tooltipState;
    }

    /**
     * Place the tooltip at specific data value coordinates or by data index
     *
     * @param {object} options
     * @param {XValue} [options.x]
     * @param {YValue} [options.y]
     * @param {number} [options.index] - Data index
     */
    setTooltipPosition(options) {
        this._establishTooltipState();
        return this._setTooltipPosition(options);
    }

    _setTooltipPosition({x, y, index, disableAnimation, internal=false}) {
        Object.assign(this._tooltipState, {x, y, index});
        this._updateTooltip({disableAnimation});
        queueMicrotask(() => this.dispatchEvent(new CustomEvent('tooltip', {
            detail: {
                x,
                y,
                index,
                internal,
                chart: this,
            }
        })));
    }

    /**
     * @protected
     */
    updateVisibleTooltip(options) {
        const root = this.isParentChart() ? this : this.parentChart;
        if (root && root._tooltipState.visible && root.isTooltipAvailable()) {
            root._updateTooltip(options);
        }
    }

    _updateTooltip(options={}) {
        const tooltips = [];
        const state = this._tooltipState;
        let drawSig = `${scrollX},${scrollY}`;
        for (let i = 0; i < state.charts.length; i++) {
            const chart = state.charts[i];
            let xRef = state.index != null ?
                chart.xValueToCoord(chart.normalizedData[state.index]?.x) :
                state.x;
            if (xRef >= chart._plotBox[1]) {
                xRef = chart._plotBox[1] - 1e-6;
            } else if (xRef <= chart._plotBox[3]) {
                xRef = chart._plotBox[3] + 1e-6;
            }
            const entry = chart.findNearestFromXCoord(xRef);
            if (entry === undefined || entry.x < chart._xMin || entry.x > chart._xMax) {
                continue;
            }
            const coordinates = [chart.xValueToCoord(entry.x), chart.yValueToCoord(entry.y)];
            tooltips.push({chart, entry, coordinates, contents: chart.onTooltip({entry})});
            drawSig += ` ${i} ${entry.index} ${coordinates[0]} ${coordinates[1]}`;
        }
        if (drawSig !== state.lastDrawSig) {
            state.lastDrawSig = drawSig;
            const posEl = this._tooltipPositionerEl;
            const disableAnim = (options.disableAnimation || !state.hasDrawn) &&
                (!posEl.classList.contains('sc-disable-animation') &&
                 !this.el.classList.contains('sc-disable-animation'));
            if (disableAnim) {
                posEl.classList.add('sc-disable-animation');
            }
            try {
                this._drawTooltip(tooltips);
            } finally {
                if (disableAnim) {
                    posEl.offsetWidth;
                    posEl.classList.remove('sc-disable-animation');
                }
            }
        }
    }

    _drawTooltip(tooltips) {
        if (!tooltips.length) {
            this._tooltipBoxEl.replaceChildren();
            return;
        }
        const state = this._tooltipState;
        const top = this.tooltip.padding[0] * this.devicePixelRatio;
        const bottom = this._boxHeight - this.tooltip.padding[1] * this.devicePixelRatio;
        const centerX = tooltips.reduce((agg, o) => agg + o.coordinates[0], 0) / tooltips.length;
        const centerY = top + (bottom - top) / 2;
        let vertLine = this._tooltipGroupEl.querySelector('.sc-line.sc-vertical');
        const existingHLines = this._tooltipGroupEl.querySelectorAll('.sc-line.sc-horizontal');
        const existingDots = this._tooltipGroupEl.querySelectorAll('circle.sc-highlight-dot');
        if (!vertLine) {
            vertLine = createSVG({name: 'path', class: ['sc-line', 'sc-vertical']});
            this._tooltipGroupEl.append(vertLine);
        }
        vertLine.setAttribute('d', `M ${centerX}, ${bottom} V ${top}`);
        let minX = this._boxWidth;
        let minY = this._boxHeight;
        let maxX = 0;
        let maxY = 0;
        let extraCount = 0;
        for (let i = 0; i < tooltips.length; i++) {
            const [x, y] = tooltips[i].coordinates;
            let dot = existingDots[i];
            if (!dot) {
                dot = createSVG({name: 'circle', class: 'sc-highlight-dot'});
                this._tooltipGroupEl.append(dot);
            }
            dot.setAttribute('cx', x);
            dot.setAttribute('cy', y);
            if (x > maxX) {
                maxX = x;
            }
            if (x < minX) {
                minX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
            if (y < minY) {
                minY = y;
            }
            if (Math.abs(x - centerX) > 1) {
                let horizLine = existingHLines[i];
                if (!horizLine) {
                    horizLine = createSVG({name: 'path', class: ['sc-line', 'sc-horizontal']});
                    this._tooltipGroupEl.prepend(horizLine);
                }
                horizLine.setAttribute(
                    'd', `M ${x}, ${y} L ${centerX}, ${Math.min(bottom, Math.max(y, top))}`);
                extraCount++;
            }
        }
        for (let i = extraCount; i < existingHLines.length; i++) {
            existingHLines[i].remove();
        }
        for (let i = tooltips.length; i < existingDots.length; i++) {
            existingDots[i].remove();
        }
        let vAlign, hAlign;
        if (state.positionCallback) {
            [vAlign, hAlign] = state.positionCallback({
                chart: this,
                minX,
                minY,
                maxX,
                maxY,
                tooltips
            });
        } else {
            hAlign = state.hAlign === 'leftright' ?
                (centerX >= this._boxWidth * 0.5 ? 'left' : 'right') :
                state.hAlign;
            vAlign = state.vAlign;
        }
        this._tooltipBoxEl.replaceChildren(...tooltips.map(x => x.contents));
        const posEl = this._tooltipPositionerEl;
        posEl.dataset.hAlign = hAlign;
        posEl.dataset.vAlign = vAlign;
        const f = 1 / this.devicePixelRatio;
        // The positioner element uses fixed position, so remove scroll offsets...
        const offtX = state.chartOffsets[0] - scrollX;
        const offtY = state.chartOffsets[1] - scrollY;
        posEl.style.setProperty('--x-left', `${minX * f + offtX}px`);
        posEl.style.setProperty('--x-right', `${maxX * f + offtX}px`);
        posEl.style.setProperty('--x-center', `${centerX * f + offtX}px`);
        posEl.style.setProperty('--y-center', `${centerY * f + offtY}px`);
        posEl.style.setProperty('--y-top', `${top * f + offtY}px`);
        posEl.style.setProperty('--y-bottom', `${bottom * f + offtY}px`);
        state.hasDrawn = true;
    }

    /**
     * Binary search for nearest data entry using a visual X coordinate
     *
     * @param {XCoord} searchX
     * @returns {DataObject}
     */
    findNearestFromXCoord(searchX) {
        if (isNaN(searchX) || searchX === null || !this._renderData || !this._renderData.length) {
            return;
        }
        const targetX = this.xCoordToValue(searchX);
        const len = this._renderData.length;
        let left = 0;
        let right = len - 1;
        for (let i = (len * 0.5) | 0;; i = ((right - left) * 0.5 + left) | 0) {
            const x = this._renderData[i].x;
            if (x > targetX) {
                right = i;
            } else if (x < targetX) {
                left = i;
            } else {
                return this._renderData[i];
            }
            if (right - left <= 1) {
                const lDist = targetX - this._renderData[left].x;
                const rDist = this._renderData[right].x - targetX;
                return this._renderData[lDist < rDist ? left : right];
            }
        }
    }

    /**
     * @param {object} options
     * @param {("data"|"visual")} [options.type="data"] - What coordinate scheme to use and how to keep this
     *                                                    zoom anchored when data is updated
     * @param {XRange} [options.xRange] - [start, end] coordinates (type=data only)
     * @param {YRange} [options.yRange] - [start, end] coordinates (type=data only)
     * @param {Coords} [options.translate] - [x, y] coordinate offsets (type=visual only)
     * @param {number} [options.scale] - Scaling factor (type=visual only)
     */
    setZoom(options) {
        this._zoomState.rev++;
        if (!options || options.type === null) {
            this._zoomState.active = false;
            this._zoomState.type = null;
            this._zoomState.translate = this._zoomState.scale = null;
            this._zoomState.xRange = this._zoomState.yRange = null;
        } else {
            const {xRange, yRange, translate, scale, type='data'} = options;
            if (type === 'data') {
                this._zoomState.translate = this._zoomState.scale = null;
                this._zoomState.xRange = xRange ?? null;
                this._zoomState.yRange = yRange ?? null;
            } else if (type === 'visual') {
                this._zoomState.xRange = this._zoomState.yRange = null;
                this._zoomState.translate = translate ?? null;
                this._zoomState.scale = scale ?? null;
            } else {
                throw new TypeError("invalid zoom type");
            }
            this._zoomState.active = true;
            this._zoomState.type = type;
        }
        this.render();
        queueMicrotask(() => this.dispatchEvent(new CustomEvent('zoom', {
            detail: {
                ...this._zoomState,
                internal: !!options?._internal,
                chart: this,
            }
        })));
    }

    /**
     * @param {ChartData} [data]
     * @param {object} [options]
     */
    setData(data, options={}) {
        this.data = data;
        this.normalizedData = this.normalizeData(data);
        if (options.render !== false) {
            this.render(options);
        }
    }

    /**
     * @protected
     *
     * @param {ChartData} data
     * @returns {Array<DataObject>}
     */
    normalizeData(data) {
        const norm = new Array(data.length);
        if (!data.length) {
            return norm;
        }
        if (Array.isArray(data[0])) {
            // [[x, y], [x1, y1], ...]
            for (let i = 0; i < data.length; i++) {
                norm[i] = {index: i, x: data[i][0] || 0, y: data[i][1] || 0};
            }
        } else if (typeof data[0] === 'object') {
            // [{x, y, ...}, {x, y, ...}, ...]
            for (let i = 0; i < data.length; i++) {
                const o = data[i];
                norm[i] = {...o, index: i, x: o.x || 0, y: o.y || 0};
            }
        } else {
            // [y, y1, ...]
            for (let i = 0; i < data.length; i++) {
                norm[i] = {index: i, x: i, y: data[i] || 0};
            }
        }
        return norm;
    }

    /**
     * Render the chart
     *
     * @param {object} [options]
     */
    render(options={}) {
        if (!this.el || !this._boxWidth || !this._boxHeight) {
            return;
        }
        if (!this.data || !this.data.length) {
            this.doReset();
            return;
        }
        options.disableAnimation = options.disableAnimation || this.disableAnimation;
        const manifest = this.beforeRender(options);
        this.adjustScale(manifest);
        if (this._zoomState.active && this._zoomState.type === 'visual') {
            // Get offsets and size before transforms...
            const xOfft = this._zoomState.translate ? this.xCoordScale(this._zoomState.translate[0]) : 0;
            const yOfft = this._zoomState.translate ? this.yCoordScale(this._zoomState.translate[1]) : 0;
            if (this._zoomState.scale) {
                this._xMax = this._xMin + (this._xMax - this._xMin) / this._zoomState.scale[0];
                this._yMax = this._yMin + (this._yMax - this._yMin) / this._zoomState.scale[1];
            }
            this._xMin += xOfft;
            this._xMax += xOfft;
            this._yMin += yOfft;
            this._yMax += yOfft;
        }
        this.doLayout(manifest, options);
        const axisSig = [
            this._xMin,
            this._xMax,
            this._yMin,
            this._yMax,
            this._plotWidth,
            this._plotHeight,
            this._zoomState.rev
        ].join('-');
        if (this._lastAxisSig !== axisSig) {
            this._lastAxisSig = axisSig;
            if (this._xAxisEl) {
                this._drawXAxis();
            }
            if (this._yAxisEl) {
                this._drawYAxis();
            }
        }
        this.afterRender(manifest, options);
    }

    /**
     * Called before any visual reflow/painting
     *
     * @protected
     */
    beforeRender(options) {
        let data = this.normalizedData;
        const resampling = data.length > this._plotWidth * 1.5;
        if (resampling) {
            data = resample(data, this._plotWidth | 0);
        }
        this._renderData = data;
        return {data, resampling};
    }

    /**
     * @protected
     */
    adjustScale({data}) {
        this._xMin = this.xMin;
        this._xMax = this.xMax;
        this._yMin = this.yMin;
        this._yMax = this.yMax;
        if (this._zoomState.active && this._zoomState.type === 'data') {
            if (this._zoomState.xRange) {
                this._xMin = this._zoomState.xRange[0];
                this._xMax = this._zoomState.xRange[1];
            }
            if (this._zoomState.yRange) {
                this._yMin = this._zoomState.yRange[0];
                this._yMax = this._zoomState.yRange[1];
            }
        }
        if (this._yMin == null || this._yMax == null) {
            let min = Infinity;
            let max = -Infinity;
            for (let i = 0; i < data.length; i++) {
                const v = data[i].y;
                if (v < min) {
                    min = v;
                }
                if (v > max) {
                    max = v;
                }
            }
            if (this._yMin == null) {
                this._yMin = min;
            }
            if (this._yMax == null) {
                this._yMax = max;
            }
        }
    }

    /**
     * @protected
     * @abstract
     */
    doLayout(manifest, options) {
        throw new Error("subclass impl required");
    }

    /**
     * @protected
     */
    afterRender(manifest, options) {
        this.updateVisibleTooltip();
    }

    /**
     * @param {XValue} value
     * @returns {XCoord}
     */
    xValueScale(value) {
        return value * (this._plotWidth / (this._xMax - this._xMin));
    }

    /**
     * @param {YValue} value
     * @returns {YCoord}
     */
    yValueScale(value) {
        return value * (this._plotHeight / (this._yMax - this._yMin));
    }

    /**
     * @param {XValue} value
     * @returns {XCoord}
     */
    xValueToCoord(value) {
        return (value - this._xMin) * (this._plotWidth / (this._xMax - this._xMin)) + this._plotBox[3];
    }

    /**
     * @param {YValue} value
     * @returns {YCoord}
     */
    yValueToCoord(value) {
        return this._plotBox[2] - ((value - this._yMin) * (this._plotHeight / (this._yMax - this._yMin)));
    }

    /**
     * @param {XCoord} coord
     * @returns {XValue}
     */
    xCoordScale(coord) {
        return coord / (this._plotWidth / (this._xMax - this._xMin));
    }

    /**
     * @param {YCoord} coord
     * @returns {YValue}
     */
    yCoordScale(coord) {
        return coord / (this._plotHeight / (this._yMax - this._yMin));
    }

    /**
     * @param {XCoord} coord
     * @returns {XValue}
     */
    xCoordToValue(coord) {
        return (coord - this._plotBox[3]) / (this._plotWidth / (this._xMax - this._xMin)) + this._xMin;
    }

    /**
     * @param {YCoord} coord
     * @returns {YValue}
     */
    yCoordToValue(coord) {
        return (this._plotBox[2] - coord) / (this._plotHeight / (this._yMax - this._yMin)) + this._yMin;
    }

    /**
     * Clear this charts data and rendering
     */
    reset() {
        if (this.data) {
            this.data.length = 0;
        }
        this._renderData = null;
        this._lastAxisSig = null;
        this.doReset();
    }

    /**
     * @protected
     * @abstract
     */
    doReset() {}

    /**
     * Create an SVG or CSS path
     *
     * @param {Coords} coords
     * @param {object} [options]
     * @param {boolean} [options.css] - CSS compatible output
     * @param {boolean} [options.closed] - Close the Path so it can be filled
     */
    makePath(coords, {css, closed}={}) {
        if (!coords.length) {
            return '';
        }
        let path = closed ?
            `M ${coords[0][0]},${this._plotBox[2]} V ${coords[0][1]}` :
            `M ${coords[0][0]},${coords[0][1]}`;
        for (let i = 1; i < coords.length; i++) {
            path += ` L ${coords[i][0]},${coords[i][1]}`;
        }
        if (closed) {
            path += ` V ${this._plotBox[2]} Z`;
        }
        return css ? `path('${path}')` : path;
    }
}
