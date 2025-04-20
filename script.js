// 游戏配置
const GAME_CONFIG = {
    GAME_DURATION: 30,        // 游戏时长（秒）
    ITEM_SPAWN_INTERVAL: 300, // 物品生成间隔（毫秒）
    BOMB_SPAWN_INTERVAL: 5000,// 炸弹生成间隔（毫秒）
    ITEM_FALL_SPEED: 3,       // 物品下落速度
    PLAYER_SPEED: 15,         // 玩家移动速度
    SCORE_PER_ITEM: 10,       // 每个物品的分数
    PLAYER_SIZE: 150,         // 玩家大小
    ITEM_SIZE: 50,            // 物品大小
    BOMB_SIZE: 60             // 炸弹大小
};

// 图片和音频缓存
const imageCache = {};
const audioCache = {};

// 物品类型
const ITEM_TYPES = [
    { name: 'yuanbao', score: 1, image: './image/yuanbao.png' },
    { name: 'hongbao', score: 2, image: './image/hongbao.png' },
    { name: 'fudai', score: 3, image: './image/fudai.png' },
    { name: 'jintiao', score: 4, image: './image/jintiao.png' },
    { name: 'zhuanshi', score: 5, image: './image/zhuanshi.png' },
    { name: 'zhihongbao', score: 8, image: './image/zhihongbao.png' },
    { name: 'dahongbao', score: 10, image: './image/dahongbao.png' }
];

// 游戏状态变量
let canvas, ctx;
let player;
let items = [];
let bombs = [];
let currentScore = 0;
let gameTimer;
let itemGeneratorTimer;
let bombGeneratorTimer;
let gameLoopId;
let timeLeft = GAME_CONFIG.GAME_DURATION;
let isGameRunning = false;
let lastTimestamp = 0;
let imagesLoaded = false;

// 音频管理器
class AudioManager {
    constructor() {
        this.bgm = new Audio('./music/background_music.mp3');
        this.bgm.loop = true;
        this.itemSounds = [
            new Audio('./music/music1.mp3'),
            new Audio('./music/music2.mp3'),
            new Audio('./music/music3.mp3'),
            new Audio('./music/music4.mp3')
        ];
        this.bombSound = new Audio('./music/bomb.mp3');
        this.buttonSound = new Audio('./music/button.mp3');
    }

    playBGM() {
        this.bgm.play().catch(error => console.log('BGM playback prevented by browser', error));
    }

    stopBGM() {
        this.bgm.pause();
        this.bgm.currentTime = 0;
    }

    playItemSound() {
        const randomIndex = Math.floor(Math.random() * this.itemSounds.length);
        const sound = this.itemSounds[randomIndex];
        sound.currentTime = 0;
        sound.play().catch(error => console.log('Sound playback prevented by browser', error));
    }

    playBombSound() {
        this.bombSound.currentTime = 0;
        this.bombSound.play().catch(error => console.log('Sound playback prevented by browser', error));
    }

    playButtonSound() {
        this.buttonSound.currentTime = 0;
        this.buttonSound.play().catch(error => console.log('Sound playback prevented by browser', error));
    }
}

// 物品类
class Item {
    constructor(type, x, y, speed) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.width = GAME_CONFIG.ITEM_SIZE;
        this.height = GAME_CONFIG.ITEM_SIZE;
    }

    update() {
        this.y += this.speed;
    }

    isOutOfScreen() {
        return this.y > canvas.height;
    }
}

// 炸弹类
class Bomb {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.width = GAME_CONFIG.BOMB_SIZE;
        this.height = GAME_CONFIG.BOMB_SIZE;
        this.image = imageCache['./image/bomb.png'];
    }

    update() {
        this.y += this.speed;
    }

    isOutOfScreen() {
        return this.y > canvas.height;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    
    // 获取DOM元素
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    player = document.getElementById('player');
    
    // 初始化画布大小
    resizeCanvas();
    
    // 监听窗口大小变化
    window.addEventListener('resize', resizeCanvas);
    
    // 预加载图片
    preloadImages(() => {
        console.log('All images loaded successfully, initializing game...');
        imagesLoaded = true;
        
        // 创建音频管理器
        const audioManager = new AudioManager();
        
        // 设置事件监听器
        setupEventListeners(audioManager);
        
        // 阻止页面滚动和缩放
        preventDefaultTouchBehavior();
    });
});

// 预加载所有图片
function preloadImages(callback) {
    const imagesToLoad = [
        './image/user.png',
        './image/bomb.png',
        ...ITEM_TYPES.map(item => item.image)
    ];
    
    console.log('Starting to load images:', imagesToLoad);
    
    let loadedCount = 0;
    const totalImages = imagesToLoad.length;
    
    imagesToLoad.forEach(src => {
        const img = new Image();
        img.onload = () => {
            imageCache[src] = img;
            loadedCount++;
            console.log(`Loaded image: ${src} (${loadedCount}/${totalImages})`);
            
            // 当所有图片加载完成时
            if (loadedCount === totalImages && typeof callback === 'function') {
                callback();
            }
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${src}`);
            loadedCount++;
            // 即使加载失败也继续游戏
            if (loadedCount === totalImages && typeof callback === 'function') {
                callback();
            }
        };
        img.src = src;
    });
}

// 设置事件监听器
function setupEventListeners(audioManager) {
    // 开始按钮
    const startButton = document.getElementById('start-button');
    startButton.addEventListener('click', () => {
        audioManager.playButtonSound();
        startGame(audioManager);
    });
    
    // 重玩按钮
    const restartButton = document.getElementById('restart-button');
    restartButton.addEventListener('click', () => {
        audioManager.playButtonSound();
        hideResultModal();
        startGame(audioManager);
    });
    
    // 键盘控制
    document.addEventListener('keydown', (e) => {
        if (!isGameRunning) return;
        
        const playerRect = player.getBoundingClientRect();
        const playerX = playerRect.left;
        
        if (e.keyCode === 37) { // 左箭头
            movePlayer(playerX - GAME_CONFIG.PLAYER_SPEED);
        } else if (e.keyCode === 39) { // 右箭头
            movePlayer(playerX + GAME_CONFIG.PLAYER_SPEED);
        }
    });
    
    // 触摸控制
    let touchStartX = 0;
    
    canvas.addEventListener('touchstart', (e) => {
        if (!isGameRunning) return;
        e.preventDefault();
        touchStartX = e.touches[0].clientX;
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        if (!isGameRunning) return;
        e.preventDefault();
        
        const touchX = e.touches[0].clientX;
        const deltaX = touchX - touchStartX;
        
        const playerRect = player.getBoundingClientRect();
        movePlayer(playerRect.left + deltaX);
        
        touchStartX = touchX;
    }, { passive: false });
}

// 阻止默认触摸行为（防止页面滚动和缩放）
function preventDefaultTouchBehavior() {
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });
    
    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });
    
    document.addEventListener('dblclick', (e) => {
        e.preventDefault();
    });
}

// 调整画布大小
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // 重新定位玩家
    if (player) {
        player.style.left = (window.innerWidth - GAME_CONFIG.PLAYER_SIZE) / 2 + 'px';
    }
}

// 开始游戏
function startGame(audioManager) {
    // 如果图片尚未加载完成，不启动游戏
    if (!imagesLoaded) {
        console.warn('游戏尝试启动，但图片尚未完全加载');
        return;
    }
    
    console.log('Starting game...');
    
    // 切换到游戏页面
    document.getElementById('welcome-page').classList.remove('active');
    document.getElementById('game-page').classList.add('active');
    
    // 重置游戏状态
    resetGame();
    
    // 播放背景音乐
    audioManager.playBGM();
    
    // 设置游戏为运行状态
    isGameRunning = true;
    
    // 开始游戏循环
    startGameLoop(audioManager);
    
    // 开始计时器
    startTimer();
    
    // 开始生成物品
    startItemGeneration();
    
    // 开始生成炸弹
    startBombGeneration();
}

// 重置游戏状态
function resetGame() {
    items = [];
    bombs = [];
    currentScore = 0;
    timeLeft = GAME_CONFIG.GAME_DURATION;
    
    // 重置玩家位置
    player.style.left = (window.innerWidth - GAME_CONFIG.PLAYER_SIZE) / 2 + 'px';
    
    // 重置分数显示
    document.getElementById('score').textContent = '0';
    document.getElementById('timer').textContent = timeLeft;
}

// 开始游戏循环
function startGameLoop(audioManager) {
    // 清除之前的游戏循环
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    
    // 游戏主循环
    const gameLoop = (timestamp) => {
        if (!isGameRunning) return;
        
        // 计算帧率
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 更新物品位置
        updateItems();
        
        // 更新炸弹位置
        updateBombs();
        
        // 绘制物品
        drawItems();
        
        // 绘制炸弹
        drawBombs();
        
        // 检测碰撞
        checkCollisions(audioManager);
        
        // 继续循环
        gameLoopId = requestAnimationFrame(gameLoop);
    };
    
    // 启动游戏循环
    lastTimestamp = performance.now();
    gameLoopId = requestAnimationFrame(gameLoop);
}

// 开始计时器
function startTimer() {
    // 清除之前的计时器
    if (gameTimer) {
        clearInterval(gameTimer);
    }
    
    // 设置新的计时器
    gameTimer = setInterval(() => {
        timeLeft--;
        
        // 更新计时器显示
        document.getElementById('timer').textContent = timeLeft;
        
        // 游戏时间结束
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

// 开始生成物品
function startItemGeneration() {
    // 清除之前的生成器
    if (itemGeneratorTimer) {
        clearInterval(itemGeneratorTimer);
    }
    
    // 设置新的生成器
    itemGeneratorTimer = setInterval(() => {
        if (!isGameRunning) return;
        
        // 随机选择物品类型
        const randomIndex = Math.floor(Math.random() * ITEM_TYPES.length);
        const itemType = ITEM_TYPES[randomIndex];
        
        // 随机生成水平位置
        const x = Math.random() * (canvas.width - GAME_CONFIG.ITEM_SIZE);
        
        // 创建新物品
        const item = new Item(itemType, x, 0, GAME_CONFIG.ITEM_FALL_SPEED);
        
        // 添加到物品数组
        items.push(item);
    }, GAME_CONFIG.ITEM_SPAWN_INTERVAL);
}

// 开始生成炸弹
function startBombGeneration() {
    // 清除之前的生成器
    if (bombGeneratorTimer) {
        clearInterval(bombGeneratorTimer);
    }
    
    // 设置新的生成器
    bombGeneratorTimer = setInterval(() => {
        if (!isGameRunning) return;
        
        // 随机生成水平位置
        const x = Math.random() * (canvas.width - GAME_CONFIG.BOMB_SIZE);
        
        // 创建新炸弹
        const bomb = new Bomb(x, 0, GAME_CONFIG.ITEM_FALL_SPEED * 1.5);
        
        // 添加到炸弹数组
        bombs.push(bomb);
    }, GAME_CONFIG.BOMB_SPAWN_INTERVAL);
}

// 更新物品位置
function updateItems() {
    for (let i = items.length - 1; i >= 0; i--) {
        items[i].update();
        
        // 移除超出屏幕的物品
        if (items[i].isOutOfScreen()) {
            items.splice(i, 1);
        }
    }
}

// 更新炸弹位置
function updateBombs() {
    for (let i = bombs.length - 1; i >= 0; i--) {
        bombs[i].update();
        
        // 移除超出屏幕的炸弹
        if (bombs[i].isOutOfScreen()) {
            bombs.splice(i, 1);
        }
    }
}

// 绘制物品
function drawItems() {
    items.forEach(item => {
        const img = imageCache[item.type.image];
        if (img) {
            ctx.drawImage(img, item.x, item.y, item.width, item.height);
        } else {
            // 如果图片未加载，绘制一个占位符
            ctx.fillStyle = 'gold';
            ctx.fillRect(item.x, item.y, item.width, item.height);
        }
    });
}

// 绘制炸弹
function drawBombs() {
    bombs.forEach(bomb => {
        const img = imageCache['./image/bomb.png'];
        if (img) {
            ctx.drawImage(img, bomb.x, bomb.y, bomb.width, bomb.height);
        } else {
            // 如果图片未加载，绘制一个占位符
            ctx.fillStyle = 'red';
            ctx.fillRect(bomb.x, bomb.y, bomb.width, bomb.height);
        }
    });
}

// 检测碰撞
function checkCollisions(audioManager) {
    if (!player) return;
    
    // 获取玩家位置和大小
    const playerRect = player.getBoundingClientRect();
    const playerLeft = playerRect.left;
    const playerRight = playerRect.right;
    const playerTop = playerRect.top;
    const playerBottom = playerRect.bottom;
    
    // 检测与物品的碰撞
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        
        // 物品位置
        const itemLeft = item.x;
        const itemRight = item.x + item.width;
        const itemTop = item.y;
        const itemBottom = item.y + item.height;
        
        // 检测碰撞
        if (
            playerLeft < itemRight &&
            playerRight > itemLeft &&
            playerTop < itemBottom &&
            playerBottom > itemTop
        ) {
            // 播放收集音效
            audioManager.playItemSound();
            
            // 增加分数
            const pointsEarned = item.type.score * GAME_CONFIG.SCORE_PER_ITEM;
            updateScore(pointsEarned);
            
            // 移除物品
            items.splice(i, 1);
        }
    }
    
    // 检测与炸弹的碰撞
    for (let i = bombs.length - 1; i >= 0; i--) {
        const bomb = bombs[i];
        
        // 炸弹位置
        const bombLeft = bomb.x;
        const bombRight = bomb.x + bomb.width;
        const bombTop = bomb.y;
        const bombBottom = bomb.y + bomb.height;
        
        // 检测碰撞
        if (
            playerLeft < bombRight &&
            playerRight > bombLeft &&
            playerTop < bombBottom &&
            playerBottom > bombTop
        ) {
            // 播放炸弹音效
            audioManager.playBombSound();
            
            // 游戏结束
            endGame();
            return;
        }
    }
}

// 更新分数
function updateScore(points) {
    currentScore += points;
    document.getElementById('score').textContent = currentScore;
}

// 移动玩家
function movePlayer(x) {
    // 确保玩家不会移出画布
    const maxX = window.innerWidth - GAME_CONFIG.PLAYER_SIZE;
    x = Math.max(0, Math.min(maxX, x));
    
    // 更新玩家位置
    player.style.left = x + 'px';
}

// 结束游戏
function endGame() {
    isGameRunning = false;
    
    // 停止所有计时器
    clearInterval(gameTimer);
    clearInterval(itemGeneratorTimer);
    clearInterval(bombGeneratorTimer);
    
    // 停止游戏循环
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    
    // 显示结算弹窗
    showResultModal();
}

// 显示结算弹窗
function showResultModal() {
    // 设置最终分数
    document.getElementById('final-score').textContent = currentScore;
    
    // 显示模态框
    const modal = document.getElementById('result-modal');
    modal.classList.remove('hidden');
    
    // 添加动画效果
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// 隐藏结算弹窗
function hideResultModal() {
    const modal = document.getElementById('result-modal');
    modal.classList.remove('show');
    
    // 等待动画完成后隐藏
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
} 