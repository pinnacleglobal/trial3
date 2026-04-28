const sheetID = "1Sy5uBZkjKpGnLdZp2sFuhFORhO1fRqCswfNYHRl73PM";
const apiKey = "AIzaSyB5VIy4kIySW7bVrjNYMpL5rkqZ7Oe758E";

const sheets = {
    master: encodeURIComponent("Master Data 2026"),
    fees: encodeURIComponent("Fees Collection"),
    aw: encodeURIComponent("AW"),
    ds: encodeURIComponent("DS n Notice")
};

let originalDiscount = 0;
let globalNotification = "No notification to show";
let deferredPrompt;

// --- INITIALIZATION & SESSION CHECK ---
document.addEventListener("DOMContentLoaded", () => {
    const savedCode = localStorage.getItem("portalLoginCode");
    const savedView = localStorage.getItem("currentView") || "view-dashboard";
    const loginBox = document.getElementById("loginBox");
    const loader = document.getElementById("loader");

    if (savedCode) {
        // We have a session, try to login automatically
        login(true, savedView);
    } else {
        // No session, show login screen immediately
        loader.style.display = "none";
        loginBox.style.display = "block";
    }

    // Safety Timeout: If nothing happens in 8 seconds, show login box
    setTimeout(() => {
        if (loader.style.display !== "none" && document.getElementById("portal").style.display === "none") {
            loader.style.display = "none";
            loginBox.style.display = "block";
        }
    }, 8000);

    // Mobile Back Button Logic
    window.onpopstate = function() {
        if (document.getElementById("portal").style.display === "block") {
            const current = getCurrentVisibleView();
            if (current !== 'view-dashboard') showView('view-dashboard', true);
        }
    };
});

async function login(isAuto = false, targetView = 'view-dashboard') {
    const codeInput = document.getElementById("loginCode");
    const loginBox = document.getElementById("loginBox");
    const loader = document.getElementById("loader");
    const code = isAuto ? localStorage.getItem("portalLoginCode") : codeInput.value.trim();

    if (!code) {
        loader.style.display = "none";
        loginBox.style.display = "block";
        return;
    }

    loginBox.style.display = "none";
    loader.style.display = "block";

    try {
        const urls = [
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.aw}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.master}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.fees}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.ds}?key=${apiKey}`
        ];

        const responses = await Promise.all(urls.map(url => fetch(url)));
        const data = await Promise.all(responses.map(res => res.json()));

        // Check if data is valid
        if (!data[0].values) throw new Error("Could not fetch data");

        const student = data[0].values.find(r => r[29] && r[29].trim() === code);
        
        if (!student) {
            if (!isAuto) alert("Invalid Login Code");
            logout();
            return;
        }

        const mRow = (data[1].values || []).find(r => r[1] == student[1]);
        if (!mRow) {
            alert("Master Data missing. Contact Admin.");
            logout();
            return;
        }

        localStorage.setItem("portalLoginCode", code);

        handlePermissions(data[3].values);
        populateStudentProfile(student, mRow);
        renderFees(student[1], mRow, data[2].values);
        setupDateSheet(data[3].values, mRow[14]);

        loader.style.display = "none";
        document.getElementById("portal").style.display = "block";
        document.getElementById("notifIcon").style.display = "block";
        
        if (!history.state) history.pushState({view: 'dashboard'}, "");
        showView(targetView);
        setupSendScreenshotButtons();

    } catch (e) {
        console.error("Login Error:", e);
        loader.style.display = "none";
        loginBox.style.display = "block";
    }
}

// --- PWA INSTALL LOGIC ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show button only if we are at the login stage
    if (document.getElementById("portal").style.display === "none") {
        document.getElementById("installBtn").style.display = "block";
    }
});

document.getElementById("installBtn").onclick = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') document.getElementById("installBtn").style.display = "none";
        deferredPrompt = null;
    }
};

// --- CORE NAVIGATION FUNCTIONS ---
function showView(viewId, isHardwareBack = false) {
    const views = ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if(el) el.style.display = (v === viewId) ? 'block' : 'none';
    });

    localStorage.setItem("currentView", viewId);
    
    if (!isHardwareBack && viewId !== 'view-dashboard') {
        history.pushState({view: viewId}, "");
    }
    
    // Always hide install button when inside the portal
    document.getElementById("installBtn").style.display = "none";
    window.scrollTo(0,0);
}

function getCurrentVisibleView() {
    const views = ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'];
    return views.find(id => document.getElementById(id).style.display === 'block');
}

function logout() {
    localStorage.clear();
    location.reload();
}

// --- DATA RENDERING FUNCTIONS ---
function renderFees(adm, mData, fRows) {
    let monthly = parseFloat(mData[4]) || 0;
    let remain = parseFloat(mData[3]) || 0;
    let disc = parseFloat(mData[5]) || 0;
    originalDiscount = disc;
    let tableHtml = "", cardsHtml = "", totalPaid = 0;

    fRows.slice(1).forEach(r => {
        if (r[2] == adm) {
            let amt = parseFloat(r[5]) || 0;
            if (r[7] === "2026-27" && r[6]?.toLowerCase() === "monthly fees") totalPaid += amt;
            
            tableHtml += `<tr><td>${r[1]||''}</td><td>${r[0]||''}</td><td>₹${amt}</td><td>${r[6]||''}</td><td>${r[7]||''}</td><td>${r[8]||''}</td><td>${r[9]||''}</td><td>${r[10]||''}</td><td>${r[11]||''}</td></tr>`;
            
            cardsHtml += `<div class="fee-card">
                <div><span class="label">Date:</span> ${r[1]||''}</div>
                <div><span class="label">Slip Number:</span> ${r[0]||''}</div>
                <div><span class="label">Amount Paid:</span> ₹${amt}</div>
                <div><span class="label">Fee Type:</span> ${r[6]||''}</div>
                <div><span class="label">Session:</span> ${r[7]||''}</div>
                <div><span class="label">Tuition Fee Months:</span> ${r[8]||''}</div>
                <div><span class="label">Transport Fee Months:</span> ${r[9]||''}</div>
                <div><span class="label">Exam Fee Months:</span> ${r[10]||''}</div>
                <div><span class="label">Payment Mode:</span> ${r[11]||''}</div>
            </div>`;
        }
    });

    document.getElementById("feeTable").innerHTML = tableHtml || "<tr><td colspan='9'>No records found</td></tr>";
    document.getElementById("feeCards").innerHTML = cardsHtml || "No records found";
    
    document.getElementById("monthlyTuition").innerText = "₹" + monthly;
    document.getElementById("tuitionMonths").innerText = mData[6] || 0;
    document.getElementById("transportFees").innerText = "₹" + (mData[7] || 0);
    document.getElementById("transportMonths").innerText = mData[8] || 0;
    document.getElementById("examFee").innerText = "₹" + (mData[9] || 1000);
    document.getElementById("prevRemain").innerText = "₹" + remain;
    document.getElementById("discount").innerText = "₹" + Math.round(disc);

    let totalFee = ((monthly - disc) * (parseFloat(mData[6]) || 0)) + ((parseFloat(mData[7]) || 0) * (parseFloat(mData[8]) || 0)) + (parseFloat(mData[9]) || 1000) + remain;
    let balance = Math.round(totalFee - totalPaid);

    document.getElementById("totalPaid").innerText = "₹" + totalPaid;
    const balEl = document.getElementById("feeBalance");
    balEl.innerText = "₹" + balance;
    balEl.style.color = balance > 0 ? "red" : "green";

    populateFeeSelectors(parseFloat(mData[9]) || 1000, monthly, parseFloat(mData[7]) || 0);
    setupPaymentLink(balance, "payBalanceBtn");
}

function handlePermissions(rows) {
    if (!rows) return;
    if (rows[13]?.[10] === "Publish") { 
        const b = document.getElementById("btn-datesheet"); 
        if(b) { b.classList.remove("frozen"); b.onclick = () => showView('view-datesheet'); }
    }
    if (rows[15]?.[10] === "Publish") { 
        const b = document.getElementById("btn-result"); 
        if(b) { b.classList.remove("frozen"); b.onclick = () => showView('view-result'); }
    }
    if (rows[19]?.[10] === "Publish") globalNotification = rows[20]?.[9] || "No notification to show";
}

function populateStudentProfile(aw, master) {
    document.getElementById("welcomeName").innerText = "Welcome, " + (aw[3] || "Student");
    document.getElementById("studentName").innerText = aw[3] || "N/A";
    document.getElementById("adm").innerText = aw[1] || "N/A";
    document.getElementById("class").innerText = master[14] || "N/A";
    document.getElementById("father").innerText = aw[6] || "N/A";
    document.getElementById("mother").innerText = aw[5] || "N/A";
    document.getElementById("phone").innerText = aw[22] || "N/A";
    document.getElementById("address").innerText = aw[7] || "N/A";
    const photoImg = document.getElementById("studentPhoto");
    if (aw[28]) {
        const fileIdMatch = aw[28].match(/[-\w]{25,}/);
        if (fileIdMatch) { 
            photoImg.src = `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w500`; 
            photoImg.onload = () => photoImg.style.display = "inline-block"; 
        }
    }
}

function setupDateSheet(rows, studentClass) {
    if (!rows || rows.length < 2) return;
    const examType = rows[0]?.[1] || ""; 
    document.getElementById("ds-title").innerText = "Date Sheet: " + examType;
    let classCol = -1;
    for(let j=1; j<=15; j++) { if(rows[1][j] == studentClass) { classCol = j; break; } }
    let html = "";
    if(classCol !== -1) {
        if(examType.includes("Half Yearly") || examType.includes("Annual")) {
            html += `<tr class="ds-type-header"><td colspan="2">Minor Exams</td></tr>`;
            [3, 4].forEach(idx => { if(rows[idx]?.[0]) html += `<tr><td>${rows[idx][0]}</td><td>${rows[idx][classCol] || '-'}</td></tr>`; });
            html += `<tr class="ds-type-header"><td colspan="2">Major Exams</td></tr>`;
        }
        [6, 7, 8, 9, 10, 11].forEach(idx => { if(rows[idx]?.[0]) html += `<tr><td>${rows[idx][0]}</td><td>${rows[idx][classCol] || '-'}</td></tr>`; });
    }
    document.getElementById("dsBody").innerHTML = html || "<tr><td colspan='2'>Nothing to show</td></tr>";
}

function populateFeeSelectors(exFee, monthly, transport) {
    const t = document.getElementById("calcTuitionMonths"), 
          tr = document.getElementById("calcTransportMonths"), 
          ex = document.getElementById("calcExamMonths"), 
          res = document.getElementById("calcTotal");
    if(!t || !tr || !ex || !res) return;
    t.innerHTML = tr.innerHTML = ex.innerHTML = "";
    for(let i=0; i<=12; i++) t.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=0; i<=11; i++) tr.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=0; i<=2; i++) ex.innerHTML += `<option value="${i}">${i}</option>`;
    const updateCalc = () => {
        let total = (t.value * (monthly - originalDiscount)) + (tr.value * transport) + (ex.value * (exFee/2));
        res.innerText = "₹" + Math.round(total);
        setupPaymentLink(total, "payNowBtn");
    };
    t.onchange = tr.onchange = ex.onchange = updateCalc;
}

function setupPaymentLink(amount, btnId) {
    const btn = document.getElementById(btnId);
    if(!btn) return;
    btn.onclick = () => {
        if (amount <= 0) return alert("Enter amount > 0");
        const adm = document.getElementById("adm").innerText;
        const name = document.getElementById("studentName").innerText;
        const note = encodeURIComponent(`${adm} ${name} FEE`);
        window.location.href = `upi://pay?pa=pinnacleglobalschool.62697340@hdfcbank&pn=Pinnacle Global School&am=${amount}&cu=INR&tn=${note}`;
    };
}

function setupSendScreenshotButtons() {
    const handler = () => {
        const adm = document.getElementById("adm").innerText;
        const name = document.getElementById("studentName").innerText;
        const msg = encodeURIComponent(`Hello, I have completed the payment.\nAdmission No: ${adm}\nName: ${name}`);
        window.location.href = `https://wa.me/917830968000?text=${msg}`;
    };
    const b1 = document.getElementById("sendScreenshotBalanceBtn");
    const b2 = document.getElementById("sendScreenshotCalcBtn");
    if(b1) b1.onclick = handler;
    if(b2) b2.onclick = handler;
}

// Custom Notification Logic (No URL shown)
function showNotification() {
    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";
    overlay.innerHTML = `<div style="background:white; padding:20px; border-radius:10px; max-width:400px; width:100%; text-align:center; box-shadow:0 5px 15px rgba(0,0,0,0.3);">
        <h3 style="margin-top:0; color:#0b3d91;">📢 School Notice</h3>
        <p style="white-space:pre-wrap; text-align:left; font-size:14px; color:#333;">${globalNotification}</p>
        <button onclick="this.parentElement.parentElement.remove()" style="margin-top:15px; background:#0b3d91; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold;">Close</button>
    </div>`;
    document.body.appendChild(overlay);
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
    .then(() => console.log("Service Worker Registered"))
    .catch(err => console.log("Service Worker Failed", err));
}
