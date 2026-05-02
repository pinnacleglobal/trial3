const sheetID = "1Sy5uBZkjKpGnLdZp2sFuhFORhO1fRqCswfNYHRl73PM";
const apiKey = "AIzaSyB5VIy4kIySW7bVrjNYMpL5rkqZ7Oe758E";

const sheets = {
    master: encodeURIComponent("Master Data 2026"),
    fees: encodeURIComponent("Fees Collection"),
    aw: encodeURIComponent("AW"),
    ds: encodeURIComponent("DS n Notice"),
    att: encodeURIComponent("Attendance")
};

let originalDiscount = 0;
let globalNotification = "No notification to show";
let deferredPrompt;

document.addEventListener("DOMContentLoaded", () => {
    const savedCode = localStorage.getItem("portalLoginCode");
    const savedView = localStorage.getItem("currentView") || "view-dashboard";
    const loginBox = document.getElementById("loginBox");
    const loader = document.getElementById("loader");

    if (savedCode) {
        login(true, savedView);
    } else {
        loader.style.display = "none";
        loginBox.style.display = "block";
    }

    setTimeout(() => {
        if (loader.style.display !== "none" && document.getElementById("portal").style.display === "none") {
            loader.style.display = "none";
            loginBox.style.display = "block";
        }
    }, 8000);

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
    const portal = document.getElementById("portal");
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
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.ds}?key=${apiKey}`,
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheets.att}?key=${apiKey}`
        ];

        const responses = await Promise.all(urls.map(url => fetch(url)));
        const data = await Promise.all(responses.map(res => res.json()));

        if (!data[0].values) throw new Error("Could not fetch data");

        const student = data[0].values.find(r => r[29] && r[29].trim() === code);
        
        if (!student) {
            if (!isAuto) alert("Invalid Login Code");
            logout();
            return;
        }

        const mRow = (data[1].values || []).find(r => r[1] == student[1]);
        if (!mRow) {
            alert("Master Data missing.");
            logout();
            return;
        }

        localStorage.setItem("portalLoginCode", code);

        // CLEAR AND POPULATE
        handlePermissions(data[3].values);
        populateStudentProfile(student, mRow);
        renderFees(student[1], mRow, data[2].values);
        setupDateSheet(data[3].values, mRow[14]);
        renderAttendance(student[1], data[4].values);

        // FINAL UI TRANSITION
        loader.style.display = "none";
        loginBox.style.display = "none"; // Explicitly hide login
        portal.style.display = "block";   // Explicitly show portal
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

// --- ATTENDANCE LOGIC ---
function renderAttendance(adm, rows) {
    if (!rows || rows.length < 4) return;
    
    // Find student row starting from C4 (index 3)
    const studentRow = rows.slice(3).find(r => r[2] == adm);
    const months = [
        { name: "April", col: 33 },   // AH
        { name: "May", col: 65 },     // BN
        { name: "June", col: 96 },    // CS
        { name: "July", col: 128 },   // DY
        { name: "August", col: 160 }, // FE
        { name: "September", col: 191 }, // GJ
        { name: "October", col: 223 },   // HP
        { name: "November", col: 254 },  // IU
        { name: "December", col: 286 },  // KA
        { name: "January", col: 318 },   // LG
        { name: "February", col: 348 },  // MK
        { name: "March", col: 380 }      // NQ
    ];

    let html = "";
    let cardsHtml = "";

    if (studentRow) {
        months.forEach(m => {
            let val = studentRow[m.col] || "0";
            html += `<tr><td>${m.name}</td><td>${val}</td></tr>`;
            cardsHtml += `<div class="att-card"><span class="label">${m.name}:</span> ${val}</div>`;
        });
    } else {
        html = "<tr><td colspan='2'>No attendance records found</td></tr>";
        cardsHtml = "No attendance records found";
    }

    document.getElementById("attBody").innerHTML = html;
    document.getElementById("attCards").innerHTML = cardsHtml;
}

// --- REST OF THE FUNCTIONS (SAME AS ORIGINAL) ---

function showView(viewId, isHardwareBack = false) {
    const views = ['view-dashboard', 'view-fees', 'view-attendance', 'view-datesheet', 'view-result'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if(el) el.style.display = (v === viewId) ? 'block' : 'none';
    });
    localStorage.setItem("currentView", viewId);
    if (!isHardwareBack && viewId !== 'view-dashboard') history.pushState({view: viewId}, "");
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
            cardsHtml += `<div class="fee-card"><b>Date:</b> ${r[1]} | <b>Amt:</b> ₹${amt}<br><b>Type:</b> ${r[6]}</div>`;
        }
    });

    document.getElementById("feeTable").innerHTML = tableHtml || "<tr><td colspan='9'>No records</td></tr>";
    document.getElementById("feeCards").innerHTML = cardsHtml || "No records";
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
    if (rows[19]?.[10] === "Publish") globalNotification = rows[20]?.[9] || "No notification";
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
    if(b1) b1.onclick = handler;
}

function showNotification() {
    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;";
    overlay.innerHTML = `<div style="background:white; padding:20px; border-radius:10px; max-width:400px; width:100%; text-align:center;">
        <h3 style="color:#0b3d91;">📢 School Notice</h3>
        <p style="white-space:pre-wrap; text-align:left;">${globalNotification}</p>
        <button onclick="this.parentElement.parentElement.remove()" style="background:#0b3d91; color:white; border:none; padding:10px 20px; border-radius:5px;">Close</button>
    </div>`;
    document.body.appendChild(overlay);
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
