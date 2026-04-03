// app.js

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

// Initial state
let settings = JSON.parse(localStorage.getItem('moneyManagerSettings')) || defaultSettings;
let transactions = JSON.parse(localStorage.getItem('moneyManagerTransactions')) || [];
let monthlyIncomes = JSON.parse(localStorage.getItem('moneyManagerIncomes')) || {};
let monthlyAssets = JSON.parse(localStorage.getItem('moneyManagerAssets')) || {};
let monthlyBudgets = JSON.parse(localStorage.getItem('moneyManagerBudgets')) || {};

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
    renderAll();
    setupSPARouting();
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
                '<input type="number" data-asset-id="' + item + '" placeholder="0">';
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
}

function loadIncomeForm(month) {
    const data = monthlyIncomes[month] || { soriSal: 0, sangSal: 0, soriEx: 0, sangEx: 0 };
    document.getElementById('inc-sori-salary').value = data.soriSal || '';
    document.getElementById('inc-sang-salary').value = data.sangSal || '';
    document.getElementById('inc-sori-extra').value = data.soriEx || '';
    document.getElementById('inc-sang-extra').value = data.sangEx || '';
}

function saveIncome() {
    const month = document.getElementById('income-month-input').value;
    if (!month) return;

    monthlyIncomes[month] = {
        soriSal: Number(document.getElementById('inc-sori-salary').value) || 0,
        sangSal: Number(document.getElementById('inc-sang-salary').value) || 0,
        soriEx: Number(document.getElementById('inc-sori-extra').value) || 0,
        sangEx: Number(document.getElementById('inc-sang-extra').value) || 0
    };
    
    localStorage.setItem('moneyManagerIncomes', JSON.stringify(monthlyIncomes));
    showToast(month + " 수입 내역이 저장되었습니다!");
    renderAll();
}

// Asset Form Helpers
function loadAssetForm(month) {
    const data = monthlyAssets[month] || {};
    const assetInputs = document.querySelectorAll('#dynamic-assets-container input[data-asset-id]');
    assetInputs.forEach(input => {
        const id = input.getAttribute('data-asset-id');
        input.value = data[id] || 0;
    });
}

function saveAssets() {
    const month = document.getElementById('asset-month-input').value;
    if (!month) return;

    const data = {};
    const assetInputs = document.querySelectorAll('#dynamic-assets-container input[data-asset-id]');
    assetInputs.forEach(input => {
        const id = input.getAttribute('data-asset-id');
        data[id] = Number(input.value) || 0;
    });

    monthlyAssets[month] = data;
    localStorage.setItem('moneyManagerAssets', JSON.stringify(monthlyAssets));
    showToast(month + " 자산 스냅샷이 든든하게 저장되었습니다!");
    renderAll();
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

    // Extract Merchant from remaining text heuristically
    
    // 1) Toss Bank style marker (e.g. "결제 | 고덕드림약국")
    const tossMatch = text.match(/결제\s*\|\s*([^\n\r]+)/);
    // 2) Samsung Card style time marker (e.g. "17:28 서울강정형외과의")
    const timeMatch = text.match(/\d{2}:\d{2}\s+(.+)$/);

    if (tossMatch) {
        parsedMerchant = tossMatch[1].trim();
    } else if (timeMatch) {
        parsedMerchant = timeMatch[1].trim();
    } else if (amountMatch) {
        // 3) Find the word immediately preceding the amount on the same line
        const lines = text.split('\n');
        for (let line of lines) {
            if (line.includes(amountMatch[0])) {
                const parts = line.substring(0, line.indexOf(amountMatch[0])).trim().split(/\s+/);
                if (parts.length > 0 && parts[parts.length - 1] !== '') {
                    parsedMerchant = parts[parts.length - 1]; // e.g. "약국 7200원" -> "약국"
                }
                break;
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

    // 5. Apply Values directly to inputs (Immediately reflected)
    if (parsedAmount) document.getElementById('amount-input').value = parsedAmount;
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
    if (parsedSharedType) document.querySelector('input[name="shared_type"][value="' + parsedSharedType + '"]').checked = true;
}

// Save Transaction
function saveTransaction() {
    let type = document.getElementById('type-select').value;
    const date = document.getElementById('date-input').value;
    const merchant = document.getElementById('merchant-input').value;
    const amount = Number(document.getElementById('amount-input').value);
    const category = document.getElementById('category-select').value;
    const author = document.querySelector('input[name="author"]:checked').value;
    const sharedType = document.querySelector('input[name="shared_type"]:checked').value;

    // 만약 카테고리가 '저축'이라면 type을 강제로 'saving'으로 맞춰줍니다.
    if (category === 'saving') {
        type = 'saving';
    }

    // Duplicate Check logic !!
    const isDuplicate = transactions.some(tx => 
        tx.date === date && 
        tx.merchant === merchant && 
        tx.amount === amount
    );

    if (isDuplicate) {
        alert("⚠️ 이미 동일한 내역이 등록되어 있습니다! (날짜, 사용처, 금액 일치)");
        return; // do not save
    }

    const newTx = {
        id: Date.now(),
        type, date, merchant, amount, category, author, sharedType,
        timestamp: new Date().toISOString()
    };

    transactions.unshift(newTx);
    localStorage.setItem('moneyManagerTransactions', JSON.stringify(transactions));
    
    // Completely clear forms!
    smsInput.value = '';
    document.getElementById('amount-input').value = '';
    document.getElementById('merchant-input').value = '';
    document.getElementById('type-select').value = 'expense';
    document.getElementById('category-select').value = 'food';
    
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    document.getElementById('date-input').value = localDate;
    
    document.querySelector('input[name="author"][value="소리"]').checked = true;
    document.querySelector('input[name="shared_type"][value="공용"]').checked = true;

    showToast("억! 소리 나게 저축 완료!");
    renderAll();
}

// Delete Transaction
window.deleteTransaction = function(id) {
    if (confirm("정말 이 내역을 삭제하시겠습니까?")) {
        transactions = transactions.filter(tx => tx.id !== id);
        localStorage.setItem('moneyManagerTransactions', JSON.stringify(transactions));
        renderAll();
        showToast("내역이 삭제되었습니다.");
    }
};

// Delete Income
window.deleteIncome = function(month) {
    if (confirm(month + " 월의 수입 기록을 모두 삭제하시겠습니까? (삭제된 수치는 대시보드와 자산계산에서 제외됩니다.)")) {
        delete monthlyIncomes[month];
        localStorage.setItem('moneyManagerIncomes', JSON.stringify(monthlyIncomes));
        renderAll();
        showToast(month + " 수입이 삭제되었습니다.");
    }
};

// Delete Budget
window.deleteBudget = function(month) {
    if (confirm(month + " 월의 예산 기록을 삭제하시겠습니까? (삭제 시 해당 월의 예산은 이전 달의 세팅을 따라갑니다.)")) {
        delete monthlyBudgets[month];
        localStorage.setItem('moneyManagerBudgets', JSON.stringify(monthlyBudgets));
        renderAll();
        showToast(month + " 예산 설정이 삭제되었습니다.");
        
        // If the deleted budget is the currently viewed one in the setting form, reload the form
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

    transactions.forEach(tx => {
        // Lifetime Net Worth Additions
        if (tx.type === 'saving') lifetimeSavings += tx.amount;
        if (tx.type === 'debt_payment') lifetimeDebtPayments += tx.amount;

        // Monthly Dashboard Summaries
        const txMonth = tx.date.substring(0, 7);
        if (txMonth === currentMonth) {
            if (tx.type === 'saving') monthSavings += tx.amount;
            if (tx.type === 'expense') monthExpenses += tx.amount;
            if (tx.type === 'debt_payment') monthDebtPayments += tx.amount;
        }
    });

    displayList.forEach(tx => {
        const tr = document.createElement('tr');
        
        let typeBadge = '';
        if(tx.type==='expense') typeBadge = '📉 지출';
        else if(tx.type==='income') typeBadge = '📈 수입';
        else if(tx.type==='saving') typeBadge = '💰 저축';
        else typeBadge = '💸 부채상환';

        tr.innerHTML = 
            '<td>' + tx.date.substring(5) + '</td>' +
            '<td><strong>' + tx.merchant + '</strong><br><small>' + typeBadge + ' / ' + tx.category + '</small></td>' +
            '<td>' + tx.author + '<br><small>' + tx.sharedType + '</small></td>' +
            '<td style="font-weight:bold; color: ' + (tx.type === 'expense' ? 'var(--danger)' : 'var(--success)') + '">' + 
            tx.amount.toLocaleString() + '원' +
            '<button onclick="deleteTransaction(' + tx.id + ')" class="btn-delete" title="삭제" aria-label="삭제">&times;</button>' +
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
    if (bInput) bInput.value = data.budget || '';
    if (sInput) sInput.value = data.targetSaving || '';
}

// Settings Save (Now Monthly Budget Save)
function saveSettings() {
    const month = document.getElementById('budget-month-input').value;
    if (!month) return;

    monthlyBudgets[month] = {
        budget: Number(document.getElementById('monthly-budget-input').value) || 0,
        targetSaving: Number(document.getElementById('target-saving-input').value) || 0
    };

    localStorage.setItem('moneyManagerBudgets', JSON.stringify(monthlyBudgets));
    renderAll();
    showToast(month + " 예산 설정이 안전하게 저장되었습니다!");
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
