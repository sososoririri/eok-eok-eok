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

// Smart Parsing Engine
function parseSMS() {
    const text = smsInput.value;
    if (!text.trim()) return;

    let parsedAmount = null;
    let parsedDate = null;
    let parsedMerchant = null;
    let parsedAuthor = null;
    let parsedSharedType = null;
    let parsedCategory = 'etc';

    // 1. Amount Parsing
    // Match "154,300원" or "7200원"
    const amountMatch = text.match(/([0-9,]+)(?:원)/);
    if (amountMatch) {
        parsedAmount = amountMatch[1].replace(/,/g, '');
    }

    // 2. Date Parsing
    // Pattern: 2026-04-03
    const fullDateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
    // Pattern: 03/30
    const shortDateMatch = text.match(/(\d{2})\/(\d{2})/);

    if (fullDateMatch) {
        parsedDate = fullDateMatch[0];
    } else if (shortDateMatch) {
        const year = new Date().getFullYear();
        parsedDate = year + '-' + shortDateMatch[1] + '-' + shortDateMatch[2];
    }

    // 3. Keyword Mappings
    if (text.includes('삼성카드') || text.includes('삼성') || text.includes('강*리')) {
        parsedAuthor = '소리';
    }
    if (text.includes('상혁') || text.includes('이*혁')) {
        parsedAuthor = '상혁';
    }
    if (text.includes('모임통장') || text.includes('부부통장')) {
        parsedSharedType = '공용';
    }

    // 4. Category and Merchant Mapping
    const categories = {
        food: ['마트', '식당', '배달', '스타벅스', '커피'],
        health: ['병원', '약국', '의원', '치과', '정형외과'],
        traffic: ['주유', '택시', '카카오T', '교통'],
        shopping: ['톤28', '올리브영', '쇼핑', '쿠팡']
    };

    outerLoop: for (const [cat, keywords] of Object.entries(categories)) {
        for (let keyword of keywords) {
            if (text.includes(keyword)) {
                parsedCategory = cat;
                break outerLoop;
            }
        }
    }

    // Extract Merchant from remaining text heuristically (Bulletproof Line Scanner)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    for (let line of lines) {
        // 금액이 포함된 줄(예: 10,700원 일시불, 누적1,579,160원)은 이름이 아님! 패스!
        if (line.match(/[0-9,]+원/)) continue;
        // 카드 승인/거절 메시지 줄은 패스!
        if (line.includes('승인') && line.includes('삼성')) continue;
        if (line.includes('카드')) continue;

        // 시간에 섞여있는 정보 추출 (예: "04/02 12:15 풀동네판교점")
        if (line.match(/\d{2}:\d{2}/)) {
            let stripped = line.replace(/\d{4}-\d{2}-\d{2}/, '') // "2026-04-03" 제거
                               .replace(/\d{2}\/\d{2}/, '')      // "04/02" 제거
                               .replace(/\d{2}:\d{2}/, '')       // "12:15" 제거
                               .trim();
            // 시간/날짜를 걷어냈더니 무언가 남았다면 그게 바로 사용처!
            if (stripped) {
                parsedMerchant = stripped;
                break;
            }
        } else {
            // 시간조차 없고 순수 텍스트만 있는 줄 (카카오페이 / 토스뱅크 등)
            // '결제 | 약국' 같은 형태
            const tossMatch = line.match(/결제\s*\|\s*(.+)/);
            if (tossMatch) {
                parsedMerchant = tossMatch[1].trim();
                break;
            }
            
            // 일반 텍스트 줄 중 숫자 범벅이 아닌 경우
            if (line.match(/[가-힣a-zA-Z]/) && !line.match(/\d{6,}/)) {
                 parsedMerchant = line;
            }
        }
    }

    // Clean up parsed merchant to remove trailing balance/accumulated info
    if (parsedMerchant) {
        const stopWords = ['누적', '잔액', '일시불'];
        for (let word of stopWords) {
            const idx = parsedMerchant.indexOf(word);
            if (idx !== -1) {
                parsedMerchant = parsedMerchant.substring(0, idx).trim();
            }
        }
    }

    // 4.5. 짧은 메모 파서 (N빵, 용돈 등 패턴 매치)
    if (!parsedAmount) {
        // '원'이 없는 단순 숫자 매칭 (예: "아빠 코스트코 엔빵 50000")
        const rawNumbers = text.match(/(?:\s|^)(\d+[\d,]*)(?:\s|$)/);
        if (rawNumbers) {
            parsedAmount = rawNumbers[1].replace(/,/g, '');
            // 이미 사용처에 전체 문장이 다 잡혀있다면, 사용처에서 방금 발견한 '금액' 부분은 도려냅니다!
            if (parsedMerchant && parsedMerchant.includes(rawNumbers[1])) {
                parsedMerchant = parsedMerchant.replace(rawNumbers[1], '').trim();
            }
        }
    }

    const refundKeywords = ['환급', '용돈', 'n빵', '엔빵', '지원', '받음'];
    let isRefundMemo = false;
    for (let kw of refundKeywords) {
        if (text.toLowerCase().includes(kw)) {
            isRefundMemo = true;
            break;
        }
    }

    if (isRefundMemo) {
        // 환급/이체 내역으로 자동 인식!
        document.querySelector('input[name="tx_type"][value="refund"]').checked = true;
        parsedCategory = 'transfer';
        parsedAuthor = '공용'; // 결제자는 기본적으로 '공용/기타'

        // 금액을 제외한 나머지 글자들을 사용처로 예쁘게 조합
        if (!parsedMerchant || parsedMerchant.length === 0) {
            let memoWithoutNumbers = text.replace(/[0-9,]+/g, '').trim();
            parsedMerchant = memoWithoutNumbers.replace(/\s+/g, ' '); 
        }
    } else {
        document.querySelector('input[name="tx_type"][value="expense"]').checked = true;
        // 일반 지출 메모라도 결제자를 방어적으로 세팅
        if(!parsedAuthor) parsedAuthor = '소리';
    }

    // 5. Apply Values directly to inputs (Immediately reflected)
    if (parsedAmount) document.getElementById('amount-input').value = Number(parsedAmount).toLocaleString();
    if (parsedDate) {
        document.getElementById('date-input').value = parsedDate;
    } else if (!document.getElementById('date-input').value) {
        // 문자에 날짜가 없고, 인풋이 비어있다면 로컬 오늘 날짜로 방어 세팅
        const today = new Date();
        const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        document.getElementById('date-input').value = localDate;
    }
    
    if (parsedMerchant && parsedMerchant !== '승인') document.getElementById('merchant-input').value = parsedMerchant;
    document.getElementById('category-select').value = parsedCategory;
    
    if (parsedAuthor) document.querySelector('input[name="author"][value="' + parsedAuthor + '"]').checked = true;
}

// Save Transaction
async function saveTransaction() {
    let type = document.querySelector('input[name="tx_type"]:checked').value;
    const date = document.getElementById('date-input').value;
    const merchant = document.getElementById('merchant-input').value;
    const amount = Number(document.getElementById('amount-input').value.replace(/,/g, ''));
    const category = document.getElementById('category-select').value;
    const author = document.querySelector('input[name="author"]:checked').value;

    // 만약 카테고리가 '저축'이라면 type을 강제로 'saving'으로 맞춰줍니다.
    if (category === 'saving') {
        type = 'saving';
    }

    // Duplicate Check logic !!
    const isDuplicate = transactions.some(tx => 
        tx.id !== editingTxId && // 자신이 아닌 다른 내역 중 중복 검사
        tx.date === date && 
        tx.merchant === merchant && 
        tx.amount === amount
    );

    if (isDuplicate) {
        alert("⚠️ 이미 동일한 내역이 등록되어 있습니다! (날짜, 사용처, 금액 일치)");
        return; // do not save
    }

    const timestamp = editingTxId ? transactions.find(t=>t.id===editingTxId).timestamp : new Date().toISOString();
    
    const newTxData = {
        type, date, merchant, amount, category, author,
        timestamp: timestamp
    };

    if (editingTxId) {
        // 기존 덮어쓰기 로직
        await setDoc(doc(db, "transactions", editingTxId), newTxData);
        showToast("내역이 멋지게 수정되었습니다!");
        window.cancelEdit();
    } else {
        // 신규 저장 로직
        const newTxId = Date.now().toString();
        await setDoc(doc(db, "transactions", newTxId), newTxData);
        
        // Completely clear forms!
        smsInput.value = '';
        document.getElementById('amount-input').value = '';
        document.getElementById('merchant-input').value = '';
        document.getElementById('type-select').value = 'expense';
        document.getElementById('category-select').value = 'food';
        const localDate = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        document.getElementById('date-input').value = localDate;
        document.querySelector('input[name="author"][value="소리"]').checked = true;
    
        showToast("억! 소리 나게 클라우드 저축 완료!");
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
    let monthSavings = 0;
    let monthExpenses = 0;
    let monthDebtPayments = 0; // Fix ReferenceError

    const tbody = document.createDocumentFragment();
    transactionList.innerHTML = '';
    
    // Filter out transactions strictly by currentMonth for Dashboard List
    const displayTransactionsForMonth = transactions.filter(tx => tx.date.substring(0, 7) === currentMonth);
    const displayList = displayTransactionsForMonth.slice(0, 10);

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
            if (tx.type === 'saving') monthSavings += tx.amount;
            if (tx.type === 'expense') monthExpenses += tx.amount;
            if (tx.type === 'refund') monthExpenses -= tx.amount; // [지출 방어 로직] 쓴 돈에서 까기
            if (tx.type === 'debt_payment') monthDebtPayments += tx.amount;
        }
    });

    displayList.forEach(tx => {
        const tr = document.createElement('tr');
        
        let typeBadge = '';
        if(tx.type==='expense') typeBadge = '📉 지출';
        else if(tx.type==='income') typeBadge = '📈 수입';
        else if(tx.type==='saving') typeBadge = '💰 저축';
        else if(tx.type==='refund') typeBadge = '📈 입금/환급';
        else typeBadge = '💸 부채상환';

        let displayAmount = tx.amount.toLocaleString() + '원';
        let displayColor = (tx.type === 'expense' ? 'var(--danger)' : 'var(--success)');
        if (tx.type === 'refund' || tx.type === 'saving') {
            displayAmount = '+' + tx.amount.toLocaleString() + '원';
            displayColor = 'var(--success)'; 
        }

        tr.innerHTML = 
            '<td>' + tx.date.substring(5) + '</td>' +
            '<td><strong>' + tx.merchant + '</strong><br><small>' + typeBadge + ' / ' + tx.category + '</small></td>' +
            '<td>' + (tx.author || '-') + '</td>' +
            '<td style="font-weight:bold; color: ' + displayColor + '">' + 
            displayAmount + 
            '<button onclick="deleteTransaction(\'' + tx.id + '\')" class="btn-delete" title="삭제" aria-label="삭제">&times;</button>' +
            '<button onclick="editTransaction(\'' + tx.id + '\')" class="btn-edit" title="수정" aria-label="수정" style="background:none; border:none; cursor:pointer; color:var(--primary-gold); font-size:1rem; margin-left:5px;">✏️</button>' +
            '</td>';
        tbody.appendChild(tr);
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

    const actualAssets = baseAssetTotal + monthSavings; // Only add this month's savings to the snapshot base
    const actualDebt = baseDebtTotal - monthDebtPayments; // Only subtract this month's debt payments
    const netWorth = actualAssets - actualDebt;

    netWorthDisplay.textContent = netWorth.toLocaleString() + '원';

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
