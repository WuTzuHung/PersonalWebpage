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
                // 每次進入首頁時，執行動畫
                if (data.next.namespace === "home") {
                    restartBackgroundAnimation();
                }
                contentAnimation(); // 其他頁面過渡動畫
            },

            async once(data) {
                // 首次進入頁面時的動畫
                if (data.next.namespace === "home") {
                    restartBackgroundAnimation();
                }
                contentAnimation();
            },
        },
    ],
});

// GSAP 動畫控制函數
function restartBackgroundAnimation() {
    const backgroundAnimation = document.getElementById("backgroundAnimation");
    if (!backgroundAnimation) return;

    // 重設背景動畫的透明度和顯示狀態
    backgroundAnimation.style.display = "block";
    backgroundAnimation.style.opacity = 1;

    // 播放淡出動畫
    gsap.to("#backgroundAnimation", {
        duration: 1,    // 動畫持續時間
        delay: 3.5,     // 延遲時間
        opacity: 0,     // 最終透明度
        onComplete: function() {
            backgroundAnimation.style.display = "none"; // 動畫結束後隱藏
        }
    });
}

// 在網頁載入時設定初始狀態，這是拿來改善首次進入home時，不小心點到home 會觸發不能點其他頁面的問題
document.addEventListener('DOMContentLoaded', function() {
    // 假設 Home 是預設的活動頁面
    const homeLi = document.querySelector('.liComputer[data-page="home"], .navLi[data-page="home"]'); // 請根據您的 HTML 結構調整選擇器
    if (homeLi) {
        homeLi.classList.add('active');
    }
});


//這是拿來改善過渡相同頁面的問題
document.querySelectorAll('.liComputer, .navLi').forEach(item => {
    item.addEventListener('click', function(event) {
        event.preventDefault();  // 防止連接的默認跳轉行為，便於測試

        // console.log("Clicked on:", item.textContent);  // 打印點擊的元素

        // 檢查當前 active 的 li
        const activeItems = document.querySelectorAll('.liComputer.active');
        // console.log("Active items before click:", activeItems);

        // 移除所有 li 中的 active 類
        activeItems.forEach(activeItem => {
            activeItem.classList.remove('active');
        });

        // 為當前點擊的 li 添加 active 類
        item.classList.add('active');

        // console.log("Active items after click:", document.querySelectorAll('.liComputer.active'));

        // 檢查所有 li 的 CSS display 屬性
        document.querySelectorAll('.liComputer').forEach(li => {
            const computedStyle = window.getComputedStyle(li);
            // console.log(`${li.textContent} display status:`, computedStyle.display);
        });
    });
});
