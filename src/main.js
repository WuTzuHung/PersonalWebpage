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
        top:0,
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
            },

            async once(data) {

                contentAnimation();
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

//使用動態載入和預載入
const advancedLazyLoad = () => {
    const images = document.querySelectorAll('.imgAll');
    let imageQueue = [];

    const loadImage = (img) => {
        return new Promise((resolve) => {
            const src = img.getAttribute('data-src');  // 確保從 data-src 中取得圖片 URL
            if (!src) {
                resolve();  // 如果沒有 data-src，直接跳過
                return;
            }
            img.src = src;  // 設定圖片的 src
            img.onload = () => {
                img.style.opacity = '1';  // 載入後顯示圖片
                resolve();  // 解決 Promise
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${src}`);
                resolve();  // 即使失敗也繼續處理隊列中的其他圖片
            };
        });
    };

    const processQueue = async () => {
        if (imageQueue.length > 0) {
            const img = imageQueue.shift();  // 取出第一張圖片
            await loadImage(img);  // 載入圖片
            processQueue();  // 處理下一張圖片
        }
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;  // 取得進入視窗的圖片
                imageQueue.push(img);  // 加入待載入隊列
                observer.unobserve(img);  // 停止觀察此圖片
            }
        });

        if (imageQueue.length > 0) {
            processQueue();  // 開始處理圖片載入
        }
    }, {
        rootMargin: '100px',  // 增加根距，提早 100px 預載
        threshold: 0  // 當圖片進入畫面時觸發
    });

    images.forEach(img => {
        img.style.opacity = '0';  // 設置初始透明度
        img.style.transition = 'opacity 1s ease-in-out';  // 動畫過渡效果
        observer.observe(img);  // 開始觀察每張圖片
    });
};

// 確保在 DOM 完全載入後執行懶加載
document.addEventListener("DOMContentLoaded", advancedLazyLoad);
