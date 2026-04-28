const sheetID = "1Sy5uBZkjKpGnLdZp2sFuhFORhO1fRqCswfNYHRl73PM";
const apiKey = "AIzaSyB5VIy4kIySW7bVrjNYMpL5rkqZ7Oe758E";
const sheets = {
    master: encodeURIComponent("Master Data 2026"),
    fees: encodeURIComponent("Fees Collection"),
    aw: encodeURIComponent("AW"),
    ds: encodeURIComponent("DS n Notice")
};
let originalDiscount = 0, globalNotification = "No notice", deferredPrompt;

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    const savedCode = localStorage.getItem("portalLoginCode");
    const savedView = localStorage.getItem("currentView") || "view-dashboard";
    if (savedCode) {
        login(true, savedView);
    } else {
        document.getElementById("loader").style.display = "none";
        document.getElementById("loginBox").style.display = "block";
    }
    window.onpopstate = () => {
        if (document.getElementById("portal").style.display === "block") {
            if (getCurrentVisibleView() !== 'view-dashboard') showView('view-dashboard', true);
        }
    };
});

// --- CORE LOGIN LOGIC ---
async function login(isAuto = false, targetView = 'view-dashboard') {
    const code = isAuto ? localStorage.getItem("portalLoginCode") : document.getElementById("loginCode").value.trim();
    if (!code) { 
        document.getElementById("loader").style.display = "none";
        document.getElementById("loginBox").style.display = "block";
        return; 
    }
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("loader").style.display = "block";
    try {
        const urls = [`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.aw}?key=${apiKey}`,
                      `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.master}?key=${apiKey}`,
                      `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.fees}?key=${apiKey}`,
                      `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.ds}?key=${apiKey}`];
        const resps = await Promise.all(urls.map(u => fetch(u)));
        const data = await Promise.all(resps.map(res => res.json()));
        const student = data[0].values.find(r => r[29] && r[29].trim() === code);
        if (!student) { logout(); return; }
        const mRow = data[1].values.find(r => r[1] == student[1]);
        localStorage.setItem("portalLoginCode", code);
        handlePermissions(data[3].values);
        populateStudentProfile(student, mRow);
        renderFees(student[1], mRow, data[2].values);
        setupDateSheet(data[3].values, mRow[14]);
        document.getElementById("loader").style.display = "none";
        document.getElementById("portal").style.display = "block";
        document.getElementById("notifIcon").style.display = "block";
        if (!history.state) history.pushState({view: 'dashboard'}, "");
        showView(targetView);
        setupSendScreenshotButtons();
    } catch (e) {
        document.getElementById("loginBox").style.display = "block";
        document.getElementById("loader").style.display = "none";
    }
}

// --- NAVIGATION & PWA ---
function showView(viewId, isHardwareBack = false) {
    const views = ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'];
    views.forEach(v => document.getElementById(v).style.display = (v === viewId) ? 'block' : 'none');
    localStorage.setItem("currentView", viewId);
    if (!isHardwareBack && viewId !== 'view-dashboard') history.pushState({view: viewId}, "");
    document.getElementById("installBtn").style.display = "none";
    window.scrollTo(0,0);
}

function getCurrentVisibleView() {
    return ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'].find(id => document.getElementById(id).style.display === 'block');
}

function logout() { localStorage.clear(); location.reload(); }

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    if (document.getElementById("portal").style.display === "none") document.getElementById("installBtn").style.display = "block";
});

document.getElementById("installBtn").onclick = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') document.getElementById("installBtn").style.display = "none";
        deferredPrompt = null;
    }
};

// --- DATA RENDERING ---
function populateStudentProfile(aw, master) {
    const fields = { studentName: aw[3], adm: aw[1], class: master[14], father: aw[6], mother: aw[5], phone: aw[22], address: aw[7] };
    Object.keys(fields).forEach(id => document.getElementById(id).innerText = fields[id] || "N/A");
    document.getElementById("welcomeName").innerText = "Welcome, " + (aw[3] || "Student");
    const photo = document.getElementById("studentPhoto");
    if (aw[28]) {
        const id = aw[28].match(/[-\w]{25,}/);
        if (id) { photo.src = `https://drive.google.com/thumbnail?id=${id[0]}&sz=w500`; photo.style.display = "inline-block"; }
    }
}

function renderFees(adm, mData, fRows) {
    let monthly = parseFloat(mData[4]) || 0, remain = parseFloat(mData[3]) || 0, disc = parseFloat(mData[5]) || 0;
    originalDiscount = disc;
    let tHtml = "", cHtml = "", paid = 0;
    fRows.slice(1).forEach(r => {
        if (r[2] == adm) {
            let amt = parseFloat(r[5]) || 0;
            if (r[7] === "2026-27" && r[6]?.toLowerCase() === "monthly fees") paid += amt;
            tHtml += `<tr><td>${r[1]}</td><td>${r[0]}</td><td>₹${amt}</td><td>${r[6]}</td><td>${r[7]}</td><td>${r[8]}</td><td>${r[9]}</td><td>${r[10]}</td><td>${r[11]}</td></tr>`;
            cHtml += `<div class="fee-card"><div><span class="label">Date:</span> ${r[1]}</div><div><span class="label">Slip Number:</span> ${r[0]}</div><div><span class="label">Amount Paid:</span> ₹${amt}</div><div><span class="label">Fee Type:</span> ${r[6]}</div><div><span class="label">Session:</span> ${r[7]}</div><div><span class="label">Tuition Fee Months:</span> ${r[8]}</div><div><span class="label">Transport Fee Months:</span> ${r[9]}</div><div><span class="label">Exam Fee Months:</span> ${r[10]}</div><div><span class="label">Payment Mode:</span> ${r[11]}</div></div>`;
        }
    });
    document.getElementById("feeTable").innerHTML = tHtml || "<tr><td colspan='9'>No records</td></tr>";
    document.getElementById("feeCards").innerHTML = cHtml || "No records";
    document.getElementById("monthlyTuition").innerText = "₹" + monthly;
    document.getElementById("tuitionMonths").innerText = mData[6];
    document.getElementById("transportFees").innerText = "₹" + (mData[7] || 0);
    document.getElementById("transportMonths").innerText = mData[8];
    document.getElementById("examFee").innerText = "₹" + (mData[9] || 1000);
    document.getElementById("prevRemain").innerText = "₹" + remain;
    document.getElementById("discount").innerText = "₹" + Math.round(disc);
    document.getElementById("totalPaid").innerText = "₹" + paid;
    const totalDue = ((monthly - disc) * (parseFloat(mData[6]) || 0)) + ((parseFloat(mData[7]) || 0) * (parseFloat(mData[8]) || 0)) + (parseFloat(mData[9]) || 1000) + remain;
    const balance = Math.round(totalDue - paid);
    const balEl = document.getElementById("feeBalance");
    balEl.innerText = "₹" + balance; balEl.style.color = balance > 0 ? "red" : "green";
    populateFeeSelectors(parseFloat(mData[9]) || 1000, monthly, parseFloat(mData[7]) || 0, balance);
}

function handlePermissions(rows) {
    if (!rows) return;
    if (rows[13]?.[10] === "Publish") { const b = document.getElementById("btn-datesheet"); b.classList.remove("frozen"); b.onclick = () => showView('view-datesheet'); }
    if (rows[15]?.[10] === "Publish") { const b = document.getElementById("btn-result"); b.classList.remove("frozen"); b.onclick = () => showView('view-result'); }
    if (rows[19]?.[10] === "Publish") { globalNotification = rows[20]?.[9] || "No Notice"; document.getElementById("notifBadge").style.display = "block"; }
}

function showNotification() {
    document.getElementById("notifBadge").style.display = "none";
    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";
    overlay.innerHTML = `<div style="background:white; padding:20px; border-radius:10px; max-width:400px; width:100%; text-align:center;"><h3>📢 Notice</h3><p style="white-space:pre-wrap; text-align:left;">${globalNotification}</p><button onclick="this.parentElement.parentElement.remove()" style="background:#0b3d91; color:white; border:none; padding:10px 20px; border-radius:5px;">Close</button></div>`;
    document.body.appendChild(overlay);
}

function setupDateSheet(rows, sClass) {
    const type = rows[0]?.[1]; document.getElementById("ds-title").innerText = "Date Sheet: " + type;
    let col = -1; for(let j=1; j<=15; j++) { if(rows[1][j] == sClass) col = j; }
    let html = "";
    if(col !== -1) {
        if(type.includes("Half") || type.includes("Annual")) {
            html += `<tr class="ds-type-header"><td colspan="2">Minor Exams</td></tr>`;
            [3, 4].forEach(i => { if(rows[i]?.[0]) html += `<tr><td>${rows[i][0]}</td><td>${rows[i][col] || '-'}</td></tr>`; });
            html += `<tr class="ds-type-header"><td colspan="2">Major Exams</td></tr>`;
        }
        [6, 7, 8, 9, 10, 11].forEach(i => { if(rows[i]?.[0]) html += `<tr><td>${rows[i][0]}</td><td>${rows[i][col] || '-'}</td></tr>`; });
    }
    document.getElementById("dsBody").innerHTML = html || "<tr><td colspan='2'>No data</td></tr>";
}

function populateFeeSelectors(exFee, monthly, transport, balance) {
    const t = document.getElementById("calcTuitionMonths"), tr = document.getElementById("calcTransportMonths"), ex = document.getElementById("calcExamMonths"), res = document.getElementById("calcTotal");
    t.innerHTML = tr.innerHTML = ex.innerHTML = "";
    for(let i=0; i<=12; i++) t.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=0; i<=11; i++) tr.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=0; i<=2; i++) ex.innerHTML += `<option value="${i}">${i}</option>`;
    const update = () => {
        let total = (t.value * (monthly - originalDiscount)) + (tr.value * transport) + (ex.value * (exFee/2));
        res.innerText = "₹" + Math.round(total);
        setupPaymentLink(total, "payNowBtn");
    };
    t.onchange = tr.onchange = ex.onchange = update;
    setupPaymentLink(balance, "payBalanceBtn");
}

function setupPaymentLink(amt, id) {
    document.getElementById(id).onclick = () => {
        if (amt <= 0) return alert("Amount must be > 0");
        const note = encodeURIComponent(`${document.getElementById("adm").innerText} ${document.getElementById("studentName").innerText} FEE`);
        window.location.href = `upi://pay?pa=pinnacleglobalschool.62697340@hdfcbank&pn=Pinnacle Global School&am=${amt}&cu=INR&tn=${note}`;
    };
}

function setupSendScreenshotButtons() {
    const handler = () => {
        const msg = encodeURIComponent(`Payment Done.\nAdm: ${document.getElementById("adm").innerText}\nName: ${document.getElementById("studentName").innerText}`);
        window.location.href = `https://wa.me/917830968000?text=${msg}`;
    };
    document.getElementById("sendScreenshotBalanceBtn").onclick = document.getElementById("sendScreenshotCalcBtn").onclick = handler;
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
