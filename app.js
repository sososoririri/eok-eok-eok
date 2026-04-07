// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDB_KH5ocr9IpUG3zo7h4UAUiePvlqXG54",
    authDomain: "eok-eok-eok.firebaseapp.com",
    projectId: "eok-eok-eok",
    storageBucket: "eok-eok-eok.firebasestorage.app",
    messagingSenderId: "1074375686114",
    appId: "1:1074375686114:web:0be6221509907ddf26ebbb",
    measurementId: "G-LYGTDV4L7M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// Schema Definition
const assetCategories = {
    savings: { 
        label: "저축", 
        items: ["청년 도약_소리", "주택 청약_소리", "신한 종신보험_소리", "토스 외화 통장_소리", "토스 자유 적금_소리", "카카오페이증권_소리", "종신 보험_상혁", "주택 청약_상혁", "청년 도약_상혁", "경조사", "운동,미용", "예비비"] 
    },
    investments: { 
        label: "투자", 
        items: ["한투 해외 주식_소리", "토스 해외 주식_소리", "코인_소리", "금_소리", "금_상혁", "신한 해외 주식_상혁"] 
    },
    realestate: { 
        label: "부동산", 
        items: ["천안아산역 월세"] 
    },
    pension: { 
        label: "연금", 
        items: ["연금저축_소리", "개인연금저축_상혁"] 
    },
    debt: { 
        label: "부채", 
        items: ["학자금 대출", "자동차", "천안아산역 오피스텔"] 
    }
};

// ============================================================
// 📋 모임통장 자동이체 분류 딕셔너리
// ============================================================

// ✅ 저축 → 자산 자동 반영 항목
// { keywords: [SMS에 나오는 키워드들], assetId: 자산 스냅샷의 항목 ID }
const SAVING_KEYWORD_MAP = [
    { keywords: ['운동', '미용'],                   assetId: '운동,미용' },
    { keywords: ['예비비'],                          assetId: '예비비' },
    { keywords: ['경조'],                            assetId: '경조사' },
    { keywords: ['자유 적금', '자유적금'],            assetId: '토스 자유 적금_소리' },
    { keywords: ['일일 주식', '카카오페이증권'],       assetId: '카카오페이증권_소리' },
    { keywords: ['청년 도약', '청년도약'],            assetId: '청년 도약_소리' },
    { keywords: ['주택 청약', '주택청약', '청약_소리'], assetId: '주택 청약_소리' },
    { keywords: ['종신 보험_소리', '신한 종신'],       assetId: '신한 종신보험_소리' },
    { keywords: ['외화 통장', '외화통장'],            assetId: '토스 외화 통장_소리' },
    { keywords: ['종신 보험_상혁', '종신보험_상혁'],  assetId: '종신 보험_상혁' },
    { keywords: ['청약_상혁'],                       assetId: '주택 청약_상혁' },
    { keywords: ['도약_상혁'],                       assetId: '청년 도약_상혁' },
    { keywords: ['개인연금'],                        assetId: '개인연금저축_상혁' },
    { keywords: ['연금저축_소리'],                   assetId: '연금저축_소리' },
];

// ❌ 지출로만 처리 (자산 반영 X)
const EXPENSE_KEYWORDS_LIST = [
    '병원비', '보험료', '보험비', '상헌주식', 'KB 보험', 'KB보험',
    '아빠', '엄마', '부모님', '경비'
];

// Default settings
const defaultSettings = {
    monthlyBudget: 2000000,
    targetSaving: 1000000,
    monthlyIncome: 5000000,
    assets: {}
};

// Initial state (Cloud live synced)
let settings = defaultSettings;
let transactions = [];
let monthlyIncomes = {};
let monthlyAssets = {};
let monthlyBudgets = {};
let editingTxId = null; // 수정 모드 상태 관리
let dashboardTypeFilter = 'all'; // 대시보드 타입 필터 ('all'|'expense'|'refund'|'income'|'saving')

// Global Dashboard Date State
let dashboardMonth = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().substring(0, 7);

// DOM Elements
const form = document.getElementById('transaction-form');
const smsInput = document.getElementById('sms-input');
const netWorthDisplay = document.getElementById('net-worth-display');
const savingProgress = document.getElementById('saving-progress');
const currentSavingDisplay = document.getElementById('current-saving-display');
const targetSavingDisplay = document.getElementById('target-saving-display');
const progressPercent = document.getElementById('progress-percent');
const transactionList = document.getElementById('transaction-list');
const budgetStatus = document.getElementById('budget-status');
const toast = document.getElementById('toast');
const settingForm = document.getElementById('setting-form');

// Summary DOM
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const totalSavingEl = document.getElementById('total-saving');

// Initialize App
function init() {
    renderAssetUI();
    setupEventListeners();
    setupSPARouting();
    
    // Start Cloud Sync
    startDatabaseSync();
}

function startDatabaseSync() {
    // 1. Transactions Syncer
    const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        transactions = [];
        snapshot.forEach((d) => {
            transactions.push({ id: d.id, ...d.data() });
        });
        renderAll();
    });

    // 2. Incomes Syncer
    onSnapshot(collection(db, "incomes"), (snapshot) => {
        monthlyIncomes = {};
        snapshot.forEach((d) => {
            monthlyIncomes[d.id] = d.data();
        });
        renderAll();
    });

    // 3. Assets Syncer
    onSnapshot(collection(db, "assets"), (snapshot) => {
        monthlyAssets = {};
        snapshot.forEach((d) => {
            monthlyAssets[d.id] = d.data();
        });
        renderAll();
    });

    // 4. Budgets Syncer
    onSnapshot(collection(db, "budgets"), (snapshot) => {
        monthlyBudgets = {};
        snapshot.forEach((d) => {
            monthlyBudgets[d.id] = d.data();
        });
        renderAll();
    });
}

function renderAssetUI() {
    const container = document.getElementById('dynamic-assets-container');
    if(!container) return;
    container.innerHTML = '';
    
    for (const [key, category] of Object.entries(assetCategories)) {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'setting-group';
        fieldset.innerHTML = '<legend>' + category.label + '</legend>';
        
        category.items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = 
                '<label>' + item + '</label>' +
                '<input type="text" inputmode="numeric" data-asset-id="' + item + '" placeholder="0">';
            fieldset.appendChild(div);
        });
        container.appendChild(fieldset);
    }
}

// SPA Routing (Bulletproof Fix)
function setupSPARouting() {
    const navLinks = document.querySelectorAll('.nav-links a[data-target]');
    
    // 1. Click Listener
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            switchToSection(targetId);
        });
    });

    // 2. Hash Change Fallback
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1); // remove '#'
        if (hash) {
            switchToSection(hash);
        }
    });

    // Handle initial state cleanly
    document.querySelectorAll('.page-section').forEach(sec => {
        if (!sec.classList.contains('active-page')) {
            sec.style.display = 'none';
        } else {
            sec.style.display = 'block';
        }
    });
}

function switchToSection(targetId) {
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    // Update active class on Navigation
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector('.nav-links a[data-target="' + targetId + '"]');
    if (activeLink) activeLink.classList.add('active');

    // Force Hide all sections via pure JS + CSS classes
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active-page');
        sec.style.display = 'none';
    });

    // Force Show target section
    targetEl.classList.add('active-page');
    targetEl.style.display = 'block';
    
    // Update URL Hash for back-button support without jump
    history.replaceState(null, null, '#' + targetId);
}

function setupEventListeners() {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTransaction();
    });

    // Real-time Parsing
    smsInput.addEventListener('input', parseSMS);

    // Default Date to today (Local Timezone Safe)
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    // Setting Form Logic (Monthly Budgets)
    const settingForm = document.getElementById('setting-form');
    const budgetMonthInput = document.getElementById('budget-month-input');
    
    if (settingForm) {
        settingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSettings();
        });

        const localMonth = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().substring(0, 7);
        if (budgetMonthInput) budgetMonthInput.value = localMonth;
        loadBudgetForm(localMonth);

        if (budgetMonthInput) {
            budgetMonthInput.addEventListener('change', (e) => {
                loadBudgetForm(e.target.value);
            });
        }
    }
    
    // Dashboard Month Filter Logic
    const dashMonthFilter = document.getElementById('dashboard-month-filter');
    if (dashMonthFilter) {
        dashMonthFilter.value = dashboardMonth;
        dashMonthFilter.addEventListener('change', (e) => {
            dashboardMonth = e.target.value;
            renderAll();
        });
    }

    // Income Form Logic
    const incomeForm = document.getElementById('income-form');
    const incomeMonthInput = document.getElementById('income-month-input');
    
    if (incomeForm) {
        incomeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveIncome();
        });

        // Set default income month to current YYYY-MM
        const localMonth = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().substring(0, 7);
        incomeMonthInput.value = localMonth;
        loadIncomeForm(localMonth);

        incomeMonthInput.addEventListener('change', (e) => {
            loadIncomeForm(e.target.value);
        });
    }

    // Asset Form Logic
    const assetForm = document.getElementById('asset-form');
    const assetMonthInput = document.getElementById('asset-month-input');
    
    if (assetForm) {
        assetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveAssets();
        });

        // Use the same localMonth
        const localMonth = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().substring(0, 7);
        assetMonthInput.value = localMonth;
        loadAssetForm(localMonth);

        assetMonthInput.addEventListener('change', (e) => {
            loadAssetForm(e.target.value);
        });
    }

    // Comma formatter logic for Asset Container
    const dynamicAssetsContainer = document.getElementById('dynamic-assets-container');
    if (dynamicAssetsContainer) {
        dynamicAssetsContainer.addEventListener('input', function(e) {
            if(e.target.tagName === 'INPUT') {
                let val = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                e.target.value = val ? Number(val).toLocaleString() : '';
            }
        });
    }

    // Comma formatter logic for Incomes & Budgets
    const numberFormatInputs = document.querySelectorAll('#inc-sori-salary, #inc-sang-salary, #inc-sori-extra, #inc-sang-extra, #monthly-budget-input, #target-saving-input, #amount-input');
    numberFormatInputs.forEach(input => {
        input.type = 'text';
        input.setAttribute('inputmode', 'numeric');
        input.addEventListener('input', function(e) {
            let val = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
            e.target.value = val ? Number(val).toLocaleString() : '';
        });
    });

    // 저축 대상 드롭다운 토글 → 기록유형(tx_type) 변경 시
    const savingTargetGroup = document.getElementById('saving-target-group');
    document.querySelectorAll('input[name="tx_type"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (savingTargetGroup) savingTargetGroup.style.display = this.value === 'saving' ? 'block' : 'none';
        });
    });

    // 대시보드 타입 필터 버튼
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            dashboardTypeFilter = this.getAttribute('data-filter');
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderAll();
        });
    });
}

function loadIncomeForm(month) {
    const data = monthlyIncomes[month] || { soriSal: 0, sangSal: 0, soriEx: 0, sangEx: 0 };
    document.getElementById('inc-sori-salary').value = data.soriSal ? data.soriSal.toLocaleString() : '';
    document.getElementById('inc-sang-salary').value = data.sangSal ? data.sangSal.toLocaleString() : '';
    document.getElementById('inc-sori-extra').value = data.soriEx ? data.soriEx.toLocaleString() : '';
    document.getElementById('inc-sang-extra').value = data.sangEx ? data.sangEx.toLocaleString() : '';
}

async function saveIncome() {
    const month = document.getElementById('income-month-input').value;
    if (!month) return;

    const data = {
        soriSal: Number(document.getElementById('inc-sori-salary').value.replace(/,/g, '')) || 0,
        sangSal: Number(document.getElementById('inc-sang-salary').value.replace(/,/g, '')) || 0,
        soriEx: Number(document.getElementById('inc-sori-extra').value.replace(/,/g, '')) || 0,
        sangEx: Number(document.getElementById('inc-sang-extra').value.replace(/,/g, '')) || 0
    };
    
    await setDoc(doc(db, "incomes", month), data);
    showToast(month + " 수입 내역이 클라우드에 저장되었습니다!");
}

// Asset Form Helpers
function loadAssetForm(month) {
    const data = monthlyAssets[month] || {};
    const assetInputs = document.querySelectorAll('#dynamic-assets-container input[data-asset-id]');
    assetInputs.forEach(input => {
        const id = input.getAttribute('data-asset-id');
        const val = data[id] || 0;
        input.value = val ? val.toLocaleString() : '';
    });
}

async function saveAssets() {
    const month = document.getElementById('asset-month-input').value;
    if (!month) return;

    const data = {};
    const assetInputs = document.querySelectorAll('#dynamic-assets-container input[data-asset-id]');
    assetInputs.forEach(input => {
        const id = input.getAttribute('data-asset-id');
        data[id] = Number(input.value.replace(/,/g, '')) || 0;
    });

    await setDoc(doc(db, "assets", month), data);
    showToast(month + " 자산 스냅샷이 클라우드에 든든하게 저장되었습니다!");
}

// ============================================================
// 🃏 Smart SMS Parsing Engine v2 — 카드사별 파이프라인 파서
// ============================================================
function parseSMS() {
    const raw = smsInput.value;
    if (!raw.trim()) return;

    // 줄바꿈 정규화 (Windows \r\n → \n)
    const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    let parsedAmount = null;
    let parsedDate = null;
    let parsedMerchant = null;
    let parsedAuthor = null;
    let parsedCategory = 'etc';
    let parsedType = null; // 'expense'|'refund'|'income'|'saving' 자동 감지
    let parsedSavingTarget = ''; // 저축 대상 자산 항목 (자동 선택)
    let isRefund = false;

    // ── 1. 금액 파싱 (잔액/누적 줄은 제외하고 첫번째 금액만 추출) ──
    for (const line of lines) {
        if (line.includes('잔액') || line.includes('누적')) continue;
        const m = line.match(/([0-9,]+)원/);
        if (m) {
            parsedAmount = m[1].replace(/,/g, '');
            break;
        }
    }
    // fallback: 잔액/누적 줄 포함해서 첫번째 금액
    if (!parsedAmount) {
        const m = text.match(/([0-9,]+)원/);
        if (m) parsedAmount = m[1].replace(/,/g, '');
    }

    // ── 2. 날짜 파싱 ──
    const fullDateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
    const shortDateMatch = text.match(/(\d{2})\/(\d{2})/);
    if (fullDateMatch) {
        parsedDate = fullDateMatch[0];
    } else if (shortDateMatch) {
        parsedDate = new Date().getFullYear() + '-' + shortDateMatch[1] + '-' + shortDateMatch[2];
    }

    // ── 3. 결제자 판별 ──
    if (text.includes('강*리')) parsedAuthor = '소리';
    if (text.includes('이*혁') || text.includes('상혁')) parsedAuthor = '상혁';
    // 삼성카드 기본은 소리 (강*리가 없어도)
    if (!parsedAuthor && (text.includes('삼성') && text.includes('승인'))) parsedAuthor = '소리';
    // 공통카드 / 부부통장 / 모임통장 → 공용
    if (text.includes('공통카드') || text.includes('부부통장') || text.includes('모임통장')) {
        parsedAuthor = '공용';
    }

    // ── 4. 카드사별 사용처 추출 ──

    // [토스뱅크] 패턴: "28,300원 결제 | 에메랄드그린(EMERALD G"
    // → "결제 |" 뒤의 텍스트가 사용처
    const tossMatch = text.match(/결제\s*\|\s*([^\n]+)/);
    if (tossMatch) {
        parsedMerchant = tossMatch[1].trim();
    }

    // [삼성카드] 패턴: 시간이 있는 줄 → "04/02 12:15 풀동네판교점"
    if (!parsedMerchant) {
        for (const line of lines) {
            if (!line.match(/\d{2}:\d{2}/)) continue; // 시간 포함 줄만
            let stripped = line
                .replace(/\d{4}-\d{2}-\d{2}/, '')
                .replace(/\d{2}\/\d{2}/, '')
                .replace(/\d{2}:\d{2}/, '')
                .trim();
            if (stripped && stripped.match(/[가-힣a-zA-Z]/)) {
                parsedMerchant = stripped;
                break;
            }
        }
    }

    // [일반 Fallback] 줄별 스캔
    if (!parsedMerchant) {
        for (const line of lines) {
            // 금액이 있는 줄 스킵 (잔액, 누적, 일시불 포함)
            if (line.match(/[0-9,]+원/)) continue;
            // 카드사 헤더 줄 스킵
            if (line.match(/\[(토스뱅크|삼성|KB|신한|하나|현대|우리|카카오)/)) continue;
            if (line.includes('카드') || line.includes('체크')) continue;
            // 승인 메시지 줄 스킵 (이름+승인 혼합)
            if (line.includes('승인') && (line.includes('삼성') || line.includes('카드'))) continue;
            // 이름 줄 스킵 (홍*동, 강*리 패턴)
            if (line.match(/[가-힣]\*[가-힣]/)) continue;
            // 잔액/누적/날짜만 있는 줄 스킵
            if (line.includes('잔액') || line.includes('누적')) continue;
            if (line.match(/^\d{2}\/\d{2}$/)) continue;

            if (line.match(/[가-힣a-zA-Z]/) && !line.match(/\d{6,}/) && line.length > 1) {
                parsedMerchant = line;
                break; // ← 첫 번째 유효한 줄에서 멈춤!
            }
        }
    }

    // ── 5. 사용처 클린업 (잔액/누적/일시불 꼬리 제거) ──
    if (parsedMerchant) {
        const stopWords = ['누적', '잔액', '일시불', '할부'];
        for (const word of stopWords) {
            const idx = parsedMerchant.indexOf(word);
            if (idx !== -1) parsedMerchant = parsedMerchant.substring(0, idx).trim();
        }
        if (!parsedMerchant || parsedMerchant === '승인') parsedMerchant = null;
    }

    // ── 5.5. [모임통장 자동이체] 목적명 기반 자동 분류 ──
    // "X원이 출금됐어요" 패턴이 있으면 모임통장 자동이체로 판단
    if (parsedMerchant && (text.includes('출금됐어요') || text.includes('모임통장'))) {
        const purposeText = parsedMerchant; // 목적명 (예비비, 운동/미용 등)

        // 먼저 지출 키워드인지 체크 (병원비, 보험료 등)
        const isKnownExpense = EXPENSE_KEYWORDS_LIST.some(kw => purposeText.includes(kw));

        if (!isKnownExpense) {
            // 저축 키워드 매핑 탐색 → type=saving으로 처리
            for (const { keywords, assetId } of SAVING_KEYWORD_MAP) {
                if (keywords.some(kw => purposeText.includes(kw))) {
                    parsedType = 'saving'; // 카테고리 아닌 유형으로 저장
                    parsedSavingTarget = assetId;
                    break;
                }
            }
        }
        // 지출 키워드도 아니고 저축 매핑도 없으면 → 기타 지출로
    }

    // ── 6. 카테고리 자동 매핑 ──
    const categoryMap = {
        food: ['마트', '식당', '배달', '스타벅스', '커피', 'GS25', 'CU', '세븐일레븐', '편의점', '카페', '치킨', '피자'],
        health: ['병원', '약국', '의원', '치과', '정형외과', '한의원'],
        traffic: ['주유', '택시', '카카오T', '교통', 'GS칼텍스', '주차', 'BNK캐피탈', 'BNK캐피'],
        shopping: ['톤28', '올리브영', '쇼핑', '쿠팡', '무신사', 'H&M', 'ZARA'],
        living: ['월세', '관리비', '전기', '가스', '수도', '인터넷'],
        insurance: ['프리드L010', '삼성화04061', '메리츠통합001', '삼성화04014', '삼성화04076', 'DB손07804', '삼생04002건', '프리드L', '삼성화0', 'DB손0', '메리츠통합']
    };
    const checkText = text + (parsedMerchant || '');
    outer: for (const [cat, keywords] of Object.entries(categoryMap)) {
        for (const kw of keywords) {
            if (checkText.includes(kw)) { parsedCategory = cat; break outer; }
        }
    }

    // ── 7. 간편 메모 파서 (원 없는 숫자, N빵/용돈) ──
    if (!parsedAmount) {
        const rawNum = text.match(/(?:^|\s)([0-9][0-9,]*)(?:\s|$)/);
        if (rawNum) {
            parsedAmount = rawNum[1].replace(/,/g, '');
            if (parsedMerchant && parsedMerchant.includes(rawNum[1])) {
                parsedMerchant = parsedMerchant.replace(rawNum[1], '').trim();
            }
        }
    }

    // ── 8. 유형 자동 감지 (환급 / 입금 / 저축 / 지출) ──
    const refundKeywords = ['환급', '용돈', 'n빵', '엔빵', '지원', '받음'];
    const incomeKeywords = ['월급', '급여', '부수입', '월급입금', '급여입금'];
    isRefund = refundKeywords.some(kw => text.toLowerCase().includes(kw));
    const isIncome = !isRefund && incomeKeywords.some(kw => text.includes(kw));

    if (parsedType === 'saving') {
        // 모임통장 저축 자동분류 → 저축 유형
        // (이미 parsedType 세팅됨)
    } else if (isRefund) {
        parsedType = 'refund';
        parsedCategory = 'transfer';
        if (!parsedAuthor) parsedAuthor = '공용';
        if (!parsedMerchant) {
            parsedMerchant = text.replace(/[0-9,]+/g, '').trim().replace(/\s+/g, ' ');
        }
    } else if (isIncome) {
        parsedType = 'income';
        parsedCategory = 'transfer';
    } else {
        parsedType = 'expense';
    }
    if (!parsedAuthor) parsedAuthor = '소리';

    // ── 9. 폼에 값 적용 ──

    // 하이라이트: 월급/부수입 유형이면 수입 메뉴로 자동 이동
    if (parsedType === 'income') {
        const targetMonth = parsedDate ? parsedDate.substring(0, 7) : dashboardMonth;
        switchToSection('income-section');
        const incomeMonthInput = document.getElementById('income-month-input');
        if (incomeMonthInput) {
            incomeMonthInput.value = targetMonth;
            loadIncomeForm(targetMonth);
        }
        const isExtra = text.includes('부수입') || text.includes('기타수입');
        const fieldId = parsedAuthor === '상혁'
            ? (isExtra ? 'inc-sang-extra' : 'inc-sang-salary')
            : (isExtra ? 'inc-sori-extra' : 'inc-sori-salary');
        const fieldEl = document.getElementById(fieldId);
        if (fieldEl && parsedAmount) fieldEl.value = Number(parsedAmount).toLocaleString();
        smsInput.value = '';
        return; // 소비기록 폼 채우지 않음
    }

    if (parsedAmount) document.getElementById('amount-input').value = Number(parsedAmount).toLocaleString();

    if (parsedDate) {
        document.getElementById('date-input').value = parsedDate;
    } else if (!document.getElementById('date-input').value) {
        const today = new Date();
        document.getElementById('date-input').value =
            new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    }

    if (parsedMerchant) document.getElementById('merchant-input').value = parsedMerchant;

    // 카테고리 세팅 (saving은 이제 category에 없으므로 etc로 대체)
    const catSelectEl = document.getElementById('category-select');
    if (catSelectEl) catSelectEl.value = parsedCategory !== 'saving' ? parsedCategory : 'etc';

    // 기록 유형 라디오 세팅 (parsedType 기반)
    const typeRadio = document.querySelector('input[name="tx_type"][value="' + parsedType + '"]');
    if (typeRadio) typeRadio.checked = true;

    // 저축 대상 드롭다운 토글 + 자동 선택
    const saving_group = document.getElementById('saving-target-group');
    const saving_target_sel = document.getElementById('saving-target-select');
    if (saving_group) saving_group.style.display = parsedType === 'saving' ? 'block' : 'none';
    if (saving_target_sel && parsedSavingTarget) saving_target_sel.value = parsedSavingTarget;

    if (parsedAuthor) {
        const radio = document.querySelector('input[name="author"][value="' + parsedAuthor + '"]');
        if (radio) radio.checked = true;
    }
}

// Save Transaction
async function saveTransaction() {
    let type = document.querySelector('input[name="tx_type"]:checked').value;
    const date = document.getElementById('date-input').value;
    const merchant = document.getElementById('merchant-input').value;
    const amount = Number(document.getElementById('amount-input').value.replace(/,/g, ''));
    const category = document.getElementById('category-select').value;
    const author = document.querySelector('input[name="author"]:checked').value;
    const savingTarget = document.getElementById('saving-target-select')?.value || '';

    // (구) category=saving → type 강제 변환 로직 제거됨
    // 이제 tx_type 라디오에서 직접 선택

    // 저축인데 자산 항목 선택 안 한 경우 경고
    if (type === 'saving' && !savingTarget) {
        alert('💰 저축 항목에 반영할 자산을 선택해주세요!');
        return;
    }

    // Duplicate Check logic !!
    const isDuplicate = transactions.some(tx => 
        tx.id !== editingTxId &&
        tx.date === date && 
        tx.merchant === merchant && 
        tx.amount === amount
    );

    if (isDuplicate) {
        alert('⚠️ 이미 동일한 내역이 등록되어 있습니다! (날짜, 사용처, 금액 일치)');
        return;
    }

    const timestamp = editingTxId ? transactions.find(t=>t.id===editingTxId).timestamp : new Date().toISOString();
    
    const newTxData = {
        type, date, merchant, amount, category, author,
        savingTarget: type === 'saving' ? savingTarget : '',
        timestamp
    };

    if (editingTxId) {
        await setDoc(doc(db, 'transactions', editingTxId), newTxData);
        showToast('내역이 멋지게 수정되었습니다!');
        window.cancelEdit();
    } else {
        const newTxId = Date.now().toString();
        await setDoc(doc(db, 'transactions', newTxId), newTxData);

        // ── 저축 자동 자산 반영 ──
        if (type === 'saving' && savingTarget) {
            const txMonth = date.substring(0, 7); // YYYY-MM
            const currentSnap = monthlyAssets[txMonth] || {};
            const updatedSnap = { ...currentSnap };
            // 해당 자산 항목에 금액 누적
            updatedSnap[savingTarget] = (Number(updatedSnap[savingTarget]) || 0) + amount;
            await setDoc(doc(db, 'assets', txMonth), updatedSnap);
            showToast('💰 ' + savingTarget + '에 ' + amount.toLocaleString() + '원 자동 반영 완료!');
        } else {
            showToast('억! 소리 나게 클라우드 저장 완료!');
        }
        
        // 폼 초기화
        smsInput.value = '';
        document.getElementById('amount-input').value = '';
        document.getElementById('merchant-input').value = '';
        document.getElementById('category-select').value = 'food';
        const localDate = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        document.getElementById('date-input').value = localDate;
        document.querySelector('input[name="author"][value="소리"]').checked = true;
        document.querySelector('input[name="tx_type"][value="expense"]').checked = true;
        const savingGroup = document.getElementById('saving-target-group');
        if (savingGroup) savingGroup.style.display = 'none';
        const savingTargetSel = document.getElementById('saving-target-select');
        if (savingTargetSel) savingTargetSel.value = '';
    }
}

// 수정 모드 활성화
window.editTransaction = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    editingTxId = id;
    
    // 네비게이션 시뮬레이트 (입력 탭으로 이동)
    document.querySelector('a[data-target="input-section"]').click();
    
    // 정보 채우기
    let typeRadio = document.querySelector(`input[name="tx_type"][value="${tx.type}"]`);
    if(typeRadio) typeRadio.checked = true;
    else document.querySelector('input[name="tx_type"][value="expense"]').checked = true;
    
    document.getElementById('date-input').value = tx.date;
    document.getElementById('merchant-input').value = tx.merchant;
    document.getElementById('amount-input').value = Number(tx.amount).toLocaleString();
    document.getElementById('category-select').value = tx.category;
    if (tx.author) document.querySelector(`input[name="author"][value="${tx.author}"]`).checked = true;
    
    // 버튼 상태 변환
    document.getElementById('btn-save-tx').innerText = '수정 완료';
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if(cancelBtn) cancelBtn.style.display = 'block';
};

// 수정 취소
window.cancelEdit = function() {
    editingTxId = null;
    document.getElementById('btn-save-tx').innerText = '저장하기';
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if(cancelBtn) cancelBtn.style.display = 'none';
    
    // 폼 초기화
    smsInput.value = '';
    document.getElementById('amount-input').value = '';
    document.getElementById('merchant-input').value = '';
    document.querySelector('input[name="tx_type"][value="expense"]').checked = true;
    document.getElementById('category-select').value = 'food';
    const localDate = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    document.getElementById('date-input').value = localDate;
    document.querySelector('input[name="author"][value="소리"]').checked = true;
};

// Delete Transaction
window.deleteTransaction = async function(id) {
    if (confirm("정말 이 내역을 삭제하시겠습니까?")) {
        await deleteDoc(doc(db, "transactions", id.toString()));
        showToast("내역이 클라우드에서 삭제되었습니다.");
    }
};

// Delete Income
window.deleteIncome = async function(month) {
    if (confirm(month + " 월의 수입 기록을 모두 삭제하시겠습니까?")) {
        await deleteDoc(doc(db, "incomes", month));
        showToast(month + " 수입이 클라우드에서 삭제되었습니다.");
    }
};

// Delete Budget
window.deleteBudget = async function(month) {
    if (confirm(month + " 월의 예산 기록을 삭제하시겠습니까? (이전 달의 세팅을 따라갑니다)")) {
        await deleteDoc(doc(db, "budgets", month));
        showToast(month + " 예산 설정이 삭제되었습니다.");
        
        const currentFormMonth = document.getElementById('budget-month-input').value;
        if (currentFormMonth === month) {
            loadBudgetForm(month);
        }
    }
};

// Render Logic
function renderAll() {
    // Current Local YYYY-MM for Dashboard filtering (Controlled by Dashboard Filter Input)
    const currentMonth = dashboardMonth;

    // Lifetime tracking for Net Worth
    let lifetimeSavings = 0;
    let lifetimeDebtPayments = 0;
    
    // Current Month tracking for Dashboard Widgets
    let monthSavings = 0; // 자산 스냅샷 델타(비교) 값으로 할당될 예정
    let monthExpenses = 0;
    let monthDebtPayments = 0; // Fix ReferenceError

    const tbody = document.createDocumentFragment();
    transactionList.innerHTML = '';
    
    // Filter out transactions strictly by currentMonth for Dashboard List
    const displayTransactionsForMonth = transactions.filter(tx => tx.date.substring(0, 7) === currentMonth);
    // 타입 필터 적용
    const displayList = dashboardTypeFilter === 'all'
        ? displayTransactionsForMonth
        : displayTransactionsForMonth.filter(tx => tx.type === dashboardTypeFilter);

    // [중요 로직] 클라우드 동기화 과정에서 뷰와 실제 폼 데이터가 엇갈리는 현상을 막기 위한 데이터 주입
    const currentAssetMonth = document.getElementById('asset-month-input')?.value;
    if (currentAssetMonth) loadAssetForm(currentAssetMonth);

    const currentIncomeMonth = document.getElementById('income-month-input')?.value;
    if (currentIncomeMonth) loadIncomeForm(currentIncomeMonth);

    const currentBudgetMonth = document.getElementById('budget-month-input')?.value;
    if (currentBudgetMonth) loadBudgetForm(currentBudgetMonth);

    transactions.forEach(tx => {
        // Lifetime Net Worth Additions
        if (tx.type === 'saving') lifetimeSavings += tx.amount;
        if (tx.type === 'refund') lifetimeSavings += tx.amount; // 환급도 통장 잔고 증가효과
        
        // Monthly Dashboard Summaries
        const txMonth = tx.date.substring(0, 7);
        if (txMonth === currentMonth) {
            if (tx.type === 'expense') monthExpenses += tx.amount;
            if (tx.type === 'refund') monthExpenses -= tx.amount; // [지출 방어 로직] 쓴 돈에서 까기
            if (tx.type === 'debt_payment') monthDebtPayments += tx.amount;
        }
    });

    // --- [NEW 핵심 로직] 자산 스냅샷 기반의 '이번 달 총 저축(자산 성장)' 산출 ---
    // 자산 그룹 중 '저축, 투자, 부동산, 연금'에 속하는 항목의 전월 대비 증가분을 '총 저축'으로 계산
    const targetGroups = ['savings', 'investments', 'realestate', 'pension'];
    
    function getAssetSum(monthStr) {
        if (!monthlyAssets[monthStr]) return 0;
        let sum = 0;
        targetGroups.forEach(groupKey => {
            if (assetCategories[groupKey]) {
                assetCategories[groupKey].items.forEach(item => {
                    sum += (monthlyAssets[monthStr][item] || 0);
                });
            }
        });
        return sum;
    }

    // 전월 날짜(YYYY-MM) 안전하게 구하기
    const [currY, currM] = currentMonth.split('-');
    let prevM = parseInt(currM) - 1;
    let prevY = parseInt(currY);
    if(prevM === 0) { prevM = 12; prevY -= 1; }
    const prevMonthStr = prevY + '-' + String(prevM).padStart(2, '0');

    if (monthlyAssets[currentMonth] && monthlyAssets[prevMonthStr]) {
        const currSum = getAssetSum(currentMonth);
        const prevSum = getAssetSum(prevMonthStr);
        monthSavings = currSum - prevSum;
    } else {
        // 비교할 전월 데이터가 없는 등 안전 장치
        monthSavings = 0; 
    }

    // 날짜별 그룹화
    const dateGroups = {};
    displayList.forEach(tx => {
        if (!dateGroups[tx.date]) dateGroups[tx.date] = [];
        dateGroups[tx.date].push(tx);
    });
    const sortedDates = Object.keys(dateGroups).sort().reverse();

    sortedDates.forEach(dateStr => {
        // 날짜 헤더 행
        const headerTr = document.createElement('tr');
        const mm = dateStr.substring(5, 7);
        const dd = dateStr.substring(8, 10);
        const dayNames = ['일','월','화','수','목','금','토'];
        const dayOfWeek = dayNames[new Date(dateStr).getDay()];
        headerTr.innerHTML = '<td colspan="2" style="' +
            'background:var(--bg-color); color:var(--primary-navy); font-weight:700; ' +
            'font-size:0.78rem; padding:8px 4px 4px; border-bottom:2px solid var(--primary-gold)' +
            '">' + mm + '월 ' + dd + '일 (' + dayOfWeek + ')</td>';
        tbody.appendChild(headerTr);

        dateGroups[dateStr].forEach(tx => {
            const tr = document.createElement('tr');

            let typeBadge = '';
            if(tx.type==='expense') typeBadge = '📉 지출';
            else if(tx.type==='income') typeBadge = '📈 월급/부수입';
            else if(tx.type==='saving') typeBadge = '💰 저축';
            else if(tx.type==='refund') typeBadge = '💵 환급';
            else typeBadge = '기타';

            const catLabels = {
                food: '식비', living: '주거', traffic: '교통',
                health: '의료', shopping: '쇼핑', insurance: '보험',
                gift: '선물', transfer: '이체', etc: '기타'
            };
            const catLabel = catLabels[tx.category] || tx.category;

            let displayAmount = tx.amount.toLocaleString() + '원';
            let displayColor = (tx.type === 'expense' ? 'var(--danger)' : 'var(--success)');
            if (tx.type === 'refund' || tx.type === 'saving' || tx.type === 'income') {
                displayAmount = '+' + tx.amount.toLocaleString() + '원';
                displayColor = 'var(--success)';
            }

            const authorShort = tx.author || '-';

            tr.innerHTML =
                '<td><strong style="font-size:0.88rem">' + tx.merchant + '</strong>' +
                '<br><small style="color:var(--text-muted); font-size:0.75rem">' + typeBadge + ' · ' + catLabel + ' · ' + authorShort + '</small></td>' +
                '<td style="font-weight:bold; color:' + displayColor + '; font-size:0.85rem; text-align:right; vertical-align:middle">' +
                displayAmount +
                '<br><span style="display:inline-flex; gap:2px; justify-content:flex-end">' +
                '<button onclick="deleteTransaction(\'' + tx.id + '\')" class="btn-delete" title="삭제" aria-label="삭제" style="font-size:0.9rem; margin:0">&times;</button>' +
                '<button onclick="editTransaction(\'' + tx.id + '\')" class="btn-edit" title="수정" aria-label="수정" style="background:none; border:none; cursor:pointer; color:var(--primary-gold); font-size:0.85rem; padding:0">✏️</button>' +
                '</span></td>';
            tbody.appendChild(tr);
        });
    });
    transactionList.appendChild(tbody);

    // Monthly Income retrieval
    const monthIncomeData = monthlyIncomes[currentMonth] || { soriSal: 0, sangSal: 0, soriEx: 0, sangEx: 0 };
    const monthTotalIncomes = monthIncomeData.soriSal + monthIncomeData.sangSal + monthIncomeData.soriEx + monthIncomeData.sangEx;

    // Summary Boxes Update (Current Month Only!)
    totalIncomeEl.textContent = monthTotalIncomes.toLocaleString() + '원';
    totalExpenseEl.textContent = monthExpenses.toLocaleString() + '원';
    totalSavingEl.textContent = monthSavings.toLocaleString() + '원';

    // Render Income List Table
    const incomeListEl = document.getElementById('income-list');
    if (incomeListEl) {
        incomeListEl.innerHTML = '';
        const sortedMonths = Object.keys(monthlyIncomes).sort().reverse();
        sortedMonths.forEach(m => {
            const d = monthlyIncomes[m];
            const soriTotal = d.soriSal + d.soriEx;
            const sangTotal = d.sangSal + d.sangEx;
            const total = soriTotal + sangTotal;
            const tr = document.createElement('tr');
            tr.innerHTML = 
                '<td><strong>' + m + '</strong></td>' +
                '<td>' + soriTotal.toLocaleString() + '원</td>' +
                '<td>' + sangTotal.toLocaleString() + '원</td>' +
                '<td style="font-weight:bold; color:var(--success)">' + total.toLocaleString() + '원</td>' +
                '<td><button onclick="deleteIncome(\'' + m + '\')" class="btn-delete" title="삭제">&times;</button></td>';
            incomeListEl.appendChild(tr);
        });
    }

    // Render Budget List Table
    const budgetListEl = document.getElementById('budget-list');
    if (budgetListEl) {
        budgetListEl.innerHTML = '';
        const sortedBudgets = Object.keys(monthlyBudgets).sort().reverse();
        sortedBudgets.forEach(m => {
            const b = monthlyBudgets[m];
            const tr = document.createElement('tr');
            tr.innerHTML = 
                '<td><strong>' + m + '</strong></td>' +
                '<td>' + (b.budget || 0).toLocaleString() + '원</td>' +
                '<td style="font-weight:bold; color:var(--success)">' + (b.targetSaving || 0).toLocaleString() + '원</td>' +
                '<td><button onclick="deleteBudget(\'' + m + '\')" class="btn-delete" title="삭제">&times;</button></td>';
            budgetListEl.appendChild(tr);
        });
    }

    // Chart.js Rendering
    renderChart();
    
    // Calculate Net Worth based on the latest snapshot + current month's savings
    let baseAssetTotal = 0;
    let baseDebtTotal = 0;

    // Find applicable month in monthlyAssets (<= currentMonth)
    const sortedAssetMonths = Object.keys(monthlyAssets).sort();
    let targetAssetMonth = null;
    for (let i = sortedAssetMonths.length - 1; i >= 0; i--) {
        if (sortedAssetMonths[i] <= currentMonth) {
            targetAssetMonth = sortedAssetMonths[i];
            break;
        }
    }

    if (targetAssetMonth) {
        const snap = monthlyAssets[targetAssetMonth];
        for (const [key, category] of Object.entries(assetCategories)) {
            category.items.forEach(item => {
                const val = Number(snap[item] || 0);
                if (key === 'debt') {
                    baseDebtTotal += val;
                } else {
                    baseAssetTotal += val;
                }
            });
        }
    }

    const actualAssets = baseAssetTotal; 
    const actualDebt = baseDebtTotal; 
    const netWorth = actualAssets - actualDebt;

    if (netWorthDisplay) netWorthDisplay.textContent = netWorth.toLocaleString() + '원';
    
    const totalAssetDisplay = document.getElementById('total-asset-display');
    if (totalAssetDisplay) totalAssetDisplay.textContent = actualAssets.toLocaleString() + '원';
    
    const totalDebtDisplay = document.getElementById('total-debt-display');
    if (totalDebtDisplay) totalDebtDisplay.textContent = actualDebt.toLocaleString() + '원';

    // Budget & Target Retrieving (Monthly Fallback)
    let currentBudgetData = { budget: 2000000, targetSaving: 1000000 };
    const sortedBudgetMonths = Object.keys(monthlyBudgets).sort();
    for (let i = sortedBudgetMonths.length - 1; i >= 0; i--) {
        if (sortedBudgetMonths[i] <= currentMonth) {
            currentBudgetData = monthlyBudgets[sortedBudgetMonths[i]];
            break;
        }
    }

    const targetSaving = Number(currentBudgetData.targetSaving || 1);
    let ratio = (monthSavings / targetSaving) * 100;
    if (ratio > 100) ratio = 100;
    
    savingProgress.style.width = ratio + '%';
    currentSavingDisplay.textContent = '현재: ' + monthSavings.toLocaleString() + '원';
    targetSavingDisplay.textContent = '목표: ' + targetSaving.toLocaleString() + '원';
    progressPercent.textContent = ratio.toFixed(1) + '%';

    // Calculate Budget Target Status (Monthly Focus)
    const budget = Number(currentBudgetData.budget || 0);
    const remainBudget = budget - monthExpenses;
    
    if (remainBudget < 0) {
        budgetStatus.style.color = "var(--danger)";
        budgetStatus.textContent = '⚠️ 예산 초과! ' + Math.abs(remainBudget).toLocaleString() + '원 적자';
    } else {
        budgetStatus.style.color = "var(--primary-navy)";
        budgetStatus.textContent = '✅ 잔여 생활 예산: ' + remainBudget.toLocaleString() + '원 남음';
    }

    // The inputs for bindings are handled directly inside the budget form now!
}

function loadBudgetForm(month) {
    let data = { budget: 2000000, targetSaving: 1000000 };
    const sortedBudgetMonths = Object.keys(monthlyBudgets).sort();
    for (let i = sortedBudgetMonths.length - 1; i >= 0; i--) {
        if (sortedBudgetMonths[i] <= month) {
            data = monthlyBudgets[sortedBudgetMonths[i]];
            break;
        }
    }
    const bInput = document.getElementById('monthly-budget-input');
    const sInput = document.getElementById('target-saving-input');
    if (bInput) bInput.value = data.budget ? data.budget.toLocaleString() : '';
    if (sInput) sInput.value = data.targetSaving ? data.targetSaving.toLocaleString() : '';
}

// Settings Save (Now Monthly Budget Save)
async function saveSettings() {
    const month = document.getElementById('budget-month-input').value;
    if (!month) return;

    const data = {
        budget: Number(document.getElementById('monthly-budget-input').value.replace(/,/g, '')) || 0,
        targetSaving: Number(document.getElementById('target-saving-input').value.replace(/,/g, '')) || 0
    };

    await setDoc(doc(db, "budgets", month), data);
    showToast(month + " 예산 설정이 클라우드에 안전하게 저장되었습니다!");
}

// Toast Function
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

let assetChartInst = null;
function renderChart() {
    const ctx = document.getElementById('asset-chart');
    if (!ctx) return;
    
    const sortedMonths = Object.keys(monthlyAssets).sort();
    if (sortedMonths.length === 0) return;

    const labels = [];
    const netWorthData = []; // Line chart
    const savingsData = [];
    const investmentsData = [];
    const realestateData = [];
    const pensionData = [];

    sortedMonths.forEach(m => {
        const snap = monthlyAssets[m];
        let cSavings=0, cInvest=0, cReal=0, cPension=0, cDebt=0;
        
        assetCategories['savings'].items.forEach(i => cSavings+=Number(snap[i]||0));
        assetCategories['investments'].items.forEach(i => cInvest+=Number(snap[i]||0));
        assetCategories['realestate'].items.forEach(i => cReal+=Number(snap[i]||0));
        assetCategories['pension'].items.forEach(i => cPension+=Number(snap[i]||0));
        assetCategories['debt'].items.forEach(i => cDebt+=Number(snap[i]||0));

        labels.push(m);
        savingsData.push(cSavings);
        investmentsData.push(cInvest);
        realestateData.push(cReal);
        pensionData.push(cPension);
        
        const tAsset = cSavings + cInvest + cReal + cPension;
        netWorthData.push(tAsset - cDebt);
    });

    if (assetChartInst) {
        assetChartInst.destroy();
    }

    assetChartInst = new Chart(ctx, {
        type: 'bar', // Base Type
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: '순자산 합계',
                    data: netWorthData,
                    borderColor: '#f59e0b', // Vibrant Orange
                    backgroundColor: '#f59e0b',
                    borderWidth: 2,
                    tension: 0,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    z: 10 // draw above bars
                },
                {
                    type: 'bar',
                    label: '저축',
                    data: savingsData,
                    backgroundColor: '#1e3a8a', // Deep navy
                    stack: 'Stack 0',
                },
                {
                    type: 'bar',
                    label: '투자',
                    data: investmentsData,
                    backgroundColor: '#3b82f6', // Blue
                    stack: 'Stack 0',
                },
                {
                    type: 'bar',
                    label: '부동산',
                    data: realestateData,
                    backgroundColor: '#93c5fd', // Light blue
                    stack: 'Stack 0',
                },
                {
                    type: 'bar',
                    label: '연금',
                    data: pensionData,
                    backgroundColor: '#dbeafe', // Very light blue
                    stack: 'Stack 0',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + '원';
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value >= 100000000) return (value / 100000000) + '억';
                            if (value >= 10000) return (value / 10000) + '만';
                            return value;
                        }
                    }
                }
            }
        }
    });
}

// Start
init();
