function pageTransition(){
    let tl = gsap.timeline();

    tl.to(".transition", {
        duration: 1,
        scaleY: 1,
        transformOrigin: "bottom",
        ease: "power4.inOut",
    });

    tl.to(".transition", {
        duration: 1,
        scaleY: 0,
        transformOrigin: "top",
        ease: "power4.inOut",
        delay: 0.2,
    });
}

function contentAnimation(){
    let tl = gsap.timeline();
    tl.to("h2", {
        left: 0,
        duration:1,
        ease: "power3.inOut",
        delay: 0.75,
    });
}

function delay(n) {
    n = n || 0;
    return new Promise((done) => {
        setTimeout(() => {
            done();
        }, n);
    });
}

//關閉漢堡選單方法
function closeHamburgerMenu() {
    const checkbox = document.querySelector('.checkbox-toggle');
    if (checkbox && checkbox.checked) {
        checkbox.checked = false; // 取消選中，關閉漢堡選單
    }
}


// 初始化 Barba.js
barba.init({
    sync: true,
    transitions: [
        {
            async leave(data) {
                const done = this.async();
                pageTransition();
                closeHamburgerMenu(); // 強制關閉選單
                await delay(1000);
                done();
            },

            async enter(data) {

                contentAnimation(); // 其他頁面過渡動畫
                advancedLazyLoad();  // 切換到新頁面時重新執行懶加載
            },

            async once(data) {

                contentAnimation();
                advancedLazyLoad();  // 頁面首次加載時執行懶加載
            },
        },
    ],
});

document.addEventListener('DOMContentLoaded', function() {
    const homeLis = document.querySelectorAll('li[data-page="home"]');
    // console.log('網頁載入時的 homeLis:', homeLis);
    
    homeLis.forEach(homeLi => {
        if (homeLi) {
            homeLi.classList.add('active');
            // console.log('設置初始 active 後的狀態:', homeLi.classList.contains('active'));
        }
    });
});

// 監聽所有 li 元素的點擊事件
document.querySelectorAll('li').forEach(item => {
    item.addEventListener('click', function(event) {
        // 找到 li 內的 a 元素並阻止其默認行為
        const link = item.querySelector('a');
        if (link) {
            event.preventDefault();
            link.addEventListener('click', function(e) {
                e.preventDefault();
            });
        }

        // console.log('點擊事件觸發');
        // console.log('點擊的 li 元素:', item);
        
        // 檢查是否為 home 頁面的 li
        const isHomePage = item.getAttribute('data-page') === 'home';
        
        // 檢查當前 li 是否已經是 active
        if (item.classList.contains('active')) {
            // console.log('已在當前頁面，阻止處理');
            event.preventDefault(); // 再次確保阻止默認行為
            event.stopPropagation(); // 阻止事件冒泡
            return false; // 確保完全阻止
        }

        // console.log('開始切換頁面...');
        
        // 移除所有 li 中的 active 類（包括兩個選單）
        document.querySelectorAll('li.active').forEach(activeItem => {
            // console.log('移除 active 從:', activeItem);
            activeItem.classList.remove('active');
        });

        // 如果點擊的是 home 頁面，則為兩個選單中的 home li 都添加 active
        if (isHomePage) {
            document.querySelectorAll('li[data-page="home"]').forEach(homeLi => {
                homeLi.classList.add('active');
            });
        } else {
            // 為當前點擊的 li 添加 active 類
            item.classList.add('active');
            
            // 在另一個選單中找到對應的 li 並添加 active
            const href = link ? link.getAttribute('href') : null;
            if (href) {
                const correspondingLinks = document.querySelectorAll(`a[href="${href}"]`);
                correspondingLinks.forEach(corrLink => {
                    const corrLi = corrLink.closest('li');
                    if (corrLi && corrLi !== item) {
                        corrLi.classList.add('active');
                    }
                });
            }
        }
    });

    // 額外監聽 a 標籤的點擊事件
    const link = item.querySelector('a');
    if (link) {
        link.addEventListener('click', function(e) {
            if (item.classList.contains('active')) {
                e.preventDefault();
                e.stopPropagation();
                // console.log('阻止 active 連結的點擊');
                return false;
            }
        });
    }
});

// 懶加載函數
const advancedLazyLoad = () => {
    const images = document.querySelectorAll('.imgAll');
    let imageQueue = [];
    const maxConcurrentLoads = 3; // 最大同時載入圖片數量
    let currentLoads = 0; // 當前正在載入的圖片數量

    const loadImage = (img) => {
        return new Promise((resolve) => {
            const src = img.getAttribute('data-src');
            if (!src || img.src === src) {  // 檢查圖片是否已經載入過
                resolve(); // 如果已經載入過，跳過處理
                return;
            }
            img.src = src;  // 設定圖片的 src
            img.onload = () => {
                img.style.opacity = '1';
                currentLoads--; // 載入完成，減少正在載入的計數
                resolve();
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${src}`);
                currentLoads--; // 即使失敗也減少正在載入的計數
                resolve();
            };
        });
    };

    const processQueue = async () => {
        while (imageQueue.length > 0 && currentLoads < maxConcurrentLoads) {
            const img = imageQueue.shift();
            currentLoads++;
            await loadImage(img);
        }
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                imageQueue.push(img);
                observer.unobserve(img);
            }
        });

        processQueue(); // 開始處理圖片載入
    }, {
        rootMargin: '100px',
        threshold: 0
    });

    images.forEach(img => {
        img.style.opacity = '0';  // 設置初始透明度
        img.style.transition = 'opacity 1s ease-in-out';  // 動畫過渡效果
        if (!img.src) { // 確保未被設置 src 的圖片重新觀察
            observer.observe(img);  // 開始觀察每張圖片
        }
    });
};

// 確保在 DOM 完全載入後執行懶加載
document.addEventListener("DOMContentLoaded", advancedLazyLoad);