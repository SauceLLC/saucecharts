import * as sc from '../src/index.mjs';

function ts() {
    //return Date.now();
    return 1e1 + Math.round(performance.now());
}

let paused = false;
let tests = [1, 2];
const speed = 1000;
const maxSize = 4000;
let sinFactor = speed / Number(document.querySelector('#freq').value);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const commonOptions = {
    hidePoints: false,
    padding: [5, 5, 5, 5],
};

document.querySelector('#freq').addEventListener('input', ev => {
    const f = Number(ev.currentTarget.value);
    console.log('freq', f, maxSize / f);
    sinFactor = speed / f;
});

if (tests.includes(1)) {
    const data = [];
    const c1 = new sc.BarChart({
        ...commonOptions,
        el: document.querySelector(".graph.i1"),
        title: 'ltr',
        disableAnimation: true,
        barSpacing: 0,
    });
    /*const c2 = new sc.LineChart({
        ...commonOptions,
        el: document.querySelector(".graph.i1"),
        merge: true,
        title: 'ltr',
        hidePoints: true,
        disableAnimation: true,
    });*/
    setInterval(() => {
        if (paused) return;
        const x = ts();
        data.push([x, Math.sin(x / sinFactor)]);
        while (data.length > maxSize) {
            data.shift();
        }
        c1.setData(data);
        //c2.setData(data);
        if (data.length % 100 === 0) {
            console.log('c1', performance.now() / data.length, data.length);
        }
    }, 0/*speed*/);
}


if (tests.includes(2)) {
    const data = [];
    const segments = [];
    const sl = new sc.LineChart({
        ...commonOptions,
        el: document.querySelector(".graph.i2"),
        title: 'segments',
        disableAnimation: true,
        hidePoints: true,
    });
    setInterval(async () => {
        if (paused) return;
        const x = ts();
        const y = Math.sin(x / sinFactor);
        data.push([x, y]);
        segments.push({
            x: x,
            width: data.length > 1 ? x - data[data.length - 2][0] : 0,
            color: ['blue', 'red', 'green', 'ping', 'orange', 'yellow'][data.length % 5],
        });
        while (data.length > maxSize) {
            data.shift();
            segments.shift();
        }
        sl.setData(data);
        sl.setSegments(segments);
        if (data.length % 100 === 0) {
            console.log('c2', performance.now() / data.length, data.length);
        }
    }, 0 /*speed*/);
}


document.querySelector('#playpause').addEventListener('click', () => {
    paused = !paused;
});
