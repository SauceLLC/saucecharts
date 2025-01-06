import * as sc from '../src/index.mjs';

function ts() {
    //return Date.now();
    return 1e1 + Math.round(performance.now());
}

let paused = false;
let tests = [1, 2, 3, 4, 5, 6, 7, 8];
const speed = 1000;
const maxSize = 40;
let sinFactor = speed / Number(document.querySelector('#freq').value);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const commonOptions = {
    hidePoints: false,
    padding: [5, 10, 15, 20],
};

document.querySelector('#freq').addEventListener('input', ev => {
    const f = Number(ev.currentTarget.value);
    console.log('freq', f, maxSize / f);
    sinFactor = speed / f;
});

let dir = 1;
let steps = 0;
/*setInterval(() => {
    if ((steps++) > 2) {
        dir = -dir;
        steps = 0;
    }
    maxSize += dir;
}, speed * 2);*/

if (tests.includes(1)) {
    const data = [];
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i1"),
        title: 'ltr',
    });
    setInterval(() => {
        if (paused) return;
        data.push([ts(), Math.sin(ts() / sinFactor)]);
        while (data.length > maxSize) {
            data.shift();
        }
        sl.setData(data);
    }, speed);
}


if (tests.includes(2)) {
    const data = [];
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i2"),
        title: 'ltr, 3 points per interval',
    });
    setInterval(async () => {
        if (paused) return;
        data.push([ts(), Math.sin(ts() / sinFactor)]);
        await sleep(speed / 3);
        data.push([ts(), Math.sin(ts() / sinFactor)]);
        await sleep(speed / 3);
        data.push([ts(), Math.sin(ts() / sinFactor)]);
        while (data.length > maxSize * 3) {
            data.shift();
        }
        sl.setData(data);
    }, speed);
}


if (tests.includes(3)) {
    const data = [];
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i3"),
        title: 'rtl',
    });
    setInterval(() => {
        if (paused) return;
        data.unshift([-ts(), Math.sin(ts() / sinFactor)]);
        while (data.length > maxSize) {
            data.pop();
        }
        sl.setData(data);
    }, speed);
}


if (tests.includes(4)) {
    const data = [];
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i4"),
        title: 'rtl, 2 points per interval',
    });
    setInterval(async () => {
        if (paused) return;
        data.unshift([-ts(), Math.sin(ts() / sinFactor)]);
        await sleep(speed / 2);
        data.unshift([-ts(), Math.sin(ts() / sinFactor)]);
        while (data.length > maxSize * 2) {
            data.pop();
        }
        sl.setData(data);
    }, speed);
}


if (tests.includes(5)) {
    const data = new Array(maxSize);
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i5"),
        title: 'random, same size',
    });
    setInterval(() => {
        if (paused) return;
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random();
        }
        sl.setData(data);
    }, speed);
}


if (tests.includes(6)) {
    const data = new Array(maxSize);
    const sl = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i6"),
        title: 'random, random size',
    });
    setInterval(() => {
        if (paused) return;
        data.length = Math.random() * maxSize * 2 | 0;
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random();
        }
        sl.setData(data);
    }, speed);
}

if (tests.includes(7)) {
    const data1 = [];
    const data2 = [];
    const data3 = [];
    const data4 = [];

    const sl1 = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i7"),
        padding: [10, 0, 0, 0],
        title: 'Multiple graphs',
    });
    const sl2 = new sc.BarChart({
        ...commonOptions,
        el: sl1.el,
        merge: true,
        padding: [sl1.padding[0] + 30, 0, 0, 0],
    });
    const sl3 = new sc.BarChart({
        ...commonOptions,
        el: sl1.el,
        merge: true,
        padding: [sl2.padding[0] + 30, 0, 0, 0],
    });
    const sl4 = new sc.BarChart({
        ...commonOptions,
        el: sl1.el,
        merge: true,
        padding: [sl3.padding[0] + 30, 0, 0, 0],
    });

    setInterval(() => {
        if (paused) return;
        data1.push([ts(), Math.sin(ts() / sinFactor)]);
        while (data1.length > maxSize) {
            data1.shift();
        }
        sl1.setData(data1);

        data2.unshift([-ts(), Math.sin(ts() / sinFactor)]);
        while (data2.length > maxSize) {
            data2.pop();
        }
        sl2.setData(data2);

        data3.push([ts(), Math.cos(ts() / sinFactor)]);
        while (data3.length > maxSize) {
            data3.shift();
        }
        sl3.setData(data3);

        data4.unshift([-ts(), Math.cos(ts() / sinFactor)]);
        while (data4.length > maxSize) {
            data4.pop();
        }
        sl4.setData(data4);
    }, speed);
}


if (tests.includes(8)) {
    const size = 100;
    let i = size;
    const data = Array.from(new Array(size)).map((x, i) => Math.sin(i / 50));
    const sl = new sc.BarChart({
        ...commonOptions,
        hidePoints: true,
        el: document.querySelector(".graph.i8"),
        title: 'large-data',
    });
    setInterval(() => {
        if (paused) return;
        i++;
        data.push(Math.sin(i / 50));
        while (data.length > size) {
            data.shift();
        }
        sl.setData(data);
    }, speed);
}


document.querySelector('#playpause').addEventListener('click', () => {
    paused = !paused;
});
