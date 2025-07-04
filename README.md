Sauce Charts
========
Simple, modern, web chart library

[![Docs](https://img.shields.io/badge/API-documentation-blue)](https://saucellc.github.io/saucecharts/docs)
[![Version](https://img.shields.io/github/package-json/v/saucellc/saucecharts)](https://github.com/SauceLLC/saucecharts)
[![GitHub](https://img.shields.io/badge/GitHub-Source-lightgrey)](https://github.com/SauceLLC/saucecharts)

 * Charts:
    * Line Chart
    * Bar Chart
 * Renders to SVG
 * Dynamic resizing and placement in flexible DOM containers
 * CSS transitions
 * CSS styling and customization (devicePixelRatio aware)
 * High performance data updating
 * Large dataset support (lttb resampling)
 * Brushing and Zooming by data range or visual ranges
 * Customizable HTML tooltips


Compatibility
--------
 * Chromium and Firefox: Fully supported
 * Safari (webkit): limited animations (as of 05-2025)
 

Examples
--------
Simple Line Chart
```javascript
import {LineChart} from '../src/index.mjs';
const sl = new LineChart({
    el: document.body
});
sl.setData([0,10,20,10,0,-10,-20,-10,0,10,20,10,0]);
```
[Try it](examples/simple-line.html)


Simple Bar Chart
```javascript
import {BarChart} from '../src/index.mjs';
const sl = new BarChart({
    el: document.body
});
sl.setData([0,10,20,10,0,-10,-20,-10,0,10,20,10,0]);
```
[Try it](examples/simple-bar.html)


Demos...
--------
 * [Demo 1](examples/demo1.html) Line charts
 * [Demo 2](examples/demo2.html) Bar charts
 * [Demo 3](examples/demo3.html) Composite charts, line chart segments
 * [Demo 4](examples/demo4.html) Manual y range bar chart
 * [Demo 5](examples/demo5.html) Axis options
 * [Performance test - 100](examples/perf.html?size=100) Stress test for large data sizes and fast updating
 * [Performance test - 1,000](examples/perf.html?size=1000)
 * [Performance test - 10,000](examples/perf.html?size=10000)
 * [Performance test - 100,000](examples/perf.html?size=100000)
 * [Performance test - 1,000,000](examples/perf.html?size=1000000)
