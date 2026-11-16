(function () {
    'use strict';

    var root = document.documentElement;

    // 函式庫沒載到時（例如 CDN 失敗），退回一般的靜態頁面，不要讓內容卡在隱藏狀態
    if (!window.gsap || !window.barba) {
        root.classList.remove('js', 'is-snap');
        return;
    }
    root.classList.add('js-ready');

    /* ------------------------------------------------------------------
       可調整的參數都集中在這裡
       ------------------------------------------------------------------ */
    var CONFIG = {
        // 啟用「一次滑一個區塊」的條件：有滑鼠的桌機、視窗夠大
        snapQuery: '(hover: hover) and (pointer: fine) and (min-width: 1024px) and (min-height: 560px)',
        snapDuration: 1.0,      // 區塊之間滑動的秒數
        snapEase: 'power3.inOut',
        minFitScale: 0.72,      // 內容放不下時最多縮到多小，再小就改回一般滑動

        curtain: {
            cover: 0.85,        // 每一層蓋上來的秒數
            open: 0.85,         // 每一層離開的秒數
            layerGap: 0.11,     // 三層之間的時間差
            hold: 0.45,         // 完全蓋住、楓葉飄過時停留的秒數
            wave: 7             // 簾幕邊緣波浪的高度（0 = 直線）
        },

        leaf: {
            enabled: true,
            max: 2,                 // 畫面上同時最多幾片
            maxMobile: 1,
            size: [40, 80],         // px
            sizeMobileMax: 56,
            opacity: [0.2, 0.38],
            fall: [12, 18],         // 落完一個畫面的秒數
            interval: [4, 9],       // 兩片之間的等待秒數
            sway: [30, 60],         // 左右搖擺的振幅 px
            swayPeriod: [3, 5],     // 搖擺一次的秒數
            colors: ['#C4674B', '#CF8A4A', '#B5533C']
        }
    };

    var snapMq = window.matchMedia(CONFIG.snapQuery);
    var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    function prefersReducedMotion() {
        return reduceMq.matches;
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    /* ------------------------------------------------------------------
       導覽列：目前頁面標記、漢堡選單
       ------------------------------------------------------------------ */
    var PAGES = ['about', 'skills', 'favorites'];

    function pageKey(href) {
        var a = document.createElement('a');
        a.href = href;
        var last = a.pathname.replace(/\/+$/, '').split('/').pop().replace(/\.html$/, '');
        return PAGES.indexOf(last) !== -1 ? last : 'home';
    }

    function updateNav() {
        var current = pageKey(window.location.href);
        document.querySelectorAll('.nav a').forEach(function (link) {
            var isCurrent = pageKey(link.href) === current;
            link.classList.toggle('is-current', isCurrent);
            if (isCurrent) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }

    // 關閉漢堡選單
    function closeHamburgerMenu() {
        var checkbox = document.querySelector('.checkbox-toggle');
        if (checkbox && checkbox.checked) {
            checkbox.checked = false;
        }
    }

    // 點擊目前所在頁面的連結時不換頁
    document.querySelectorAll('.nav a').forEach(function (link) {
        link.addEventListener('click', function (e) {
            if (pageKey(link.href) === pageKey(window.location.href)) {
                e.preventDefault();
                closeHamburgerMenu();
            }
        });
    });

    /* ------------------------------------------------------------------
       圖片懶加載
       ------------------------------------------------------------------ */
    function advancedLazyLoad() {
        var images = document.querySelectorAll('.imgAll');
        var imageQueue = [];
        var maxConcurrentLoads = 3; // 最大同時載入圖片數量
        var currentLoads = 0;

        function loadImage(img) {
            return new Promise(function (resolve) {
                var src = img.getAttribute('data-src');
                if (!src || img.getAttribute('src') === src) {
                    resolve();
                    return;
                }
                img.onload = function () {
                    img.style.opacity = '1';
                    currentLoads--;
                    resolve();
                };
                img.onerror = function () {
                    console.error('Failed to load image: ' + src);
                    currentLoads--;
                    resolve();
                };
                img.src = src;
            });
        }

        async function processQueue() {
            while (imageQueue.length > 0 && currentLoads < maxConcurrentLoads) {
                var img = imageQueue.shift();
                currentLoads++;
                await loadImage(img);
            }
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    imageQueue.push(entry.target);
                    observer.unobserve(entry.target);
                }
            });
            processQueue();
        }, {
            rootMargin: '300px',
            threshold: 0
        });

        images.forEach(function (img) {
            if (!img.getAttribute('src')) {
                img.style.opacity = '0';
                img.style.transition = 'opacity 1s ease-in-out';
                observer.observe(img);
            }
        });
    }

    /* ------------------------------------------------------------------
       區塊：全畫面、一次滑一個、進場動畫
       ------------------------------------------------------------------ */
    var Panels = (function () {
        var container = null;
        var panels = [];
        var index = 0;
        var step = 0;
        var base = 0;
        var snap = false;
        var animating = false;
        var coasting = false;   // 上一次滑動後，觸控板的慣性滾動還沒結束
        var lastWheelTime = 0;
        var lastWheelAbs = 0;
        var unlockAt = 0;
        var tween = null;
        var dots = null;
        var io = null;
        var scrollTimer = null;
        var resizeTimer = null;
        var refitTimer = null;
        var locked = false;     // 換頁轉場進行中

        var REVEAL_SELECTOR = '[data-reveal], [data-reveal-children] > *';

        function reveal(panel, delay) {
            if (!panel || panel.__revealed) {
                return;
            }
            panel.__revealed = true;
            var items = panel.querySelectorAll(REVEAL_SELECTOR);
            if (!items.length) {
                return;
            }
            if (prefersReducedMotion()) {
                gsap.set(items, { opacity: 1 });
                return;
            }
            gsap.fromTo(items,
                { opacity: 0, y: 24 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.7,
                    stagger: Math.min(0.08, 0.9 / items.length),
                    ease: 'power3.out',
                    delay: delay || 0,
                    clearProps: 'transform'
                });
        }

        // 內容比一個畫面高時，等比例縮小到剛好放得下；差太多就放棄吸附
        function fit() {
            var ok = true;
            panels.forEach(function (panel) {
                var inner = panel.querySelector('.panel__inner');
                if (!inner) {
                    return;
                }
                inner.style.transform = '';
                var cs = window.getComputedStyle(panel);
                var avail = panel.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
                var needed = inner.offsetHeight;
                if (needed > avail + 1) {
                    var scale = avail / needed;
                    if (scale < CONFIG.minFitScale) {
                        ok = false;
                    } else {
                        inner.style.transform = 'scale(' + scale.toFixed(4) + ')';
                    }
                }
            });
            if (!ok) {
                clearFit();
            }
            return ok;
        }

        function clearFit() {
            panels.forEach(function (panel) {
                var inner = panel.querySelector('.panel__inner');
                if (inner) {
                    inner.style.transform = '';
                }
            });
        }

        function measure() {
            step = panels[0].offsetHeight;
            if (window.scrollY === 0) {
                base = panels[0].getBoundingClientRect().top;
            }
        }

        function targetOf(i) {
            return base + i * step;
        }

        function updateDots() {
            if (!dots) {
                return;
            }
            Array.prototype.forEach.call(dots.children, function (dot, i) {
                if (i === index) {
                    dot.setAttribute('aria-current', 'true');
                } else {
                    dot.removeAttribute('aria-current');
                }
            });
            var hint = container && container.querySelector('.scroll-hint');
            if (hint) {
                gsap.to(hint, { autoAlpha: index === 0 ? 1 : 0, duration: 0.3 });
            }
        }

        function buildDots() {
            removeDots();
            if (panels.length < 2) {
                return;
            }
            dots = document.createElement('div');
            dots.className = 'panel-dots';
            panels.forEach(function (panel, i) {
                var dot = document.createElement('button');
                dot.type = 'button';
                dot.setAttribute('aria-label', 'Go to section ' + (i + 1) + ' of ' + panels.length);
                dot.addEventListener('click', function () {
                    go(i);
                });
                dots.appendChild(dot);
            });
            document.body.appendChild(dots);
            updateDots();
        }

        function removeDots() {
            if (dots) {
                dots.remove();
                dots = null;
            }
        }

        function go(i, force) {
            if (!snap || locked) {
                return;
            }
            i = clamp(i, 0, panels.length - 1);
            if (i === index && !force) {
                return;
            }
            index = i;
            updateDots();
            reveal(panels[i], 0.35);

            if (tween) {
                tween.kill();
            }
            var state = { y: window.scrollY };
            var target = targetOf(i);
            if (prefersReducedMotion()) {
                window.scrollTo(0, target);
                return;
            }
            animating = true;
            tween = gsap.to(state, {
                y: target,
                duration: CONFIG.snapDuration,
                ease: CONFIG.snapEase,
                onUpdate: function () {
                    window.scrollTo(0, state.y);
                },
                onComplete: function () {
                    animating = false;
                    coasting = true;
                    unlockAt = performance.now() + 150;
                    tween = null;
                }
            });
        }

        function onWheel(e) {
            if (!snap || e.ctrlKey) {
                return;
            }
            e.preventDefault();

            var now = performance.now();
            var gap = now - lastWheelTime;
            var abs = Math.abs(e.deltaY);
            var prevAbs = lastWheelAbs;
            lastWheelTime = now;
            lastWheelAbs = abs;

            if (locked || animating || now < unlockAt || abs < 4) {
                return;
            }
            // 觸控板放開後還會持續送出越來越小的滾動事件，那些不算新的一次滑動
            if (coasting) {
                if (gap < 80 && abs <= prevAbs + 20) {
                    return;
                }
                coasting = false;
            }
            go(index + (e.deltaY > 0 ? 1 : -1));
        }

        function onKeydown(e) {
            if (!snap || locked || e.altKey || e.ctrlKey || e.metaKey) {
                return;
            }
            var tag = (e.target && e.target.tagName) || '';
            if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) {
                return;
            }
            var next = null;
            switch (e.key) {
                case 'ArrowDown':
                case 'PageDown':
                    next = index + 1;
                    break;
                case 'ArrowUp':
                case 'PageUp':
                    next = index - 1;
                    break;
                case ' ':
                    if (tag === 'BUTTON' || tag === 'A') {
                        return;
                    }
                    next = index + (e.shiftKey ? -1 : 1);
                    break;
                case 'Home':
                    next = 0;
                    break;
                case 'End':
                    next = panels.length - 1;
                    break;
                default:
                    return;
            }
            e.preventDefault();
            if (!animating) {
                go(next);
            }
        }

        // 用 Tab 鍵、觸控螢幕或其他方式捲動後，對齊回最近的區塊
        function onScroll() {
            if (!snap || animating || locked) {
                return;
            }
            window.clearTimeout(scrollTimer);
            scrollTimer = window.setTimeout(function () {
                if (!snap || animating || locked || !step) {
                    return;
                }
                var nearest = clamp(Math.round((window.scrollY - base) / step), 0, panels.length - 1);
                if (Math.abs(window.scrollY - targetOf(nearest)) > 2) {
                    go(nearest, true);
                } else if (nearest !== index) {
                    index = nearest;
                    updateDots();
                    reveal(panels[index], 0);
                }
            }, 160);
        }

        function onResize() {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(function () {
                if (!container || locked) {
                    return;
                }
                var keep = index;
                setup();
                if (snap) {
                    index = clamp(keep, 0, panels.length - 1);
                    window.scrollTo(0, targetOf(index));
                    updateDots();
                    reveal(panels[index], 0);
                }
            }, 150);
        }

        function scheduleRefit() {
            window.clearTimeout(refitTimer);
            refitTimer = window.setTimeout(function () {
                if (snap && !animating && !locked) {
                    if (!fit()) {
                        onResize();
                    }
                }
            }, 60);
        }

        // 依目前的視窗大小決定要不要吸附，並量好尺寸
        function setup() {
            if (tween) {
                tween.kill();
                tween = null;
            }
            animating = false;
            removeDots();
            if (io) {
                io.disconnect();
                io = null;
            }

            snap = snapMq.matches && panels.length > 0;
            root.classList.toggle('is-snap', snap);

            if (snap) {
                window.scrollTo(0, 0);
                if (!fit()) {
                    snap = false;
                    root.classList.remove('is-snap');
                }
            } else {
                clearFit();
            }

            if (snap) {
                measure();
                buildDots();
            } else if ('IntersectionObserver' in window) {
                io = new IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting) {
                            reveal(entry.target, 0);
                            io.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.12 });
                panels.forEach(function (panel) {
                    if (!panel.__revealed) {
                        io.observe(panel);
                    }
                });
            } else {
                panels.forEach(function (panel) {
                    reveal(panel, 0);
                });
            }
        }

        function init(nextContainer, firstDelay) {
            destroy();
            container = nextContainer;
            panels = Array.prototype.slice.call(container.querySelectorAll('.panel'));
            index = 0;
            if ('scrollRestoration' in window.history) {
                window.history.scrollRestoration = 'manual';
            }
            setup();
            if (snap) {
                reveal(panels[0], firstDelay);
            }
            container.querySelectorAll('img').forEach(function (img) {
                if (!img.complete) {
                    img.addEventListener('load', scheduleRefit, { once: true });
                }
            });
        }

        function destroy() {
            if (tween) {
                tween.kill();
                tween = null;
            }
            animating = false;
            coasting = false;
            removeDots();
            if (io) {
                io.disconnect();
                io = null;
            }
            window.clearTimeout(scrollTimer);
            window.clearTimeout(resizeTimer);
            window.clearTimeout(refitTimer);
            container = null;
            panels = [];
            snap = false;
        }

        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('keydown', onKeydown);
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleRefit);
        }

        return {
            init: init,
            destroy: destroy,
            lock: function (value) {
                locked = value;
            }
        };
    })();

    /* ------------------------------------------------------------------
       換頁轉場：由下往上的三層紙張簾幕，邊緣是手撕紙般的波浪
       ------------------------------------------------------------------ */
    var Curtain = (function () {
        var SVG_NS = 'http://www.w3.org/2000/svg';

        var el = document.createElement('div');
        el.className = 'curtain';
        el.setAttribute('aria-hidden', 'true');

        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');

        // 由下層到上層：楓紅、暖米、奶油
        var layers = ['accent', 'sand', 'paper'].map(function (name, i) {
            var path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('class', 'curtain__layer curtain__layer--' + name);
            svg.appendChild(path);
            // 每一層的波浪方向交錯，三條邊才不會完全重疊
            return { path: path, sign: i % 2 === 0 ? 1 : -1, state: { p: 0 } };
        });

        var leaf = document.createElement('div');
        leaf.className = 'curtain__leaf';

        el.appendChild(svg);
        el.appendChild(leaf);
        document.body.appendChild(el);

        // p = 0 到 1。from 'bottom'：從底部長上來；from 'top'：往頂端收走
        function draw(layer, from) {
            var p = layer.state.p;
            var amp = Math.sin(Math.PI * p) * CONFIG.curtain.wave * layer.sign;
            var d;
            if (from === 'bottom') {
                var y = 100 - p * 100;
                d = 'M 0 100 V ' + y.toFixed(2) +
                    ' Q 12.5 ' + (y - amp).toFixed(2) + ' 25 ' + y.toFixed(2) +
                    ' T 50 ' + y.toFixed(2) + ' T 75 ' + y.toFixed(2) + ' T 100 ' + y.toFixed(2) +
                    ' V 100 Z';
            } else {
                var edge = 100 - p * 100;
                d = 'M 0 0 V ' + edge.toFixed(2) +
                    ' Q 12.5 ' + (edge + amp).toFixed(2) + ' 25 ' + edge.toFixed(2) +
                    ' T 50 ' + edge.toFixed(2) + ' T 75 ' + edge.toFixed(2) + ' T 100 ' + edge.toFixed(2) +
                    ' V 0 Z';
            }
            layer.path.setAttribute('d', d);
        }

        function cover(oldContainer) {
            var c = CONFIG.curtain;
            return new Promise(function (resolve) {
                if (prefersReducedMotion()) {
                    gsap.to(oldContainer, { opacity: 0, duration: 0.2, onComplete: resolve });
                    return;
                }
                el.classList.add('is-active');
                leaf.textContent = '';
                leaf.appendChild(Leaves.createArt());
                gsap.set(leaf, { opacity: 0, y: -46, rotation: -24 });

                var tl = gsap.timeline({ onComplete: resolve });
                tl.to(oldContainer, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 0);
                layers.forEach(function (layer, i) {
                    layer.state.p = 0;
                    draw(layer, 'bottom');
                    tl.to(layer.state, {
                        p: 1,
                        duration: c.cover,
                        ease: 'power3.inOut',
                        onUpdate: function () {
                            draw(layer, 'bottom');
                        }
                    }, i * c.layerGap);
                });
                // 蓋滿後，一片楓葉在中央緩緩飄過
                var covered = c.cover + c.layerGap * (layers.length - 1);
                tl.to(leaf, { opacity: 0.85, duration: 0.35, ease: 'power1.out' }, covered - 0.3);
                tl.to(leaf, { y: 0, rotation: 6, duration: 0.3 + c.hold, ease: 'sine.inOut' }, covered - 0.3);
            });
        }

        function open(newContainer) {
            var c = CONFIG.curtain;
            return new Promise(function (resolve) {
                if (prefersReducedMotion()) {
                    gsap.fromTo(newContainer, { opacity: 0 }, { opacity: 1, duration: 0.2, onComplete: resolve });
                    return;
                }
                var tl = gsap.timeline({
                    onComplete: function () {
                        el.classList.remove('is-active');
                        resolve();
                    }
                });
                tl.to(leaf, { opacity: 0, y: 40, rotation: 26, duration: 0.45, ease: 'power1.in' }, 0);
                // 最上層先走，露出下面兩層的顏色，最後才看到新頁面
                layers.slice().reverse().forEach(function (layer, i) {
                    layer.state.p = 0;
                    draw(layer, 'top');
                    tl.to(layer.state, {
                        p: 1,
                        duration: c.open,
                        ease: 'power3.inOut',
                        onUpdate: function () {
                            draw(layer, 'top');
                        }
                    }, 0.1 + i * c.layerGap);
                });
            });
        }

        // 新頁面的內容大約在簾幕離開到一半時開始出現
        function revealDelay() {
            return prefersReducedMotion() ? 0 : 0.1 + CONFIG.curtain.open * 0.55;
        }

        return { cover: cover, open: open, revealDelay: revealDelay };
    })();

    /* ------------------------------------------------------------------
       手繪楓葉：偶爾一片緩緩飄落、慢慢淡出（不跟滑鼠互動）
       想換成自己的圖：改 Leaves.createArt() 讓它回傳自己的 <svg> 或 <img> 即可
       ------------------------------------------------------------------ */
    var Leaves = (function () {
        var SVG_NS = 'http://www.w3.org/2000/svg';
        var C = CONFIG.leaf;
        var layer = null;
        var leaves = [];
        var nextSpawnAt = 0;
        var gutter = 0;         // favorites 頁：卡片左右留白的寬度，楓葉只落在這裡
        var clock = 0;

        // 楓葉右半邊的輪廓（100 x 100 的畫布，左半邊鏡射產生）
        var HALF = [
            [50, 4], [55, 18], [62, 13], [59, 35], [71, 27], [73, 36], [93, 30],
            [86, 42], [94, 49], [78, 58], [85, 70], [64, 66], [53, 73]
        ];
        var VEINS = [[50, 12], [86, 32], [14, 32], [79, 67], [21, 67]];

        function outlinePoints() {
            var pts = HALF.slice();
            for (var i = HALF.length - 1; i >= 1; i--) {
                pts.push([100 - HALF[i][0], HALF[i][1]]);
            }
            return pts;
        }

        // 每個點加一點隨機偏移，邊線微微內凹，畫出來才不會像電腦圖示
        function sketchPath(jitter) {
            var pts = outlinePoints().map(function (p) {
                return [p[0] + rand(-jitter, jitter), p[1] + rand(-jitter, jitter)];
            });
            var d = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
            for (var i = 1; i <= pts.length; i++) {
                var a = pts[i - 1];
                var b = pts[i % pts.length];
                var mx = (a[0] + b[0]) / 2;
                var my = (a[1] + b[1]) / 2;
                var cx = mx + (50 - mx) * 0.1 + rand(-jitter, jitter);
                var cy = my + (46 - my) * 0.1 + rand(-jitter, jitter);
                d += ' Q ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
            }
            return d + ' Z';
        }

        function svgEl(tag, attrs) {
            var node = document.createElementNS(SVG_NS, tag);
            Object.keys(attrs).forEach(function (key) {
                node.setAttribute(key, attrs[key]);
            });
            return node;
        }

        function createArt() {
            var color = C.colors[Math.floor(Math.random() * C.colors.length)];
            var svg = svgEl('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' });

            // 水彩色塊：故意和線稿錯開一點
            svg.appendChild(svgEl('path', {
                d: sketchPath(1.6),
                fill: color,
                'fill-opacity': '0.62',
                transform: 'translate(' + rand(-2, 2).toFixed(1) + ' ' + rand(-1.5, 2).toFixed(1) + ')'
            }));

            // 線稿畫兩次，兩次略有不同，像鉛筆來回描過
            for (var pass = 0; pass < 2; pass++) {
                svg.appendChild(svgEl('path', {
                    d: sketchPath(pass === 0 ? 0.9 : 1.5),
                    fill: 'none',
                    stroke: '#2B2926',
                    'stroke-opacity': pass === 0 ? '0.75' : '0.4',
                    'stroke-width': pass === 0 ? '1.3' : '0.9',
                    'stroke-linejoin': 'round',
                    'stroke-linecap': 'round'
                }));
            }

            // 葉脈與葉柄
            var veins = '';
            VEINS.forEach(function (tip) {
                var ex = 50 + (tip[0] - 50) * 0.84 + rand(-1, 1);
                var ey = 71 + (tip[1] - 71) * 0.84 + rand(-1, 1);
                var cx = (50 + ex) / 2 + rand(-3, 3);
                var cy = (71 + ey) / 2 + rand(-3, 3);
                veins += 'M 50 71 Q ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ' ';
            });
            veins += 'M 50 70 Q ' + rand(47, 53).toFixed(1) + ' 84 ' + rand(46, 54).toFixed(1) + ' 97';
            svg.appendChild(svgEl('path', {
                d: veins,
                fill: 'none',
                stroke: '#2B2926',
                'stroke-opacity': '0.55',
                'stroke-width': '1',
                'stroke-linecap': 'round'
            }));

            return svg;
        }

        function maxLeaves() {
            return window.innerWidth < 768 ? C.maxMobile : C.max;
        }

        function spawn() {
            var w = window.innerWidth;
            var h = window.innerHeight;
            var size = rand(C.size[0], w < 768 ? Math.min(C.sizeMobileMax, C.size[1]) : C.size[1]);
            // 避開中央 30% 的寬度，優先落在左右兩側的留白
            var x = Math.random() < 0.5 ? rand(0.04, 0.33) * w : rand(0.67, 0.96) * w;
            var amp = rand(C.sway[0], C.sway[1]);

            // favorites：只落在卡片外側的留白，飄到卡片範圍時會被卡片蓋住
            if (gutter > 0) {
                size = clamp(gutter * 0.8, 26, 48);
                x = Math.random() < 0.5 ? gutter / 2 : w - gutter / 2;
                amp = rand(4, 10);
            }

            var el = document.createElement('div');
            el.className = 'leaf';
            el.style.width = size + 'px';
            el.style.height = size + 'px';
            el.appendChild(createArt());
            layer.appendChild(el);

            leaves.push({
                el: el,
                size: size,
                x0: x - size / 2,
                y: -size,
                speed: (h + size) / rand(C.fall[0], C.fall[1]),
                amp: amp,
                freq: (Math.PI * 2) / rand(C.swayPeriod[0], C.swayPeriod[1]),
                phase: rand(0, Math.PI * 2),
                rot: rand(0, 360),
                rotSpeed: rand(-14, 14),
                alpha: rand(C.opacity[0], C.opacity[1]),
                t: 0
            });
        }

        function tick(time, deltaTime) {
            var dt = Math.min(deltaTime, 50) / 1000;
            clock += dt;
            var h = window.innerHeight;

            if (leaves.length < maxLeaves() && clock >= nextSpawnAt) {
                spawn();
                nextSpawnAt = clock + rand(C.interval[0], C.interval[1]);
            }

            for (var i = leaves.length - 1; i >= 0; i--) {
                var leaf = leaves[i];
                leaf.t += dt;
                leaf.y += leaf.speed * dt;

                var swing = leaf.phase + leaf.t * leaf.freq;
                var x = leaf.x0 + Math.sin(swing) * leaf.amp;
                var tilt = Math.cos(swing) * 16;

                // 最後 30% 的路程慢慢淡出
                var progress = (leaf.y + leaf.size) / (h + leaf.size);
                var fade = progress < 0.08 ? progress / 0.08 : (progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1);

                if (progress >= 1) {
                    leaf.el.remove();
                    leaves.splice(i, 1);
                    continue;
                }

                var rotation = leaf.rot + leaf.rotSpeed * leaf.t + tilt;
                leaf.el.style.opacity = (leaf.alpha * fade).toFixed(3);
                leaf.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + leaf.y.toFixed(1) + 'px,0) rotate(' + rotation.toFixed(1) + 'deg)';
            }
        }

        function showStaticLeaf() {
            var el = document.createElement('div');
            el.className = 'leaf';
            el.style.width = '64px';
            el.style.height = '64px';
            el.style.opacity = '0.2';
            el.style.transform = 'translate3d(' + (window.innerWidth - 110) + 'px,' + (window.innerHeight - 120) + 'px,0) rotate(-18deg)';
            el.appendChild(createArt());
            layer.appendChild(el);
        }

        function init() {
            if (!C.enabled) {
                return;
            }
            layer = document.createElement('div');
            layer.className = 'leaf-layer';
            layer.setAttribute('aria-hidden', 'true');
            document.body.appendChild(layer);

            if (prefersReducedMotion()) {
                showStaticLeaf();
                return;
            }

            nextSpawnAt = 1.2;
            // gsap.ticker 在分頁切到背景時會自動暫停
            gsap.ticker.add(tick);
        }

        // 換頁時記錄新頁面是不是 favorites 的堆疊版面
        function setPage(container) {
            var card = container.querySelector('.stack-card');
            gutter = card ? Math.max(0, card.getBoundingClientRect().left) : 0;
        }

        window.addEventListener('resize', function () {
            var card = document.querySelector('main:not([style*="display: none"]) .stack-card');
            gutter = card ? Math.max(0, card.getBoundingClientRect().left) : 0;
        });

        return { init: init, createArt: createArt, setPage: setPage };
    })();

    /* ------------------------------------------------------------------
       Barba.js
       ------------------------------------------------------------------ */
    // 頁面標題（about me、skills、favorites）從中間滑到左邊，沿用原本網站的動畫
    function slideHeading(container, delay) {
        var heading = container.querySelectorAll('.header h2');
        if (!heading.length) {
            return;
        }
        if (prefersReducedMotion()) {
            gsap.set(heading, { left: 0 });
            return;
        }
        gsap.to(heading, { left: 0, duration: 1, ease: 'power3.inOut', delay: (delay || 0) + 0.35 });
    }

    function startPage(container, firstDelay) {
        updateNav();
        Panels.init(container, firstDelay);
        Leaves.setPage(container);
        slideHeading(container, firstDelay);
        advancedLazyLoad();
    }

    barba.init({
        preventRunning: true,
        prevent: function (data) {
            return !!data.el && !!data.el.href && pageKey(data.el.href) === pageKey(window.location.href);
        },
        transitions: [
            {
                name: 'paper-curtain',

                once: function (data) {
                    startPage(data.next.container, 0.15);
                },

                leave: function (data) {
                    Panels.lock(true);
                    closeHamburgerMenu();
                    return Curtain.cover(data.current.container);
                },

                afterLeave: function (data) {
                    // 舊頁面先收起來，新頁面才能從最上方開始排版
                    Panels.destroy();
                    data.current.container.style.display = 'none';
                    window.scrollTo(0, 0);
                },

                enter: function (data) {
                    startPage(data.next.container, Curtain.revealDelay());
                    return Curtain.open(data.next.container);
                },

                after: function () {
                    Panels.lock(false);
                }
            }
        ]
    });

    Leaves.init();
})();
