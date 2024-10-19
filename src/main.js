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
